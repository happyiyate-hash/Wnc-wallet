
'use client';

import { useEffect, useRef, useCallback } from 'react';
import type { ChainConfig, WalletWithMetadata, AssetRow } from '@/lib/types';
import { fetchGlobalMarketData, type PriceResult } from '@/lib/market/price-service';
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
 * 
 * Performance Strategy:
 * 1. Immediate Price Engine mount (independent).
 * 2. Phase 1: Active Network Discovery (Critical Path).
 * 3. Phase 2: Sequential Discovery based on Speed Tiers (Slow chains last).
 * 4. Tiered TTL Caching: Slow chains updated less frequently.
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
      const startTime = Date.now();
      
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
      console.log(`[ENGINE] Active Node Verified in ${Date.now() - startTime}ms.`);

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
        const ttl = isSlowTier ? 300000 : 0; // 5 mins for slow tier

        if (Date.now() - lastSync < ttl) {
            console.log(`[ENGINE] Skipping cached node: ${chain.symbol}`);
            continue;
        }

        console.log(`[ENGINE] Reconciling ${chain.symbol} (${chain.type})...`);
        const chainStartTime = Date.now();
        
        const secondaryBalances = await fetchBalancesForChain(chain, wallets, infuraApiKey, userAddedTokens);
        
        if (signal.aborted) break;
        setBalances(prev => ({ ...prev, [chain.chainId]: secondaryBalances }));
        lastSyncTimestampRef.current[chain.chainId] = Date.now();
        
        console.log(`[ENGINE_PERF] ${chain.symbol} Discovery: ${Date.now() - chainStartTime}ms`);
        
        // Throttled breather based on speed tier
        await sleep(isSlowTier ? 800 : 400); 
      }
      
      console.log(`[ENGINE] Background Reconciliation Complete.`);
    } catch (e) {
      console.warn("[ENGINE_ADVISORY] Handshake Interrupted:", e);
      setHasFetchedInitialData(true); 
    } finally { 
      setIsRefreshing(false); 
      isRefreshingRef.current = false;
    }
  }, [wallets, viewingNetwork, infuraApiKey, userAddedTokens, chainsWithLogos, setBalances, setIsRefreshing, setHasFetchedInitialData]);

  /**
   * INDEPENDENT PRICE ENGINE
   * Mounts once and polls market data globally.
   */
  useEffect(() => {
    if (chainsWithLogos.length === 0) return;

    let isPolling = true;
    const fetchPrices = async () => {
        try {
            const newPrices = await fetchGlobalMarketData(chainsWithLogos, userAddedTokens, rates);
            if (isPolling) setPrices(newPrices);
        } catch (e) { console.warn("[MARKET_ENGINE_FAIL]", e); }
    };

    fetchPrices();
    const interval = setInterval(fetchPrices, 60000); // 60s Global Market Refresh

    return () => { isPolling = false; clearInterval(interval); };
  }, [chainsWithLogos.length, userAddedTokens, rates, setPrices]);

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

  return { refresh: executeRevalidation };
}
