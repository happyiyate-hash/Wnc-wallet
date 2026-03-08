
'use client';

import { ethers } from 'ethers';

/**
 * LI.FI BRIDGE & SWAP ENGINE
 * Version: 2.0.0 (Unified 1.00% Fee Sync)
 */

export async function fetchLifiQuote(params: {
  fromChain: number;
  toChain: number;
  fromToken: string;
  toToken: string;
  fromAmount: string;
  fromAddress: string;
  toTokenPriceUsd: number;
  tradeValueUsd: number;
  toTokenDecimals: number;
}) {
  const query = new URLSearchParams({
    fromChain: params.fromChain.toString(),
    toChain: params.toChain.toString(),
    fromToken: params.fromToken,
    toToken: params.toToken,
    fromAmount: params.fromAmount,
    fromAddress: params.fromAddress,
    slippage: '0.005'
  });

  const res = await fetch(`/api/bridge/quote?${query.toString()}`);
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.details || err.error || "Bridge Protocol Failed.");
  }
  const q = await res.json();

  // INSTITUTIONAL FEE CALCULATION (1.00%)
  const platformFeeUsd = params.tradeValueUsd * 0.01;
  const receiveAmountReduction = platformFeeUsd / (params.toTokenPriceUsd || 1);
  const rawReceive = parseFloat(ethers.formatUnits(q.estimate.toAmount, params.toTokenDecimals));

  return {
    receiveAmount: Math.max(0, rawReceive - receiveAmountReduction),
    feeUsd: parseFloat(q.estimate.feeCosts?.[0]?.amountUsd || '2.00') + 0.10 + platformFeeUsd,
    rawQuote: q
  };
}

export async function executeLifiSwap(params: {
  rawQuote: any;
  wallet: ethers.Wallet;
  fromToken: any;
  amount: string;
  setPhase: (phase: any) => void;
}) {
  const { rawQuote, wallet, fromToken, amount, setPhase } = params;

  setPhase('LIQUIDITY');
  const q = rawQuote;
  if (!q.transactionRequest) throw new Error("Invalid LI.FI transaction request.");

  setPhase('APPROVING');
  const approvalAddress = q.estimate.approvalAddress;
  if (approvalAddress && !fromToken.isNative) {
    const tokenContract = new ethers.Contract(
      fromToken.address,
      ["function allowance(address owner, address spender) view returns (uint256)", "function approve(address spender, uint256 amount) returns (bool)"],
      wallet
    );
    const allowance = await tokenContract.allowance(wallet.address, approvalAddress);
    if (allowance < ethers.parseUnits(amount, fromToken.decimals || 18)) {
      const approveTx = await tokenContract.approve(approvalAddress, ethers.MaxUint256);
      await approveTx.wait();
    }
  }

  setPhase('SENDING');
  const tx = await wallet.sendTransaction({
    to: q.transactionRequest.to,
    data: q.transactionRequest.data,
    value: q.transactionRequest.value,
    gasLimit: q.transactionRequest.gasLimit
  });

  return tx;
}
