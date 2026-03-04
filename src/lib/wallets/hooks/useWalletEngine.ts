
'use client';

import { useEffect, useRef, useCallback } from 'react';
import type { ChainConfig, WalletWithMetadata, AssetRow } from '@/lib/types';
import { fetchGlobalMarketData, type PriceResult } from '@/lib/market/price-service';
import { fetchBalancesForChain } from '../services/balance-service';

/**
 * INSTITUTIONAL DATA REFRESH ENGINE (REACTIVE & SEQUENTIAL)
 * 
 * Optimized for logic-gated "Phase-Prioritized" rhythm:
 * 1. Phase 1: Immediate fetch for Active Network + Global Prices.
 * 2. Phase 2: Lazy sequential background sync for all other chains.
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
   * SEQUENTIAL DISCOVERY PROTOCOL
   * Executes a prioritized handshake to unblock UI first, then sync registry.
   */
  const executeDataHandshake = useCallback(async () => {
    if (!wallets || wallets.length === 0 || !viewingNetwork || !user || isRefreshingRef.current) return;
    
    // Cleanup previous handshake if it's still running
    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    isRefreshingRef.current = true;
    setIsRefreshing(true);
    
    try {
      console.log(`[ENGINE] Handshake Phase 1: Market & Active Network...`);
      
      // STEP 1: Global Price Discovery (Parallel to Balance)
      const pricesPromise = fetchGlobalMarketData(chainsWithLogos, userAddedTokens, rates);
      
      // STEP 2: Active Network Balance
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

      // HANDSHAKE VERIFIED: Drop the barrier now
      setHasFetchedInitialData(true);
      console.log(`[ENGINE] Handshake Phase 1 Verified. Terminal Unblocked.`);

      // STEP 3: Phase 2 - Lazy Sequential Discovery
      const otherChains = chainsWithLogos.filter(c => c.chainId !== viewingNetwork.chainId);
      
      for (const chain of otherChains) {
        if (signal.aborted) break;
        if (!wallets) break;

        console.log(`[ENGINE] Lazy Sync: ${chain.name}...`);
        const secondaryBalances = await fetchBalancesForChain(chain, wallets, infuraApiKey, userAddedTokens);
        
        if (signal.aborted) break;
        setBalances(prev => ({ ...prev, [chain.chainId]: secondaryBalances }));
        
        // Institutional Throttle: Prevent RPC congestion
        await sleep(400); 
      }
      
      console.log(`[ENGINE] Handshake Phase 2: Registry Fully Synchronized.`);
    } catch (e) {
      console.warn("[ENGINE_ADVISORY] Handshake Interrupted:", e);
      setHasFetchedInitialData(true); 
    } finally { 
      setIsRefreshing(false); 
      isRefreshingRef.current = false;
    }
  }, [wallets, viewingNetwork, infuraApiKey, userAddedTokens, chainsWithLogos, rates, setPrices, setBalances, setIsRefreshing, setHasFetchedInitialData]);

  /**
   * REACTIVE TRIGGERS
   */

  // 1. Full Handshake Trigger
  useEffect(() => {
    if (wallets && wallets.length > 0 && viewingNetwork && user && chainsWithLogos.length > 0) {
      executeDataHandshake();
    }
    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, [!!wallets, viewingNetwork?.chainId, user?.id, chainsWithLogos.length, executeDataHandshake]);

  // 2. Periodic Maintenance (60s cycle)
  useEffect(() => {
    if (wallets && wallets.length > 0 && viewingNetwork && user) {
      const interval = setInterval(executeDataHandshake, 60000);
      return () => clearInterval(interval);
    }
  }, [!!wallets, viewingNetwork?.chainId, user?.id, executeDataHandshake]);

  return { refresh: executeDataHandshake };
}
