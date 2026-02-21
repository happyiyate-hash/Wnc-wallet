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
  restoreFromCloud: () => Promise<void>;
  logout: () => void;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: ReactNode }) {
  const { chainsWithLogos, areLogosLoading } = useNetworkLogos();
  const { user, profile, loading: authLoading, refreshProfile, signOut: authSignOut } = useUser();
  const { toast } = useToast();
  
  const [viewingNetwork, setViewingNetwork] = useState<ChainConfig | null>(null);
  const [infuraApiKey, setInfuraApiKeyInternal] = useState<string | null>(null);
  const [wallets, setWallets] = useState<WalletWithMetadata[] | null>(null);
  const [balances, setBalances] = useState<{ [key: string]: AssetRow[] }>({});
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Helper to load wallet into state
  const loadWalletFromMnemonic = useCallback((mnemonic: string) => {
    if (!user) return; // STRICT GUARD: No wallet loading without a user context
    
    try {
      const wallet = ethers.Wallet.fromPhrase(mnemonic.trim());
      setWallets([{ 
        address: wallet.address, 
        privateKey: wallet.privateKey,
        avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${wallet.address}`
      }]);
      localStorage.setItem(`wallet_mnemonic_${user.id}`, mnemonic.trim());
    } catch (e) {
      throw new Error("Invalid mnemonic phrase.");
    }
  }, [user]);

  // Recovery logic: Silent recovery ONLY if authenticated
  useEffect(() => {
    if (!authLoading && user) {
      const savedMnemonic = localStorage.getItem(`wallet_mnemonic_${user.id}`);
      if (savedMnemonic) {
        loadWalletFromMnemonic(savedMnemonic);
      }
    } else if (!authLoading && !user) {
      // Clear wallets if user logged out
      setWallets(null);
      setBalances({});
    }
  }, [authLoading, user, loadWalletFromMnemonic]);

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
  }, []);

  const backupToCloudInternal = async (mnemonic: string) => {
    if (!user || !supabase) return;
    try {
      const response = await fetch('/api/wallet/encrypt-phrase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phrase: mnemonic })
      });
      const { encrypted, iv } = await response.json();
      await supabase.from('profiles').update({ vault_phrase: encrypted, iv: iv }).eq('id', user.id);
      await refreshProfile();
    } catch (e) {
      console.error("Cloud backup failed", e);
    }
  };

  const generateWallet = useCallback(() => {
    if (!user) return '';
    const wallet = ethers.Wallet.createRandom();
    const mnemonic = wallet.mnemonic?.phrase || '';
    if (mnemonic) {
      loadWalletFromMnemonic(mnemonic);
      backupToCloudInternal(mnemonic); // Auto-backup on creation
      toast({ title: "Wallet Created", description: "Your new keys are secured in your cloud vault." });
    }
    return mnemonic;
  }, [loadWalletFromMnemonic, toast, user]);

  const importWallet = useCallback((mnemonic: string) => {
    if (!user) return;
    loadWalletFromMnemonic(mnemonic);
    backupToCloudInternal(mnemonic); // Sync imported wallet to vault
    toast({ title: "Wallet Imported", description: "Success! Your wallet is now active." });
  }, [loadWalletFromMnemonic, toast, user]);

  const restoreFromCloud = async () => {
    if (!user || !profile?.vault_phrase || !profile.iv) {
      toast({ variant: "destructive", title: "Restore Failed", description: "No cloud backup found." });
      return;
    }

    try {
      const response = await fetch('/api/wallet/decrypt-phrase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ encrypted: profile.vault_phrase, iv: profile.iv })
      });
      if (response.ok) {
        const { phrase } = await response.json();
        loadWalletFromMnemonic(phrase);
        toast({ title: "Cloud Restore Success", description: "Welcome back! Access restored." });
      } else {
        throw new Error("Decryption failed");
      }
    } catch (e) {
      toast({ variant: "destructive", title: "Restore Failed", description: "Could not decrypt vault phrase." });
    }
  };

  const backupToCloud = async () => {
    if (!user) return;
    const mnemonic = localStorage.getItem(`wallet_mnemonic_${user.id}`);
    if (mnemonic) await backupToCloudInternal(mnemonic);
    toast({ title: "Vault Synced", description: "Your backup is up to date." });
  };

  const logout = useCallback(() => {
    if (user) {
      localStorage.removeItem(`wallet_mnemonic_${user.id}`);
    }
    setWallets(null);
    setBalances({});
    authSignOut();
  }, [user, authSignOut]);

  const fetchBalances = useCallback(async () => {
    // STRICT GUARD: No balance fetching if no user, no wallet, or no RPC key
    if (!user || !wallets || wallets.length === 0 || !viewingNetwork || !infuraApiKey) return;
    
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
  }, [user, wallets, viewingNetwork, infuraApiKey]);

  useEffect(() => {
    if (isInitialized && user && wallets && infuraApiKey) {
        fetchBalances();
    }
  }, [isInitialized, user, wallets, infuraApiKey, viewingNetwork, fetchBalances]);

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
    isInitialized: isInitialized && !authLoading,
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
    restoreFromCloud,
    logout
  };

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (context === undefined) throw new Error('useWallet must be used within a WalletProvider');
  return context;
}
