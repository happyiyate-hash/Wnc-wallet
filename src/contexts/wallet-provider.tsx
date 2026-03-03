
'use client';

import React, { createContext, useContext, useState, ReactNode, useMemo, useEffect, useCallback, useRef } from 'react';
import type { AssetRow, ChainConfig, WalletWithMetadata, UserProfile } from '@/lib/types';
import { useNetworkLogos } from '@/hooks/useNetworkLogos';
import { useUser } from './user-provider';
import { useCurrency } from './currency-provider';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase/client';
import { getInitialAssets } from '@/lib/wallets/balances';
import { getAddressForChain as getAddressForChainUtil } from '@/lib/wallets/utils';

// SERVICE NODES
import { deriveAllWallets } from '@/lib/wallets/derive';
import { fetchGlobalMarketData, type PriceResult } from '@/lib/market/price-service';

export type SyncDiagnosticState = {
  status: 'idle' | 'checking' | 'mismatch' | 'syncing' | 'success' | 'completed';
  chain: string | null;
  localValue: string | null;
  cloudValue: string | null;
  progress: number;
};

interface WalletContextType {
  isInitialized: boolean;
  isAssetsLoading: boolean;
  isWalletLoading: boolean;
  hasNewNotifications: boolean;
  setHasNewNotifications: (val: boolean) => void;
  viewingNetwork: ChainConfig;
  setNetwork: (network: ChainConfig) => void;
  allAssets: AssetRow[];
  allChains: ChainConfig[];
  allChainsMap: { [key: string]: ChainConfig };
  isRefreshing: boolean;
  isTokenLoading: (chainId: number, symbol: string) => boolean;
  wallets: WalletWithMetadata[] | null;
  balances: { [key: string]: AssetRow[] };
  prices: PriceResult;
  accountNumber: string | null;
  refresh: () => Promise<void>;
  importWallet: (mnemonic: string) => Promise<void>;
  generateWallet: () => Promise<string>;
  saveToVault: () => Promise<void>;
  restoreFromCloud: (onStatusUpdate?: (status: string) => void) => Promise<void>;
  logout: () => Promise<void>;
  deleteWallet: () => void;
  deleteWalletPermanently: () => Promise<void>;
  fetchError: string | null;
  getAddressForChain: (chain: ChainConfig, wallets: WalletWithMetadata[]) => string | undefined;
  infuraApiKey: string | null;
  setInfuraApiKey: (key: string | null) => void;
  hiddenTokenKeys: Set<string>;
  toggleTokenVisibility: (chainId: number, symbol: string) => void;
  userAddedTokens: AssetRow[];
  addUserToken: (token: AssetRow) => void;
  getAvailableAssetsForChain: (chainId: number) => AssetRow[];
  isSynced: boolean;
  syncAllAddresses: (providedWallets?: WalletWithMetadata[]) => Promise<void>;
  syncDiagnostic: SyncDiagnosticState;
  runCloudDiagnostic: (options?: { forceUI?: boolean }) => Promise<void>;
  isRequestOverlayOpen: boolean;
  setIsRequestOverlayOpen: (open: boolean) => void;
  isNotificationsOpen: boolean;
  setIsNotificationsOpen: (open: boolean) => void;
  activeFulfillmentId: string | null;
  setActiveFulfillmentId: (id: string | null) => void;
  hasFetchedInitialData: boolean;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: ReactNode }) {
  const { chainsWithLogos, areLogosLoading, allChainsMap } = useNetworkLogos();
  const { user, loading: authLoading, signOut: authSignOut, profile, refreshProfile } = useUser();
  const { rates } = useCurrency();
  const { toast } = useToast();
  
  const [viewingNetwork, setViewingNetwork] = useState<ChainConfig | null>(null);
  const [wallets, setWallets] = useState<WalletWithMetadata[] | null>(null);
  const [balances, setBalances] = useState<{ [key: string]: AssetRow[] }>({});
  const [prices, setPrices] = useState<PriceResult>({});
  const [accountNumber, setAccountNumber] = useState<string | null>(null);
  
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasFetchedInitialData, setHasFetchedInitialData] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isWalletLoading, setIsWalletLoading] = useState(true);
  
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [infuraApiKey, setInfuraApiKey] = useState<string | null>(null);
  const [isSynced, setIsSynced] = useState(true);
  const [hiddenTokenKeys, setHiddenTokenKeys] = useState<Set<string>>(new Set());
  const [userAddedTokens, setUserAddedTokens] = useState<AssetRow[]>([]);
  const [isRequestOverlayOpen, setIsRequestOverlayOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [hasNewNotifications, setHasNewNotifications] = useState(false);
  const [activeFulfillmentId, setActiveFulfillmentId] = useState<string | null>(null);
  
  const [syncDiagnostic, setSyncDiagnostic] = useState<SyncDiagnosticState>({
    status: 'idle',
    chain: null,
    localValue: null,
    cloudValue: null,
    progress: 0
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  const priceIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const initialFetchTriggeredRef = useRef<boolean>(false);

  // AUTOMATIC NETWORK INITIALIZATION
  useEffect(() => {
    if (!viewingNetwork && chainsWithLogos.length > 0) {
      setViewingNetwork(chainsWithLogos[0]);
    }
  }, [chainsWithLogos, viewingNetwork]);

  const getAddressForChain = useCallback((chain: ChainConfig, wallets: WalletWithMetadata[]) => {
    return getAddressForChainUtil(chain, wallets);
  }, []);

  const getAvailableAssetsForChain = useCallback((chainId: number): AssetRow[] => {
    const base = getInitialAssets(chainId).map(a => ({ ...a, balance: '0' } as AssetRow));
    const custom = userAddedTokens.filter(t => t.chainId === chainId);
    
    return [...base, ...custom].reduce((acc, curr) => {
        const identifier = curr.isNative ? curr.symbol : curr.address?.toLowerCase();
        if (!acc.find(a => (a.isNative ? a.symbol : a.address?.toLowerCase()) === identifier)) {
            acc.push(curr);
        }
        return acc;
    }, [] as AssetRow[]);
  }, [userAddedTokens]);

  const addUserToken = useCallback((token: AssetRow) => {
    setUserAddedTokens(prev => {
      const next = [...prev, token];
      if (user) localStorage.setItem(`custom_tokens_${user.id}`, JSON.stringify(next));
      return next;
    });
  }, [user]);

  const toggleTokenVisibility = useCallback((chainId: number, symbol: string) => {
    setHiddenTokenKeys(prev => {
      const next = new Set(prev);
      const key = `${chainId}:${symbol}`;
      if (next.has(key)) next.delete(key);
      else next.add(key);
      if (user) localStorage.setItem(`hidden_tokens_${user.id}`, JSON.stringify(Array.from(next)));
      return next;
    });
  }, [user]);

  const syncAllAddresses = useCallback(async (providedWallets?: WalletWithMetadata[]) => {
    const currentWallets = providedWallets || wallets;
    if (!user || !supabase) return;
    
    let targetAcc = accountNumber;
    if (!targetAcc) {
        const randomSuffix = Math.floor(Math.random() * 9000000 + 1000000);
        targetAcc = `835${randomSuffix}`;
        setAccountNumber(targetAcc);
        localStorage.setItem(`account_number_${user.id}`, targetAcc);
    }

    try {
      await supabase
        .from('profiles')
        .update({ 
          account_number: targetAcc, 
          updated_at: new Date().toISOString(),
          evm_address: currentWallets?.find(w => w.type === 'evm')?.address,
          xrp_address: currentWallets?.find(w => w.type === 'xrp')?.address,
          polkadot_address: currentWallets?.find(w => w.type === 'polkadot')?.address
        })
        .eq('id', user.id);

      await refreshProfile();
    } catch (e: any) {
      console.error("Registry Sync Interrupted:", e.message);
    }
  }, [user, wallets, accountNumber, refreshProfile]);

  const fetchBalancesForChain = useCallback(async (chain: ChainConfig, providedWallets: WalletWithMetadata[] | null) => {
    const currentWallets = providedWallets || wallets;
    if (!currentWallets || (!infuraApiKey && chain.type === 'evm')) return [];
    
    const walletForChain = currentWallets.find(w => w.type === (chain.type || 'evm'));
    if (!walletForChain) return [];
    
    const combinedAssetsList = getAvailableAssetsForChain(chain.chainId);
    
    try {
        const { evmAdapterFactory } = await import('@/lib/wallets/adapters/evm');
        const { xrpAdapterFactory } = await import('@/lib/wallets/adapters/xrp');
        const { polkadotAdapterFactory } = await import('@/lib/wallets/adapters/polkadot');
        
        let adapter = null;
        if (chain.type === 'xrp') adapter = xrpAdapterFactory(chain);
        else if (chain.type === 'polkadot') adapter = polkadotAdapterFactory(chain);
        else adapter = evmAdapterFactory(chain, infuraApiKey);

        if (adapter) {
            const results = await adapter.fetchBalances(walletForChain.address, combinedAssetsList);
            return results.map(r => ({ ...r, updatedAt: Date.now() }));
        }
    } catch (e) {
        console.warn(`Balance Fetch Advisory for ${chain.name}:`, e);
    }
    return combinedAssetsList;
  }, [wallets, infuraApiKey, getAvailableAssetsForChain]);

  const startEngine = useCallback(async (forceWallets: WalletWithMetadata[] | null = null) => {
    const activeWallets = forceWallets || wallets;
    if (!activeWallets || !viewingNetwork || !user) return;
    
    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();
    
    setIsRefreshing(true);
    try {
        // BREAK THE LOOP: Don't depend on 'prices' state here, just fetch and set
        const newPrices = await fetchGlobalMarketData(chainsWithLogos, userAddedTokens, rates, {});
        setPrices(newPrices);
        
        const currentChain = viewingNetwork;
        const currentBalances = await fetchBalancesForChain(currentChain, activeWallets);
        
        setBalances(prev => ({ ...prev, [currentChain.chainId]: currentBalances }));
        setHasFetchedInitialData(true);
    } catch (e) {
        console.warn("Market Sync Advisory:", e);
    } finally { 
        setIsRefreshing(false); 
    }
    // EXCLUDE 'prices' and 'balances' to prevent infinite loop
  }, [wallets, viewingNetwork, user, chainsWithLogos, userAddedTokens, rates, fetchBalancesForChain]);

  const generateWallet = useCallback(async (): Promise<string> => {
    if (!user) throw new Error("Authentication required");
    const { generateMnemonic } = await import('bip39');
    const mnemonic = generateMnemonic();
    localStorage.setItem(`wallet_mnemonic_${user.id}`, mnemonic);
    
    const derived = await deriveAllWallets(mnemonic, profile);
    setWallets(derived);
    await syncAllAddresses(derived);
    await startEngine(derived);
    return mnemonic;
  }, [user, profile, syncAllAddresses, startEngine]);

  const importWallet = useCallback(async (mnemonic: string) => {
    if (!user) throw new Error("Authentication required");
    const { validateMnemonic } = await import('bip39');
    if (!validateMnemonic(mnemonic)) throw new Error("Invalid mnemonic");
    localStorage.setItem(`wallet_mnemonic_${user.id}`, mnemonic);
    
    const derived = await deriveAllWallets(mnemonic, profile);
    setWallets(derived);
    await syncAllAddresses(derived);
    await startEngine(derived);
  }, [user, profile, syncAllAddresses, startEngine]);

  const saveToVault = useCallback(async () => {
    if (!user || !supabase) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const mnemonic = localStorage.getItem(`wallet_mnemonic_${user.id}`);
      const updates: any = {};

      if (mnemonic) {
        const res = await fetch('/api/wallet/encrypt-phrase', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
          body: JSON.stringify({ phrase: mnemonic })
        });
        if (res.ok) { const data = await res.json(); updates.vault_phrase = data.encrypted; updates.iv = data.iv; }
      }

      if (Object.keys(updates).length > 0) {
        await supabase.from('profiles').update(updates).eq('id', user.id);
      }
    } catch (e) {}
  }, [user]);

  const restoreFromCloud = useCallback(async (onStatusUpdate?: (status: string) => void) => {
    if (!user || !profile?.vault_phrase) throw new Error("No cloud backup found");
    onStatusUpdate?.('Decrypting...');
    
    const { data: { session } } = await supabase!.auth.getSession();
    const res = await fetch('/api/wallet/decrypt-phrase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
      body: JSON.stringify({ encrypted: profile.vault_phrase, iv: profile.iv })
    });
    
    const { phrase } = await res.json();
    if (phrase) {
      localStorage.setItem(`wallet_mnemonic_${user.id}`, phrase);
      const derived = await deriveAllWallets(phrase, profile);
      setWallets(derived);
      await syncAllAddresses(derived);
      await startEngine(derived);
    }
  }, [user, profile, syncAllAddresses, startEngine]);

  /**
   * INITIALIZATION LIFECYCLE
   */
  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setWallets(null);
      setIsWalletLoading(false);
      setIsInitialized(true);
      setHasFetchedInitialData(true);
      return;
    }

    async function initLocalSession() {
      setIsWalletLoading(true);
      try {
        const savedMnemonic = localStorage.getItem(`wallet_mnemonic_${user.id}`);
        if (savedMnemonic) {
          const derived = await deriveAllWallets(savedMnemonic, profile);
          setWallets(derived);
          
          if (!initialFetchTriggeredRef.current) {
            initialFetchTriggeredRef.current = true;
            await startEngine(derived);
          }
        } else {
          setHasFetchedInitialData(true);
        }

        const localKey = localStorage.getItem('infura_api_key');
        if (localKey) setInfuraApiKey(localKey);
        
        const localAcc = localStorage.getItem(`account_number_${user.id}`);
        setAccountNumber(profile?.account_number || localAcc || null);

        setIsInitialized(true);
      } catch (e) {
        console.error("Initialization Failed:", e);
        setHasFetchedInitialData(true);
      } finally {
        setIsWalletLoading(false);
      }
    }

    initLocalSession();
  }, [user, authLoading, profile, startEngine]);

  // Periodic Refresh
  useEffect(() => {
    if (isInitialized && hasFetchedInitialData && user && wallets) {
        if (priceIntervalRef.current) clearInterval(priceIntervalRef.current);
        priceIntervalRef.current = setInterval(() => startEngine(), 30000);
    }
    return () => { if (priceIntervalRef.current) clearInterval(priceIntervalRef.current); };
  }, [isInitialized, hasFetchedInitialData, user, wallets, startEngine]);

  const logout = useCallback(async () => {
    if (priceIntervalRef.current) clearInterval(priceIntervalRef.current);
    const prevId = user?.id;
    await authSignOut();
    if (prevId) {
        localStorage.removeItem(`wallet_mnemonic_${prevId}`);
        localStorage.removeItem('infura_api_key');
    }
    setWallets(null); setBalances({}); setAccountNumber(null);
    window.location.href = '/auth/login';
  }, [authSignOut, user?.id]);

  const assetsForCurrentNetwork = useMemo(() => {
    if (!viewingNetwork) return [];
    
    const wncPriceInfo = prices['internal:wnc'];
    const wncAsset: AssetRow = {
        chainId: viewingNetwork.chainId, address: 'internal:wnc', symbol: 'WNC', name: 'Wevinacoin', 
        balance: profile?.wnc_earnings?.toString() || '0', isNative: false, 
        priceUsd: wncPriceInfo?.price || 0.0006, fiatValueUsd: (profile?.wnc_earnings || 0) * (wncPriceInfo?.price || 0.0006), 
        pctChange24h: wncPriceInfo?.change || 0, decimals: 0, iconUrl: null 
    };

    const available = getAvailableAssetsForChain(viewingNetwork.chainId);
    const chainBalances = balances[viewingNetwork.chainId] || [];

    const onChainAssets = available.map((asset) => {
        const balDoc = chainBalances.find((b) => (b.isNative ? b.symbol : b.address?.toLowerCase()) === (asset.isNative ? asset.symbol : asset.address?.toLowerCase()));
        const balance = balDoc?.balance || '0';
        
        // BULLETPROOF PRICE LOOKUP: Use any available identifier
        const lookupKeys = [
            asset.priceId,
            asset.coingeckoId,
            asset.address,
            asset.symbol
        ].filter(Boolean).map(k => k!.toLowerCase());
        
        let priceInfo = null;
        for (const key of lookupKeys) {
            if (prices[key]) {
                priceInfo = prices[key];
                break;
            }
        }
        
        const price = priceInfo?.price || 0;
        const change = priceInfo?.change || 0;

        return { 
          ...asset, 
          balance, 
          priceUsd: price, 
          pctChange24h: change, 
          fiatValueUsd: parseFloat(balance) * price 
        } as AssetRow;
    });

    return [wncAsset, ...onChainAssets].filter((asset) => !hiddenTokenKeys.has(`${viewingNetwork.chainId}:${asset.symbol}`));
  }, [viewingNetwork, balances, prices, hiddenTokenKeys, getAvailableAssetsForChain, profile?.wnc_earnings]);

  const contextValue = useMemo(() => ({
    isInitialized, isAssetsLoading: areLogosLoading, isWalletLoading, hasNewNotifications, setHasNewNotifications,
    viewingNetwork: viewingNetwork || (chainsWithLogos[0] || {} as ChainConfig),
    setNetwork: (net: ChainConfig) => { setViewingNetwork(net); setFetchError(null); },
    allAssets: assetsForCurrentNetwork,
    allChains: chainsWithLogos,
    allChainsMap,
    isRefreshing,
    isTokenLoading: () => false,
    wallets, balances, prices, accountNumber,
    refresh: () => startEngine(),
    generateWallet, importWallet, saveToVault, restoreFromCloud,
    logout, deleteWallet: () => {}, deleteWalletPermanently: async () => {},
    fetchError, getAddressForChain, infuraApiKey, setInfuraApiKey,
    hiddenTokenKeys, toggleTokenVisibility, userAddedTokens, addUserToken,
    getAvailableAssetsForChain, isSynced, syncAllAddresses, syncDiagnostic, runCloudDiagnostic: async () => {},
    isRequestOverlayOpen, setIsRequestOverlayOpen, isNotificationsOpen, setIsNotificationsOpen,
    activeFulfillmentId, setActiveFulfillmentId, hasFetchedInitialData
  }), [
    isInitialized, areLogosLoading, isWalletLoading, hasNewNotifications, viewingNetwork, assetsForCurrentNetwork,
    chainsWithLogos, allChainsMap, isRefreshing, wallets, balances, prices, accountNumber, fetchError, infuraApiKey,
    hiddenTokenKeys, userAddedTokens, isSynced, syncDiagnostic, isRequestOverlayOpen, isNotificationsOpen,
    activeFulfillmentId, hasFetchedInitialData, generateWallet, importWallet, restoreFromCloud, logout,
    getAddressForChain, toggleTokenVisibility, addUserToken, getAvailableAssetsForChain, syncAllAddresses, startEngine
  ]);

  return <WalletContext.Provider value={contextValue}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (context === undefined) throw new Error('useWallet must be used within WalletProvider');
  return context;
}
