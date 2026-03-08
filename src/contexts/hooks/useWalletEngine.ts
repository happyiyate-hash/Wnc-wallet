'use client';

import { useRef, useCallback } from 'react';
import type { ChainConfig, WalletWithMetadata, AssetRow } from '@/lib/types';
import { fetchBalancesForChain } from '@/lib/wallets/services/balance-service';

/**
 * INSTITUTIONAL DATA REFRESH ENGINE (FAIL-FAST)
 * Version: 5.1.0 (8s Unified Safety Lifecycle)
 * 
 * Ensures that the main UI is never locked behind a slow RPC.
 */
export function useWalletEngine({
  wallets,
  viewingNetwork,
  user,
  chainsWithLogos,
  userAddedTokens,
  infuraApiKey,
  setBalances,
  setIsRefreshing,
  setHasFetchedInitialData
}: {
  wallets: WalletWithMetadata[] | null;
  viewingNetwork: ChainConfig | null;
  user: any;
  chainsWithLogos: ChainConfig[];
  userAddedTokens: AssetRow[];
  infuraApiKey: string | null;
  setBalances: (update: (prev: any) => any) => void;
  setIsRefreshing: (val: boolean) => void;
  setHasFetchedInitialData: (val: boolean) => void;
}) {
  const isRefreshingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastSyncTimestampRef = useRef<{ [chainId: number]: number }>({});

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const executeRevalidation = useCallback(async () => {
    if (!wallets || wallets.length === 0 || !viewingNetwork || !user || isRefreshingRef.current) {
      if (!wallets || wallets.length === 0) setHasFetchedInitialData(true);
      return;
    }
    
    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    isRefreshingRef.current = true;
    setIsRefreshing(true);
    
    // SAFETY TIMEOUT: Hard barrier release after 8 seconds
    // Prevents "Establishing Terminal" from spinning forever if an RPC node is slow.
    const safetyTimer = setTimeout(() => {
        setHasFetchedInitialData(true);
    }, 8000);
    
    try {
      // PHASE 1: Active Network Handshake (Priority)
      const activeBalances = await fetchBalancesForChain(
        viewingNetwork, 
        wallets, 
        infuraApiKey, 
        userAddedTokens
      );

      if (signal.aborted) return;

      setBalances(prev => ({ ...prev, [viewingNetwork.chainId]: activeBalances }));
      lastSyncTimestampRef.current[viewingNetwork.chainId] = Date.now();
      
      // Release barrier immediately after first network sync or timeout
      clearTimeout(safetyTimer);
      setHasFetchedInitialData(true);

      // PHASE 2: Background Registry Sequence (Non-Blocking)
      const otherChains = chainsWithLogos.filter(c => c.chainId !== viewingNetwork.chainId);
      
      for (const chain of otherChains) {
        if (signal.aborted || !wallets) break;

        const lastSync = lastSyncTimestampRef.current[chain.chainId] || 0;
        if (Date.now() - lastSync < 60000) continue;

        const secondaryBalances = await fetchBalancesForChain(chain, wallets, infuraApiKey, userAddedTokens);
        
        if (signal.aborted) break;
        setBalances(prev => ({ ...prev, [chain.chainId]: secondaryBalances }));
        lastSyncTimestampRef.current[chain.chainId] = Date.now();
        
        await sleep(400); 
      }
    } catch (e) {
      // Handshake deferred, but we must release the barrier
    } finally { 
      setHasFetchedInitialData(true);
      clearTimeout(safetyTimer);
      setIsRefreshing(false); 
      isRefreshingRef.current = false;
    }
  }, [wallets, viewingNetwork, infuraApiKey, userAddedTokens, chainsWithLogos, setBalances, setIsRefreshing, setHasFetchedInitialData, user]);

  return { refresh: executeRevalidation };
}
