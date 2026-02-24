'use client';

import React, { createContext, useContext, useState, ReactNode, useMemo, useEffect, useCallback } from 'react';
import type { AssetRow, ChainConfig, WalletWithMetadata } from '@/lib/types';
import { useNetworkLogos } from '@/hooks/useNetworkLogos';
import { ethers } from 'ethers';
import { getInitialAssets } from '@/lib/wallets/balances';
import { useUser } from './user-provider';
import { useToast } from '@/hooks/use-toast';
import { fetchAssetPrices } from '@/lib/coingecko';
import { logoSupabase } from '@/lib/supabase/logo-client';

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
  const { user, loading: authLoading, signOut: authSignOut } = useUser();
  const { toast } = useToast();
  
  const [viewingNetwork, setViewingNetwork] = useState<ChainConfig | null>(null);
  const [wallets, setWallets] = useState<WalletWithMetadata[] | null>(null);
  const [balances, setBalances] = useState<{ [key: string]: AssetRow[] }>({});
  const [tokenRegistry, setTokenRegistry] = useState<{ [chainId: number]: any[] }>({});
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

  /**
   * DIRECT SUPABASE REGISTRY SYNC
   * Fetches the entire token_metadata table for each network from the secondary instance.
   */
  const fetchTokenRegistry = useCallback(async () => {
    if (!logoSupabase) return;
    const registry: { [chainId: number]: any[] } = {};

    const fetchPromises = chainsWithLogos.map(async (chain) => {
      try {
        const networkSlug = chain.name.split(' ')[0].toLowerCase();
        const { data, error } = await logoSupabase
          .from('token_metadata')
          .select('token_details, contract_address, network, logo_url')
          .eq('network', networkSlug);

        if (!error && data) {
          registry[chain.chainId] = data.map(token => ({
            symbol: token.token_details.symbol,
            name: token.token_details.name,
            decimals: token.token_details.decimals,
            network: token.network,
            contract: token.contract_address,
            logo_url: token.logo_url
          }));
        }
      } catch (e) {
        console.error(`Metadata sync failed for ${chain.name}:`, e);
      }
    });

    await Promise.all(fetchPromises);
    setTokenRegistry(registry);
  }, [chainsWithLogos]);

  useEffect(() => {
    if (chainsWithLogos.length > 0) {
      if (!viewingNetwork) setViewingNetwork(chainsWithLogos[0]);
      setIsInitialized(true);
      fetchTokenRegistry();
    }
  }, [chainsWithLogos, fetchTokenRegistry]);

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
      throw new Error(e.message || "Invalid mnemonic phrase.");
    }
  }, []);

  useEffect(() => {
    const initWallet = async () => {
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
    };
    initWallet();
  }, [authLoading, user, loadWalletFromMnemonic]);

  const fetchBalances = useCallback(async () => {
    if (!wallets || wallets.length === 0 || !isInitialized) return;
    if (!infuraApiKey) {
      setFetchError("Connect to a node to fetch balances.");
      return;
    }
    
    setIsRefreshing(true);
    setFetchError(null);

    const newBalances: { [key: string]: AssetRow[] } = {};

    try {
      const balancePromises = chainsWithLogos.map(async (chain) => {
        if (!chain.rpcUrl || !chain.chainId) return null;

        const apiTokens = tokenRegistry[chain.chainId] || [];
        const combinedAssetsList = getInitialAssets(chain.chainId).map(a => {
            const apiMeta = apiTokens.find(t => t.symbol === a.symbol);
            return {
                ...a,
                balance: '0',
                name: apiMeta?.name || a.name,
                iconUrl: apiMeta?.logo_url ? apiMeta.logo_url : (a.iconUrl || chain.iconUrl)
            } as AssetRow;
        });

        const rpcUrl = chain.rpcUrl.replace('{API_KEY}', infuraApiKey);
        try {
          const provider = new ethers.JsonRpcProvider(rpcUrl, undefined, { staticNetwork: true });
          
          const chainBalances = await Promise.all(combinedAssetsList.map(async (asset) => {
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
                balance: ethers.formatUnits(balance, 18), 
              } as AssetRow;
            } catch (e) {
              return asset;
            }
          }));

          return { chainId: chain.chainId, assets: chainBalances };
        } catch (e: any) {
          return { chainId: chain.chainId, assets: combinedAssetsList };
        }
      });

      const results = await Promise.all(balancePromises);
      results.forEach((res) => {
        if (res) newBalances[res.chainId] = res.assets;
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
      setFetchError("Market data sync issue.");
    } finally {
      setIsRefreshing(false);
    }
  }, [wallets, isInitialized, chainsWithLogos, infuraApiKey, tokenRegistry]);

  useEffect(() => {
    if (isInitialized && wallets && infuraApiKey) {
        fetchBalances();
    }
  }, [isInitialized, wallets, fetchBalances, infuraApiKey]);

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
