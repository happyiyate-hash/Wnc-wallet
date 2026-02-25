
'use client';

import React, { createContext, useContext, useState, ReactNode, useMemo, useEffect, useCallback, useRef } from 'react';
import type { AssetRow, ChainConfig, WalletWithMetadata } from '@/lib/types';
import { useNetworkLogos } from '@/hooks/useNetworkLogos';
import { ethers } from 'ethers';
import * as xrpl from 'xrpl';
import { Keyring } from '@polkadot/keyring';
import { cryptoWaitReady } from '@polkadot/util-crypto';
import { getInitialAssets } from '@/lib/wallets/balances';
import { useUser } from './user-provider';
import { useToast } from '@/hooks/use-toast';
import { fetchAssetPrices } from '@/lib/coingecko';
import { logoSupabase } from '@/lib/supabase/logo-client';
import { supabase } from '@/lib/supabase/client';
import { xrpAdapterFactory } from '@/lib/wallets/adapters/xrp';
import { polkadotAdapterFactory } from '@/lib/wallets/adapters/polkadot';

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
  hiddenTokenKeys: Set<string>;
  toggleTokenVisibility: (chainId: number, symbol: string) => void;
  userAddedTokens: AssetRow[];
  addUserToken: (token: AssetRow) => void;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

export function WalletProvider({ children }: { children: ReactNode }) {
  const { chainsWithLogos, areLogosLoading } = useNetworkLogos();
  const { user, loading: authLoading, signOut: authSignOut, profile, refreshProfile } = useUser();
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

  const [hiddenTokenKeys, setHiddenTokenKeys] = useState<Set<string>>(new Set());
  const [userAddedTokens, setUserAddedTokens] = useState<AssetRow[]>([]);

  const isBackgroundFetching = useRef(false);

  useEffect(() => {
    const savedKey = localStorage.getItem('infura_api_key');
    if (savedKey) setInfuraApiKey(savedKey);

    if (user) {
        const cachedBalances = localStorage.getItem(`wallet_balances_${user.id}`);
        if (cachedBalances) {
            try {
                setBalances(JSON.parse(cachedBalances));
            } catch (e) {
                console.warn("Failed to parse cached balances");
            }
        }

        const savedHidden = localStorage.getItem(`hidden_tokens_${user.id}`);
        if (savedHidden) {
            try {
                setHiddenTokenKeys(new Set(JSON.parse(savedHidden)));
            } catch (e) {}
        }

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
      } catch (e) {}
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
    if (!wallets) return undefined;
    const found = wallets.find(w => w.type === (chain.type || 'evm'));
    return found?.address;
  }, []);

  const fetchAllBalances = useCallback(async (priorityChainId?: number) => {
    if (!wallets || wallets.length === 0 || !isInitialized || !infuraApiKey) return;
    
    setIsRefreshing(true);
    setFetchError(null);

    const chainsToFetch = [...chainsWithLogos];

    if (priorityChainId) {
        const idx = chainsToFetch.findIndex(c => c.chainId === priorityChainId);
        if (idx > -1) {
            const priority = chainsToFetch.splice(idx, 1)[0];
            chainsToFetch.unshift(priority);
        }
    }

    try {
      const updatedBalances: { [key: string]: AssetRow[] } = {};

      for (const chain of chainsToFetch) {
        const walletForChain = wallets.find(w => w.type === (chain.type || 'evm'));
        if (!walletForChain) continue;

        const apiTokens = tokenRegistry[chain.chainId] || [];
        const baseAssets = getInitialAssets(chain.chainId);
        const customAssets = userAddedTokens.filter(t => t.chainId === chain.chainId);
        
        const combinedAssetsList = [...baseAssets, ...customAssets].reduce((acc, curr) => {
            if (!acc.find(a => a.symbol === curr.symbol)) acc.push(curr);
            return acc;
        }, [] as any[]).map(a => {
            const apiMeta = apiTokens.find(t => t.symbol === a.symbol);
            const cachedAsset = balances[chain.chainId]?.find(oa => oa.symbol === a.symbol);
            return {
                ...a,
                balance: cachedAsset?.balance || '0',
                name: apiMeta?.name || a.name,
                iconUrl: apiMeta?.logo_url ? apiMeta.logo_url : (a.iconUrl || chain.iconUrl),
                priceUsd: cachedAsset?.priceUsd || 0,
                pctChange24h: cachedAsset?.pctChange24h || 0,
                fiatValueUsd: cachedAsset?.fiatValueUsd || 0
            } as AssetRow;
        });

        // Adapters for non-EVM chains
        if (chain.type === 'xrp') {
            const adapter = xrpAdapterFactory(chain);
            if (adapter) {
                const results = await adapter.fetchBalances(walletForChain.address, combinedAssetsList);
                updatedBalances[chain.chainId] = results;
                setBalances(prev => ({ ...prev, [chain.chainId]: results }));
                continue;
            }
        }

        if (chain.type === 'polkadot') {
            const adapter = polkadotAdapterFactory(chain);
            if (adapter) {
                const results = await adapter.fetchBalances(walletForChain.address, combinedAssetsList);
                updatedBalances[chain.chainId] = results;
                setBalances(prev => ({ ...prev, [chain.chainId]: results }));
                continue;
            }
        }

        const rpcUrl = chain.rpcUrl.replace('{API_KEY}', infuraApiKey);
        try {
          const provider = new ethers.JsonRpcProvider(rpcUrl, undefined, { staticNetwork: true });
          
          const chainBalances = await Promise.all(combinedAssetsList.map(async (asset) => {
            try {
              let balance;
              if (asset.isNative) {
                balance = await provider.getBalance(walletForChain.address);
              } else {
                const abi = ["function balanceOf(address owner) view returns (uint256)"];
                const contract = new ethers.Contract(asset.address, abi, provider);
                balance = await contract.balanceOf(walletForChain.address);
              }
              const balanceStr = ethers.formatUnits(balance, 18);
              return {
                ...asset,
                balance: balanceStr,
              } as AssetRow;
            } catch (e) {
              return asset;
            }
          }));

          updatedBalances[chain.chainId] = chainBalances;
          
          setBalances(prev => ({
            ...prev,
            [chain.chainId]: chainBalances.map(nb => {
              const existing = prev[chain.chainId]?.find(eb => eb.symbol === nb.symbol);
              return {
                ...nb,
                priceUsd: existing?.priceUsd || 0,
                pctChange24h: existing?.pctChange24h || 0,
                fiatValueUsd: parseFloat(nb.balance) * (existing?.priceUsd || 0)
              };
            })
          }));
        } catch (e) {
          updatedBalances[chain.chainId] = combinedAssetsList;
        }
        
        await delay(priorityChainId === chain.chainId ? 0 : 20);
      }

      const flatAssets = Object.values(updatedBalances).flat();
      const assetsWithPrices = await fetchAssetPrices(flatAssets as any);
      
      const finalBalances: { [key: string]: AssetRow[] } = {};
      assetsWithPrices.forEach(asset => {
        const existing = balances[asset.chainId]?.find(eb => eb.symbol === asset.symbol);
        
        const finalAsset = {
            ...asset,
            priceUsd: asset.priceUsd > 0 ? asset.priceUsd : (existing?.priceUsd || 0),
            pctChange24h: asset.pctChange24h !== 0 ? asset.pctChange24h : (existing?.pctChange24h || 0),
        };
        
        finalAsset.fiatValueUsd = parseFloat(finalAsset.balance) * (finalAsset.priceUsd || 0);

        if (!finalBalances[asset.chainId]) finalBalances[asset.chainId] = [];
        finalBalances[asset.chainId].push(finalAsset);
      });

      setBalances(finalBalances);
      if (user) {
          localStorage.setItem(`wallet_balances_${user.id}`, JSON.stringify(finalBalances));
      }
    } catch (e: any) {
      console.warn("Refresh issue:", e.message);
      setFetchError("Connection limited. Check API key.");
    } finally {
      setIsRefreshing(false);
    }
  }, [wallets, isInitialized, chainsWithLogos, infuraApiKey, tokenRegistry, balances, user, userAddedTokens]);

  useEffect(() => {
    if (!isInitialized || !wallets || !infuraApiKey || !viewingNetwork) return;
    const interval = setInterval(() => {
        if (!isRefreshing) fetchAllBalances(viewingNetwork.chainId);
    }, 60000);
    return () => clearInterval(interval);
  }, [isInitialized, wallets, infuraApiKey, viewingNetwork, fetchAllBalances, isRefreshing]);

  useEffect(() => {
    if (isInitialized && wallets && infuraApiKey && !isBackgroundFetching.current) {
        isBackgroundFetching.current = true;
        fetchAllBalances(viewingNetwork?.chainId);
    }
  }, [isInitialized, wallets, infuraApiKey, viewingNetwork?.chainId, fetchAllBalances]);

  const loadWalletFromMnemonic = useCallback(async (mnemonic: string) => {
    if (!mnemonic) return;
    try {
      const cleanMnemonic = mnemonic.trim();
      if (!ethers.Mnemonic.isValidMnemonic(cleanMnemonic)) throw new Error("Invalid mnemonic.");
      
      // Derive EVM
      const evmWallet = ethers.Wallet.fromPhrase(cleanMnemonic);
      
      // Derive XRP (using BIP44 path)
      const xrpWallet = xrpl.Wallet.fromMnemonic(cleanMnemonic);

      // Derive Polkadot
      await cryptoWaitReady();
      const keyring = new Keyring({ type: 'sr25519' });
      const dotWallet = keyring.addFromMnemonic(cleanMnemonic);

      setWallets([
        { 
          address: evmWallet.address, 
          privateKey: evmWallet.privateKey,
          avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${evmWallet.address}`,
          type: 'evm'
        },
        {
          address: xrpWallet.address,
          seed: xrpWallet.seed,
          type: 'xrp'
        },
        {
          address: dotWallet.address,
          type: 'polkadot'
        }
      ]);
    } catch (e: any) {
      console.error("Wallet loading error:", e);
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
              await loadWalletFromMnemonic(savedMnemonic);
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
      await loadWalletFromMnemonic(mnemonic);
      localStorage.setItem(`wallet_mnemonic_${user.id}`, mnemonic);
      toast({ title: "Secure Wallet Generated" });
    }
    return mnemonic;
  }, [loadWalletFromMnemonic, toast, user]);

  const importWallet = useCallback(async (mnemonic: string) => {
    if (!user) return;
    try {
      await loadWalletFromMnemonic(mnemonic);
      localStorage.setItem(`wallet_mnemonic_${user.id}`, mnemonic.trim());
      toast({ title: "Access Restored" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Import Error" });
    }
  }, [loadWalletFromMnemonic, toast, user]);

  const saveToVault = useCallback(async () => {
    if (!user || !wallets?.[0]?.privateKey || !supabase) return;
    
    const mnemonic = localStorage.getItem(`wallet_mnemonic_${user.id}`);
    if (!mnemonic) {
        toast({ variant: "destructive", title: "Backup Error", description: "Mnemonic not found." });
        return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch('/api/wallet/encrypt-phrase', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ phrase: mnemonic }),
      });

      const { encrypted, iv } = await response.json();

      const { error } = await supabase
        .from('profiles')
        .update({ vault_phrase: encrypted, iv })
        .eq('id', user.id);

      if (error) throw error;
      
      toast({ title: "Vault Sync Complete" });
      refreshProfile();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Vault Error", description: e.message });
    }
  }, [user, wallets, toast, refreshProfile]);

  const restoreFromCloud = useCallback(async () => {
    if (!user || !profile?.vault_phrase || !profile?.iv || !supabase) {
      toast({ variant: "destructive", title: "Vault Not Found" });
      throw new Error("No vault");
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch('/api/wallet/decrypt-phrase', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ 
          encrypted: profile.vault_phrase, 
          iv: profile.iv 
        }),
      });

      const data = await response.json();
      if (data.phrase) {
        await importWallet(data.phrase);
        toast({ title: "Vault Restored" });
      } else {
        throw new Error(data.message || "Decryption failed");
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Restoration Failed" });
      throw e;
    }
  }, [user, profile, importWallet, toast]);

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
    saveToVault,
    restoreFromCloud,
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
