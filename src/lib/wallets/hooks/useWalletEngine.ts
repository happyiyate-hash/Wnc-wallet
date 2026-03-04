
'use client';

import { useEffect, useRef, useCallback } from 'react';
import type { ChainConfig, WalletWithMetadata, AssetRow } from '@/lib/types';
import { fetchGlobalMarketData, type PriceResult } from '@/lib/market/price-service';
import { fetchBalancesForChain } from '../services/balance-service';

/**
 * INSTITUTIONAL DATA REFRESH ENGINE
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
      
    } catch (e) {
      console.warn("[ENGINE_ADVISORY] Market synchronization interrupted:", e);
    } finally { 
      // ALWAYS mark initial data as fetched once the first run completes (even if partial)
      // to allow the Loading Barrier to drop.
      setHasFetchedInitialData(true);
      setIsRefreshing(false); 
      isRunningRef.current = false;
    }
  }, [wallets, viewingNetwork, user, chainsWithLogos, userAddedTokens, rates, infuraApiKey, setPrices, setBalances, setIsRefreshing, setHasFetchedInitialData]);

  /**
   * INITIAL & REACTIVE TRIGGER
   */
  useEffect(() => {
    if (wallets && wallets.length > 0 && viewingNetwork?.chainId && user) {
      startEngine();
    }
  }, [viewingNetwork?.chainId, wallets === null, user?.id, startEngine]);

  /**
   * PERIODIC REFRESH LOOP (30s)
   */
  useEffect(() => {
    if (wallets && wallets.length > 0 && viewingNetwork?.chainId && user) {
      if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
      refreshIntervalRef.current = setInterval(startEngine, 30000);
    }
    return () => { if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current); };
  }, [viewingNetwork?.chainId, wallets === null, user?.id, startEngine]);

  return { refresh: startEngine };
}
