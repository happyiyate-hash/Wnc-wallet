
'use client';

import { useEffect, useRef, useCallback } from 'react';
import type { ChainConfig, WalletWithMetadata, AssetRow } from '@/lib/types';
import { fetchGlobalMarketData, type PriceResult } from '@/lib/market/price-service';
import { fetchBalancesForChain } from '../services/balance-service';

/**
 * INSTITUTIONAL DATA REFRESH ENGINE (REACTIVE VERSION)
 * 
 * Decoupled logic nodes:
 * 1. Global Price Engine: Independent, runs on mount.
 * 2. Balance Engine: Reactive, runs when wallets exist.
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
  const isBalanceRefreshingRef = useRef(false);
  const isPriceRefreshingRef = useRef(false);

  /**
   * NODE A: GLOBAL PRICE ENGINE
   * Fetches market valuations independently of wallet state.
   */
  const refreshPrices = useCallback(async () => {
    if (isPriceRefreshingRef.current || chainsWithLogos.length === 0) return;
    
    isPriceRefreshingRef.current = true;
    try {
      console.log("[PRICE_ENGINE] Discovery started...");
      const newPrices = await fetchGlobalMarketData(chainsWithLogos, userAddedTokens, rates, {});
      setPrices(newPrices);
      console.log("[PRICE_ENGINE] Discovery complete.");
    } catch (e) {
      console.warn("[PRICE_ENGINE_ADVISORY]", e);
    } finally {
      isPriceRefreshingRef.current = false;
    }
  }, [chainsWithLogos, userAddedTokens, rates, setPrices]);

  /**
   * NODE B: BALANCE DISCOVERY ENGINE
   * Reconciles on-chain assets for derived wallet identities.
   */
  const refreshBalances = useCallback(async () => {
    if (!wallets || wallets.length === 0 || !viewingNetwork || isBalanceRefreshingRef.current) return;
    
    isBalanceRefreshingRef.current = true;
    setIsRefreshing(true);
    
    try {
      console.log(`[BALANCE_ENGINE] Syncing ${viewingNetwork.name}...`);
      
      // PHASE 1: Active Network Handshake
      const currentBalances = await fetchBalancesForChain(
        viewingNetwork, 
        wallets, 
        infuraApiKey, 
        userAddedTokens
      );
      
      setBalances(prev => ({ 
        ...prev, 
        [viewingNetwork.chainId]: currentBalances 
      }));

      // Dropping the loading barrier as soon as active data is ready
      setHasFetchedInitialData(true);

      // PHASE 2: Background Registry Discovery
      const otherChains = chainsWithLogos.filter(c => c.chainId !== viewingNetwork.chainId);
      for (const chain of otherChains) {
        if (!wallets) break;
        const secondaryBalances = await fetchBalancesForChain(chain, wallets, infuraApiKey, userAddedTokens);
        setBalances(prev => ({ ...prev, [chain.chainId]: secondaryBalances }));
        await new Promise(r => setTimeout(r, 200)); // Breather for UI thread
      }
      
    } catch (e) {
      console.warn("[BALANCE_ENGINE_ADVISORY]", e);
      setHasFetchedInitialData(true); 
    } finally { 
      setIsRefreshing(false); 
      isBalanceRefreshingRef.current = false;
    }
  }, [wallets, viewingNetwork, infuraApiKey, userAddedTokens, chainsWithLogos, setBalances, setIsRefreshing, setHasFetchedInitialData]);

  /**
   * REACTIVE TRIGGERS
   */

  // 1. Trigger Prices on metadata readiness
  useEffect(() => {
    if (chainsWithLogos.length > 0) {
      refreshPrices();
      const interval = setInterval(refreshPrices, 45000); // 45s price cycle
      return () => clearInterval(interval);
    }
  }, [chainsWithLogos.length, refreshPrices]);

  // 2. Trigger Balances on wallet derivation
  useEffect(() => {
    if (wallets && wallets.length > 0 && viewingNetwork && user) {
      refreshBalances();
    }
  }, [!!wallets, viewingNetwork?.chainId, user?.id, refreshBalances]);

  // 3. Periodic Balance Audit
  useEffect(() => {
    if (wallets && wallets.length > 0 && viewingNetwork && user) {
      const interval = setInterval(refreshBalances, 60000); // 60s balance cycle
      return () => clearInterval(interval);
    }
  }, [!!wallets, viewingNetwork?.chainId, user?.id, refreshBalances]);

  return { refresh: refreshBalances };
}
