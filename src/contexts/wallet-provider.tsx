
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

  // Fetch and Subscribe to Supabase Data
  useEffect(() => {
    if (!user) {
      setBalances([]);
      setUserData(null);
      return;
    }

    const fetchData = async () => {
      setIsRefreshing(true);
      
      // Fetch user profile and wallets
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      
      const { data: wallets } = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', user.id);

      const walletMap = (wallets || []).reduce((acc: any, w: any) => {
        // Find chain symbol for the wallet's blockchain_id
        const chain = chainsWithLogos.find(c => c.id === w.blockchain_id);
        if (chain) acc[chain.chainId] = w.address;
        return acc;
      }, {});

      setUserData({ profile, wallets: walletMap });

      // Fetch balances
      const { data: balanceData } = await supabase
        .from('balances')
        .select(`
          *,
          assets (*)
        `)
        .eq('user_id', user.id);
      
      setBalances(balanceData || []);
      setIsRefreshing(false);
    };

    fetchData();

    // Subscribe to balance changes
    const balanceSubscription = supabase
      .channel('schema-db-changes')
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
  }, [user, chainsWithLogos]);

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
      .filter(b => b.assets?.blockchain_id === viewingNetwork.id)
      .map(b => ({
        chainId: viewingNetwork.chainId,
        address: b.assets.contract_address || 'native',
        symbol: b.assets.symbol,
        name: b.assets.symbol,
        balance: b.balance?.toString() || '0',
        fiatValueUsd: (parseFloat(b.balance) || 0) * (b.price_usd || 0),
        priceUsd: b.price_usd || 0,
        pctChange24h: b.pct_change_24h || 0,
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
    profile: userData?.profile ? { username: userData.profile.username || user?.email?.split('@')[0] || 'User' } : null,
    wallets: userData?.wallets || null,
    infuraApiKey,
    setInfuraApiKey,
  };

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (context === undefined) throw new Error('useWallet must be used within a WalletProvider');
  return context;
}
