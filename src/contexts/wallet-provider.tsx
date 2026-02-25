
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
import { fetchPriceMap } from '@/lib/coingecko';
import { logoSupabase } from '@/lib/supabase/logo-client';
import { supabase } from '@/lib/supabase/client';
import { xrpAdapterFactory } from '@/lib/wallets/adapters/xrp';
import { polkadotAdapterFactory } from '@/lib/wallets/adapters/polkadot';
import { evmAdapterFactory } from '@/lib/wallets/adapters/evm';
import { getAddressForChain as getAddressForChainUtil } from '@/lib/wallets/utils';

interface PriceInfo {
    price: number;
    change: number;
}

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

export function WalletProvider({ children }: { children: ReactNode }) {
  const { chainsWithLogos, areLogosLoading } = useNetworkLogos();
  const { user, loading: authLoading, signOut: authSignOut, profile, refreshProfile } = useUser();
  const { toast } = useToast();
  
  const [viewingNetwork, setViewingNetwork] = useState<ChainConfig | null>(null);
  const [wallets, setWallets] = useState<WalletWithMetadata[] | null>(null);
  const [balances, setBalances] = useState<{ [key: string]: AssetRow[] }>({});
  const [prices, setPrices] = useState<{ [coingeckoId: string]: PriceInfo }>({});
  const [tokenRegistry, setTokenRegistry] = useState<{ [chainId: number]: any[] }>({});
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isWalletLoading, setIsWalletLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [infuraApiKey, setInfuraApiKey] = useState<string | null>(null);

  const [hiddenTokenKeys, setHiddenTokenKeys] = useState<Set<string>>(new Set());
  const [userAddedTokens, setUserAddedTokens] = useState<AssetRow[]>([]);

  // Engine refs
  const isBackgroundSyncRunning = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const savedKey = localStorage.getItem('infura_api_key');
    if (savedKey) setInfuraApiKey(savedKey);

    if (user) {
        const cachedBalances = localStorage.getItem(`wallet_balances_${user.id}`);
        if (cachedBalances) {
            try { setBalances(JSON.parse(cachedBalances)); } catch (e) {}
        }
        const savedHidden = localStorage.getItem(`hidden_tokens_${user.id}`);
        if (savedHidden) {
            try { setHiddenTokenKeys(new Set(JSON.parse(savedHidden))); } catch (e) {}
        }
        const savedCustom = localStorage.getItem(`custom_tokens_${user.id}`);
        if (savedCustom) {
            try { setUserAddedTokens(JSON.parse(savedCustom)); } catch (e) {}
        }
    }
  }, [user]);

  const handleSetApiKey = (key: string | null) => {
    setInfuraApiKey(key);
    if (key) {
        localStorage.setItem('infura_api_key', key);
        // Automatically sync to cloud if a wallet exists
        if (wallets && user) saveToVault();
    } else {
        localStorage.removeItem('infura_api_key');
    }
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
  }, [chainsWithLogos, fetchTokenRegistry]);

  const fetchGlobalPrices = useCallback(async () => {
    if (!isInitialized) return;
    const ids = new Set<string>();
    chainsWithLogos.forEach(chain => {
        getInitialAssets(chain.chainId).forEach(a => { if (a.coingeckoId) ids.add(a.coingeckoId); });
    });
    userAddedTokens.forEach(t => { if (t.coingeckoId) ids.add(t.coingeckoId); });
    const idList = Array.from(ids);
    if (idList.length === 0) return;
    try {
        const priceMap = await fetchPriceMap(idList);
        const newPrices: { [id: string]: PriceInfo } = {};
        Object.entries(priceMap).forEach(([id, data]) => {
            newPrices[id] = { price: data.usd, change: data.usd_24h_change };
        });
        setPrices(prev => ({ ...prev, ...newPrices }));
    } catch (e) {
        console.warn("Global Price Engine Error:", e);
    }
  }, [isInitialized, chainsWithLogos, userAddedTokens]);

  const fetchBalancesForChain = useCallback(async (chain: ChainConfig) => {
    if (!wallets || !infuraApiKey) return [];
    const walletForChain = wallets.find(w => w.type === (chain.type || 'evm'));
    if (!walletForChain) return [];
    const apiTokens = tokenRegistry[chain.chainId] || [];
    const baseAssets = getInitialAssets(chain.chainId);
    const customAssets = userAddedTokens.filter(t => t.chainId === chain.chainId);
    const combinedAssetsList = [...baseAssets, ...customAssets].reduce((acc, curr) => {
        if (!acc.find(a => a.symbol === curr.symbol)) acc.push(curr);
        return acc;
    }, [] as any[]).map(a => {
        const apiMeta = apiTokens.find(t => t.symbol === a.symbol);
        return {
            ...a,
            balance: '0',
            name: apiMeta?.name || a.name,
            iconUrl: apiMeta?.logo_url ? apiMeta.logo_url : (a.iconUrl || chain.iconUrl),
            updatedAt: 0
        } as AssetRow;
    });
    let adapter = null;
    if (chain.type === 'xrp') adapter = xrpAdapterFactory(chain);
    else if (chain.type === 'polkadot') adapter = polkadotAdapterFactory(chain);
    else adapter = evmAdapterFactory(chain, infuraApiKey);
    if (adapter) {
        try {
            const results = await adapter.fetchBalances(walletForChain.address, combinedAssetsList);
            return results.map(r => ({ ...r, updatedAt: Date.now() }));
        } catch (e) {
            console.warn(`RPC Balance Engine error for ${chain.name}:`, e);
            return combinedAssetsList;
        }
    }
    return combinedAssetsList;
  }, [wallets, infuraApiKey, tokenRegistry, userAddedTokens]);

  const manualRefresh = useCallback(async () => {
    if (!viewingNetwork || !infuraApiKey || !wallets) return;
    setIsRefreshing(true);
    try {
        const [freshBalances] = await Promise.all([
            fetchBalancesForChain(viewingNetwork),
            fetchGlobalPrices()
        ]);
        setBalances(prev => {
            const next = { ...prev, [viewingNetwork.chainId]: freshBalances };
            if (user) localStorage.setItem(`wallet_balances_${user.id}`, JSON.stringify(next));
            return next;
        });
    } catch (e) {
        setFetchError("Connection limited.");
    } finally {
        setIsRefreshing(false);
    }
  }, [viewingNetwork, infuraApiKey, wallets, fetchBalancesForChain, fetchGlobalPrices, user]);

  const startEngine = useCallback(async () => {
    if (!isInitialized || !wallets || !infuraApiKey || !viewingNetwork) return;
    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();
    setIsRefreshing(true);
    try {
        await fetchGlobalPrices();
        const priorityBalances = await fetchBalancesForChain(viewingNetwork);
        setBalances(prev => {
            const next = { ...prev, [viewingNetwork.chainId]: priorityBalances };
            if (user) localStorage.setItem(`wallet_balances_${user.id}`, JSON.stringify(next));
            return next;
        });
    } catch (e) {} finally {
        setIsRefreshing(false);
    }
    if (isBackgroundSyncRunning.current) return;
    isBackgroundSyncRunning.current = true;
    const backgroundChains = chainsWithLogos.filter(c => c.chainId !== viewingNetwork.chainId);
    for (const chain of backgroundChains) {
        if (abortControllerRef.current?.signal.aborted) break;
        await new Promise(r => setTimeout(r, 1000));
        try {
            const bgBalances = await fetchBalancesForChain(chain);
            setBalances(prev => {
                const next = { ...prev, [chain.chainId]: bgBalances };
                if (user) localStorage.setItem(`wallet_balances_${user.id}`, JSON.stringify(next));
                return next;
            });
        } catch (e) {}
    }
    isBackgroundSyncRunning.current = false;
  }, [isInitialized, wallets, infuraApiKey, viewingNetwork, chainsWithLogos, fetchBalancesForChain, fetchGlobalPrices, user]);

  useEffect(() => {
    if (isInitialized && wallets && infuraApiKey && viewingNetwork?.chainId) {
        startEngine();
    }
    return () => { if (abortControllerRef.current) abortControllerRef.current.abort(); };
  }, [isInitialized, wallets?.[0]?.address, infuraApiKey, viewingNetwork?.chainId, startEngine]);

  const loadWalletFromMnemonic = useCallback(async (mnemonic: string) => {
    if (!mnemonic) return;
    try {
      const cleanMnemonic = mnemonic.trim();
      if (!ethers.Mnemonic.isValidMnemonic(cleanMnemonic)) throw new Error("Invalid.");
      const evmWallet = ethers.Wallet.fromPhrase(cleanMnemonic);
      const xrpWallet = xrpl.Wallet.fromMnemonic(cleanMnemonic);
      await cryptoWaitReady();
      const keyring = new Keyring({ type: 'sr25519' });
      const dotWallet = keyring.addFromMnemonic(cleanMnemonic);
      setWallets([
        { address: evmWallet.address, privateKey: evmWallet.privateKey, type: 'evm' },
        { address: xrpWallet.address, seed: xrpWallet.seed, type: 'xrp' },
        { address: dotWallet.address, type: 'polkadot' }
      ]);
    } catch (e) { throw new Error("Validation failed."); }
  }, []);

  useEffect(() => {
    if (!authLoading) {
      if (user) {
        const saved = localStorage.getItem(`wallet_mnemonic_${user.id}`);
        if (saved) loadWalletFromMnemonic(saved).catch(() => localStorage.removeItem(`wallet_mnemonic_${user.id}`));
      }
      setIsWalletLoading(false);
    }
  }, [authLoading, user, loadWalletFromMnemonic]);

  const generateWallet = useCallback(async () => {
    if (!user) return '';
    if (profile?.vault_phrase) throw new Error("CLOUDV_EXISTS");
    const wallet = ethers.Wallet.createRandom();
    const mnemonic = wallet.mnemonic?.phrase || '';
    if (mnemonic) {
      await loadWalletFromMnemonic(mnemonic);
      localStorage.setItem(`wallet_mnemonic_${user.id}`, mnemonic);
      toast({ title: "Institution Vault Generated" });
    }
    return mnemonic;
  }, [loadWalletFromMnemonic, toast, user, profile]);

  const importWallet = useCallback(async (mnemonic: string) => {
    if (!user) return;
    try {
      await loadWalletFromMnemonic(mnemonic);
      localStorage.setItem(`wallet_mnemonic_${user.id}`, mnemonic.trim());
      toast({ title: "Vault Restored" });
    } catch (e) { toast({ variant: "destructive", title: "Invalid Phrase" }); }
  }, [loadWalletFromMnemonic, toast, user]);

  const saveToVault = useCallback(async () => {
    if (!user || !supabase || !wallets) return;
    const mnemonic = localStorage.getItem(`wallet_mnemonic_${user.id}`);
    const currentApiKey = localStorage.getItem('infura_api_key');
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const payload: any = {};

      // 1. Encrypt & Prepare Mnemonic
      if (mnemonic) {
          const res = await fetch('/api/wallet/encrypt-phrase', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
            body: JSON.stringify({ phrase: mnemonic }),
          });
          const data = await res.json();
          if (res.ok) {
            payload.vault_phrase = data.encrypted; 
            payload.iv = data.iv;
          }
      }

      // 2. Encrypt & Prepare Infura Key
      if (currentApiKey) {
          const res = await fetch('/api/wallet/encrypt-phrase', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
            body: JSON.stringify({ phrase: currentApiKey }),
          });
          const data = await res.json();
          if (res.ok) {
            payload.vault_infura_key = data.encrypted; 
            payload.infura_iv = data.iv;
          }
      }

      // 3. Perform atomic update
      if (Object.keys(payload).length > 0) {
          await supabase.from('profiles').update(payload).eq('id', user.id);
          toast({ title: "Cloud Vault Synced" });
          refreshProfile();
      }
    } catch (e) {
        console.error("Vault sync failed:", e);
    }
  }, [user, wallets, toast, refreshProfile]);

  const restoreFromCloud = useCallback(async () => {
    if (!user || !supabase) return;
    
    const { data: { session } } = await supabase.auth.getSession();
    const encryptedPhrase = profile?.vault_phrase;
    const phraseIv = profile?.iv;
    const encryptedInfura = profile?.vault_infura_key;
    const infuraIv = profile?.infura_iv;

    if (!encryptedPhrase && !encryptedInfura) {
      toast({ variant: "destructive", title: "No Cloud Backup Found" });
      throw new Error("No vault");
    }

    try {
      // Restore Mnemonic
      if (encryptedPhrase && phraseIv) {
          const res = await fetch('/api/wallet/decrypt-phrase', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
            body: JSON.stringify({ encrypted: encryptedPhrase, iv: phraseIv }),
          });
          const data = await res.json();
          if (res.ok && data.phrase) {
              await loadWalletFromMnemonic(data.phrase);
              localStorage.setItem(`wallet_mnemonic_${user.id}`, data.phrase);
          }
      }

      // Restore Infura API Key
      if (encryptedInfura && infuraIv) {
          const res = await fetch('/api/wallet/decrypt-phrase', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
            body: JSON.stringify({ encrypted: encryptedInfura, iv: infuraIv }),
          });
          const data = await res.json();
          if (res.ok && data.phrase) {
              setInfuraApiKey(data.phrase);
              localStorage.setItem('infura_api_key', data.phrase);
          }
      }

      toast({ title: "Restored from Cloud" });
    } catch (e) {
        console.error("Cloud restoration error:", e);
        throw e;
    }
  }, [user, profile, loadWalletFromMnemonic, toast]);

  const assetsForCurrentNetwork = useMemo(() => {
    if (!viewingNetwork) return [];
    const list = balances[viewingNetwork.chainId] || getInitialAssets(viewingNetwork.chainId).map(a => ({ ...a, balance: '0' } as AssetRow));
    return list
        .filter(asset => !hiddenTokenKeys.has(`${viewingNetwork.chainId}:${asset.symbol}`))
        .map(asset => {
            const market = asset.coingeckoId ? prices[asset.coingeckoId] : null;
            const price = market?.price ?? 0;
            const balanceNum = parseFloat(asset.balance || '0');
            return {
                ...asset,
                priceUsd: price,
                pctChange24h: market?.change ?? 0,
                fiatValueUsd: balanceNum * price
            };
        });
  }, [balances, viewingNetwork, hiddenTokenKeys, prices]);

  const value: WalletContextType = {
    isInitialized: isInitialized && !authLoading,
    isAssetsLoading: areLogosLoading,
    isWalletLoading,
    hasNewNotifications: false,
    viewingNetwork: viewingNetwork || (chainsWithLogos[0] || {} as ChainConfig),
    setNetwork: (net) => { setViewingNetwork(net); setFetchError(null); },
    allAssets: assetsForCurrentNetwork,
    allChains: chainsWithLogos,
    allChainsMap: chainsWithLogos.reduce((acc, c) => ({ ...acc, [c.chainId]: c }), {}),
    isRefreshing,
    isTokenLoading: () => false,
    wallets,
    balances,
    refresh: manualRefresh,
    generateWallet,
    importWallet,
    saveToVault,
    restoreFromCloud,
    logout: () => { if (user) { localStorage.removeItem(`wallet_mnemonic_${user.id}`); localStorage.removeItem(`wallet_balances_${user.id}`); } setWallets(null); setBalances({}); authSignOut(); },
    deleteWallet: () => { if (user) { localStorage.removeItem(`wallet_mnemonic_${user.id}`); localStorage.removeItem(`wallet_balances_${user.id}`); } setWallets(null); setBalances({}); },
    fetchError,
    getAddressForChain: (chain, w) => getAddressForChainUtil(chain, w),
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
