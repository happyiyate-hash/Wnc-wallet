
'use client';

import { useRef, useCallback } from 'react';
import type { ChainConfig, WalletWithMetadata, AssetRow } from '@/lib/types';
import { fetchBalancesForChain } from '@/lib/wallets/services/balance-service';

/**
 * INSTITUTIONAL RECLAMATION ENGINE (STAGED)
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

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const executeRevalidation = useCallback(async () => {
    if (!wallets || wallets.length === 0 || !viewingNetwork || !user || isRefreshingRef.current) return;
    
    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    isRefreshingRef.current = true;
    setIsRefreshing(true);
    
    try {
      // PHASE 1: Active Handshake
      const activeBalances = await fetchBalancesForChain(
        viewingNetwork, 
        wallets, 
        infuraApiKey, 
        userAddedTokens
      );

      if (signal.aborted) return;

      setBalances(prev => ({ ...prev, [viewingNetwork.chainId]: activeBalances }));
      setHasFetchedInitialData(true);

      // PHASE 2: Background Sequence
      const otherChains = chainsWithLogos.filter(c => c.chainId !== viewingNetwork.chainId);
      
      for (const chain of otherChains) {
        if (signal.aborted || !wallets) break;

        const secondaryBalances = await fetchBalancesForChain(chain, wallets, infuraApiKey, userAddedTokens);
        
        if (signal.aborted) break;
        setBalances(prev => ({ ...prev, [chain.chainId]: secondaryBalances }));
        
        await sleep(400); // Institutional breather
      }
    } catch (e) {
      setHasFetchedInitialData(true); 
    } finally { 
      setIsRefreshing(false); 
      isRefreshingRef.current = false;
    }
  }, [wallets, viewingNetwork, infuraApiKey, userAddedTokens, chainsWithLogos, setBalances, setIsRefreshing, setHasFetchedInitialData, user]);

  return { refresh: executeRevalidation };
}
