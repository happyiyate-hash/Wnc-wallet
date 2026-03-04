
'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { fetchGlobalMarketData, type PriceResult } from '@/lib/market/price-service';
import { useUser } from './user-provider';
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

const PRICE_REFRESH_INTERVAL = 60000; // 1 minute

export function MarketProvider({ children }: { children: ReactNode }) {
  const { user } = useUser();
  const { rates } = useCurrency();
  const [prices, setPrices] = useState<PriceResult>({});
  const [isMarketLoading, setIsMarketLoading] = useState(true);
  
  // High-performance custom token registry for background polling
  const customTokensRef = useRef<AssetRow[]>([]);

  const registerCustomTokens = useCallback((tokens: AssetRow[]) => {
    customTokensRef.current = tokens;
  }, []);

  // STABLE PRICE MERGER
  const updatePrices = useCallback((newPrices: PriceResult) => {
    setPrices(prev => {
      // Deep equality check to prevent redundant re-renders if values are unchanged
      const hasChanged = Object.keys(newPrices).some(
        key => !prev[key] || prev[key].price !== newPrices[key].price || prev[key].change !== newPrices[key].change
      );
      if (!hasChanged) return prev;
      
      const merged = { ...prev, ...newPrices };
      localStorage.setItem('price_cache_global', JSON.stringify({ 
        data: merged, 
        timestamp: Date.now() 
      }));
      return merged;
    });
  }, []);

  const refreshPrices = useCallback(async (chains: ChainConfig[], customTokens: AssetRow[]) => {
    try {
      const newPrices = await fetchGlobalMarketData(chains, customTokens, rates);
      updatePrices(newPrices);
    } catch (e) {
      console.warn("[MARKET_ENGINE_ADVISORY] Price sync interrupted.");
    } finally {
      setIsMarketLoading(false);
    }
  }, [rates, updatePrices]);

  // INITIAL HYDRATION
  useEffect(() => {
    const cached = localStorage.getItem('price_cache_global');
    if (cached) {
      try {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < 300000) { // 5 min TTL for cache use
          setPrices(data);
          setIsMarketLoading(false);
        }
      } catch (e) {}
    }
  }, []);

  // AUTONOMOUS POLLING LOOP
  useEffect(() => {
    const allChains = Object.values(evmNetworks) as ChainConfig[];
    
    const execute = () => {
        refreshPrices(allChains, customTokensRef.current);
    };

    execute(); // Initial boot refresh

    const interval = setInterval(execute, PRICE_REFRESH_INTERVAL);
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
