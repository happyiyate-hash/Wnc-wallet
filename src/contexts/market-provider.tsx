'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { fetchGlobalMarketData, type PriceResult } from '@/lib/market/price-service';
import { useCurrency } from './currency-provider';
import type { AssetRow, ChainConfig } from '@/lib/types';
import evmNetworks from '@/lib/evmNetworks.json';
import { registryDb } from '@/lib/storage/registry-db';
import { getDirectLogoUrl } from '@/lib/getTokenLogo';
import { getInitialAssets } from '@/lib/wallets/balances';

interface MarketContextType {
  prices: PriceResult;
  isMarketLoading: boolean;
  refreshPrices: () => Promise<void>;
  registerCustomTokens: (tokens: AssetRow[]) => void;
}

const MarketContext = createContext<MarketContextType | undefined>(undefined);

const PRICE_UPDATE_INTERVAL = 30000; // 30 seconds
const PRICE_CACHE_KEY = 'ss-price-cache-global';

/**
 * INSTITUTIONAL INDEPENDENT MARKET ENGINE
 * Version: 6.0.0 (Zero-Latency Discovery)
 * 
 * Operates independently of Auth and Wallet state.
 * Loads cached global prices instantly on boot.
 * Triggers background logo pre-fetching for all whitelisted assets.
 */
export function MarketProvider({ children }: { children: ReactNode }) {
  const { rates } = useCurrency();
  const [prices, setPrices] = useState<PriceResult>({});
  const [isMarketLoading, setIsMarketLoading] = useState(true);
  
  const customTokensRef = useRef<AssetRow[]>([]);
  const hasInitializedLogosRef = useRef(false);

  const registerCustomTokens = useCallback((tokens: AssetRow[]) => {
    customTokensRef.current = tokens;
  }, []);

  /**
   * CENTRALIZED LOGO PRE-FETCH
   * Populates the IndexedDB logo registry for whitelisted tokens.
   */
  const prefetchLogos = useCallback(async (chains: ChainConfig[]) => {
    if (hasInitializedLogosRef.current) return;
    hasInitializedLogosRef.current = true;

    console.log("[MARKET_ENGINE] Initializing logo pre-fetch sequence...");
    
    for (const chain of chains) {
      const assets = getInitialAssets(chain.chainId);
      for (const asset of assets) {
        const cacheKey = `logo_v12_${asset.name.replace(/\s+/g, '_').toLowerCase()}_${asset.symbol.toLowerCase()}`;
        
        // Only fetch if not already in cache
        const cached = await registryDb.getLogo(cacheKey);
        if (!cached) {
          try {
            const url = await getDirectLogoUrl(asset.name, asset.symbol);
            if (url) await registryDb.saveLogo(cacheKey, url);
          } catch (e) {
            // Silent fail for individual logos
          }
        }
      }
    }
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
      
      // Also ensure logos are warming up
      prefetchLogos(allChains);
    } catch (e) {
      console.warn("[MARKET_ENGINE_ADVISORY] Global price handshake deferred.");
    } finally {
      setIsMarketLoading(false);
    }
  }, [rates, updatePrices, prefetchLogos]);

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
