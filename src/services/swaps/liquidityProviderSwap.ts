'use client';

import { swapExecutionService } from '@/lib/services/swap-execution-service';
import { ethers } from 'ethers';
import type { AssetRow } from '@/lib/types';

/**
 * INTERNAL LIQUIDITY PROVIDER ENGINE
 * Version: 2.0.0 (Pivot Standardization & Progress Guard)
 * 
 * Orchestrates multi-step swaps by standardizing through stable nodes.
 * Automatically communicates progress states to the UI dispatcher.
 */

export async function fetchLiquidityQuote(params: {
  amount: string;
  fromTokenPrice: number;
  toTokenPrice: number;
  networkFeeUsd: number;
}) {
  // ATOMIC CALCULATION: (Amount * Rate) - Network Buffer Fees
  const divisor = params.toTokenPrice || 1;
  const estAmt = (parseFloat(params.amount) * params.fromTokenPrice) / divisor;
  
  // Apply secret admin spread + buffer
  const finalReceive = Math.max(0, estAmt - (params.networkFeeUsd / divisor));

  return {
    receiveAmount: finalReceive
  };
}

export async function executeLiquiditySwap(params: {
  amount: string;
  fromToken: AssetRow;
  toToken: AssetRow;
  fromTokenPrice: number;
  receiveAmount: number;
  totalFeeUsd: number;
  userId: string;
  recipientAddress: string;
  wallet: ethers.Wallet;
  isPivot: boolean;
  setPhase: (phase: any) => void;
}) {
  const { amount, fromToken, toToken, fromTokenPrice, receiveAmount, totalFeeUsd, userId, recipientAddress, wallet, isPivot, setPhase } = params;

  try {
    // 1. INITIAL HANDSHAKE
    if (isPivot) setPhase('PIVOT_CONVERTING');
    else setPhase('VERIFYING');

    const handshakeRes = await fetch('/api/swap/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fromChain: fromToken.name,
        toChain: toToken.name,
        fromSymbol: fromToken.symbol,
        toSymbol: toToken.symbol,
        fromAmount: parseFloat(amount),
        fromTokenPriceUsd: fromTokenPrice,
        toAmountExpected: receiveAmount,
        adminFeeUsd: totalFeeUsd * 0.5,
        networkFeeUsd: totalFeeUsd * 0.5,
        recipientAddress: recipientAddress
      })
    });

    const handshake = await handshakeRes.json();
    if (!handshake.success) throw new Error(handshake.error || "Registry Handshake Denied.");

    // 2. DISPATCH LEG 1 (User -> Admin)
    if (isPivot) setPhase('PIVOT_BRIDGING');
    else setPhase('SENDING');

    let userTx;
    if (fromToken.isNative) {
      userTx = await wallet.sendTransaction({
        to: handshake.adminAddress,
        value: ethers.parseEther(amount)
      });
    } else {
      const contract = new ethers.Contract(fromToken.address, ["function transfer(address to, uint256 amount) returns (bool)"], wallet);
      userTx = await contract.transfer(handshake.adminAddress, ethers.parseUnits(amount, fromToken.decimals || 18));
    }

    // 3. SETTLEMENT HANDSHAKE
    setPhase('SETTLING');
    const receipt = await userTx.wait();

    // 4. TRIGGER FINAL LEG (Admin -> User)
    if (isPivot) setPhase('PIVOT_FINALIZING');

    const finalizeRes = await fetch('/api/swap/finalize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ swapId: handshake.swapId, txHash: receipt.hash })
    });

    const finalize = await finalizeRes.json();
    if (!finalize.success) throw new Error(finalize.error || "Institutional Settlement Error");

    return receipt;
  } catch (error: any) {
    console.error("[INTERNAL_SWAP_FAIL]", error);
    throw error;
  }
}
