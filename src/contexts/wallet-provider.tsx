'use client';

import React, { createContext, useContext, useState, ReactNode, useMemo, useEffect, useCallback } from 'react';
import type { AssetRow, ChainConfig, WalletWithMetadata } from '@/lib/types';
import { useNetworkLogos } from '@/hooks/useNetworkLogos';
import { ethers } from 'ethers';
import { getInitialAssets } from '@/lib/wallets/balances';
import { useUser } from './user-provider';
import { supabase } from '@/lib/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { fetchAssetPrices } from '@/lib/coingecko';

interface WalletContextType {
  isInitialized: boolean;
  isAssetsLoading: boolean;
  isWalletLoading: boolean;
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
  infuraApiKey: string | null;
  setInfuraApiKey: (key: string | null) => void;
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
  const [isWalletLoading, setIsWalletLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [infuraApiKey, setInfuraApiKey] = useState<string | null>(null);

  useEffect(() => {
    const savedKey = localStorage.getItem('infura_api_key');
    if (savedKey) setInfuraApiKey(savedKey);
  }, []);

  const handleSetApiKey = (key: string | null) => {
    setInfuraApiKey(key);
    if (key) localStorage.setItem('infura_api_key', key);
    else localStorage.removeItem('infura_api_key');
  };

  const isTokenLoading = useCallback((chainId: number, symbol: string) => {
    return loadingTokens[`${chainId}:${symbol}`] || false;
  }, [loadingTokens]);

  const getAddressForChain = useCallback((chain: ChainConfig, wallets: WalletWithMetadata[]): string | undefined => {
    if (wallets && wallets.length > 0) return wallets[0].address;
    return undefined;
  }, []);

  const loadWalletFromMnemonic = useCallback((mnemonic: string) => {
    if (!mnemonic) return;
    try {
      const cleanMnemonic = mnemonic.trim();
      if (!ethers.Mnemonic.isValidMnemonic(cleanMnemonic)) throw new Error("Invalid mnemonic phrase structure.");
      const wallet = ethers.Wallet.fromPhrase(cleanMnemonic);
      setWallets([{ 
        address: wallet.address, 
        privateKey: wallet.privateKey,
        avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${wallet.address}`
      }]);
    } catch (e: any) {
      console.error("Mnemonic load error:", e);
      throw new Error(e.message || "Invalid mnemonic phrase.");
    }
  }, []);

  useEffect(() => {
    if (!authLoading) {
      if (user) {
        const savedMnemonic = localStorage.getItem(`wallet_mnemonic_${user.id}`);
        if (savedMnemonic) {
          try {
            loadWalletFromMnemonic(savedMnemonic);
          } catch (e) {
            localStorage.removeItem(`wallet_mnemonic_${user.id}`);
          }
        }
      } else {
        setWallets(null);
        setBalances({});
      }
      setIsWalletLoading(false);
    }
  }, [authLoading, user, loadWalletFromMnemonic]);

  useEffect(() => {
    if (chainsWithLogos.length > 0) {
      if (!viewingNetwork) setViewingNetwork(chainsWithLogos[0]);
      setIsInitialized(true);
    }
  }, [chainsWithLogos, viewingNetwork]);

  const fetchBalances = useCallback(async () => {
    if (!wallets || wallets.length === 0 || !isInitialized) return;
    if (!infuraApiKey) {
      setFetchError("Please provide an Infura API Key in Settings to fetch live balances.");
      return;
    }
    
    setIsRefreshing(true);
    setFetchError(null);

    const newBalances: { [key: string]: AssetRow[] } = {};

    try {
      const balancePromises = chainsWithLogos.map(async (chain) => {
        if (!chain.rpcUrl || !chain.chainId) return null;

        const rpcUrl = chain.rpcUrl.replace('{API_KEY}', infuraApiKey);
        try {
          const provider = new ethers.JsonRpcProvider(rpcUrl, undefined, { staticNetwork: true });
          const initialAssets = getInitialAssets(chain.chainId);
          
          const chainBalances = await Promise.all(initialAssets.map(async (asset) => {
            try {
              let balance;
              if (asset.isNative) {
                balance = await provider.getBalance(wallets[0].address);
              } else {
                const abi = ["function balanceOf(address owner) view returns (uint256)"];
                const contract = new ethers.Contract(asset.address, abi, provider);
                balance = await contract.balanceOf(wallets[0].address);
              }
              return {
                ...asset,
                balance: ethers.formatUnits(balance, 18), // Assuming standard 18 decimals for simplicity in this proto
                iconUrl: asset.iconUrl || chain.iconUrl
              } as AssetRow;
            } catch (e) {
              return { ...asset, balance: '0', iconUrl: asset.iconUrl || chain.iconUrl } as AssetRow;
            }
          }));

          return { chainId: chain.chainId, assets: chainBalances };
        } catch (e: any) {
          return null;
        }
      });

      const results = await Promise.all(balancePromises);
      
      results.forEach((res) => {
        if (res) {
          newBalances[res.chainId] = res.assets;
        }
      });

      // Fill in chains that failed
      chainsWithLogos.forEach(chain => {
        if (chain.chainId && !newBalances[chain.chainId]) {
          newBalances[chain.chainId] = getInitialAssets(chain.chainId).map(a => ({
            ...a,
            balance: '0',
            iconUrl: a.iconUrl || chain.iconUrl
          } as AssetRow));
        }
      });

      const flatAssets = Object.values(newBalances).flat();
      const assetsWithPrices = await fetchAssetPrices(flatAssets as any);
      
      const finalBalances: { [key: string]: AssetRow[] } = {};
      assetsWithPrices.forEach(asset => {
        if (!finalBalances[asset.chainId]) finalBalances[asset.chainId] = [];
        finalBalances[asset.chainId].push(asset);
      });

      setBalances(finalBalances);
    } catch (e: any) {
      console.error("Global Balance Fetch Error:", e);
      setFetchError("Market data sync issues. Some balances may be stale.");
    } finally {
      setIsRefreshing(false);
    }
  }, [wallets, isInitialized, chainsWithLogos, infuraApiKey]);

  useEffect(() => {
    if (isInitialized && wallets) {
        fetchBalances();
    }
  }, [isInitialized, wallets, fetchBalances]);

  const generateWallet = useCallback(async () => {
    if (!user) return '';
    const wallet = ethers.Wallet.createRandom();
    const mnemonic = wallet.mnemonic?.phrase || '';
    if (mnemonic) {
      loadWalletFromMnemonic(mnemonic);
      localStorage.setItem(`wallet_mnemonic_${user.id}`, mnemonic);
      toast({ title: "Wallet Created", description: "Keys saved locally." });
    }
    return mnemonic;
  }, [loadWalletFromMnemonic, toast, user]);

  const importWallet = useCallback(async (mnemonic: string) => {
    if (!user) return;
    try {
      loadWalletFromMnemonic(mnemonic);
      localStorage.setItem(`wallet_mnemonic_${user.id}`, mnemonic.trim());
      toast({ title: "Wallet Imported", description: "Success!" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Import Error", description: e.message });
    }
  }, [loadWalletFromMnemonic, toast, user]);

  const logout = useCallback(() => {
    if (user) localStorage.removeItem(`wallet_mnemonic_${user.id}`);
    setWallets(null);
    setBalances({});
    authSignOut();
  }, [user, authSignOut]);

  const deleteWallet = useCallback(() => {
    if (user) localStorage.removeItem(`wallet_mnemonic_${user.id}`);
    setWallets(null);
    setBalances({});
  }, [user]);

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
    isWalletLoading,
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
    saveToVault: async () => {},
    restoreFromCloud: async () => {},
    logout,
    deleteWallet,
    fetchError,
    getAddressForChain,
    infuraApiKey,
    setInfuraApiKey: handleSetApiKey
  };

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (context === undefined) throw new Error('useWallet must be used within a WalletProvider');
  return context;
}
