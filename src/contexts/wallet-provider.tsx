'use client';

import React, { createContext, useContext, useState, ReactNode, useMemo, useEffect, useCallback } from 'react';
import type { AssetRow, ChainConfig, WalletWithMetadata } from '@/lib/types';
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
  importWallet: (mnemonic: string) => Promise<void>;
  generateWallet: () => Promise<string>;
  saveToVault: () => Promise<void>;
  restoreFromCloud: () => Promise<void>;
  logout: () => void;
  deleteWallet: () => void;
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

  const loadWalletFromMnemonic = useCallback((mnemonic: string) => {
    if (!user || !mnemonic) return;
    
    try {
      const cleanMnemonic = mnemonic.trim();
      if (!ethers.Mnemonic.isValidMnemonic(cleanMnemonic)) {
        throw new Error("Invalid mnemonic phrase structure.");
      }

      const wallet = ethers.Wallet.fromPhrase(cleanMnemonic);
      
      setWallets([{ 
        address: wallet.address, 
        privateKey: wallet.privateKey,
        avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${wallet.address}`
      }]);
      
      localStorage.setItem(`wallet_mnemonic_${user.id}`, cleanMnemonic);
    } catch (e: any) {
      console.error("Mnemonic load error:", e);
      throw new Error(e.message || "Invalid mnemonic phrase.");
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading && user) {
      const savedMnemonic = localStorage.getItem(`wallet_mnemonic_${user.id}`);
      if (savedMnemonic) {
        try {
          loadWalletFromMnemonic(savedMnemonic);
        } catch (e) {
          localStorage.removeItem(`wallet_mnemonic_${user.id}`);
        }
      }
    } else if (!authLoading && !user) {
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

  const getAuthToken = async () => {
    if (!supabase) return null;
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token;
  };

  const saveToVaultInternal = async (mnemonic: string) => {
    if (!user || !supabase) return;
    try {
      const token = await getAuthToken();
      if (!token) throw new Error("No active session");

      const response = await fetch('/api/wallet/encrypt-phrase', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ phrase: mnemonic })
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Encryption failed');
      
      const { encrypted, iv } = data;
      const { error: updateError } = await supabase.from('profiles').update({ vault_phrase: encrypted, iv: iv }).eq('id', user.id);
      if (updateError) throw updateError;

      await refreshProfile();
    } catch (e: any) {
      console.error("Cloud backup failed", e);
      toast({ variant: "destructive", title: "Backup Failed", description: e.message || "Could not sync keys to Cloud Vault." });
    }
  };

  const generateWallet = useCallback(async () => {
    if (!user) return '';
    const wallet = ethers.Wallet.createRandom();
    const mnemonic = wallet.mnemonic?.phrase || '';
    if (mnemonic) {
      loadWalletFromMnemonic(mnemonic);
      await saveToVaultInternal(mnemonic);
      toast({ title: "Wallet Created", description: "Your new keys are secured in your cloud vault." });
    }
    return mnemonic;
  }, [loadWalletFromMnemonic, toast, user]);

  const importWallet = useCallback(async (mnemonic: string) => {
    if (!user) return;
    try {
      loadWalletFromMnemonic(mnemonic);
      await saveToVaultInternal(mnemonic);
      toast({ title: "Wallet Imported", description: "Success! Your wallet is now active." });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Import Error", description: e.message });
    }
  }, [loadWalletFromMnemonic, toast, user]);

  const restoreFromCloud = async () => {
    if (!user || !supabase) return;
    
    // Refresh profile to get latest vault data
    await refreshProfile();
    
    // Access profile from the updated state or the already available one
    // Note: React state updates might not be immediate, so we re-fetch if needed
    const { data: latestProfile } = await supabase.from('profiles').select('vault_phrase, iv').eq('id', user.id).single();

    if (!latestProfile?.vault_phrase || !latestProfile?.iv) {
      toast({ variant: "destructive", title: "Restore Failed", description: "No cloud backup found for this account." });
      return;
    }

    try {
      const token = await getAuthToken();
      if (!token) throw new Error("Unauthorized: Please log in again.");

      const response = await fetch('/api/wallet/decrypt-phrase', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          encrypted: latestProfile.vault_phrase, 
          iv: latestProfile.iv 
        })
      });
      
      const data = await response.json();
      
      if (response.ok && data.phrase) {
        loadWalletFromMnemonic(data.phrase);
        toast({ title: "Cloud Restore Success", description: "Welcome back! Access restored from vault." });
      } else {
        throw new Error(data.message || "Decryption failed on the server.");
      }
    } catch (e: any) {
      console.error("Restore error:", e);
      toast({ variant: "destructive", title: "Restore Failed", description: e.message });
    }
  };

  const saveToVault = async () => {
    if (!user) return;
    const mnemonic = localStorage.getItem(`wallet_mnemonic_${user.id}`);
    if (mnemonic) await saveToVaultInternal(mnemonic);
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

  const deleteWallet = useCallback(() => {
    if (user) {
      localStorage.removeItem(`wallet_mnemonic_${user.id}`);
    }
    setWallets(null);
    setBalances({});
  }, [user]);

  const fetchBalances = useCallback(async () => {
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
    saveToVault,
    restoreFromCloud,
    logout,
    deleteWallet
  };

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (context === undefined) throw new Error('useWallet must be used within a WalletProvider');
  return context;
}