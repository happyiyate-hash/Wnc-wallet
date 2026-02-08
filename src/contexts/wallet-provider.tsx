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
  refresh: () => void;
  profile: UserProfile | null;
  custodialAddress: string | null;
  infuraApiKey: string | null;
  setInfuraApiKey: (key: string | null) => void;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useUser();
  const db = useFirestore();
  const { chainsWithLogos, areLogosLoading } = useNetworkLogos();
  
  const [viewingNetwork, setViewingNetwork] = useState<ChainConfig>(chainsWithLogos[0]);
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

  // Real-time User Profile from Firestore
  const userRef = useMemo(() => {
    if (!db || !user) return null;
    return doc(db, 'users', user.uid);
  }, [db, user]);

  const { data: userData } = useDoc<any>(userRef);

  // Real-time Balances from Firestore
  const balancesQuery = useMemo(() => {
    if (!db || !user) return null;
    return collection(db, 'users', user.uid, 'balances');
  }, [db, user]);

  const { data: firestoreBalances, loading: balancesLoading } = useCollection<any>(balancesQuery);

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
    if (!firestoreBalances) return [];
    return firestoreBalances
      .filter((b) => b.chainId === viewingNetwork?.chainId)
      .map((b) => ({
        ...b,
        balance: b.amount || '0',
        fiatValueUsd: Number(b.amount || 0) * (b.priceUsd || 0),
        iconUrl: b.iconUrl || null,
      }));
  }, [firestoreBalances, viewingNetwork]);

  const value: WalletContextType = {
    isInitialized: !authLoading && !areLogosLoading,
    hasNewNotifications: false,
    viewingNetwork: viewingNetwork || chainsWithLogos[0],
    setNetwork,
    allAssets: assetsForCurrentNetwork,
    allChains: chainsWithLogos,
    allChainsMap,
    isRefreshing: balancesLoading,
    refresh: () => {},
    profile: userData ? { username: userData.username || user?.displayName || user?.email || 'User' } : null,
    custodialAddress: userData?.custodialAddress || null,
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
