'use client';

/**
 * INSTITUTIONAL GAS PRICE SERVICE
 * Version: 1.0.0
 * Centralized registry for multi-chain gas discovery and caching.
 * Exposes real-time price data and estimated fees for terminal dispatches.
 */

export interface GasData {
  priceGwei: string;
  nativeFee: string;
  usdFee: number;
}

class GasService {
  private cache: Record<string, GasData> = {};
  private interval: NodeJS.Timeout | null = null;
  private listeners: Set<() => void> = new Set();

  constructor() {}

  /**
   * Dispatches a network handshake to the fee gateway.
   */
  async fetchGas(chain: any, apiKey: string | null) {
    if (!chain || !chain.rpcUrl) return;
    try {
      const params = new URLSearchParams({
        chainType: chain.type || 'evm',
        rpcUrl: chain.rpcUrl,
        symbol: chain.symbol,
        apiKey: apiKey || ''
      });
      
      const response = await fetch(`/api/fees?${params.toString()}`);
      if (!response.ok) return;
      const result = await response.json();
      
      this.cache[chain.name] = {
        priceGwei: result.gasPriceGwei || '0',
        nativeFee: result.nativeFee || '0',
        usdFee: result.usdFee || 0.05
      };
      
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
    return this.cache[chainName] || null;
  }

  /**
   * Returns an estimated transaction fee for sending or swapping.
   */
  getEstimatedTransactionFee(chainName: string, txType: 'send' | 'swap'): number {
    const data = this.getGasPrice(chainName);
    if (!data) return 0.05;
    // Multi-step swaps typically consume 2x basic transfer gas
    return txType === 'send' ? data.usdFee : data.usdFee * 2;
  }

  /**
   * Starts a background process that refreshes gas prices every 10 seconds.
   */
  startGasUpdater(chains: any[], apiKey: string | null) {
    if (this.interval || chains.length === 0) return;
    
    const run = () => {
      chains.forEach(c => this.fetchGas(c, apiKey));
    };
    
    run();
    this.interval = setInterval(run, 10000);
  }
}

export const gasService = new GasService();
