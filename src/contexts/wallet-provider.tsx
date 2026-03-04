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
  saveInfuraToCloud,
  purgeLocalWalletCache 
} from '@/lib/wallets/services/wallet-actions';
import { backgroundSyncWorker, type SyncDiagnostic } from '@/lib/wallets/background-sync-worker';
import { supabase } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';

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
  deleteWallet: () => Promise<void>;
  deleteWalletPermanently: () => Promise<void>;
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
  const router = useRouter();
  const { toast } = useToast();
  const { chainsWithLogos, areLogosLoading, allChainsMap } = useNetworkLogos();
  const { user, loading: authLoading, profile, refreshProfile, signOut: authSignOut } = useUser();
  const { rates } = useCurrency();
  
  const [prices, setPrices] = useState<PriceResult>({});
  const [balances, setBalances] = useState<{ [key: string]: AssetRow[] }>({});
  const [accountNumber, setAccountNumber] = useState<string | null>(null);
  const [viewingNetwork, setViewingNetwork] = useState<ChainConfig | null>(null);
  const [wallets, setWallets] = useState<WalletWithMetadata[] | null>(null);
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
    status: 'idle', chain: null, localValue: null, cloudValue: null, progress: 0
  });

  const isAuditRunningRef = useRef(false);

  // 1. Initial State Hydration
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const cachedPrices = localStorage.getItem('cache_prices_global');
    if (cachedPrices) setPrices(JSON.parse(cachedPrices));
    const cachedBalances = localStorage.getItem('cache_balances_all');
    if (cachedBalances) setBalances(JSON.parse(cachedBalances));
    const lastNetwork = localStorage.getItem('last_viewing_network');
    if (lastNetwork) setViewingNetwork(JSON.parse(lastNetwork));
  }, []);

  // 2. Profile Sync - Only update Account Number, not wallet state
  useEffect(() => {
    if (profile?.account_number) {
      setAccountNumber(profile.account_number);
      if (user) localStorage.setItem(`account_number_${user.id}`, profile.account_number);
    }
  }, [profile?.account_number, user?.id]);

  /**
   * STABLE INITIALIZATION ENGINE
   * Hardened to depend strictly on user.id to prevent loops on profile metadata updates.
   */
  const initLocalSession = useCallback(async () => {
    if (authLoading) return;
    if (!user) {
      setWallets(null);
      setIsWalletLoading(false);
      setIsInitialized(true);
      return;
    }

    try {
      const savedMnemonic = localStorage.getItem(`wallet_mnemonic_${user.id}`);
      if (savedMnemonic) {
        // Derive wallets using only the mnemonic. hedera_address is fetched inside derivation if needed
        const derived = await deriveAllWallets(savedMnemonic);
        setWallets(derived);
      }

      const localKey = localStorage.getItem(`infura_api_key_${user.id}`);
      if (localKey) setInfuraApiKey(localKey);
      
      const savedHidden = localStorage.getItem(`hidden_tokens_${user.id}`);
      if (savedHidden) setHiddenTokenKeys(new Set(JSON.parse(savedHidden)));

      const savedCustom = localStorage.getItem(`custom_tokens_${user.id}`);
      if (savedCustom) setUserAddedTokens(JSON.parse(savedCustom));

      setIsInitialized(true);
    } catch (e) {
      console.error("Initialization Failed:", e);
      setIsInitialized(true); 
    } finally {
      setIsWalletLoading(false);
    }
  }, [user?.id, authLoading]);

  useEffect(() => {
    initLocalSession();
  }, [initLocalSession]);

  const { refresh } = useWalletEngine({
    wallets, viewingNetwork, user, chainsWithLogos, userAddedTokens, rates, infuraApiKey,
    setPrices: (newPrices) => {
      setPrices(newPrices);
      localStorage.setItem('cache_prices_global', JSON.stringify(newPrices));
    },
    setBalances: (update) => {
      setBalances(prev => {
        const next = update(prev);
        localStorage.setItem('cache_balances_all', JSON.stringify(next));
        return next;
      });
    },
    setIsRefreshing, setHasFetchedInitialData
  });

  const updateInfuraKey = useCallback(async (key: string | null) => {
    if (!user) return;
    setInfuraApiKey(key);
    if (key) {
      localStorage.setItem(`infura_api_key_${user.id}`, key);
      await saveInfuraToCloud(user.id, key);
    } else {
      localStorage.removeItem(`infura_api_key_${user.id}`);
    }
  }, [user?.id]);

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
    const derived = await deriveAllWallets(mnemonic);
    setWallets(derived);
    
    let targetAcc = profile?.account_number || accountNumber || `835${Math.floor(Math.random() * 9000000 + 1000000)}`;
    setAccountNumber(targetAcc);
    localStorage.setItem(`account_number_${user.id}`, targetAcc);
    
    await syncAddressesToCloud(user.id, derived, targetAcc);
    await saveVaultToCloud(user.id, mnemonic);
    return mnemonic;
  }, [user?.id, profile?.account_number, accountNumber]);

  const importWallet = useCallback(async (mnemonic: string) => {
    if (!user) throw new Error("Authentication required");
    const { validateMnemonic } = await import('bip39');
    if (!validateMnemonic(mnemonic)) throw new Error("Invalid mnemonic");
    localStorage.setItem(`wallet_mnemonic_${user.id}`, mnemonic);
    const derived = await deriveAllWallets(mnemonic);
    setWallets(derived);
    
    let targetAcc = profile?.account_number || accountNumber || `835${Math.floor(Math.random() * 9000000 + 1000000)}`;
    setAccountNumber(targetAcc);
    localStorage.setItem(`account_number_${user.id}`, targetAcc);
    
    await syncAddressesToCloud(user.id, derived, targetAcc);
    await saveVaultToCloud(user.id, mnemonic);
  }, [user?.id, profile?.account_number, accountNumber]);

  const saveToVault = useCallback(async () => {
    if (!user) return;
    const mnemonic = localStorage.getItem(`wallet_mnemonic_${user.id}`);
    if (mnemonic) await saveVaultToCloud(user.id, mnemonic);
  }, [user?.id]);

  const restoreFromCloud = useCallback(async (onStatusUpdate?: (status: string) => void) => {
    if (!user || (!profile?.vault_phrase && !profile?.vault_infura_key)) {
      throw new Error("No cloud backup detected.");
    }

    const { data: { session } } = await supabase!.auth.getSession();
    if (!session) throw new Error("Authentication session missing.");

    // 1. RESTORE MNEMONIC
    if (profile?.vault_phrase && profile?.iv) {
      onStatusUpdate?.('Restoring Vault Registry...');
      const res = await fetch('/api/wallet/decrypt-phrase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ encrypted: profile.vault_phrase, iv: profile.iv })
      });
      const data = await res.json();
      if (data.phrase) {
        localStorage.setItem(`wallet_mnemonic_${user.id}`, data.phrase);
        const derived = await deriveAllWallets(data.phrase);
        setWallets(derived);
      }
    }

    // 2. RESTORE API KEY (RPC NODE)
    if (profile?.vault_infura_key && profile?.infura_iv) {
      onStatusUpdate?.('Synchronizing RPC Nodes...');
      const res = await fetch('/api/wallet/decrypt-phrase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ encrypted: profile.vault_infura_key, iv: profile.infura_iv })
      });
      const data = await res.json();
      if (data.phrase) {
        setInfuraApiKey(data.phrase);
        localStorage.setItem(`infura_api_key_${user.id}`, data.phrase);
      }
    }

    toast({ title: "Node Synchronized", description: "Vault credentials restored." });
  }, [user?.id, profile, toast]);

  const deleteWallet = useCallback(async () => {
    if (user) {
        setSyncDiagnostic({ status: 'idle', chain: null, localValue: null, cloudValue: null, progress: 0 });
        purgeLocalWalletCache(user.id);
        setWallets(null);
        setAccountNumber(null);
        setBalances({});
        setInfuraApiKey(null);
        setHasFetchedInitialData(true);
        router.replace('/wallet-session');
    }
  }, [user?.id, router]);

  const deleteWalletPermanently = useCallback(async () => {
    if (!user || !supabase) return;
    
    try {
        const { error: dbError } = await supabase.from('profiles').update({
            vault_phrase: null,
            iv: null,
            vault_infura_key: null,
            infura_iv: null,
            account_number: null,
            onboarding_completed: false
        }).eq('id', user.id);

        if (dbError) throw dbError;

        setSyncDiagnostic({ status: 'idle', chain: null, localValue: null, cloudValue: null, progress: 0 });
        purgeLocalWalletCache(user.id);
        setWallets(null);
        setAccountNumber(null);
        setBalances({});
        setInfuraApiKey(null);
        setPrices({});
        setHasFetchedInitialData(true);
        
        router.replace('/wallet-session');
        toast({ title: "Vault Destroyed", description: "Global registry data purged." });
    } catch (e: any) {
        toast({ variant: "destructive", title: "Destruction Error", description: e.message });
    }
  }, [user?.id, router, toast]);

  const logout = useCallback(async () => {
    const prevId = user?.id;
    if (prevId) purgeLocalWalletCache(prevId);
    
    setWallets(null); 
    setBalances({}); 
    setAccountNumber(null);
    setInfuraApiKey(null);
    setPrices({});
    setUserAddedTokens([]);
    setHiddenTokenKeys(new Set());
    setSyncDiagnostic({ status: 'idle', chain: null, localValue: null, cloudValue: null, progress: 0 });

    await authSignOut();
    window.location.href = '/auth/login';
  }, [authSignOut, user?.id]);

  const getAddressForChain = useCallback((chain: ChainConfig, wallets: WalletWithMetadata[]) => {
    return getAddressForChainUtil(chain, wallets);
  }, []);

  const runCloudDiagnostic = useCallback(async (options?: { forceUI?: boolean }) => {
    if (!user || !wallets || wallets.length === 0 || !accountNumber || chainsWithLogos.length === 0) {
        setSyncDiagnostic(prev => ({ ...prev, status: 'idle' }));
        return;
    }

    if (isAuditRunningRef.current) return;
    
    const auditKey = `audit_done_${user.id}`;
    if (localStorage.getItem(auditKey) === 'true' && !options?.forceUI) {
        return;
    }

    isAuditRunningRef.current = true;
    try {
        await backgroundSyncWorker.performCloudAudit(
            user.id, 
            wallets, 
            profile, 
            accountNumber, 
            chainsWithLogos, 
            (u) => {
                setSyncDiagnostic(p => ({ ...p, ...u }));
                if (u.status === 'completed') {
                    localStorage.setItem(auditKey, 'true');
                }
            }
        );
    } finally {
        isAuditRunningRef.current = false;
    }
  }, [user?.id, wallets, accountNumber, profile, chainsWithLogos]);

  const contextValue = useMemo(() => ({
    isInitialized, isAssetsLoading: areLogosLoading, isWalletLoading, hasNewNotifications, setHasNewNotifications,
    viewingNetwork: viewingNetwork || (chainsWithLogos[0] || {} as ChainConfig),
    setNetwork: setViewingNetwork,
    allAssets: [], 
    allChains: chainsWithLogos,
    allChainsMap,
    isRefreshing, wallets, balances, prices, accountNumber,
    refresh, generateWallet, importWallet, saveToVault, restoreFromCloud,
    deleteWallet, deleteWalletPermanently, logout, 
    getAddressForChain, infuraApiKey, setInfuraApiKey: updateInfuraKey,
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
    isInitialized, areLogosLoading, isWalletLoading, hasNewNotifications, viewingNetwork,
    chainsWithLogos, allChainsMap, isRefreshing, wallets, balances, prices, accountNumber, infuraApiKey,
    hiddenTokenKeys, userAddedTokens, isRequestOverlayOpen, isNotificationsOpen,
    activeFulfillmentId, hasFetchedInitialData, syncDiagnostic, runCloudDiagnostic, refresh, generateWallet, 
    importWallet, saveToVault, restoreFromCloud, deleteWallet, deleteWalletPermanently, logout, getAddressForChain, updateInfuraKey
  ]);

  return <WalletContext.Provider value={contextValue}>{children}</WalletContext.Provider>;
}

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (context === undefined) throw new Error('useWallet must be used within WalletProvider');
  return context;
};