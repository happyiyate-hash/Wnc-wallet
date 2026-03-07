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
 * Version: 9.0.0 (Zero-Latency Pre-fetcher)
 * 
 * Operates independently of Auth state to ensure early hydration.
 * Populates the tiered logo registry in the background to eliminate UI flicker.
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
   * CENTRALIZED LOGO PRE-FETCH WORKER
   * Iterates through all whitelisted assets across all 39 chains.
   * Eliminates the "black flicker" in selectors by populating the hardware cache early.
   */
  const prefetchLogos = useCallback(async (chains: ChainConfig[]) => {
    if (hasInitializedLogosRef.current) return;
    hasInitializedLogosRef.current = true;

    console.log("[MARKET_ENGINE] Initializing logo pre-fetch worker...");
    
    // Process chains sequentially to manage network load
    for (const chain of chains) {
      try {
        // 1. Sync Network Branding
        const chainCacheId = `logo_v12_${chain.name.replace(/\s+/g, '_').toLowerCase()}_${chain.symbol.toLowerCase()}`;
        const chainCached = await registryDb.getLogo(chainCacheId);
        if (!chainCached) {
          const url = await getDirectLogoUrl(chain.name, chain.symbol);
          if (url) await registryDb.saveLogo(chainCacheId, url);
        }

        // 2. Sync Asset Registry
        const assets = getInitialAssets(chain.chainId);
        for (const asset of assets) {
          const assetCacheId = `logo_v12_${asset.name.replace(/\s+/g, '_').toLowerCase()}_${asset.symbol.toLowerCase()}`;
          const assetCached = await registryDb.getLogo(assetCacheId);
          if (!assetCached) {
            try {
              const url = await getDirectLogoUrl(asset.name, asset.symbol);
              if (url) await registryDb.saveLogo(assetCacheId, url);
            } catch (e) {}
          }
        }
      } catch (e) {}
      
      // Institutional Breather
      await new Promise(r => setTimeout(r, 100));
    }
    console.log("[MARKET_ENGINE] Asset registry synchronized.");
  }, []);

  const updatePrices = useCallback((newPrices: PriceResult) => {
    setPrices(prev => {
      const merged = { ...prev, ...newPrices };
      if (typeof window !== 'undefined') {
        localStorage.setItem(PRICE_CACHE_KEY, JSON.stringify({ 
          data: merged, 
          timestamp: Date.now() 
        }));
      }
      return merged;
    });
  }, []);

  const refreshPrices = useCallback(async () => {
    try {
      const allChains = Object.values(evmNetworks) as ChainConfig[];
      const newPrices = await fetchGlobalMarketData(allChains, customTokensRef.current, rates);
      updatePrices(newPrices);
      
      // Trigger background pre-fetcher once price handshake is stable
      prefetchLogos(allChains);
    } catch (e) {
      console.warn("[MARKET_ENGINE_ADVISORY] Market handshake deferred.");
    } finally {
      setIsMarketLoading(false);
    }
  }, [rates, updatePrices, prefetchLogos]);

  // INITIAL HYDRATION
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
