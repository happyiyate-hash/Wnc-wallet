'use client';

import React, { createContext, useContext, useState, ReactNode, useMemo, useEffect, useCallback } from 'react';
import type { AssetRow, ChainConfig, UserProfile, WalletWithMetadata } from '@/lib/types';
import { useNetworkLogos } from '@/hooks/useNetworkLogos';
import { ethers } from 'ethers';
import { getInitialAssets } from '@/lib/wallets/balances';
import { evmAdapterFactory } from '@/lib/wallets/adapters/evm';
import { fetchAssetPrices } from '@/lib/coingecko';
import { supabase } from '@/lib/supabase/client';

interface WalletContextType {
  isInitialized: boolean;
  isAssetsLoading: boolean;
  hasNewNotifications: boolean;
  viewingNetwork: ChainConfig;
  setNetwork: (network: ChainConfig) => void;
  allAssets: AssetRow[];
  allChains: ChainConfig[];
  allChainsMap: { [key: string]: ChainConfig };
  isRefreshing: boolean;
  profile: UserProfile | null;
  wallets: WalletWithMetadata[] | null;
  infuraApiKey: string | null;
  setInfuraApiKey: (key: string | null) => void;
  refresh: () => Promise<void>;
  importWallet: (mnemonic: string) => void;
  generateWallet: () => string;
  logout: () => void;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: ReactNode }) {
  const { chainsWithLogos, areLogosLoading } = useNetworkLogos();
  
  const [viewingNetwork, setViewingNetwork] = useState<ChainConfig | null>(null);
  const [infuraApiKey, setInfuraApiKeyInternal] = useState<string | null>(null);
  const [wallets, setWallets] = useState<WalletWithMetadata[] | null>(null);
  const [balances, setBalances] = useState<{ [key: string]: AssetRow[] }>({});
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize viewing network and basic state
  useEffect(() => {
    if (chainsWithLogos.length > 0) {
      if (!viewingNetwork) {
        setViewingNetwork(chainsWithLogos[0]);
      }
      setIsInitialized(true);
    }
  }, [chainsWithLogos, viewingNetwork]);

  // Load persistence
  useEffect(() => {
    const savedKey = localStorage.getItem('infuraApiKey');
    if (savedKey) setInfuraApiKeyInternal(savedKey);

    const savedMnemonic = localStorage.getItem('wallet_mnemonic');
    if (savedMnemonic) {
      try {
        const wallet = ethers.Wallet.fromPhrase(savedMnemonic);
        setWallets([{ 
          address: wallet.address, 
          privateKey: wallet.privateKey,
          avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${wallet.address}`
        }]);
      } catch (e) {
        console.error("Failed to load saved wallet", e);
      }
    }
  }, []);

  const generateWallet = useCallback(() => {
    const wallet = ethers.Wallet.createRandom();
    const mnemonic = wallet.mnemonic?.phrase || '';
    if (mnemonic) {
      localStorage.setItem('wallet_mnemonic', mnemonic);
      setWallets([{ 
        address: wallet.address, 
        privateKey: wallet.privateKey,
        avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${wallet.address}`
      }]);
    }
    return mnemonic;
  }, []);

  const importWallet = useCallback((mnemonic: string) => {
    try {
      const wallet = ethers.Wallet.fromPhrase(mnemonic.trim());
      localStorage.setItem('wallet_mnemonic', mnemonic.trim());
      setWallets([{ 
        address: wallet.address, 
        privateKey: wallet.privateKey,
        avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${wallet.address}`
      }]);
    } catch (e) {
      throw new Error("Invalid mnemonic phrase. Please ensure it is 12 or 24 words.");
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('wallet_mnemonic');
    setWallets(null);
    setBalances({});
  }, []);

  const fetchBalances = useCallback(async () => {
    if (!wallets || wallets.length === 0 || !viewingNetwork || !infuraApiKey) return;
    setIsRefreshing(true);

    try {
      const adapter = evmAdapterFactory(viewingNetwork, infuraApiKey);
      if (!adapter) throw new Error("Adapter not supported");

      const baseAssets = getInitialAssets(viewingNetwork.chainId);
      const rawBalances = await adapter.fetchBalances(wallets[0].address, baseAssets);
      const assetsWithPrices = await fetchAssetPrices(rawBalances);

      setBalances(prev => ({
        ...prev,
        [viewingNetwork.chainId]: assetsWithPrices
      }));
    } catch (e) {
      console.error("Fetch balances failed", e);
    } finally {
      setIsRefreshing(false);
    }
  }, [wallets, viewingNetwork, infuraApiKey]);

  useEffect(() => {
    fetchBalances();
  }, [fetchBalances]);

  const allChainsMap = useMemo(() => {
    return chainsWithLogos.reduce((acc, chain) => {
      acc[chain.chainId] = chain;
      return acc;
    }, {} as { [key: number]: ChainConfig });
  }, [chainsWithLogos]);

  const assetsForCurrentNetwork = useMemo(() => {
    if (!viewingNetwork) return [];
    return balances[viewingNetwork.chainId] || getInitialAssets(viewingNetwork.chainId).map(a => ({ ...a, balance: '0' } as AssetRow));
  }, [balances, viewingNetwork]);

  const value: WalletContextType = {
    isInitialized,
    isAssetsLoading: areLogosLoading,
    hasNewNotifications: false,
    viewingNetwork: viewingNetwork || chainsWithLogos[0],
    setNetwork: setViewingNetwork,
    allAssets: assetsForCurrentNetwork,
    allChains: chainsWithLogos,
    allChainsMap,
    isRefreshing,
    profile: wallets ? { username: 'Self-Custody' } : null,
    wallets,
    infuraApiKey,
    setInfuraApiKey: (key) => {
      if (key) localStorage.setItem('infuraApiKey', key);
      else localStorage.removeItem('infuraApiKey');
      setInfuraApiKeyInternal(key);
    },
    refresh: fetchBalances,
    generateWallet,
    importWallet,
    logout
  };

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (context === undefined) throw new Error('useWallet must be used within a WalletProvider');
  return context;
}
