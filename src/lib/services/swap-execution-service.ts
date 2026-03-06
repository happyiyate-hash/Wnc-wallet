
'use client';

import { supabase } from '@/lib/supabase/client';
import { validateSwapAmount } from './swap-fee-calculator';
import { adminExecutor } from './admin-executor';
import { getFeeRecipient } from '../wallets/services/fee-recipients';
import type { AssetRow, ChainConfig } from '@/lib/types';
import { fetchBalancesForChain } from '../wallets/services/balance-service';

/**
 * INSTITUTIONAL SWAP EXECUTION SERVICE
 * Version: 1.8.0 (Liquidity Guard Update)
 * 
 * Orchestrates the lifecycle of liquidity-provided swaps.
 * Synchronized with the centralized fee-recipients registry.
 */

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
   * Checks if the platform's admin vault has enough liquidity to fulfill a trade.
   */
  async checkAdminLiquidity(
    chain: ChainConfig, 
    token: AssetRow, 
    requiredAmount: number, 
    infuraKey: string | null
  ): Promise<boolean> {
    try {
      const adminAddress = getFeeRecipient(chain.name);
      if (!adminAddress) return false;

      // Wrap admin address in a temporary metadata structure for the balance service
      const adminWallet = [{
        address: adminAddress,
        type: chain.type || 'evm'
      }] as any;

      const results = await fetchBalancesForChain(chain, adminWallet, infuraKey, []);
      const tokenResult = results.find(r => 
        token.isNative ? r.isNative : r.address?.toLowerCase() === token.address?.toLowerCase()
      );

      if (!tokenResult) return false;

      const adminBalance = parseFloat(tokenResult.balance || '0');
      // Add a 5% buffer to admin liquidity check for safety
      return adminBalance >= (requiredAmount * 1.05);
    } catch (e) {
      console.warn("[LIQUIDITY_GUARD_ADVISORY] Failed to verify admin node.");
      return false;
    }
  },

  /**
   * STEP 1: Initiate Swap Handshake
   * Validates limits and creates a locked registry node.
   */
  async initiateSwap(input: InitiateSwapInput): Promise<{ swapId: string; adminAddress: string }> {
    if (!supabase) throw new Error("Registry offline.");

    // 1. Enforce Institutional Minimums
    validateSwapAmount(input.fromAmount, input.fromSymbol, input.fromTokenPriceUsd);

    // 2. Resolve Admin Deposit Node from Central Registry
    const adminAddress = getFeeRecipient(input.fromChain);

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
      .select('*')
      .from('swaps')
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
      // Use unified property resolution logic
      const targetAddress = chainKey.includes('solana') ? profile.solana_address : 
                            chainKey.includes('xrp') ? profile.xrp_address : 
                            profile.evm_address;

      if (!targetAddress) throw new Error(`RECIPIENT_${chainKey.toUpperCase()}_NODE_MISSING`);

      // BROADCAST FROM ADMIN VAULT
      const txHash = await adminExecutor.executeAdminTransfer({
        toAddress: targetAddress,
        amount: swap.to_amount_expected,
        tokenSymbol: swap.to_symbol,
        chainId: 1, 
        chainType: chainKey.includes('solana') ? 'solana' : chainKey.includes('xrp') ? 'xrp' : 'evm'
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
