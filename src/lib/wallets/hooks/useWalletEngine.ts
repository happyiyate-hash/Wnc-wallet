
'use client';

import { useEffect, useRef, useCallback } from 'react';
import type { ChainConfig, WalletWithMetadata, AssetRow } from '@/lib/types';
import { fetchGlobalMarketData, type PriceResult } from '@/lib/market/price-service';
import { fetchBalancesForChain } from '../services/balance-service';

/**
 * INSTITUTIONAL DATA REFRESH ENGINE (SWR & PHASED)
 * 
 * Implements Stale-While-Revalidate pattern:
 * 1. UI hydrates immediately from WalletProvider cache.
 * 2. Phase 1: Silent revalidation of Active Network + Global Prices.
 * 3. Phase 2: Sequential background reconciliation for all secondary chains.
 */
export function useWalletEngine({
  wallets,
  viewingNetwork,
  user,
  chainsWithLogos,
  userAddedTokens,
  rates,
  infuraApiKey,
  setPrices,
  setBalances,
  setIsRefreshing,
  setHasFetchedInitialData
}: {
  wallets: WalletWithMetadata[] | null;
  viewingNetwork: ChainConfig | null;
  user: any;
  chainsWithLogos: ChainConfig[];
  userAddedTokens: AssetRow[];
  rates: { [key: string]: number };
  infuraApiKey: string | null;
  setPrices: (val: PriceResult) => void;
  setBalances: (update: (prev: any) => any) => void;
  setIsRefreshing: (val: boolean) => void;
  setHasFetchedInitialData: (val: boolean) => void;
}) {
  const isRefreshingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  /**
   * REVALIDATION HANDSHAKE
   * Updates the registry without blocking the terminal UI.
   */
  const executeRevalidation = useCallback(async () => {
    if (!wallets || wallets.length === 0 || !viewingNetwork || !user || isRefreshingRef.current) return;
    
    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    isRefreshingRef.current = true;
    setIsRefreshing(true);
    
    try {
      console.log(`[ENGINE] Revalidating Registry Phase 1: Market & Active Network...`);
      
      // STEP 1: Global Price Discovery
      const pricesPromise = fetchGlobalMarketData(chainsWithLogos, userAddedTokens, rates);
      
      // STEP 2: Active Network Balance Discovery
      const activeBalancePromise = fetchBalancesForChain(
        viewingNetwork, 
        wallets, 
        infuraApiKey, 
        userAddedTokens
      );

      const [newPrices, activeBalances] = await Promise.all([pricesPromise, activeBalancePromise]);
      
      if (signal.aborted) return;

      setPrices(newPrices);
      setBalances(prev => ({ ...prev, [viewingNetwork.chainId]: activeBalances }));

      // PRIMARY HANDSHAKE VERIFIED
      setHasFetchedInitialData(true);

      // STEP 3: Phase 2 - Lazy Background Reconciliation
      const otherChains = chainsWithLogos.filter(c => c.chainId !== viewingNetwork.chainId);
      
      for (const chain of otherChains) {
        if (signal.aborted || !wallets) break;

        const secondaryBalances = await fetchBalancesForChain(chain, wallets, infuraApiKey, userAddedTokens);
        
        if (signal.aborted) break;
        setBalances(prev => ({ ...prev, [chain.chainId]: secondaryBalances }));
        
        await sleep(400); // Throttled breather
      }
      
      console.log(`[ENGINE] Revalidation Complete. Registry in Sync.`);
    } catch (e) {
      console.warn("[ENGINE_ADVISORY] Revalidation Interrupted:", e);
      setHasFetchedInitialData(true); 
    } finally { 
      setIsRefreshing(false); 
      isRefreshingRef.current = false;
    }
  }, [wallets, viewingNetwork, infuraApiKey, userAddedTokens, chainsWithLogos, rates, setPrices, setBalances, setIsRefreshing, setHasFetchedInitialData]);

  /**
   * REACTIVE TRIGGERS
   */
  useEffect(() => {
    if (wallets && wallets.length > 0 && viewingNetwork && user && chainsWithLogos.length > 0) {
      executeRevalidation();
    }
    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, [!!wallets, viewingNetwork?.chainId, user?.id, chainsWithLogos.length, executeRevalidation]);

  useEffect(() => {
    if (wallets && wallets.length > 0 && viewingNetwork && user) {
      const interval = setInterval(executeRevalidation, 60000); // 60s Revalidation Cycle
      return () => clearInterval(interval);
    }
  }, [!!wallets, viewingNetwork?.chainId, user?.id, executeRevalidation]);

  return { refresh: executeRevalidation };
}
