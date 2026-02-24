
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
   * REFACTORED: ANKR MULTICHAIN BALANCE FETCHING
   * Fetches all tokens across all chains in a single efficient request.
   */
  const fetchBalances = useCallback(async () => {
    if (!wallets || wallets.length === 0) return;
    
    setIsRefreshing(true);
    setFetchError(null);

    try {
      // Prepare the list of blockchain names Ankr understands
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
      if (result.error) throw new Error(result.error.message);

      const assets = result.result?.assets || [];
      const newBalances: { [key: string]: AssetRow[] } = {};

      // Map Ankr assets back to our ChainID-based balance state
      assets.forEach((asset: any) => {
        const chainId = Object.keys(ANKR_CHAIN_MAPPING).find(key => ANKR_CHAIN_MAPPING[Number(key)] === asset.blockchain);
        if (!chainId) return;

        if (!newBalances[chainId]) newBalances[chainId] = [];

        newBalances[chainId].push({
          chainId: Number(chainId),
          address: asset.contractAddress || 'native',
          symbol: asset.tokenSymbol,
          name: asset.tokenName,
          balance: asset.balance,
          fiatValueUsd: parseFloat(asset.balanceUsd),
          priceUsd: parseFloat(asset.tokenPrice),
          pctChange24h: 0, // Ankr simple balance doesn't always provide 24h change directly here
          isNative: !asset.contractAddress,
          iconUrl: asset.thumbnail
        } as AssetRow);
      });

      // Ensure every network has its entry, even if Ankr didn't find tokens
      Object.keys(ANKR_CHAIN_MAPPING).forEach(chainId => {
        if (!newBalances[chainId]) {
          // If no tokens found by Ankr, populate with our initial placeholder assets (0 balance)
          newBalances[chainId] = getInitialAssets(Number(chainId)).map(a => ({
            ...a,
            balance: '0',
            fiatValueUsd: 0,
            priceUsd: 0,
            pctChange24h: 0
          } as AssetRow));
        } else {
          // Merge Ankr data with initialAssets to ensure we don't miss core tokens the user expects to see
          const initial = getInitialAssets(Number(chainId));
          initial.forEach(initAsset => {
            const found = newBalances[chainId].find(b => b.symbol === initAsset.symbol);
            if (!found) {
              newBalances[chainId].push({
                ...initAsset,
                balance: '0',
                fiatValueUsd: 0,
                priceUsd: 0,
                pctChange24h: 0
              } as AssetRow);
            }
          });
        }
      });

      setBalances(newBalances);
    } catch (e: any) {
      console.error("Ankr Multichain fetch failed", e);
      setFetchError(e.message || "Could not fetch multi-chain balances.");
    } finally {
      setIsRefreshing(false);
    }
  }, [wallets]);

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
