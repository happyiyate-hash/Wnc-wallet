'use client';

import { useRef, useCallback } from 'react';
import type { ChainConfig, WalletWithMetadata, AssetRow } from '@/lib/types';
import { fetchBalancesForChain } from '../services/balance-service';

/**
 * SPEED TIER DEFINITIONS
 * EVM/SOL/NEAR = FAST (Handshake priority)
 * DOT/KSM = MEDIUM (WebSocket handshake overhead)
 * BTC/LTC/DOGE = SLOW (Indexer/UTXO aggregation latency)
 */
const CHAIN_SPEED_SCORE: { [type: string]: number } = {
  'evm': 1,
  'solana': 1,
  'near': 1,
  'aptos': 2,
  'sui': 2,
  'polkadot': 3,
  'kusama': 3,
  'cosmos': 3,
  'osmosis': 3,
  'secret': 3,
  'injective': 3,
  'celestia': 3,
  'btc': 10,
  'ltc': 10,
  'doge': 10
};

/**
 * INSTITUTIONAL DATA REFRESH ENGINE (PHASE-PRIORITIZED)
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

  /**
   * REVALIDATION HANDSHAKE
   */
  const executeRevalidation = useCallback(async () => {
    if (!wallets || wallets.length === 0 || !viewingNetwork || !user || isRefreshingRef.current) return;
    
    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    isRefreshingRef.current = true;
    setIsRefreshing(true);
    
    try {
      // PHASE 1: Active Handshake
      console.log(`[ENGINE] Syncing Active Node: ${viewingNetwork.name}...`);
      
      const activeBalances = await fetchBalancesForChain(
        viewingNetwork, 
        wallets, 
        infuraApiKey, 
        userAddedTokens
      );

      if (signal.aborted) return;

      setBalances(prev => ({ ...prev, [viewingNetwork.chainId]: activeBalances }));
      lastSyncTimestampRef.current[viewingNetwork.chainId] = Date.now();
      
      // ACTIVE NODE VERIFIED: Drop the barrier
      setHasFetchedInitialData(true);

      // PHASE 2: Background Sequence (Sorted by speed)
      const otherChains = chainsWithLogos
        .filter(c => c.chainId !== viewingNetwork.chainId)
        .sort((a, b) => (CHAIN_SPEED_SCORE[a.type || 'evm'] || 1) - (CHAIN_SPEED_SCORE[b.type || 'evm'] || 1));
      
      for (const chain of otherChains) {
        if (signal.aborted || !wallets) break;

        // TIERED TTL CHECK: Slow chains (BTC/LTC/DOGE) only sync every 5 minutes
        const speedScore = CHAIN_SPEED_SCORE[chain.type || 'evm'] || 1;
        const lastSync = lastSyncTimestampRef.current[chain.chainId] || 0;
        const isSlowTier = speedScore >= 10;
        const ttl = isSlowTier ? 300000 : 0; 

        if (Date.now() - lastSync < ttl) continue;

        console.log(`[ENGINE] Reconciling ${chain.symbol}...`);
        
        const secondaryBalances = await fetchBalancesForChain(chain, wallets, infuraApiKey, userAddedTokens);
        
        if (signal.aborted) break;
        setBalances(prev => ({ ...prev, [chain.chainId]: secondaryBalances }));
        lastSyncTimestampRef.current[chain.chainId] = Date.now();
        
        await sleep(isSlowTier ? 800 : 400); 
      }
    } catch (e) {
      console.warn("[ENGINE_ADVISORY] Handshake Interrupted:", e);
      setHasFetchedInitialData(true); 
    } finally { 
      setIsRefreshing(false); 
      isRefreshingRef.current = false;
    }
  }, [wallets, viewingNetwork, infuraApiKey, userAddedTokens, chainsWithLogos, setBalances, setIsRefreshing, setHasFetchedInitialData]);

  return { refresh: executeRevalidation };
}
