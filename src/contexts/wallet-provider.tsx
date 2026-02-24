
'use client';

import React, { createContext, useContext, useState, ReactNode, useMemo, useEffect, useCallback } from 'react';
import type { AssetRow, ChainConfig, WalletWithMetadata } from '@/lib/types';
import { useNetworkLogos } from '@/hooks/useNetworkLogos';
import { ethers } from 'ethers';
import { getInitialAssets } from '@/lib/wallets/balances';
import { useUser } from './user-provider';
import { supabase } from '@/lib/supabase/client';
import { useToast } from '@/hooks/use-toast';

// ANKR MULTICHAIN CONFIGURATION
const ANKR_MULTICHAIN_URL = "https://rpc.ankr.com/multichain/";

// Mapping internal Chain IDs to Ankr-specific blockchain names
const ANKR_CHAIN_MAPPING: Record<number, string> = {
  1: 'eth',
  137: 'polygon',
  8453: 'base',
  10: 'optimism',
  42161: 'arbitrum',
  56: 'bsc',
  43114: 'avalanche',
  59144: 'linea',
  534352: 'scroll',
  324: 'zksync',
  81457: 'blast',
  5000: 'mantle',
  204: 'opbnb',
  1329: 'sei',
  42220: 'celo',
  130: 'unichain',
  1750: 'swellchain',
  1313161554: 'hemi'
};

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
  isTokenLoading: (chainId: number, symbol: string) => boolean;
  wallets: WalletWithMetadata[] | null;
  balances: { [key: string]: AssetRow[] };
  refresh: () => Promise<void>;
  importWallet: (mnemonic: string) => Promise<void>;
  generateWallet: () => Promise<string>;
  saveToVault: () => Promise<void>;
  restoreFromCloud: () => Promise<void>;
  logout: () => void;
  deleteWallet: () => void;
  fetchError: string | null;
  getAddressForChain: (chain: ChainConfig, wallets: WalletWithMetadata[]) => string | undefined;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: ReactNode }) {
  const { chainsWithLogos, areLogosLoading } = useNetworkLogos();
  const { user, profile, loading: authLoading, refreshProfile, signOut: authSignOut } = useUser();
  const { toast } = useToast();
  
  const [viewingNetwork, setViewingNetwork] = useState<ChainConfig | null>(null);
  const [wallets, setWallets] = useState<WalletWithMetadata[] | null>(null);
  const [balances, setBalances] = useState<{ [key: string]: AssetRow[] }>({});
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadingTokens, setLoadingTokens] = useState<Record<string, boolean>>({});
  const [isInitialized, setIsInitialized] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const isTokenLoading = useCallback((chainId: number, symbol: string) => {
    return loadingTokens[`${chainId}:${symbol}`] || false;
  }, [loadingTokens]);

  const getAddressForChain = useCallback((chain: ChainConfig, wallets: WalletWithMetadata[]): string | undefined => {
    if (wallets && wallets.length > 0) return wallets[0].address;
    return undefined;
  }, []);

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

  /**
   * REFACTORED: ANKR MULTICHAIN BALANCE FETCHING (PRO VERSION)
   * Merges Ankr live data with local metadata to ensure perfect logo and chain resolution.
   */
  const fetchBalances = useCallback(async () => {
    if (!wallets || wallets.length === 0 || !isInitialized) return;
    
    setIsRefreshing(true);
    setFetchError(null);

    try {
      const blockchainNames = Object.values(ANKR_CHAIN_MAPPING);

      const response = await fetch(ANKR_MULTICHAIN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'ankr_getAccountBalance',
          params: {
            walletAddress: wallets[0].address,
            blockchain: blockchainNames,
            onlyWhitelisted: true
          },
          id: 1
        }),
      });

      const result = await response.json();
      if (!response.ok || result.error) throw new Error(result.error?.message || "Ankr request failed");

      const assets = result.result?.assets || [];
      const newBalances: { [key: string]: AssetRow[] } = {};

      // Initialize all configured chains with zero-balance initial assets
      chainsWithLogos.forEach(chain => {
        newBalances[chain.chainId] = getInitialAssets(chain.chainId).map(a => ({
          ...a,
          balance: '0',
          fiatValueUsd: 0,
          priceUsd: 0,
          pctChange24h: 0,
          iconUrl: a.iconUrl || null
        } as AssetRow));
      });

      // Update balances with Ankr live data
      assets.forEach((ankrAsset: any) => {
        const chainIdKey = Object.keys(ANKR_CHAIN_MAPPING).find(key => ANKR_CHAIN_MAPPING[Number(key)] === ankrAsset.blockchain);
        if (!chainIdKey) return;
        
        const chainId = Number(chainIdKey);
        const internalChain = chainsWithLogos.find(c => c.chainId === chainId);
        if (!internalChain) return;

        // Find existing asset in our initial list or create new entry
        const existingIndex = newBalances[chainId].findIndex(a => a.symbol === ankrAsset.tokenSymbol);
        
        const updatedAsset: AssetRow = {
          chainId: chainId,
          address: ankrAsset.contractAddress || 'native',
          symbol: ankrAsset.tokenSymbol,
          name: ankrAsset.tokenName,
          balance: ankrAsset.balance,
          fiatValueUsd: parseFloat(ankrAsset.balanceUsd || '0'),
          priceUsd: parseFloat(ankrAsset.tokenPrice || '0'),
          pctChange24h: 0,
          isNative: !ankrAsset.contractAddress,
          iconUrl: ankrAsset.thumbnail || internalChain.iconUrl // Prefer Ankr thumbnail, fallback to internal chain logo
        };

        if (existingIndex > -1) {
          newBalances[chainId][existingIndex] = updatedAsset;
        } else {
          newBalances[chainId].push(updatedAsset);
        }
      });

      setBalances(newBalances);
    } catch (e: any) {
      console.error("Ankr Portfolio Fetch Error:", e);
      setFetchError(e.message || "Could not retrieve multi-chain portfolio.");
    } finally {
      setIsRefreshing(false);
    }
  }, [wallets, isInitialized, chainsWithLogos]);

  useEffect(() => {
    if (isInitialized && wallets) {
        fetchBalances();
    }
  }, [isInitialized, wallets, fetchBalances]);

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
    setNetwork: (net) => {
        setViewingNetwork(net);
        setFetchError(null);
    },
    allAssets: assetsForCurrentNetwork,
    allChains: chainsWithLogos,
    allChainsMap,
    isRefreshing,
    isTokenLoading,
    wallets,
    balances,
    refresh: fetchBalances,
    generateWallet,
    importWallet,
    saveToVault,
    restoreFromCloud,
    logout,
    deleteWallet,
    fetchError,
    getAddressForChain
  };

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (context === undefined) throw new Error('useWallet must be used within a WalletProvider');
  return context;
}
