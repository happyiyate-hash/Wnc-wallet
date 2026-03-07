
'use client';

/**
 * WARNING: Do NOT modify UI in this file.
 * Only add functions for fetching quotes and executing swaps.
 * 
 * 0X PROTOCOL SWAP ENGINE
 * Version: 2.0.0 (Robust Handshake & Institutional Fees)
 * Handles same-chain EVM swaps via the 0x Aggregator Proxy.
 */

import { zeroXService } from '@/lib/services/zerox-service';
import { ethers } from 'ethers';
import type { AssetRow } from '@/lib/types';

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

/**
 * Executes an async function with institutional retry logic.
 */
async function withRetry<T>(fn: () => Promise<T>, retries = MAX_RETRIES): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err: any) {
      if (i === retries - 1) throw err;
      // Exponential backoff for network resilience
      await new Promise(r => setTimeout(r, RETRY_DELAY_MS * (i + 1)));
    }
  }
  throw new Error("RETRY_LIMIT_EXCEEDED");
}

export interface ZeroXQuoteResult {
  receiveAmount: number;
  feeUsd: number;
  rawQuote: any;
  success: boolean;
  error?: string;
}

/**
 * Fetches an indicative price from the 0x protocol.
 * Note: The 1.00% platform fee is applied server-side by the proxy.
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
}): Promise<ZeroXQuoteResult> {
  try {
    const p = await withRetry(() => 
      zeroXService.getPrice(
        params.chainId,
        params.sellToken,
        params.buyToken,
        params.sellAmount,
        params.takerAddress
      )
    );

    // Calculate estimated network cost
    const gasCostEth = (parseFloat(p.estimatedGas || '21000') * parseFloat(p.gasPrice || '1000000000')) / 1e18;
    const gasCostUsd = gasCostEth * params.ethPrice;

    // buyAmount returned by proxy already has the 1% fee deducted per 0x specs
    const receiveAmount = parseFloat(ethers.formatUnits(p.buyAmount, params.toTokenDecimals));

    return {
      receiveAmount,
      feeUsd: gasCostUsd + 0.10, // Base gas + volatility buffer
      rawQuote: p,
      success: true
    };
  } catch (e: any) {
    console.error("[0X_QUOTE_ENGINE_FAIL]", e.message);
    return {
      receiveAmount: 0,
      feeUsd: 0,
      rawQuote: null,
      success: false,
      error: e.message || "0x Protocol Sync Failure"
    };
  }
}

/**
 * Executes a 0x swap by signing and broadcasting the transaction.
 */
export async function executeZeroXSwap(params: {
  chainId: number;
  rawQuote: any;
  wallet: ethers.Wallet;
  fromToken: AssetRow;
  amount: string;
  setPhase: (phase: any) => void;
}) {
  const { chainId, fromToken, amount, wallet, setPhase } = params;

  try {
    setPhase('LIQUIDITY');
    const sellId = fromToken.isNative ? (fromToken.chainId === 1 ? 'ETH' : '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee') : fromToken.address;
    
    // Fetch execution-ready quote with retries
    const q = await withRetry(() => 
      zeroXService.getQuote(
        chainId,
        sellId,
        params.rawQuote.buyTokenAddress,
        ethers.parseUnits(amount, fromToken.decimals || 18).toString(),
        wallet.address
      )
    );

    // 1. Handle Token Approvals for non-native assets
    if (!fromToken.isNative) {
      setPhase('APPROVING');
      const tokenContract = new ethers.Contract(
        fromToken.address,
        ["function allowance(address owner, address spender) view returns (uint256)", "function approve(address spender, uint256 amount) returns (bool)"],
        wallet
      );
      
      const allowance = await tokenContract.allowance(wallet.address, q.allowanceTarget);
      const requiredAmount = ethers.parseUnits(amount, fromToken.decimals || 18);

      if (allowance < requiredAmount) {
        const approveTx = await tokenContract.approve(q.allowanceTarget, ethers.MaxUint256);
        await approveTx.wait();
      }
    }

    // 2. Broadcast Transaction
    setPhase('SENDING');
    const tx = await wallet.sendTransaction({
      to: q.to,
      data: q.data,
      value: q.value,
      gasLimit: q.gas
    });

    return tx;
  } catch (e: any) {
    console.error("[0X_EXECUTION_ENGINE_FAIL]", e.message);
    throw new Error(e.message || "Blockchain transaction rejected.");
  }
}
