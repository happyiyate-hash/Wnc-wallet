'use client';

import React, { createContext, useContext, useState, ReactNode, useMemo, useEffect, useCallback, useRef } from 'react';
import type { AssetRow, ChainConfig, WalletWithMetadata } from '@/lib/types';
import { useNetworkLogos } from '@/hooks/useNetworkLogos';
import { useUser } from './user-provider';
import { useMarket } from './market-provider';
import { useWalletEngine } from '@/contexts/hooks/useWalletEngine';
import { deriveAllWallets } from '@/lib/wallets/derive';
import { getAddressForChain as getAddressForChainUtil } from '@/lib/wallets/utils';
import { 
  syncAddressesToCloud, 
  saveVaultToCloud, 
  saveInfuraToCloud,
  purgeLocalWalletCache 
} from '@/lib/wallets/services/wallet-actions';
import { supabase } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { getInitialAssets } from '@/lib/wallets/balances';
import type { PriceResult } from '@/lib/market/price-service';
import { registryDb } from '@/lib/storage/registry-db';
import { backgroundSyncWorker, type SyncDiagnostic } from '@/lib/wallets/background-sync-worker';

interface WalletContextType {
  isInitialized: boolean;
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
  deleteWallet: () => void;
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
  runCloudDiagnostic: (force?: boolean) => Promise<void>;
  dismissSyncCard: () => void;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { toast } = useToast();
  const { chainsWithLogos, allChainsMap } = useNetworkLogos();
  const { user, loading: authLoading, profile, signOut, refreshProfile } = useUser();
  const { prices, registerCustomTokens } = useMarket();
  
