'use client';

import React, { createContext, useContext, useState, ReactNode, useMemo, useEffect, useCallback } from 'react';
import type { AssetRow, ChainConfig, WalletWithMetadata } from '@/lib/types';
import { useNetworkLogos } from '@/hooks/useNetworkLogos';
import { ethers } from 'ethers';
import { getInitialAssets } from '@/lib/wallets/balances';
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

  const getAuthToken = useCallback(async () => {
    if (!supabase) return null;
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token;
  }, []);

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
  }, [loadWalletFromMnemonic, toast, user, getAuthToken]);

  const importWallet = useCallback(async (mnemonic: string) => {
    if (!user) return;
    try {
      loadWalletFromMnemonic(mnemonic);
      await saveToVaultInternal(mnemonic);
      toast({ title: "Wallet Imported", description: "Success! Your wallet is now active." });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Import Error", description: e.message });
    }
  }, [loadWalletFromMnemonic, toast, user, getAuthToken]);

  const restoreFromCloud = async () => {
    if (!user || !supabase) {
        toast({ variant: "destructive", title: "Restore Failed", description: "Login required to access cloud vault." });
        return;
    }
    
    setIsRefreshing(true);
    try {
      await refreshProfile();
      
      const { data: latestProfile, error: fetchError } = await supabase
        .from('profiles')
        .select('vault_phrase, iv')
        .eq('id', user.id)
        .single();

      if (fetchError || !latestProfile?.vault_phrase || !latestProfile?.iv) {
        throw new Error("No cloud backup found for this account.");
      }

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
    } finally {
      setIsRefreshing(false);
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
    if (!user || !wallets || wallets.length === 0 || !viewingNetwork) return;
    
    setIsRefreshing(true);

    try {
      const provider = new ethers.JsonRpcProvider(`${viewingNetwork.rpcBase}${infuraApiKey || ''}`);
      const baseAssets = getInitialAssets(viewingNetwork.chainId);
      
      const balancePromises = baseAssets.map(async (asset) => {
        try {
          if (asset.isNative) {
            const bal = await provider.getBalance(wallets[0].address);
            return { ...asset, balance: ethers.formatEther(bal) };
          } else {
            const abi = ["function balanceOf(address owner) view returns (uint256)", "function decimals() view returns (uint8)"];
            const contract = new ethers.Contract(asset.address, abi, provider);
            const [bal, decimals] = await Promise.all([
              contract.balanceOf(wallets[0].address),
              contract.decimals()
            ]);
            return { ...asset, balance: ethers.formatUnits(bal, decimals) };
          }
        } catch (e) {
          return { ...asset, balance: '0' };
        }
      });

      const rawBalances = await Promise.all(balancePromises);
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
    if (isInitialized && user && wallets) {
        fetchBalances();
    }
  }, [isInitialized, user, wallets, viewingNetwork, fetchBalances]);

  const allChainsMap = useMemo(() => {
    return chainsWithLogos.reduce((acc, chain) => {
      acc[chain.chainId] = chain;
      return acc;
    }, {} as { [key: number]: ChainConfig });
  }, [chainsWithLogos]);

  const assetsForCurrentNetwork = useMemo(() => {
    if (!viewingNetwork) return [];
    // CRITICAL: Strictly filter to show only assets for the active chainId
    return (balances[viewingNetwork.chainId] || getInitialAssets(viewingNetwork.chainId).map(a => ({ ...a, balance: '0' } as AssetRow))).filter(a => a.chainId === viewingNetwork.chainId);
  }, [balances, viewingNetwork]);

  const value: WalletContextType = {
    isInitialized: isInitialized && !authLoading,
    isAssetsLoading: areLogosLoading,
    hasNewNotifications: false,
    viewingNetwork: viewingNetwork || chainsWithLogos[0],
    setNetwork: (net) => {
        // Hard Reset: Clear local balance state for the current view before switching
        setViewingNetwork(net);
    },
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
