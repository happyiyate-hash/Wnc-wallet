'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { fetchGlobalMarketData, type PriceResult } from '@/lib/market/price-service';
import { useCurrency } from './currency-provider';
import type { AssetRow, ChainConfig } from '@/lib/types';
import evmNetworks from '@/lib/evmNetworks.json';

interface MarketContextType {
  prices: PriceResult;
  isMarketLoading: boolean;
  refreshPrices: (chains: ChainConfig[], customTokens: AssetRow[]) => Promise<void>;
  registerCustomTokens: (tokens: AssetRow[]) => void;
}

const MarketContext = createContext<MarketContextType | undefined>(undefined);

const PRICE_UPDATE_INTERVAL = 30000; // 30 seconds
const PRICE_CACHE_KEY = 'ss-price-cache-global';

/**
 * INSTITUTIONAL INDEPENDENT MARKET ENGINE
 * Version: 5.0.0 (Zero-Dependency Discovery)
 * 
 * Operates independently of Auth and Wallet state.
 * Loads cached global prices instantly on boot.
 */
export function MarketProvider({ children }: { children: ReactNode }) {
  const { rates } = useCurrency();
  const [prices, setPrices] = useState<PriceResult>({});
  const [isMarketLoading, setIsMarketLoading] = useState(true);
  
  const customTokensRef = useRef<AssetRow[]>([]);

  const registerCustomTokens = useCallback((tokens: AssetRow[]) => {
    customTokensRef.current = tokens;
  }, []);

  const updatePrices = useCallback((newPrices: PriceResult) => {
    setPrices(prev => {
      const merged = { ...prev, ...newPrices };
      localStorage.setItem(PRICE_CACHE_KEY, JSON.stringify({ 
        data: merged, 
        timestamp: Date.now() 
      }));
      return merged;
    });
  }, []);

  const refreshPrices = useCallback(async () => {
    try {
      const allChains = Object.values(evmNetworks) as ChainConfig[];
      const newPrices = await fetchGlobalMarketData(allChains, customTokensRef.current, rates);
      updatePrices(newPrices);
    } catch (e) {
      console.warn("[MARKET_ENGINE_ADVISORY] Global price handshake deferred.");
    } finally {
      setIsMarketLoading(false);
    }
  }, [rates, updatePrices]);

  // INITIAL HYDRATION: Immediate Cache Load
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const cached = localStorage.getItem(PRICE_CACHE_KEY);
    if (cached) {
      try {
        const { data } = JSON.parse(cached);
        setPrices(data);
        setIsMarketLoading(false);
      } catch (e) {}
    }

    // Start background polling immediately
    refreshPrices();
    const interval = setInterval(refreshPrices, PRICE_UPDATE_INTERVAL);
    return () => clearInterval(interval);
  }, [refreshPrices]);

  return (
    <MarketContext.Provider value={{ prices, isMarketLoading, refreshPrices, registerCustomTokens }}>
      {children}
    </MarketContext.Provider>
  );
}

export const useMarket = () => {
  const context = useContext(MarketContext);
  if (context === undefined) throw new Error('useMarket must be used within MarketProvider');
  return context;
};