  const [balances, setBalances] = useState<{ [key: string]: AssetRow[] }>({});
  const [accountNumber, setAccountNumber] = useState<string | null>(null);
  const [viewingNetwork, setViewingNetwork] = useState<ChainConfig | null>(null);
  const [wallets, setWallets] = useState<WalletWithMetadata[] | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasFetchedInitialData, setHasFetchedInitialData] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isWalletLoading, setIsWalletLoading] = useState(true);
  
  const [infuraApiKey, setInfuraApiKeyState] = useState<string | null>(null);
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

  const hasRunAuditRef = useRef(false);
  const isAuditAbortedRef = useRef(false);

  const effectiveViewingNetwork = useMemo(() => {
    return viewingNetwork || (chainsWithLogos[0] || { chainId: 1, name: 'Ethereum', symbol: 'ETH', rpcUrl: 'https://mainnet.infura.io/v3/{API_KEY}', type: 'evm' } as ChainConfig);
  }, [viewingNetwork, chainsWithLogos]);

  /**
   * DASHBOARD ASSET RESOLUTION
   * Strictly enforces visibility: only Native tokens or User-Enabled tokens appear on the main dashboard.
   */
  const allAssets = useMemo(() => {
    if (!isInitialized) return [];

    const base = getInitialAssets(effectiveViewingNetwork.chainId);
    const custom = userAddedTokens.filter(t => t.chainId === effectiveViewingNetwork.chainId);
    
    // Registry contains everything we know about for this chain
    const registry = [...base, ...custom].reduce((acc, curr) => {
      const id = curr.isNative ? curr.symbol : curr.address?.toLowerCase();
      if (!acc.find(a => (a.isNative ? a.symbol : a.address?.toLowerCase()) === id)) acc.push(curr);
      return acc;
    }, [] as AssetRow[]);

    const wncPrice = prices['internal:wnc']?.price || 0.0006;
    const wncAsset = { 
      chainId: effectiveViewingNetwork.chainId, 
      address: 'internal:wnc', 
      symbol: 'WNC', 
      name: 'Wevinacoin', 
      balance: profile?.wnc_earnings?.toString() || '0', 
      isNative: false, 
      priceUsd: wncPrice, 
      fiatValueUsd: (profile?.wnc_earnings || 0) * wncPrice, 
      pctChange24h: prices['internal:wnc']?.change || 0, 
      decimals: 0 
    } as AssetRow;

    const chainBalances = balances[effectiveViewingNetwork.chainId] || [];
    const mappedAssets = registry.map(asset => {
      const balDoc = chainBalances.find(b => asset.isNative ? b.symbol === asset.symbol : b.address?.toLowerCase() === asset.address?.toLowerCase());
      const p = prices[(asset.priceId || asset.coingeckoId || asset.address || '').toLowerCase()];
      const livePrice = p?.price || 0;
      return { 
        ...asset, 
        balance: balDoc?.balance || '0', 
        priceUsd: livePrice, 
        fiatValueUsd: parseFloat(balDoc?.balance || '0') * livePrice, 
        pctChange24h: p?.change || 0 
      } as AssetRow;
    });

    // DASHBOARD FILTER: Hide non-native tokens that aren't explicitly enabled by the user
    return [wncAsset, ...mappedAssets]
      .filter(a => {
        const key = `${effectiveViewingNetwork.chainId}:${a.symbol}`;
        const isHidden = hiddenTokenKeys.has(key);
        const isUserAdded = userAddedTokens.some(t => t.chainId === effectiveViewingNetwork.chainId && t.symbol === a.symbol);
        
        // Always show WNC and Native Gas Tokens unless explicitly hidden
        if (a.symbol === 'WNC' || a.isNative) return !isHidden;
        
        // Only show hardcoded whitelisted tokens if they were toggled ON (which adds them to userAddedTokens)
        return isUserAdded && !isHidden;
      })
      .sort((a, b) => (b.fiatValueUsd || 0) - (a.fiatValueUsd || 0));
  }, [isInitialized, effectiveViewingNetwork, profile, balances, prices, hiddenTokenKeys, userAddedTokens]);

  const handleSetBalances = useCallback((update: (prev: any) => any) => {
    setBalances(prev => {
      const next = update(prev);
      if (user) localStorage.setItem(`ss-wallet-balances-${user.id}`, JSON.stringify({ data: next, timestamp: Date.now() }));
      return next;
    });
  }, [user]);

  const { refresh } = useWalletEngine({ 
    wallets, 
    viewingNetwork: effectiveViewingNetwork, 
    user, 
    chainsWithLogos, 
    userAddedTokens, 
    infuraApiKey, 
    setBalances: handleSetBalances, 
    setIsRefreshing, 
    setHasFetchedInitialData 
  });

  const dismissSyncCard = useCallback(() => {
    isAuditAbortedRef.current = true;
    setSyncDiagnostic(prev => ({ ...prev, status: 'idle' }));
  }, []);

  const runCloudDiagnostic = useCallback(async (force: boolean = false) => {
    if (!user || !wallets || !chainsWithLogos.length || !accountNumber) return;
    
    const auditKey = `ss-audit-completed-${user.id}`;
    const hasAlreadyRun = localStorage.getItem(auditKey) === 'true';

    if (hasAlreadyRun && !force && !hasRunAuditRef.current) {
        return;
    }

    if (hasRunAuditRef.current && !force) return;
    hasRunAuditRef.current = true;
    isAuditAbortedRef.current = false;

    await backgroundSyncWorker.performCloudAudit(
      user.id, 
      wallets, 
      profile, 
      accountNumber,
      chainsWithLogos,
      (update) => {
          setSyncDiagnostic(prev => ({ ...prev, ...update }));
          if (update.status === 'completed') {
              localStorage.setItem(auditKey, 'true');
          }
      },
      () => isAuditAbortedRef.current
    );
  }, [user, wallets, profile, accountNumber, chainsWithLogos]);

  // GLOBAL DOUBLE-TAP DISMISSAL
  useEffect(() => {
    const handleDblClick = () => {
      if (syncDiagnostic.status !== 'idle') {
        dismissSyncCard();
      }
    };
    window.addEventListener('dblclick', handleDblClick);
    return () => window.removeEventListener('dblclick', handleDblClick);
  }, [syncDiagnostic.status, dismissSyncCard]);

  const generateWallet = useCallback(async (): Promise<string> => {
    if (!user) throw new Error("Auth required");
    const { generateMnemonic } = await import('bip39');
    const mnemonic = generateMnemonic();
    
    localStorage.setItem(`ss-mnemonic-${user.id}`, mnemonic);
    const derived = await deriveAllWallets(mnemonic);
    const targetAcc = profile?.account_number || `835${Math.floor(Math.random() * 9000000 + 1000000)}`;
    
    setWallets(derived);
    setAccountNumber(targetAcc);
    localStorage.setItem(`account_number_${user.id}`, targetAcc);
    
    localStorage.removeItem(`ss-audit-completed-${user.id}`);
    
    const fingerprint = `${mnemonic.length}:${mnemonic.slice(0, 15)}`;
    await registryDb.saveVault({ id: fingerprint, wallets: derived, accountNumber: targetAcc, timestamp: Date.now() });
    
    syncAddressesToCloud(user.id, derived, targetAcc);
    saveVaultToCloud(user.id, mnemonic);
    
    hasRunAuditRef.current = false;
    setTimeout(() => runCloudDiagnostic(true), 1000);
    
    return mnemonic;
  }, [user, profile, runCloudDiagnostic]);

  const importWallet = useCallback(async (mnemonic: string) => {
    if (!user) throw new Error("Auth required");
    const { validateMnemonic } = await import('bip39');
    if (!validateMnemonic(mnemonic)) throw new Error("Invalid node phrase.");
    
    localStorage.setItem(`ss-mnemonic-${user.id}`, mnemonic);
    const derived = await deriveAllWallets(mnemonic);
    const targetAcc = profile?.account_number || `835${Math.floor(Math.random() * 9000000 + 1000000)}`;
    
    setWallets(derived);
    setAccountNumber(targetAcc);
    localStorage.setItem(`account_number_${user.id}`, targetAcc);
    
    localStorage.removeItem(`ss-audit-completed-${user.id}`);
    
    const fingerprint = `${mnemonic.length}:${mnemonic.slice(0, 15)}`;
    await registryDb.saveVault({ id: fingerprint, wallets: derived, accountNumber: targetAcc, timestamp: Date.now() });
    
    syncAddressesToCloud(user.id, derived, targetAcc);
    saveVaultToCloud(user.id, mnemonic);

    hasRunAuditRef.current = false;
    setTimeout(() => runCloudDiagnostic(true), 1000);
  }, [user, profile, runCloudDiagnostic]);

  const restoreFromCloud = useCallback(async (onStatusUpdate?: (status: string) => void) => {
    if (!user || (!profile?.vault_phrase && !profile?.account_number)) throw new Error("Registry node missing.");
    
    setIsWalletLoading(true);
    setIsInitialized(false);
    onStatusUpdate?.('Accessing Cloud Vault...');
    
    try {
      if (profile.vault_phrase && profile.iv) {
        onStatusUpdate?.('Authorizing Decryption...');
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch('/api/wallet/decrypt-phrase', { 
          method: 'POST', 
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': session?.access_token ? `Bearer ${session.access_token}` : ''
          }, 
          body: JSON.stringify({ encrypted: profile.vault_phrase, iv: profile.iv }) 
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "DECRYPTION_FAILED");
        const mnemonic = data.text;
        if (!mnemonic) throw new Error("DECRYPTION_EMPTY");
        onStatusUpdate?.('Deriving Multi-Chain Nodes...');
        localStorage.setItem(`ss-mnemonic-${user.id}`, mnemonic);
        const derived = await deriveAllWallets(mnemonic);
        const fingerprint = `${mnemonic.length}:${mnemonic.slice(0, 15)}`;
        const targetAcc = profile.account_number || `835${Math.floor(Math.random() * 9000000 + 1000000)}`;
        await registryDb.saveVault({ id: fingerprint, wallets: derived, accountNumber: targetAcc, timestamp: Date.now() });
        localStorage.setItem(`account_number_${user.id}`, targetAcc);
        setWallets(derived);
        setAccountNumber(targetAcc);
      } 
      else if (profile.account_number) {
        setAccountNumber(profile.account_number);
        localStorage.setItem(`account_number_${user.id}`, profile.account_number);
      }
      
      localStorage.removeItem(`ss-audit-completed-${user.id}`);
      toast({ title: "Node Reclaimed", description: "Identity registry successfully restored." });
      setIsInitialized(true);
      setIsWalletLoading(false);
      
      hasRunAuditRef.current = false;
      setTimeout(() => runCloudDiagnostic(true), 1500);
    } catch (e: any) { 
      setIsWalletLoading(false);
      setIsInitialized(true);
      throw new Error(e.message || "Institutional recovery failed."); 
    }
  }, [user, profile, toast, runCloudDiagnostic]);

  const deleteWalletPermanently = useCallback(async () => {
    if (!user) return;
    try {
      await supabase.from('profiles').update({ 
        vault_phrase: null, iv: null, account_number: null, onboarding_completed: false, 
        evm_address: null, xrp_address: null, polkadot_address: null, kusama_address: null, 
        near_address: null, solana_address: null, btc_address: null, ltc_address: null, 
        doge_address: null, cosmos_address: null, osmosis_address: null, secret_address: null, 
        cardano_address: null, tron_address: null, algorand_address: null, hedera_address: null, 
        tezos_address: null, aptos_address: null, sui_address: null 
      }).eq('id', user.id);
      registryDb.purgeAll(); 
      purgeLocalWalletCache(user.id);
      setWallets(null); 
      setAccountNumber(null);
      localStorage.removeItem(`ss-audit-completed-${user.id}`);
      hasRunAuditRef.current = false; 
      router.replace('/wallet-session');
    } catch (e) { console.error(e); }
  }, [user, router]);

  const logout = useCallback(async () => {
    if (user) { 
        registryDb.purgeAll(); 
        purgeLocalWalletCache(user.id); 
        localStorage.removeItem(`ss-audit-completed-${user.id}`);
    }
    setWallets(null); setBalances({}); setAccountNumber(null);
    hasRunAuditRef.current = false;
    if (signOut) await signOut();
    window.location.href = '/auth/login';
  }, [signOut, user]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setIsWalletLoading(false); setIsInitialized(true); return; }
    
    const hydrate = async () => {
      try {
        const uid = user.id;
        const savedInfura = localStorage.getItem(`ss-infura-key-${uid}`);
        if (savedInfura) setInfuraApiKeyState(savedInfura);
        const savedAcc = localStorage.getItem(`account_number_${uid}`);
        if (savedAcc) setAccountNumber(savedAcc);
        const savedMnemonic = localStorage.getItem(`ss-mnemonic-${uid}`);
        if (savedMnemonic) {
          const fingerprint = `${savedMnemonic.length}:${savedMnemonic.slice(0, 15)}`;
          const cached = await registryDb.getVault(fingerprint);
          if (cached) {
            setWallets(cached.wallets);
            if (!savedAcc) setAccountNumber(cached.accountNumber);
          } else {
            const derived = await deriveAllWallets(savedMnemonic); 
            setWallets(derived); 
            await registryDb.saveVault({ id: fingerprint, wallets: derived, accountNumber: savedAcc || '', timestamp: Date.now() });
          }
        }
        const cachedBalances = localStorage.getItem(`ss-wallet-balances-${uid}`);
        if (cachedBalances) { try { const { data } = JSON.parse(cachedBalances); setBalances(data); } catch (e) {} }
        
        const hidden = localStorage.getItem(`hidden_tokens_${uid}`);
        if (hidden) setHiddenTokenKeys(new Set(JSON.parse(hidden)));

        const custom = localStorage.getItem(`custom_tokens_${uid}`);
        if (custom) setUserAddedTokens(JSON.parse(custom));

        setIsInitialized(true);
      } catch (e) { setIsInitialized(true); } finally { setIsWalletLoading(false); }
    };
    hydrate();
  }, [authLoading, user?.id, chainsWithLogos]);

  useEffect(() => {
    if (isInitialized && wallets && user && chainsWithLogos.length > 0 && accountNumber) {
      refresh();
      setTimeout(() => runCloudDiagnostic(false), 2000);
    }
  }, [isInitialized, wallets, viewingNetwork, user, refresh, runCloudDiagnostic, chainsWithLogos, accountNumber]);

  const contextValue = useMemo(() => ({
    isInitialized, isWalletLoading, hasNewNotifications, setHasNewNotifications, viewingNetwork: effectiveViewingNetwork, setNetwork: (n: any) => { setViewingNetwork(n); if (user) localStorage.setItem(`active_network_id_${user.id}`, n.chainId.toString()); }, allAssets, allChains: chainsWithLogos, allChainsMap, isRefreshing, wallets, balances, accountNumber, prices, refresh, generateWallet, importWallet, saveToVault: () => saveVaultToCloud(user!.id, localStorage.getItem(`ss-mnemonic-${user!.id}`)!), restoreFromCloud, deleteWallet: () => { if (user) { registryDb.purgeAll(); purgeLocalWalletCache(user.id); setWallets(null); setAccountNumber(null); router.replace('/wallet-session'); } }, deleteWalletPermanently, logout, getAddressForChain: (c: any, w: any) => getAddressForChainUtil(c, w), infuraApiKey, setInfuraApiKey: (k: any) => { if (user) { setInfuraApiKeyState(k); localStorage.setItem(`ss-infura-key-${user.id}`, k || ''); if (k) saveInfuraToCloud(user.id, k); } }, hiddenTokenKeys, toggleTokenVisibility: (cid: number, sym: string) => { setHiddenTokenKeys(prev => { const n = new Set(prev); const k = `${cid}:${sym}`; if (n.has(k)) n.delete(k); else n.add(k); if (user) localStorage.setItem(`hidden_tokens_${user.id}`, JSON.stringify(Array.from(n))); return n; }); }, userAddedTokens, addUserToken: (t: any) => { setUserAddedTokens(prev => { const next = [...prev, t]; if (user) localStorage.setItem(`custom_tokens_${user.id}`, JSON.stringify(next)); registerCustomTokens(next); return next; }); }, 
    getAvailableAssetsForChain: (cid: number) => {
        const base = getInitialAssets(cid);
        const custom = userAddedTokens.filter(t => t.chainId === cid);
        return [...base, ...custom].reduce((acc, curr) => {
            const id = curr.isNative ? curr.symbol : curr.address?.toLowerCase();
            if (!acc.find(a => (a.isNative ? a.symbol : a.address?.toLowerCase()) === id)) acc.push(curr);
            return acc;
        }, [] as any[]).map(a => ({ ...a, balance: '0' } as AssetRow));
    }, 
    isRequestOverlayOpen, setIsRequestOverlayOpen, isNotificationsOpen, setIsNotificationsOpen, activeFulfillmentId, setActiveFulfillmentId, hasFetchedInitialData, syncDiagnostic, runCloudDiagnostic, dismissSyncCard
  }), [isInitialized, isWalletLoading, hasNewNotifications, effectiveViewingNetwork, allAssets, chainsWithLogos, allChainsMap, isRefreshing, wallets, balances, accountNumber, infuraApiKey, prices, hiddenTokenKeys, userAddedTokens, isRequestOverlayOpen, isNotificationsOpen, activeFulfillmentId, setActiveFulfillmentId, hasFetchedInitialData, syncDiagnostic, runCloudDiagnostic, user, profile, router, refresh, generateWallet, importWallet, restoreFromCloud, deleteWalletPermanently, logout, registerCustomTokens, dismissSyncCard]);

  return <WalletContext.Provider value={contextValue}>{children}</WalletContext.Provider>;
}

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (context === undefined) throw new Error('useWallet must be used within WalletProvider');
  return context;
};