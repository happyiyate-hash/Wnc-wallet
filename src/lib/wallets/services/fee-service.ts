
'use client';

import { ethers } from 'ethers';
import axios from 'axios';
import * as xrpl from 'xrpl';
import { Connection } from '@solana/web3.js';

/**
 * INSTITUTIONAL GAS FEE SERVICE
 * Version: 1.0.0
 * Handles multi-chain fee discovery via verified RPC and Mempool nodes.
 */

export interface FeeResult {
  gasPriceGwei?: string;
  nativeFee: string;
  usdFee: number;
  estimatedTime: string;
  satPerVByte?: number; // Bitcoin specific
}

export async function fetchChainFees(
  chainType: string,
  rpcUrl: string,
  symbol: string,
  apiKey: string | null
): Promise<FeeResult> {
  try {
    switch (chainType) {
      case 'btc':
        return await fetchBitcoinFees();
      case 'solana':
        return await fetchSolanaFees(rpcUrl);
      case 'xrp':
        return await fetchXrpFees(rpcUrl);
      case 'evm':
      default:
        return await fetchEvmFees(rpcUrl, apiKey);
    }
  } catch (error) {
    console.warn(`[FEE_SERVICE_ADVISORY] Failed to fetch fees for ${chainType}:`, error);
    return {
      nativeFee: '0',
      usdFee: 0,
      estimatedTime: 'Unknown'
    };
  }
}

/**
 * BTC: Fetch from Mempool.space
 */
async function fetchBitcoinFees(): Promise<FeeResult> {
  const { data } = await axios.get('https://mempool.space/api/v1/fees/recommended');
  const satPerVByte = data.hourFee; // Standard economy rate
  const avgTxSize = 140; // vBytes for a standard P2WPKH transfer
  const totalSats = satPerVByte * avgTxSize;
  const nativeFee = (totalSats / 100_000_000).toFixed(8);

  return {
    nativeFee,
    usdFee: 0, // Calculated by the hook based on live prices
    estimatedTime: '~60m',
    satPerVByte
  };
}

/**
 * EVM: Fetch via JsonRpcProvider
 */
async function fetchEvmFees(rpcUrl: string, apiKey: string | null): Promise<FeeResult> {
  const finalRpc = rpcUrl.replace('{API_KEY}', apiKey || '');
  const provider = new ethers.JsonRpcProvider(finalRpc, undefined, { staticNetwork: true });
  
  const feeData = await provider.getFeeData();
  const gasPrice = feeData.gasPrice || BigInt(0);
  const standardLimit = BigInt(21000); // Standard transfer
  const totalWei = gasPrice * standardLimit;

  return {
    gasPriceGwei: ethers.formatUnits(gasPrice, 'gwei'),
    nativeFee: ethers.formatUnits(totalWei, 'ether'),
    usdFee: 0,
    estimatedTime: '~15s'
  };
}

/**
 * Solana: Fetch via Connection
 */
async function fetchSolanaFees(rpcUrl: string): Promise<FeeResult> {
  const connection = new Connection(rpcUrl, 'confirmed');
  const { feeCalculator } = await connection.getRecentBlockhash();
  const lamportsPerSignature = feeCalculator.lamportsPerSignature;
  
  // Standard transfer is 1 signature
  const nativeFee = (lamportsPerSignature / 1_000_000_000).toFixed(9);

  return {
    nativeFee,
    usdFee: 0,
    estimatedTime: '~5s'
  };
}

/**
 * XRP: Fetch via WebSocket
 */
async function fetchXrpFees(rpcUrl: string): Promise<FeeResult> {
  const client = new xrpl.Client(rpcUrl);
  await client.connect();
  const response = await client.request({ command: 'fee' });
  await client.disconnect();

  const drops = response.result.drops.median_fee;
  const nativeFee = xrpl.dropsToXrp(drops);

  return {
    nativeFee,
    usdFee: 0,
    estimatedTime: '~3s'
  };
}
