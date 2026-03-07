'use client';

import { swapExecutionService } from '@/lib/services/swap-execution-service';
import { ethers } from 'ethers';
import type { AssetRow } from '@/lib/types';

/**
 * INTERNAL LIQUIDITY PROVIDER ENGINE
 * Version: 1.0.0
 * Handles non-EVM and P2P liquidity swaps.
 */

export async function fetchLiquidityQuote(params: {
  amount: string;
  fromTokenPrice: number;
  toTokenPrice: number;
  networkFeeUsd: number;
}) {
  const divisor = params.toTokenPrice || 1;
  const estAmt = (parseFloat(params.amount) * params.fromTokenPrice) / divisor;
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

  if (isPivot) setPhase('PIVOT_CONVERTING');
  else setPhase('LIQUIDITY');

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

  setPhase('SETTLING');
  const receipt = await userTx.wait();

  if (isPivot) setPhase('PIVOT_FINALIZING');

  await fetch('/api/swap/finalize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ swapId: handshake.swapId, txHash: receipt.hash })
  });

  return receipt;
}
