
'use client';

import { supabase } from '@/lib/supabase/client';
import { calculateSwapFees, validateSwapAmount } from './swap-fee-calculator';
import { adminExecutor } from './admin-executor';

/**
 * INSTITUTIONAL SWAP EXECUTION SERVICE
 * Version: 1.2.0
 * 
 * Orchestrates the lifecycle of liquidity-provided swaps.
 * Enforces minimum swap rules and multi-chain admin settlement.
 */

const ADMIN_WALLET_MAP: { [chain: string]: string } = {
  'ethereum': '0xAdminEthVaultAddress',
  'evm': '0xAdminEvmVaultAddress',
  'bitcoin': 'bc1qAdminBtcVaultAddress',
  'solana': 'AdminSolanaVaultAddress',
  'xrp': 'rAdminXrpVaultAddress',
  'tron': 'TAdminTronVaultAddress'
};

export interface InitiateSwapInput {
  userId: string;
  fromChain: string;
  toChain: string;
  fromSymbol: string;
  toSymbol: string;
  fromAmount: number;
  fromTokenPriceUsd: number;
  toAmountExpected: number;
  adminFeeUsd: number;
  networkFeeUsd: number;
  recipientAddress: string;
}

export const swapExecutionService = {
  /**
   * STEP 1: Initiate Swap Request
   * Validates minimum limits and creates a pending record in the registry.
   */
  async initiateSwap(input: InitiateSwapInput): Promise<{ swapId: string; adminAddress: string }> {
    if (!supabase) throw new Error("Registry offline.");

    // 1. Enforce Institutional Minimums
    validateSwapAmount(input.fromAmount, input.fromSymbol, input.fromTokenPriceUsd);

    const adminAddress = ADMIN_WALLET_MAP[input.fromChain.toLowerCase()] || 
                         ADMIN_WALLET_MAP['evm'];

    if (!adminAddress) {
      throw new Error(`Liquidity node for ${input.fromChain} not available.`);
    }

    const { data, error } = await supabase
      .from('swaps')
      .insert({
        user_id: input.userId,
        from_chain: input.fromChain,
        to_chain: input.toChain,
        from_symbol: input.fromSymbol,
        to_symbol: input.toSymbol,
        from_amount: input.fromAmount,
        to_amount_expected: input.toAmountExpected,
        admin_fee_usd: input.adminFeeUsd,
        network_fee_usd: input.networkFeeUsd,
        status: 'pending',
        created_at: new Date().toISOString()
      })
      .select('id')
      .single();

    if (error) {
      console.error("[SWAP_INIT_FAIL]", error);
      throw new Error("Failed to initialize swap handshake.");
    }

    return { 
      swapId: data.id, 
      adminAddress 
    };
  },

  /**
   * STEP 2: Verify User Deposit & Trigger Admin Settlement
   */
  async recordUserDepositAndSettle(swapId: string, userTxHash: string) {
    if (!supabase) return;

    // A. Record the incoming deposit
    const { error: updateErr } = await supabase
      .from('swaps')
      .update({
        user_tx_hash: userTxHash,
        status: 'user_sent'
      })
      .eq('id', swapId);

    if (updateErr) throw updateErr;

    // B. Trigger the Admin Payout (Async Settlement)
    return await this.executeAdminPayout(swapId);
  },

  /**
   * Internal Settlement logic using the Admin Execution Engine.
   */
  async executeAdminPayout(swapId: string) {
    if (!supabase) return;

    const { data: swap, error: fetchErr } = await supabase
      .from('swaps')
      .select('*')
      .eq('id', swapId)
      .single();

    if (fetchErr || !swap) throw new Error("SWAP_NOT_FOUND");

    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', swap.user_id)
        .single();

      if (!profile) throw new Error("USER_PROFILE_MISSING");

      const chainKey = swap.to_chain.toLowerCase();
      const targetAddress = chainKey === 'solana' ? profile.solana_address : 
                            chainKey === 'xrp' ? profile.xrp_address : 
                            profile.evm_address;

      if (!targetAddress) throw new Error(`USER_${chainKey.toUpperCase()}_ADDRESS_MISSING`);

      // SIGN & BROADCAST from Admin Liquidity Pool
      const txHash = await adminExecutor.executeAdminTransfer({
        toAddress: targetAddress,
        amount: swap.to_amount_expected,
        tokenSymbol: swap.to_symbol,
        chainId: 1, 
        chainType: chainKey === 'solana' ? 'solana' : chainKey === 'xrp' ? 'xrp' : 'evm'
      });

      await supabase
        .from('swaps')
        .update({
          admin_tx_hash: txHash,
          status: 'completed'
        })
        .eq('id', swapId);

      return txHash;

    } catch (e: any) {
      console.error("[SWAP_PAYOUT_FAIL]", e);
      await supabase.from('swaps').update({ status: 'failed' }).eq('id', swapId);
      throw e;
    }
  }
};
