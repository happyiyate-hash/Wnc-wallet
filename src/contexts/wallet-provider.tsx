
'use client';

import React, { createContext, useContext, useState, ReactNode, useMemo, useEffect, useCallback, useRef } from 'react';
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
  // Visibility & Custom Token Management
  hiddenTokenKeys: Set<string>;
  toggleTokenVisibility: (chainId: number, symbol: string) => void;
  userAddedTokens: AssetRow[];
  addUserToken: (token: AssetRow) => void;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

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

  // Visibility & Dynamic States
  const [hiddenTokenKeys, setHiddenTokenKeys] = useState<Set<string>>(new Set());
  const [userAddedTokens, setUserAddedTokens] = useState<AssetRow[]>([]);

  // Persistence Refs
  const isBackgroundFetching = useRef(false);

  // 1. Load Initial State from Cache
  useEffect(() => {
    const savedKey = localStorage.getItem('infura_api_key');
    if (savedKey) setInfuraApiKey(savedKey);

    if (user) {
        // Load Balances
        const cachedBalances = localStorage.getItem(`wallet_balances_${user.id}`);
        if (cachedBalances) {
            try {
                setBalances(JSON.parse(cachedBalances));
            } catch (e) {
                console.warn("Failed to parse cached balances");
            }
        }

        // Load Visibility Preferences
        const savedHidden = localStorage.getItem(`hidden_tokens_${user.id}`);
        if (savedHidden) {
            try {
                setHiddenTokenKeys(new Set(JSON.parse(savedHidden)));
            } catch (e) {}
        }

        // Load User Added Tokens
        const savedCustom = localStorage.getItem(`custom_tokens_${user.id}`);
        if (savedCustom) {
            try {
                setUserAddedTokens(JSON.parse(savedCustom));
            } catch (e) {}
        }
    }
  }, [user]);

  const handleSetApiKey = (key: string | null) => {
    setInfuraApiKey(key);
    if (key) localStorage.setItem('infura_api_key', key);
    else localStorage.removeItem('infura_api_key');
  };

  const toggleTokenVisibility = useCallback((chainId: number, symbol: string) => {
    if (!user) return;
    setHiddenTokenKeys(prev => {
        const next = new Set(prev);
        const key = `${chainId}:${symbol}`;
        if (next.has(key)) next.delete(key);
        else next.add(key);
        
        localStorage.setItem(`hidden_tokens_${user.id}`, JSON.stringify(Array.from(next)));
        return next;
    });
  }, [user]);

  const addUserToken = useCallback((token: AssetRow) => {
    if (!user) return;
    setUserAddedTokens(prev => {
        const exists = prev.find(t => t.chainId === token.chainId && t.symbol === token.symbol);
        if (exists) return prev;
        const next = [...prev, token];
        localStorage.setItem(`custom_tokens_${user.id}`, JSON.stringify(next));
        return next;
    });
  }, [user]);

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
        // Silent fail for registry
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
  }, [chainsWithLogos, fetchTokenRegistry, viewingNetwork]);

  const getAddressForChain = useCallback((chain: ChainConfig, wallets: WalletWithMetadata[]): string | undefined => {
    if (wallets && wallets.length > 0) return wallets[0].address;
    return undefined;
  }, []);

  // Optimized Fetcher: Priority Chain First, then Lazy Background
  const fetchAllBalances = useCallback(async (priorityChainId?: number) => {
    if (!wallets || wallets.length === 0 || !isInitialized || !infuraApiKey) return;
    
    setIsRefreshing(true);
    setFetchError(null);

    const currentBalances = { ...balances };
    const chainsToFetch = [...chainsWithLogos];

    // Priority handling (Move visible chain to front)
    if (priorityChainId) {
        const idx = chainsToFetch.findIndex(c => c.chainId === priorityChainId);
        if (idx > -1) {
            const priority = chainsToFetch.splice(idx, 1)[0];
            chainsToFetch.unshift(priority);
        }
    }

    try {
      for (const chain of chainsToFetch) {
        const apiTokens = tokenRegistry[chain.chainId] || [];
        
        // Merge hardcoded, user-added, and registry tokens
        const baseAssets = getInitialAssets(chain.chainId);
        const customAssets = userAddedTokens.filter(t => t.chainId === chain.chainId);
        
        const combinedAssetsList = [...baseAssets, ...customAssets].reduce((acc, curr) => {
            if (!acc.find(a => a.symbol === curr.symbol)) acc.push(curr);
            return acc;
        }, [] as any[]).map(a => {
            const apiMeta = apiTokens.find(t => t.symbol === a.symbol);
            return {
                ...a,
                balance: currentBalances[chain.chainId]?.find(b => b.symbol === a.symbol)?.balance || '0',
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

          currentBalances[chain.chainId] = chainBalances;
          
          // Partial update UI for visible network immediately
          if (chain.chainId === priorityChainId) {
              setBalances({ ...currentBalances });
          }
        } catch (e) {
          currentBalances[chain.chainId] = combinedAssetsList;
        }
        
        await delay(priorityChainId === chain.chainId ? 0 : 100);
      }

      // Enrichment logic...
      const flatAssets = Object.values(currentBalances).flat();
      const assetsWithPrices = await fetchAssetPrices(flatAssets as any);
      
      const finalBalances: { [key: string]: AssetRow[] } = {};
      assetsWithPrices.forEach(asset => {
        if (!finalBalances[asset.chainId]) finalBalances[asset.chainId] = [];
        finalBalances[asset.chainId].push(asset);
      });

      setBalances(finalBalances);
      if (user) {
          localStorage.setItem(`wallet_balances_${user.id}`, JSON.stringify(finalBalances));
      }
    } catch (e: any) {
      console.warn("Market data fetch issue:", e.message);
      setFetchError("Rate limit encountered. Data may be delayed.");
    } finally {
      setIsRefreshing(false);
    }
  }, [wallets, isInitialized, chainsWithLogos, infuraApiKey, tokenRegistry, balances, user, userAddedTokens]);

  // Periodic Refresh
  useEffect(() => {
    if (!isInitialized || !wallets || !infuraApiKey || !viewingNetwork) return;
    const interval = setInterval(() => {
        if (!isRefreshing) fetchAllBalances(viewingNetwork.chainId);
    }, 50000);
    return () => clearInterval(interval);
  }, [isInitialized, wallets, infuraApiKey, viewingNetwork, fetchAllBalances, isRefreshing]);

  // Initial Sync
  useEffect(() => {
    if (isInitialized && wallets && infuraApiKey && !isBackgroundFetching.current) {
        isBackgroundFetching.current = true;
        fetchAllBalances(viewingNetwork?.chainId);
    }
  }, [isInitialized, wallets, infuraApiKey, viewingNetwork?.chainId, fetchAllBalances]);

  const loadWalletFromMnemonic = useCallback((mnemonic: string) => {
    if (!mnemonic) return;
    try {
      const cleanMnemonic = mnemonic.trim();
      if (!ethers.Mnemonic.isValidMnemonic(cleanMnemonic)) throw new Error("Invalid mnemonic.");
      const wallet = ethers.Wallet.fromPhrase(cleanMnemonic);
      setWallets([{ 
        address: wallet.address, 
        privateKey: wallet.privateKey,
        avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${wallet.address}`
      }]);
    } catch (e: any) {
      throw new Error("Validation failed.");
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

  const generateWallet = useCallback(async () => {
    if (!user) return '';
    const wallet = ethers.Wallet.createRandom();
    const mnemonic = wallet.mnemonic?.phrase || '';
    if (mnemonic) {
      loadWalletFromMnemonic(mnemonic);
      localStorage.setItem(`wallet_mnemonic_${user.id}`, mnemonic);
      toast({ title: "Secure Wallet Generated" });
    }
    return mnemonic;
  }, [loadWalletFromMnemonic, toast, user]);

  const importWallet = useCallback(async (mnemonic: string) => {
    if (!user) return;
    try {
      loadWalletFromMnemonic(mnemonic);
      localStorage.setItem(`wallet_mnemonic_${user.id}`, mnemonic.trim());
      toast({ title: "Access Restored" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Import Error" });
    }
  }, [loadWalletFromMnemonic, toast, user]);

  const logout = useCallback(() => {
    if (user) {
        localStorage.removeItem(`wallet_mnemonic_${user.id}`);
        localStorage.removeItem(`wallet_balances_${user.id}`);
    }
    setWallets(null);
    setBalances({});
    authSignOut();
  }, [user, authSignOut]);

  const deleteWallet = useCallback(() => {
    if (user) {
        localStorage.removeItem(`wallet_mnemonic_${user.id}`);
        localStorage.removeItem(`wallet_balances_${user.id}`);
    }
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
    const list = balances[viewingNetwork.chainId] || getInitialAssets(viewingNetwork.chainId).map(a => ({ ...a, balance: '0' } as AssetRow));
    // Filter out tokens marked as hidden
    return list.filter(asset => !hiddenTokenKeys.has(`${viewingNetwork.chainId}:${asset.symbol}`));
  }, [balances, viewingNetwork, hiddenTokenKeys]);

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
    isTokenLoading: (cid, sym) => loadingTokens[`${cid}:${sym}`] || false,
    wallets,
    balances,
    refresh: () => fetchAllBalances(viewingNetwork?.chainId),
    generateWallet,
    importWallet,
    saveToVault: async () => {},
    restoreFromCloud: async () => {},
    logout,
    deleteWallet,
    fetchError,
    getAddressForChain,
    infuraApiKey,
    setInfuraApiKey: handleSetApiKey,
    hiddenTokenKeys,
    toggleTokenVisibility,
    userAddedTokens,
    addUserToken
  };

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (context === undefined) throw new Error('useWallet must be used within a WalletProvider');
  return context;
}
