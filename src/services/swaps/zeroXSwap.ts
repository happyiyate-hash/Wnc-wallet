'use client';

import { zeroXService } from '@/lib/services/zerox-service';
import { ethers } from 'ethers';
import type { AssetRow } from '@/lib/types';

/**
 * 0X PROTOCOL SWAP ENGINE
 * Version: 1.0.0
 * Handles same-chain EVM swaps via the 0x Aggregator.
 */

export async function fetchZeroXQuote(params: {
  chainId: number;
  sellToken: string;
  buyToken: string;
  sellAmount: string;
  takerAddress: string;
  priceUsd: number;
  toTokenDecimals: number;
  ethPrice: number;
}) {
  const p = await zeroXService.getPrice(
    params.chainId,
    params.sellToken,
    params.buyToken,
    params.sellAmount,
    params.takerAddress
  );

  const gasCostEth = (parseFloat(p.estimatedGas || '21000') * parseFloat(p.gasPrice || '1000000000')) / 1e18;
  const gasCostUsd = gasCostEth * params.ethPrice;

  return {
    receiveAmount: parseFloat(ethers.formatUnits(p.buyAmount, params.toTokenDecimals)),
    feeUsd: gasCostUsd + 0.10,
    rawQuote: p
  };
}

export async function executeZeroXSwap(params: {
  chainId: number;
  rawQuote: any;
  wallet: ethers.Wallet;
  fromToken: AssetRow;
  amount: string;
  setPhase: (phase: any) => void;
}) {
  const { chainId, rawQuote, wallet, fromToken, amount, setPhase } = params;

  setPhase('LIQUIDITY');
  const sellId = fromToken.isNative ? (fromToken.chainId === 1 ? 'ETH' : '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee') : fromToken.address;
  const buyId = rawQuote.buyTokenAddress; // From the previous price check

  const q = await zeroXService.getQuote(
    chainId,
    sellId,
    buyId,
    ethers.parseUnits(amount, fromToken.decimals || 18).toString(),
    wallet.address
  );

  if (!fromToken.isNative) {
    setPhase('APPROVING');
    const tokenContract = new ethers.Contract(
      fromToken.address,
      ["function allowance(address owner, address spender) view returns (uint256)", "function approve(address spender, uint256 amount) returns (bool)"],
      wallet
    );
    const allowance = await tokenContract.allowance(wallet.address, q.allowanceTarget);
    if (allowance < ethers.parseUnits(amount, fromToken.decimals || 18)) {
      const approveTx = await tokenContract.approve(q.allowanceTarget, ethers.MaxUint256);
      await approveTx.wait();
    }
  }

  setPhase('SENDING');
  const tx = await wallet.sendTransaction({
    to: q.to,
    data: q.data,
    value: q.value,
    gasLimit: q.gas
  });

  return tx;
}
