'use client';

import { supabase } from '@/lib/supabase/client';
import { validateSwapAmount } from './swap-fee-calculator';
import { adminExecutor } from './admin-executor';

/**
 * INSTITUTIONAL SWAP EXECUTION SERVICE
 * Version: 1.6.0 (Environment Synced)
 * 
 * Orchestrates the lifecycle of liquidity-provided swaps.
 * Strictly uses the ADMIN_VAULT_ADDRESS from environment variables.
 */

const ADMIN_VAULT = process.env.NEXT_PUBLIC_ADMIN_VAULT_ADDRESS || '0x71C7656EC7ab88b098defB751B7401B5f6d8976F';

// REGISTRY: Institutional Admin Vault Addresses
const ADMIN_WALLET_MAP: { [chain: string]: string } = {
  'ethereum': ADMIN_VAULT,
  'evm': ADMIN_VAULT,
  'bitcoin': 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
  'solana': 'AdminVaultSolana1111111111111111111111111',
  'xrp': 'rHb9CJAWyUMayX9V8Gu89FWJCoDYHnC4n',
  'tron': 'TNV9Z6XYnZAnvXAnvXAnvXAnvXAnvXAnvX'
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
   * STEP 1: Initiate Swap Handshake
   * Validates limits and creates a locked registry node.
   */
  async initiateSwap(input: InitiateSwapInput): Promise<{ swapId: string; adminAddress: string }> {
    if (!supabase) throw new Error("Registry offline.");

    // 1. Enforce Institutional Minimums
    validateSwapAmount(input.fromAmount, input.fromSymbol, input.fromTokenPriceUsd);

    // 2. Resolve Admin Deposit Node
    const chainKey = input.fromChain.toLowerCase();
    const adminAddress = ADMIN_WALLET_MAP[chainKey] || ADMIN_WALLET_MAP['evm'];

    if (!adminAddress) {
      throw new Error(`Liquidity node for ${input.fromChain} not available.`);
    }

    // 3. Create Verified Ledger Entry
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

    if (error) throw new Error("Ledger handshake failed.");

    return { 
      swapId: data.id, 
      adminAddress 
    };
  },

  /**
   * STEP 2: Finalize & Settle
   * Triggered once the user leg is verified. Executes admin payout leg.
   */
  async finalizeAndSettle(swapId: string, userTxHash: string) {
    if (!supabase) return;

    // A. Update Status to User Sent
    const { error: updateErr } = await supabase
      .from('swaps')
      .update({
        user_tx_hash: userTxHash,
        status: 'user_sent'
      })
      .eq('id', swapId);

    if (updateErr) throw updateErr;

    // B. Trigger Institutional Payout (Admin -> User)
    return await this.executeAdminPayout(swapId);
  },

  /**
   * Backend Signing Node: Admin Payout
   */
  async executeAdminPayout(swapId: string) {
    if (!supabase) return;

    const { data: swap, error: fetchErr } = await supabase
      .from('swaps')
      .select('*')
      .eq('id', swapId)
      .single();

    if (fetchErr || !swap) throw new Error("SWAP_NODE_NOT_FOUND");

    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', swap.user_id)
        .single();

      if (!profile) throw new Error("IDENTITY_NODE_MISSING");

      const chainKey = swap.to_chain.toLowerCase();
      const targetAddress = chainKey === 'solana' ? profile.solana_address : 
                            chainKey === 'xrp' ? profile.xrp_address : 
                            profile.evm_address;

      if (!targetAddress) throw new Error(`RECIPIENT_${chainKey.toUpperCase()}_NODE_MISSING`);

      // BROADCAST FROM ADMIN VAULT
      const txHash = await adminExecutor.executeAdminTransfer({
        toAddress: targetAddress,
        amount: swap.to_amount_expected,
        tokenSymbol: swap.to_symbol,
        chainId: 1, 
        chainType: chainKey === 'solana' ? 'solana' : chainKey === 'xrp' ? 'xrp' : 'evm'
      });

      // Update Ledger to Completed
      await supabase
        .from('swaps')
        .update({
          admin_tx_hash: txHash,
          status: 'completed'
        })
        .eq('id', swapId);

      return txHash;

    } catch (e: any) {
      console.error("[SETTLEMENT_FAIL]", e);
      await supabase.from('swaps').update({ status: 'failed' }).eq('id', swapId);
      throw e;
    }
  }
};
