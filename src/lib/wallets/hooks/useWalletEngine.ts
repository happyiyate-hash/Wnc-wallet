
'use client';

import { useEffect, useRef, useCallback } from 'react';
import type { ChainConfig, WalletWithMetadata, AssetRow } from '@/lib/types';
import { fetchGlobalMarketData, type PriceResult } from '@/lib/market/price-service';
import { fetchBalancesForChain } from '../services/balance-service';

/**
 * INSTITUTIONAL DATA REFRESH ENGINE
 * Orchestrates periodic market and balance synchronization.
 * Triggers on initial load, network switch, and every 30s interval.
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
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isRunningRef = useRef(false);

  const startEngine = useCallback(async () => {
    // PRE-FLIGHT GUARD
    if (!wallets || wallets.length === 0 || !viewingNetwork || !user || isRunningRef.current) return;
    
    isRunningRef.current = true;
    setIsRefreshing(true);
    
    try {
      // 1. Fetch Market Prices (Global)
      // This includes the deterministic WNC price lookup
      const newPrices = await fetchGlobalMarketData(chainsWithLogos, userAddedTokens, rates, {});
      setPrices(newPrices);
      
      // 2. Fetch Account Balances (Current Network)
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
      
      // 3. Mark Initial Synchronization as Complete
      // This signals the GlobalLoadingBarrier to drop
      setHasFetchedInitialData(true);
    } catch (e) {
      console.warn("[ENGINE_ADVISORY] Market synchronization interrupted:", e);
    } finally { 
      setIsRefreshing(false); 
      isRunningRef.current = false;
    }
  }, [wallets, viewingNetwork, user, chainsWithLogos, userAddedTokens, rates, infuraApiKey, setPrices, setBalances, setIsRefreshing, setHasFetchedInitialData]);

  /**
   * INITIAL & REACTIVE TRIGGER
   * Fires on: Network Switch, Wallet Derivation, or User Session Re-init.
   */
  useEffect(() => {
    if (wallets && wallets.length > 0 && viewingNetwork && user) {
      startEngine();
    }
  }, [viewingNetwork?.chainId, wallets === null, user?.id, startEngine]);

  /**
   * PERIODIC REFRESH LOOP (30s)
   * Ensures terminal registry stays synchronized with live chain data.
   */
  useEffect(() => {
    if (wallets && wallets.length > 0 && viewingNetwork && user) {
      if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
      refreshIntervalRef.current = setInterval(startEngine, 30000);
    }
    return () => { if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current); };
  }, [viewingNetwork?.chainId, wallets === null, user?.id, startEngine]);

  return { refresh: startEngine };
}
