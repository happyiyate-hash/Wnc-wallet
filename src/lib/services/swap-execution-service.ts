
'use client';

import { supabase } from '@/lib/supabase/client';
import type { SwapTransaction } from '@/lib/types';
import { calculateSwapFees } from './swap-fee-calculator';
import { adminExecutor } from './admin-executor';

/**
 * INSTITUTIONAL SWAP EXECUTION SERVICE
 * Version: 1.1.0
 * 
 * Handles the logic-gated lifecycle of a liquidity-provided swap.
 * Orchestrates the handshake between user deposit and admin payout.
 */

// In production, these addresses are securely fetched from a vault or environment
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
  toAmountExpected: number;
  adminFeeUsd: number;
  networkFeeUsd: number;
  recipientAddress: string;
}

export const swapExecutionService = {
  /**
   * STEP 1: Initiate Swap Request
   * Creates a pending record in the institutional registry.
   */
  async initiateSwap(input: InitiateSwapInput): Promise<{ swapId: string; adminAddress: string }> {
    if (!supabase) throw new Error("Registry offline.");

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
   * STEP 2: Verify User Deposit
   * In a production environment, this is triggered by a blockchain listener.
   * Records the hash and moves status to 'user_sent'.
   */
  async recordUserDeposit(swapId: string, txHash: string) {
    if (!supabase) return;

    const { error } = await supabase
      .from('swaps')
      .update({
        user_tx_hash: txHash,
        status: 'user_sent'
      })
      .eq('id', swapId);

    if (error) throw error;
  },

  /**
   * STEP 3: Execute Admin Payout
   * Logic for the admin wallet to send the output token to the user.
   */
  async executeAdminPayout(swapId: string) {
    if (!supabase) return;

    // 1. Fetch full swap context from registry
    const { data: swap, error: fetchErr } = await supabase
      .from('swaps')
      .select('*')
      .eq('id', swapId)
      .single();

    if (fetchErr || !swap) throw new Error("SWAP_NOT_FOUND");
    if (swap.status !== 'user_sent') throw new Error("SWAP_DEPOSIT_NOT_VERIFIED");

    try {
      // 2. Resolve destination address from user profile
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

      // 3. Trigger Admin Dispatch
      const txHash = await adminExecutor.executeAdminTransfer({
        toAddress: targetAddress,
        amount: swap.to_amount_expected,
        tokenSymbol: swap.to_symbol,
        chainId: 1, // Logic to resolve from registry
        chainType: chainKey === 'solana' ? 'solana' : chainKey === 'xrp' ? 'xrp' : 'evm'
      });

      // 4. Update status to completed
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
