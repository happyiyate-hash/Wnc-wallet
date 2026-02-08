'use client';

import React, { createContext, useContext, useState, ReactNode, useMemo, useEffect } from 'react';
import type { AssetRow, ChainConfig, UserProfile } from '@/lib/types';
import { useNetworkLogos } from '@/hooks/useNetworkLogos';
import { useUser } from './user-provider';
import { supabase } from '@/lib/supabase/client';

interface WalletContextType {
  isInitialized: boolean;
  hasNewNotifications: boolean;
  viewingNetwork: ChainConfig;
  setNetwork: (network: ChainConfig) => void;
  allAssets: AssetRow[];
  allChains: ChainConfig[];
  allChainsMap: { [key: string]: ChainConfig };
  isRefreshing: boolean;
  profile: UserProfile | null;
  wallets: { [chainId: number]: string } | null;
  infuraApiKey: string | null;
  setInfuraApiKey: (key: string | null) => void;
  refresh: () => Promise<void>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useUser();
  const { chainsWithLogos, areLogosLoading } = useNetworkLogos();
  
  const [viewingNetwork, setViewingNetwork] = useState<ChainConfig | null>(null);
  const [infuraApiKey, setInfuraApiKeyInternal] = useState<string | null>(null);
  const [balances, setBalances] = useState<any[]>([]);
  const [userData, setUserData] = useState<any>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (chainsWithLogos.length > 0 && !viewingNetwork) {
      setViewingNetwork(chainsWithLogos[0]);
    }
  }, [chainsWithLogos, viewingNetwork]);

  useEffect(() => {
    const savedKey = localStorage.getItem('infuraApiKey');
    if (savedKey) setInfuraApiKeyInternal(savedKey);
  }, []);

  const fetchData = async () => {
    if (!user) return;
    setIsRefreshing(true);
    
    try {
      // 1. Fetch user profile and wallets from public schemas
      const { data: wallets } = await supabase
        .from('wallets')
        .select(`
          *,
          blockchains (*)
        `)
        .eq('user_id', user.id);

      const walletMap = (wallets || []).reduce((acc: any, w: any) => {
        if (w.blockchains) acc[w.blockchains.chain_id] = w.address;
        return acc;
      }, {});

      setUserData({ 
        profile: { username: user.email?.split('@')[0] || 'User' }, 
        wallets: walletMap 
      });

      // 2. Fetch balances with asset info
      const { data: balanceData } = await supabase
        .from('balances')
        .select(`
          *,
          assets (
            *,
            blockchains (*)
          )
        `)
        .eq('user_id', user.id);
      
      setBalances(balanceData || []);
    } catch (e) {
      console.error("Error fetching wallet data:", e);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (!user) {
      setBalances([]);
      setUserData(null);
      return;
    }

    fetchData();

    // Subscribe to balance changes
    const balanceSubscription = supabase
      .channel('ledger-updates')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'balances',
        filter: `user_id=eq.${user.id}`
      }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(balanceSubscription);
    };
  }, [user]);

  const allChainsMap = useMemo(() => {
    return chainsWithLogos.reduce((acc, chain) => {
      acc[chain.chainId] = chain;
      return acc;
    }, {} as { [key: number]: ChainConfig });
  }, [chainsWithLogos]);

  const setNetwork = (network: ChainConfig) => setViewingNetwork(network);

  const setInfuraApiKey = (key: string | null) => {
    if (key) localStorage.setItem('infuraApiKey', key);
    else localStorage.removeItem('infuraApiKey');
    setInfuraApiKeyInternal(key);
  };

  const assetsForCurrentNetwork = useMemo(() => {
    if (!viewingNetwork) return [];
    
    return balances
      .filter(b => b.assets?.blockchains?.chain_id === viewingNetwork.chainId)
      .map(b => ({
        chainId: viewingNetwork.chainId,
        address: b.assets.contract_address || 'native',
        symbol: b.assets.symbol,
        name: b.assets.symbol,
        balance: b.balance?.toString() || '0',
        fiatValueUsd: (parseFloat(b.balance) || 0) * (parseFloat(b.price_usd) || 0),
        priceUsd: parseFloat(b.price_usd) || 0,
        pctChange24h: parseFloat(b.pct_change_24h) || 0,
        iconUrl: b.assets.icon_url || null,
        coingeckoId: b.assets.coingecko_id
      } as AssetRow));
  }, [balances, viewingNetwork]);

  const value: WalletContextType = {
    isInitialized: !authLoading && !areLogosLoading && !!viewingNetwork,
    hasNewNotifications: false,
    viewingNetwork: viewingNetwork || chainsWithLogos[0],
    setNetwork,
    allAssets: assetsForCurrentNetwork,
    allChains: chainsWithLogos,
    allChainsMap,
    isRefreshing,
    profile: userData?.profile || null,
    wallets: userData?.wallets || null,
    infuraApiKey,
    setInfuraApiKey,
    refresh: fetchData,
  };

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (context === undefined) throw new Error('useWallet must be used within a WalletProvider');
  return context;
}
