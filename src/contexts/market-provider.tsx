'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { fetchGlobalMarketData, type PriceResult } from '@/lib/market/price-service';
import { useCurrency } from './currency-provider';
import type { AssetRow, ChainConfig } from '@/lib/types';
import evmNetworks from '@/lib/evmNetworks.json';
import { registryDb } from '@/lib/storage/registry-db';
import { getDirectLogoUrl } from '@/lib/getTokenLogo';
import { getInitialAssets } from '@/lib/wallets/balances';
import { fetchChartData } from '@/lib/coingecko';

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
 * Version: 10.0.0 (Background Chart Prefetcher added)
 */
export function MarketProvider({ children }: { children: ReactNode }) {
  const { rates } = useCurrency();
  const [prices, setPrices] = useState<PriceResult>({});
  const [isMarketLoading, setIsMarketLoading] = useState(true);
  
  const customTokensRef = useRef<AssetRow[]>([]);
  const hasInitializedLogosRef = useRef(false);
  const hasPrefetchedChartsRef = useRef(false);

  const registerCustomTokens = useCallback((tokens: AssetRow[]) => {
    customTokensRef.current = tokens;
  }, []);

  /**
   * CENTRALIZED LOGO PRE-FETCH WORKER
   */
  const prefetchLogos = useCallback(async (chains: ChainConfig[]) => {
    if (hasInitializedLogosRef.current) return;
    hasInitializedLogosRef.current = true;

    console.log("[MARKET_ENGINE] Initializing logo pre-fetch worker...");
    
    for (const chain of chains) {
      try {
        const chainCacheId = `logo_v12_${chain.name.replace(/\s+/g, '_').toLowerCase()}_${chain.symbol.toLowerCase()}`;
        const chainCached = await registryDb.getLogo(chainCacheId);
        if (!chainCached) {
          const url = await getDirectLogoUrl(chain.name, chain.symbol);
          if (url) await registryDb.saveLogo(chainCacheId, url);
        }

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
      await new Promise(r => setTimeout(r, 100));
    }
    console.log("[MARKET_ENGINE] Asset registry synchronized.");
  }, []);

  /**
   * BACKGROUND CHART PREFETCH WORKER
   * Fetches 1D chart data for common assets to ensure instant loading in Detail Page.
   */
  const prefetchCharts = useCallback(async (chains: ChainConfig[]) => {
    if (hasPrefetchedChartsRef.current) return;
    hasPrefetchedChartsRef.current = true;

    console.log("[MARKET_ENGINE] Initializing background chart prefetcher...");

    for (const chain of chains) {
      const assets = getInitialAssets(chain.chainId);
      for (const asset of assets) {
        const coingeckoId = asset.coingeckoId;
        if (!coingeckoId) continue;

        const cacheId = `chart:${coingeckoId}:1D`;
        try {
          const cached = await registryDb.getChart(cacheId);
          if (!cached) {
            const data = await fetchChartData(coingeckoId, '1D');
            if (data && data.length > 0) {
              await registryDb.saveChart(cacheId, data);
            }
          }
        } catch (e) {}
        await new Promise(r => setTimeout(r, 500)); // Be gentle with CG API
      }
    }
    console.log("[MARKET_ENGINE] Chart registry synchronized.");
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
      
      prefetchLogos(allChains);
      prefetchCharts(allChains);
    } catch (e) {
      console.warn("[MARKET_ENGINE_ADVISORY] Market handshake deferred.");
    } finally {
      setIsMarketLoading(false);
    }
  }, [rates, updatePrices, prefetchLogos, prefetchCharts]);

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
