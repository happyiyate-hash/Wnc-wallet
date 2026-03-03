
'use client';

import React, { createContext, useContext, useState, ReactNode, useMemo, useEffect, useCallback, useRef } from 'react';
import type { AssetRow, ChainConfig, WalletWithMetadata, UserProfile } from '@/lib/types';
import { useNetworkLogos } from '@/hooks/useNetworkLogos';
import { useUser } from './user-provider';
import { useCurrency } from './currency-provider';
import { useWalletEngine } from '@/lib/wallets/hooks/useWalletEngine';
import { deriveAllWallets } from '@/lib/wallets/derive';
import { getAddressForChain as getAddressForChainUtil } from '@/lib/wallets/utils';
import type { PriceResult } from '@/lib/market/price-service';
import { 
  syncAddressesToCloud, 
  saveVaultToCloud, 
  purgeLocalWalletCache 
} from '@/lib/wallets/services/wallet-actions';
import { backgroundSyncWorker, type SyncDiagnostic } from '@/lib/wallets/background-sync-worker';

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
  getAddressForChain: (chain: ChainConfig, wallets: WalletWithMetadata[]) => string | undefined;
  infuraApiKey: string | null;
  setInfuraApiKey: (key: string | null) => void;
  hiddenTokenKeys: Set<string>;
  toggleTokenVisibility: (chainId: number, symbol: string) => void;
  userAddedTokens: AssetRow[];
  addUserToken: (token: AssetRow) => void;
  getAvailableAssetsForChain: (chainId: number) => AssetRow[];
  isRequestOverlayOpen: boolean;
  setIsRequestOverlayOpen: (open: boolean) => void;
  isNotificationsOpen: boolean;
  setIsNotificationsOpen: (open: boolean) => void;
  activeFulfillmentId: string | null;
  setActiveFulfillmentId: (id: string | null) => void;
  hasFetchedInitialData: boolean;
  syncDiagnostic: SyncDiagnostic;
  runCloudDiagnostic: (options?: { forceUI?: boolean }) => Promise<void>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: ReactNode }) {
  const { chainsWithLogos, areLogosLoading, allChainsMap } = useNetworkLogos();
  const { user, loading: authLoading, signOut: authSignOut, profile, refreshProfile } = useUser();
  const { rates } = useCurrency();
  
  const [viewingNetwork, setViewingNetwork] = useState<ChainConfig | null>(null);
  const [wallets, setWallets] = useState<WalletWithMetadata[] | null>(null);
  const [balances, setBalances] = useState<{ [key: string]: AssetRow[] }>({});
  const [prices, setPrices] = useState<PriceResult>({});
  const [accountNumber, setAccountNumber] = useState<string | null>(null);
  
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasFetchedInitialData, setHasFetchedInitialData] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isWalletLoading, setIsWalletLoading] = useState(true);
  
  const [infuraApiKey, setInfuraApiKey] = useState<string | null>(null);
  const [hiddenTokenKeys, setHiddenTokenKeys] = useState<Set<string>>(new Set());
  const [userAddedTokens, setUserAddedTokens] = useState<AssetRow[]>([]);
  const [isRequestOverlayOpen, setIsRequestOverlayOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [hasNewNotifications, setHasNewNotifications] = useState(false);
  const [activeFulfillmentId, setActiveFulfillmentId] = useState<string | null>(null);

  const [syncDiagnostic, setSyncDiagnostic] = useState<SyncDiagnostic>({
    status: 'idle',
    chain: null,
    localValue: null,
    cloudValue: null,
    progress: 0
  });

  const lastAuditRef = useRef<string | null>(null);

  useEffect(() => {
    if (!viewingNetwork && chainsWithLogos.length > 0) {
      setViewingNetwork(chainsWithLogos[0]);
    }
  }, [chainsWithLogos, viewingNetwork]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setWallets(null); setIsWalletLoading(false); setIsInitialized(true); setHasFetchedInitialData(true);
      return;
    }

    async function initLocalSession() {
      setIsWalletLoading(true);
      try {
        const savedMnemonic = localStorage.getItem(`wallet_mnemonic_${user!.id}`);
        if (savedMnemonic) {
          const derived = await deriveAllWallets(savedMnemonic, profile);
          setWallets(derived);
        } else {
          setHasFetchedInitialData(true);
        }

        const localKey = localStorage.getItem(`infura_api_key_${user!.id}`);
        if (localKey) setInfuraApiKey(localKey);
        
        const localAcc = localStorage.getItem(`account_number_${user!.id}`);
        setAccountNumber(profile?.account_number || localAcc || null);

        const savedHidden = localStorage.getItem(`hidden_tokens_${user!.id}`);
        if (savedHidden) setHiddenTokenKeys(new Set(JSON.parse(savedHidden)));

        const savedCustom = localStorage.getItem(`custom_tokens_${user!.id}`);
        if (savedCustom) setUserAddedTokens(JSON.parse(savedCustom));

        setIsInitialized(true);
      } catch (e) {
        console.error("Initialization Failed:", e);
        setHasFetchedInitialData(true);
      } finally {
        setIsWalletLoading(false);
      }
    }
    initLocalSession();
  }, [user, authLoading]);

  // SAFE LOGIC: BACKGROUND SYNC OBSERVER
  useEffect(() => {
    if (!isInitialized || !wallets || !user || !accountNumber) return;

    const auditKey = `${user.id}:${wallets[0].address}`;
    if (lastAuditRef.current === auditKey) return;
    lastAuditRef.current = auditKey;

    backgroundSyncWorker.performCloudAudit(
      user.id,
      wallets,
      profile,
      accountNumber,
      (update) => setSyncDiagnostic(prev => ({ ...prev, ...update }))
    ).then(() => {
        refreshProfile();
    });
  }, [isInitialized, wallets, user, accountNumber, profile]);

  const { refresh } = useWalletEngine({
    wallets,
    viewingNetwork,
    user,
    chainsWithLogos,
    userAddedTokens,
    rates,
    infuraApiKey,
    setPrices,
    setBalances,
    setIsRefreshing,
    setHasFetchedInitialData
  });

  const getAvailableAssetsForChain = useCallback((chainId: number): AssetRow[] => {
    const { getInitialAssets } = require('@/lib/wallets/balances');
    const base = getInitialAssets(chainId).map((a: any) => ({ ...a, balance: '0' } as AssetRow));
    const custom = userAddedTokens.filter(t => t.chainId === chainId);
    
    return [...base, ...custom].reduce((acc, curr) => {
        const identifier = curr.isNative ? curr.symbol : curr.address?.toLowerCase();
        if (!acc.find(a => (a.isNative ? a.symbol : a.address?.toLowerCase()) === identifier)) {
            acc.push(curr);
        }
        return acc;
    }, [] as AssetRow[]);
  }, [userAddedTokens]);

  const generateWallet = useCallback(async (): Promise<string> => {
    if (!user) throw new Error("Authentication required");
    const { generateMnemonic } = await import('bip39');
    const mnemonic = generateMnemonic();
    localStorage.setItem(`wallet_mnemonic_${user.id}`, mnemonic);
    
    const derived = await deriveAllWallets(mnemonic, profile);
    setWallets(derived);
    
    let targetAcc = accountNumber;
    if (!targetAcc) {
        targetAcc = `835${Math.floor(Math.random() * 9000000 + 1000000)}`;
        setAccountNumber(targetAcc);
        localStorage.setItem(`account_number_${user.id}`, targetAcc);
    }

    await syncAddressesToCloud(user.id, derived, targetAcc);
    return mnemonic;
  }, [user, profile, accountNumber]);

  const importWallet = useCallback(async (mnemonic: string) => {
    if (!user) throw new Error("Authentication required");
    const { validateMnemonic } = await import('bip39');
    if (!validateMnemonic(mnemonic)) throw new Error("Invalid mnemonic");
    
    localStorage.setItem(`wallet_mnemonic_${user.id}`, mnemonic);
    const derived = await deriveAllWallets(mnemonic, profile);
    setWallets(derived);

    let targetAcc = accountNumber;
    if (!targetAcc) {
        targetAcc = `835${Math.floor(Math.random() * 9000000 + 1000000)}`;
        setAccountNumber(targetAcc);
        localStorage.setItem(`account_number_${user.id}`, targetAcc);
    }
    await syncAddressesToCloud(user.id, derived, targetAcc);
  }, [user, profile, accountNumber]);

  const saveToVault = useCallback(async () => {
    if (!user) return;
    const mnemonic = localStorage.getItem(`wallet_mnemonic_${user.id}`);
    if (mnemonic) await saveVaultToCloud(user.id, mnemonic);
  }, [user]);

  const restoreFromCloud = useCallback(async (onStatusUpdate?: (status: string) => void) => {
    if (!user || !profile?.vault_phrase) throw new Error("No cloud backup found");
    onStatusUpdate?.('Restoring Vault...');
    
    const { supabase: ssSupabase } = require('@/lib/supabase/client');
    const { data: { session } } = await ssSupabase.auth.getSession();
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
      if (profile.account_number) setAccountNumber(profile.account_number);
    }
  }, [user, profile]);

  const logout = useCallback(async () => {
    const prevId = user?.id;
    await authSignOut();
    if (prevId) purgeLocalWalletCache(prevId);
    setWallets(null); setBalances({}); setAccountNumber(null);
    window.location.href = '/auth/login';
  }, [authSignOut, user]);

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
        
        const lookupKeys = [asset.priceId, asset.coingeckoId, asset.address, asset.symbol].filter(Boolean).map(k => k!.toLowerCase());
        let priceInfo = null;
        for (const key of lookupKeys) { if (prices[key]) { priceInfo = prices[key]; break; } }
        
        const price = priceInfo?.price || 0;
        const change = priceInfo?.change || 0;

        return { ...asset, balance, priceUsd: price, pctChange24h: change, fiatValueUsd: parseFloat(balance) * price } as AssetRow;
    });

    return [wncAsset, ...onChainAssets].filter((asset) => !hiddenTokenKeys.has(`${viewingNetwork.chainId}:${asset.symbol}`));
  }, [viewingNetwork, balances, prices, hiddenTokenKeys, getAvailableAssetsForChain, profile?.wnc_earnings]);

  const runCloudDiagnostic = useCallback(async () => {
    if (!user || !wallets || !accountNumber) return;
    await backgroundSyncWorker.performCloudAudit(
      user.id,
      wallets,
      profile,
      accountNumber,
      (update) => setSyncDiagnostic(prev => ({ ...prev, ...update }))
    );
  }, [user, wallets, accountNumber, profile]);

  const contextValue = useMemo(() => ({
    isInitialized, isAssetsLoading: areLogosLoading, isWalletLoading, hasNewNotifications, setHasNewNotifications,
    viewingNetwork: viewingNetwork || (chainsWithLogos[0] || {} as ChainConfig),
    setNetwork: setViewingNetwork,
    allAssets: assetsForCurrentNetwork,
    allChains: chainsWithLogos,
    allChainsMap,
    isRefreshing,
    wallets, balances, prices, accountNumber,
    refresh, generateWallet, importWallet, saveToVault, restoreFromCloud,
    logout, getAddressForChain: getAddressForChainUtil, infuraApiKey, setInfuraApiKey,
    hiddenTokenKeys, toggleTokenVisibility: (cid: number, sym: string) => {
        setHiddenTokenKeys(prev => {
            const n = new Set(prev); const k = `${cid}:${sym}`;
            if (n.has(k)) n.delete(k); else n.add(k);
            if (user) localStorage.setItem(`hidden_tokens_${user.id}`, JSON.stringify(Array.from(n)));
            return n;
        });
    }, 
    userAddedTokens, addUserToken: (t: AssetRow) => {
        setUserAddedTokens(prev => {
            const n = [...prev, t];
            if (user) localStorage.setItem(`custom_tokens_${user.id}`, JSON.stringify(n));
            return n;
        });
    },
    getAvailableAssetsForChain, isRequestOverlayOpen, setIsRequestOverlayOpen, isNotificationsOpen, setIsNotificationsOpen,
    activeFulfillmentId, setActiveFulfillmentId, hasFetchedInitialData,
    syncDiagnostic, runCloudDiagnostic
  }), [
    isInitialized, areLogosLoading, isWalletLoading, hasNewNotifications, viewingNetwork, assetsForCurrentNetwork,
    chainsWithLogos, allChainsMap, isRefreshing, wallets, balances, prices, accountNumber, infuraApiKey,
    hiddenTokenKeys, userAddedTokens, isRequestOverlayOpen, isNotificationsOpen,
    activeFulfillmentId, hasFetchedInitialData, syncDiagnostic, runCloudDiagnostic, refresh, generateWallet, importWallet, restoreFromCloud, logout
  ]);

  return <WalletContext.Provider value={contextValue}>{children}</WalletContext.Provider>;
}

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (context === undefined) throw new Error('useWallet must be used within WalletProvider');
  return context;
};
