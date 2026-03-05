
'use client';

import { ethers } from 'ethers';
import axios from 'axios';
import * as xrpl from 'xrpl';
import { Connection } from '@solana/web3.js';
import evmNetworks from '@/lib/evmNetworks.json';
import { ChainConfig } from '@/lib/types';

/**
 * INSTITUTIONAL GAS FEE SERVICE
 * Version: 1.1.0
 * Handles multi-chain fee discovery via verified RPC and Mempool nodes.
 */

export interface FeeResult {
  gasPriceGwei?: string;
  nativeFee: string;
  usdFee: number;
  estimatedTime: string;
  satPerVByte?: number; // Bitcoin specific
}

/**
 * Simplified helper to fetch gas fees by chain key.
 * Resolves chain config from the institutional registry.
 */
export async function getGasFee(chainKey: string, apiKey: string | null = null) {
  const allChains = Object.values(evmNetworks) as ChainConfig[];
  const chain = allChains.find(c => 
    c.name.toLowerCase() === chainKey.toLowerCase() || 
    c.symbol.toLowerCase() === chainKey.toLowerCase() ||
    c.type?.toLowerCase() === chainKey.toLowerCase()
  );

  if (!chain) {
    console.warn(`[FEE_SERVICE] Chain key "${chainKey}" not found in registry.`);
    return { estimatedFeeNative: '0', estimatedFeeUSD: 0 };
  }

  const result = await fetchChainFees(
    chain.type || 'evm',
    chain.rpcUrl,
    chain.symbol,
    apiKey
  );

  return {
    estimatedFeeNative: result.nativeFee,
    estimatedFeeUSD: result.usdFee > 0 ? result.usdFee : 0.05 // Default fallback for UI consistency
  };
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

async function fetchBitcoinFees(): Promise<FeeResult> {
  const { data } = await axios.get('https://mempool.space/api/v1/fees/recommended');
  const satPerVByte = data.hourFee; 
  const avgTxSize = 140; 
  const totalSats = satPerVByte * avgTxSize;
  const nativeFee = (totalSats / 100_000_000).toFixed(8);

  return {
    nativeFee,
    usdFee: 0, 
    estimatedTime: '~60m',
    satPerVByte
  };
}

async function fetchEvmFees(rpcUrl: string, apiKey: string | null): Promise<FeeResult> {
  const finalRpc = rpcUrl.replace('{API_KEY}', apiKey || '');
  const provider = new ethers.JsonRpcProvider(finalRpc, undefined, { staticNetwork: true });
  
  const feeData = await provider.getFeeData();
  const gasPrice = feeData.gasPrice || BigInt(0);
  const standardLimit = BigInt(21000); 
  const totalWei = gasPrice * standardLimit;

  return {
    gasPriceGwei: ethers.formatUnits(gasPrice, 'gwei'),
    nativeFee: ethers.formatUnits(totalWei, 'ether'),
    usdFee: 0,
    estimatedTime: '~15s'
  };
}

async function fetchSolanaFees(rpcUrl: string): Promise<FeeResult> {
  const connection = new Connection(rpcUrl, 'confirmed');
  const { feeCalculator } = await connection.getRecentBlockhash();
  const lamportsPerSignature = feeCalculator.lamportsPerSignature;
  const nativeFee = (lamportsPerSignature / 1_000_000_000).toFixed(9);

  return {
    nativeFee,
    usdFee: 0,
    estimatedTime: '~5s'
  };
}

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
