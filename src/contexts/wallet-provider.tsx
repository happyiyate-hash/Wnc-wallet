'use client';

import React, { createContext, useContext, useState, ReactNode, useMemo, useEffect, useCallback } from 'react';
import type { AssetRow, ChainConfig, UserProfile, WalletWithMetadata } from '@/lib/types';
import { useNetworkLogos } from '@/hooks/useNetworkLogos';
import { ethers } from 'ethers';
import { getInitialAssets } from '@/lib/wallets/balances';
import { evmAdapterFactory } from '@/lib/wallets/adapters/evm';
import { fetchAssetPrices } from '@/lib/coingecko';
import { useUser } from './user-provider';
import { supabase } from '@/lib/supabase/client';
import { useToast } from '@/hooks/use-toast';

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
  wallets: WalletWithMetadata[] | null;
  infuraApiKey: string | null;
  setInfuraApiKey: (key: string | null) => void;
  refresh: () => Promise<void>;
  importWallet: (mnemonic: string) => void;
  generateWallet: () => string;
  backupToCloud: () => Promise<void>;
  logout: () => void;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: ReactNode }) {
  const { chainsWithLogos, areLogosLoading } = useNetworkLogos();
  const { user, profile, refreshProfile } = useUser();
  const { toast } = useToast();
  
  const [viewingNetwork, setViewingNetwork] = useState<ChainConfig | null>(null);
  const [infuraApiKey, setInfuraApiKeyInternal] = useState<string | null>(null);
  const [wallets, setWallets] = useState<WalletWithMetadata[] | null>(null);
  const [balances, setBalances] = useState<{ [key: string]: AssetRow[] }>({});
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Recovery logic: Try to decrypt cloud mnemonic if local is missing
  useEffect(() => {
    const checkCloudRecovery = async () => {
      if (user && profile?.vault_phrase && profile.iv && !localStorage.getItem('wallet_mnemonic')) {
        try {
          const response = await fetch('/api/wallet/decrypt-phrase', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ encrypted: profile.vault_phrase, iv: profile.iv })
          });
          if (response.ok) {
            const { phrase } = await response.json();
            importWallet(phrase);
            toast({ title: "Wallet Recovered", description: "Your wallet was restored from your secure cloud vault." });
          }
        } catch (e) {
          console.error("Cloud recovery failed", e);
        }
      }
    };
    checkCloudRecovery();
  }, [user, profile, toast]);

  useEffect(() => {
    if (chainsWithLogos.length > 0) {
      if (!viewingNetwork) {
        setViewingNetwork(chainsWithLogos[0]);
      }
      setIsInitialized(true);
    }
  }, [chainsWithLogos, viewingNetwork]);

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

  const backupToCloud = async () => {
    const mnemonic = localStorage.getItem('wallet_mnemonic');
    if (!user || !mnemonic || !supabase) return;

    try {
      const response = await fetch('/api/wallet/encrypt-phrase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phrase: mnemonic })
      });
      const { encrypted, iv } = await response.json();

      const { error } = await supabase
        .from('profiles')
        .update({ vault_phrase: encrypted, iv: iv })
        .eq('id', user.id);

      if (error) throw error;
      await refreshProfile();
      toast({ title: "Backup Successful", description: "Your wallet is now secured in your cloud vault." });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Backup Failed", description: e.message });
    }
  };

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
    if (isInitialized && wallets && infuraApiKey) {
        fetchBalances();
    }
  }, [isInitialized, wallets, infuraApiKey, viewingNetwork, fetchBalances]);

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
    backupToCloud,
    logout
  };

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (context === undefined) throw new Error('useWallet must be used within a WalletProvider');
  return context;
}
