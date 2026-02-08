
'use client';

import React, { createContext, useContext, useState, ReactNode, useMemo, useEffect } from 'react';
import type { AssetRow, ChainConfig, UserProfile } from '@/lib/types';
import { useNetworkLogos } from '@/hooks/useNetworkLogos';
import { useUser, useCollection, useFirestore, useDoc } from '@/firebase';
import { collection, doc } from 'firebase/firestore';

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
  const db = useFirestore();
  const { chainsWithLogos, areLogosLoading } = useNetworkLogos();
  
  const [viewingNetwork, setViewingNetwork] = useState<ChainConfig | null>(null);
  const [infuraApiKey, setInfuraApiKeyInternal] = useState<string | null>(null);

  useEffect(() => {
    if (chainsWithLogos.length > 0 && !viewingNetwork) {
      setViewingNetwork(chainsWithLogos[0]);
    }
  }, [chainsWithLogos, viewingNetwork]);

  useEffect(() => {
    const savedKey = localStorage.getItem('infuraApiKey');
    if (savedKey) setInfuraApiKeyInternal(savedKey);
  }, []);

  // Real-time Profile and Wallets from Firestore
  const userRef = useMemo(() => (!db || !user) ? null : doc(db, 'users', user.uid), [db, user]);
  const { data: userData } = useDoc<any>(userRef);

  // Real-time Balances from the Internal Ledger
  const balancesQuery = useMemo(() => (!db || !user) ? null : collection(db, 'users', user.uid, 'balances'), [db, user]);
  const { data: ledgerBalances, loading: balancesLoading } = useCollection<any>(balancesQuery);

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

  // Merge the ledger balances with the frontend asset list
  const assetsForCurrentNetwork = useMemo(() => {
    if (!viewingNetwork) return [];
    
    // In this custodial model, we show assets that have a ledger entry in Firestore
    return (ledgerBalances || [])
      .filter(b => b.chainId === viewingNetwork.chainId)
      .map(b => ({
        chainId: b.chainId,
        address: b.contractAddress || 'native',
        symbol: b.symbol,
        name: b.name || b.symbol,
        balance: b.amount?.toString() || '0',
        fiatValueUsd: (b.amount || 0) * (b.priceUsd || 0),
        priceUsd: b.priceUsd || 0,
        pctChange24h: b.pctChange24h || 0,
        iconUrl: b.iconUrl || null,
        coingeckoId: b.coingeckoId
      } as AssetRow));
  }, [ledgerBalances, viewingNetwork]);

  const value: WalletContextType = {
    isInitialized: !authLoading && !areLogosLoading && !!viewingNetwork,
    hasNewNotifications: false,
    viewingNetwork: viewingNetwork || chainsWithLogos[0],
    setNetwork,
    allAssets: assetsForCurrentNetwork,
    allChains: chainsWithLogos,
    allChainsMap,
    isRefreshing: balancesLoading,
    profile: userData ? { username: userData.username || user?.displayName || 'User' } : null,
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
