
'use client';

import { fetchChainFees } from '@/lib/wallets/services/fee-service';

/**
 * INSTITUTIONAL GAS PRICE SERVICE
 * Version: 3.0.0
 * 
 * Centralized registry for multi-chain gas discovery and caching.
 * Exposes real-time price data and estimated fees for all 39 blockchains.
 */

export interface GasData {
  priceGwei: string;
  nativeFee: string;
  usdFee: number;
}

// Global Singleton Cache for direct property access if preferred
export const gasCache: Record<string, GasData> = {};

class GasService {
  private interval: NodeJS.Timeout | null = null;
  private listeners: Set<() => void> = new Set();

  constructor() {}

  /**
   * Dispatches a network handshake to the fee gateway.
   */
  async fetchGas(chain: any, apiKey: string | null) {
    if (!chain || !chain.rpcUrl) return;
    try {
      const result = await fetchChainFees(
        chain.type || 'evm',
        chain.rpcUrl,
        chain.symbol,
        apiKey
      );
      
      const data: GasData = {
        priceGwei: result.gasPriceGwei || (result.satPerVByte ? `${result.satPerVByte} sat/vB` : '0'),
        nativeFee: result.nativeFee || '0',
        usdFee: result.usdFee || 0.05
      };

      gasCache[chain.name] = data;
      this.notify();
    } catch (e) {
      // Handshake deferred: node unreachable or rate limited
    }
  }

  private notify() {
    this.listeners.forEach(l => l());
  }

  /**
   * Subscribe to registry updates for reactive UI synchronization.
   */
  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Returns the latest gas price for the specified blockchain.
   */
  getGasPrice(chainName: string): GasData | null {
    if (!chainName) return null;
    return gasCache[chainName] || null;
  }

  /**
   * Returns an estimated transaction fee for sending or swapping.
   */
  getEstimatedTransactionFee(chainName: string, txType: 'send' | 'swap'): number {
    const data = this.getGasPrice(chainName);
    if (!data) return 0.05;
    // Multi-step swaps typically consume more gas (estimated at 2x base send)
    return txType === 'send' ? data.usdFee : data.usdFee * 2;
  }

  /**
   * Starts a background process that refreshes gas prices every 10 seconds.
   */
  startGasUpdater(chains: any[], apiKey: string | null) {
    if (this.interval || chains.length === 0) return;
    
    const run = () => {
      // Batch refresh all chains in the registry
      chains.forEach(c => this.fetchGas(c, apiKey));
    };
    
    run();
    this.interval = setInterval(run, 10000);
  }

  /**
   * Bulk fetch helper compatible with functional patterns.
   */
  async fetchAllGasFees(chains: any[], apiKey: string | null): Promise<GasData[]> {
    await Promise.all(chains.map(c => this.fetchGas(c, apiKey)));
    return Object.values(gasCache);
  }
}

export const gasService = new GasService();
