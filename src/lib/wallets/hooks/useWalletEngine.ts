
'use client';

import { useEffect, useRef, useCallback } from 'react';
import type { ChainConfig, WalletWithMetadata, AssetRow } from '@/lib/types';
import { fetchGlobalMarketData, type PriceResult } from '@/lib/market/price-service';
import { fetchBalancesForChain } from '../services/balance-service';

/**
 * INSTITUTIONAL DATA REFRESH ENGINE
 * Implements Prioritized Sequential Handshake:
 * 1. Global Market Discovery (Prices)
 * 2. Active Network Handshake (Balances)
 * 3. Secondary Network Audit (Lazy Background)
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
  const isRunningRef = useRef(false);

  const startEngine = useCallback(async () => {
    if (!wallets || wallets.length === 0 || !viewingNetwork || !user || isRunningRef.current) return;
    
    isRunningRef.current = true;
    setIsRefreshing(true);
    
    try {
      console.log("[ENGINE] Starting global market audit...");
      // PHASE 1: ATOMIC REGISTRY HYDRATION (Prices + Active Network)
      const newPrices = await fetchGlobalMarketData(chainsWithLogos, userAddedTokens, rates, {});
      setPrices(newPrices);
      
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

      // PHASE 2: LAZY SECONDARY HANDSHAKE
      const otherChains = chainsWithLogos.filter(c => c.chainId !== viewingNetwork.chainId);
      
      // Sequential background load to prevent RPC bottleneck
      for (const chain of otherChains) {
        if (!isRunningRef.current) break; // Terminate if user logs out during loop
        
        const secondaryBalances = await fetchBalancesForChain(
          chain,
          wallets,
          infuraApiKey,
          userAddedTokens
        );

        setBalances(prev => ({
          ...prev,
          [chain.chainId]: secondaryBalances
        }));
        
        // Small breather between chain audits
        await new Promise(r => setTimeout(r, 500));
      }
      
    } catch (e) {
      console.warn("[ENGINE_ADVISORY] Registry sync interrupted:", e);
      setHasFetchedInitialData(true); // Don't block UI on error
    } finally { 
      setIsRefreshing(false); 
      isRunningRef.current = false;
    }
  }, [wallets, viewingNetwork, user, chainsWithLogos, userAddedTokens, rates, infuraApiKey, setPrices, setBalances, setIsRefreshing, setHasFetchedInitialData]);

  /**
   * INITIAL & REACTIVE TRIGGER
   * Fixed dependency array to correctly watch for the presence of wallets
   */
  useEffect(() => {
    if (wallets && wallets.length > 0 && viewingNetwork?.chainId && user) {
      startEngine();
    }
  }, [viewingNetwork?.chainId, !!wallets, user?.id, startEngine]);

  /**
   * PERIODIC REFRESH LOOP (60s for full registry audit)
   */
  useEffect(() => {
    if (wallets && wallets.length > 0 && viewingNetwork?.chainId && user) {
      const interval = setInterval(startEngine, 60000);
      return () => clearInterval(interval);
    }
  }, [viewingNetwork?.chainId, !!wallets, user?.id, startEngine]);

  return { refresh: startEngine };
}
