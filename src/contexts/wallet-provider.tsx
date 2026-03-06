'use client';

import React, { createContext, useContext, useState, ReactNode, useMemo, useEffect, useCallback, useRef } from 'react';
import type { AssetRow, ChainConfig, WalletWithMetadata, UserProfile } from '@/lib/types';
import { useNetworkLogos } from '@/hooks/useNetworkLogos';
import { useUser } from './user-provider';
import { useCurrency } from './currency-provider';
import { useMarket } from './market-provider';
import { useWalletEngine } from '@/lib/wallets/hooks/useWalletEngine';
import { deriveAllWallets } from '@/lib/wallets/derive';
import { getAddressForChain as getAddressForChainUtil } from '@/lib/wallets/utils';
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
import { getInitialAssets } from '@/lib/wallets/balances';
import type { PriceResult } from '@/lib/market/price-service';

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
  runCloudDiagnostic: (options?: { forceUI?: boolean }) => Promise<void>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { toast } = useToast();
  const { chainsWithLogos, areLogosLoading, allChainsMap } = useNetworkLogos();
  const { user, loading: authLoading, profile, signOut } = useUser();
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
    status: 'idle', chain: null, localValue: null, cloudValue: null, progress: 0
  });

  const isAuditRunningRef = useRef(false);
  const hasTriggeredAuditInSessionRef = useRef(false);

  // 1. HYDRATION ENGINE (Shared SmarterSeller Logic)
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setIsWalletLoading(false);
      setIsInitialized(true);
      return;
    }

    const hydrate = async () => {
      try {
        // Use institutional shared keys
        const savedInfura = localStorage.getItem(`ss-infura-key-${user.id}`);
        if (savedInfura) setInfuraApiKeyState(savedInfura);

        const savedAcc = localStorage.getItem(`account_number_${user.id}`);
        if (savedAcc) setAccountNumber(savedAcc);

        const savedNetworkId = localStorage.getItem(`active_network_id_${user.id}`);
        if (savedNetworkId && chainsWithLogos.length > 0) {
          const found = chainsWithLogos.find(c => c.chainId === parseInt(savedNetworkId));
          if (found) setViewingNetwork(found);
        }

        const savedMnemonic = localStorage.getItem(`ss-mnemonic-${user.id}`);
        if (savedMnemonic) {
          const cacheKey = `wallet_addr_cache_${user.id}`;
          const fingerprintKey = `wallet_fingerprint_${user.id}`;
          const currentFingerprint = `${savedMnemonic.length}:${savedMnemonic.slice(0, 10)}`;
          
          const cachedWallets = localStorage.getItem(cacheKey);
          const cachedFingerprint = localStorage.getItem(fingerprintKey);

          if (cachedWallets && cachedFingerprint === currentFingerprint) {
            setWallets(JSON.parse(cachedWallets));
          } else {
            const derived = await deriveAllWallets(savedMnemonic);
            setWallets(derived);
            localStorage.setItem(cacheKey, JSON.stringify(derived));
            localStorage.setItem(fingerprintKey, currentFingerprint);
          }
        }

        const cachedBalances = localStorage.getItem(`ss-wallet-balances-${user.id}`);
        if (cachedBalances) {
          try {
            const { data } = JSON.parse(cachedBalances);
            setBalances(data);
          } catch (e) {}
        }

        const savedHidden = localStorage.getItem(`hidden_tokens_${user.id}`);
        if (savedHidden) setHiddenTokenKeys(new Set(JSON.parse(savedHidden)));

        const savedCustom = localStorage.getItem(`custom_tokens_${user.id}`);
        if (savedCustom) {
            const tokens = JSON.parse(savedCustom);
            setUserAddedTokens(tokens);
            registerCustomTokens(tokens);
        }

        setIsInitialized(true);
      } catch (e) {
        setIsInitialized(true);
      } finally {
        setIsWalletLoading(false);
      }
    };

    hydrate();
  }, [authLoading, user?.id, registerCustomTokens, chainsWithLogos.length]);

  // 2. STABILITY NODES: Declare dependencies BEFORE the engine init
  const effectiveViewingNetwork = useMemo(() => {
    return viewingNetwork || (chainsWithLogos[0] || { chainId: 1, name: 'Ethereum', symbol: 'ETH', rpcUrl: 'https://mainnet.infura.io/v3/{API_KEY}', type: 'evm' } as ChainConfig);
  }, [viewingNetwork, chainsWithLogos]);

  const handleSetBalances = useCallback((update: (prev: any) => any) => {
    setBalances(prev => {
      const next = update(prev);
      if (user) {
        localStorage.setItem(`ss-wallet-balances-${user.id}`, JSON.stringify({ data: next, timestamp: Date.now() }));
      }
      return next;
    });
  }, [user]);

  // 3. ENGINE INITIALIZATION
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

  const updateNetwork = useCallback((network: ChainConfig) => {
    setViewingNetwork(network);
    if (user) {
      localStorage.setItem(`active_network_id_${user.id}`, network.chainId.toString());
    }
  }, [user]);

  const allAssets = useMemo(() => {
    if (!isInitialized) return [];

    const base = getInitialAssets(effectiveViewingNetwork.chainId);
    const custom = userAddedTokens.filter(t => t.chainId === effectiveViewingNetwork.chainId);
    
    const registry = [...base, ...custom].reduce((acc, curr) => {
      const identifier = curr.isNative ? curr.symbol : curr.address?.toLowerCase();
      if (!acc.find(a => (a.isNative ? a.symbol : a.address?.toLowerCase()) === identifier)) {
        acc.push(curr);
      }
      return acc;
    }, [] as any[]);

    const wncPrice = prices['internal:wnc']?.price || 0.0006;
    const wncChange = prices['internal:wnc']?.change || 0;

    const wncAsset = {
      chainId: effectiveViewingNetwork.chainId,
      address: 'internal:wnc',
      symbol: 'WNC',
      name: 'Wevinacoin',
      balance: profile?.wnc_earnings?.toString() || '0',
      isNative: false,
      priceUsd: wncPrice,
      fiatValueUsd: (profile?.wnc_earnings || 0) * wncPrice,
      pctChange24h: wncChange,
      decimals: 0
    };

    const chainBalances = balances[effectiveViewingNetwork.chainId] || [];
    const onChainAssets = registry.map(asset => {
      const balDoc = chainBalances.find(b => 
        asset.isNative ? b.symbol === asset.symbol : b.address?.toLowerCase() === asset.address?.toLowerCase()
      );
      
      const priceId = (asset.priceId || asset.coingeckoId || asset.address || '').toLowerCase();
      const marketData = prices[priceId];
      const livePrice = marketData?.price || 0;
      const balNum = parseFloat(balDoc?.balance || '0');

      return {
        ...asset,
        balance: balDoc?.balance || '0',
        priceUsd: livePrice,
        fiatValueUsd: balNum * livePrice,
        pctChange24h: marketData?.change || 0
      };
    });

    return [wncAsset, ...onChainAssets]
      .filter(a => !hiddenTokenKeys.has(`${effectiveViewingNetwork.chainId}:${a.symbol}`))
      .sort((a, b) => (b.fiatValueUsd || 0) - (a.fiatValueUsd || 0));
  }, [isInitialized, effectiveViewingNetwork, profile, balances, prices, hiddenTokenKeys, userAddedTokens]);

  const generateWallet = useCallback(async (): Promise<string> => {
    if (!user) throw new Error("Authentication required");
    const { generateMnemonic } = await import('bip39');
    const mnemonic = generateMnemonic();
    
    localStorage.setItem(`ss-mnemonic-${user.id}`, mnemonic);
    const derived = await deriveAllWallets(mnemonic);
    setWallets(derived);
    
    let targetAcc = profile?.account_number || `835${Math.floor(Math.random() * 9000000 + 1000000)}`;
    setAccountNumber(targetAcc);
    localStorage.setItem(`account_number_${user.id}`, targetAcc);

    await syncAddressesToCloud(user.id, derived, targetAcc);
    await saveVaultToCloud(user.id, mnemonic);
    
    return mnemonic;
  }, [user?.id, profile?.account_number]);

  const importWallet = useCallback(async (mnemonic: string) => {
    if (!user) throw new Error("Authentication required");
    const { validateMnemonic } = await import('bip39');
    if (!validateMnemonic(mnemonic)) throw new Error("Invalid mnemonic");
    
    localStorage.setItem(`ss-mnemonic-${user.id}`, mnemonic);
    const derived = await deriveAllWallets(mnemonic);
    setWallets(derived);
    
    let targetAcc = profile?.account_number || `835${Math.floor(Math.random() * 9000000 + 1000000)}`;
    setAccountNumber(targetAcc);
    localStorage.setItem(`account_number_${user.id}`, targetAcc);

    await syncAddressesToCloud(user.id, derived, targetAcc);
    await saveVaultToCloud(user.id, mnemonic);
  }, [user?.id, profile?.account_number]);

  const saveToVault = useCallback(async () => {
    if (!user || !wallets) return;
    try {
      const mnemonic = localStorage.getItem(`ss-mnemonic-${user.id}`);
      if (!mnemonic) throw new Error("Local mnemonic not found");
      await saveVaultToCloud(user.id, mnemonic);
      toast({ title: "Vault Synchronized" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Sync Failed", description: e.message });
    }
  }, [user, wallets, toast]);

  const deleteWalletPermanently = useCallback(async () => {
    if (!user || !supabase) return;
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          vault_phrase: null, iv: null,
          evm_address: null, xrp_address: null, polkadot_address: null,
          near_address: null, solana_address: null, btc_address: null,
          onboarding_completed: false
        })
        .eq('id', user.id);

      if (error) throw error;

      purgeLocalWalletCache(user.id);
      setWallets(null); setBalances({}); setAccountNumber(null);
      router.replace('/wallet-session');
    } catch (e: any) {
      toast({ variant: "destructive", title: "Action Failed" });
    }
  }, [user, router, toast]);

  /**
   * INSTITUTIONAL RECOVERY FLOW (Atomic Sequence)
   * Version: 4.0.0 (Guide Compliant)
   */
  const restoreFromCloud = useCallback(async (onStatusUpdate?: (status: string) => void) => {
    if (!user || (!profile?.vault_phrase && !profile?.account_number)) throw new Error("No backup found.");
    
    const { data: { session } } = await supabase!.auth.getSession();
    if (!session) throw new Error("Authentication required.");
    
    setIsWalletLoading(true);
    onStatusUpdate?.('Decrypting Registry Nodes...');
    
    try {
      // 1. Decrypt Mnemonic Node via API
      if (profile.vault_phrase && profile.iv) {
        const res = await fetch('/api/wallet/decrypt-phrase', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
          body: JSON.stringify({ encrypted: profile.vault_phrase, iv: profile.iv })
        });
        const data = await res.json();
        const mnemonic = data.text;
        
        if (mnemonic) {
          // Persist to Shared Registry
          localStorage.setItem(`ss-mnemonic-${user.id}`, mnemonic);
          
          // 2. Decrypt Infura Node (if exists)
          if (profile.vault_infura_key && profile.infura_iv) {
            const resKey = await fetch('/api/wallet/decrypt-phrase', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
              body: JSON.stringify({ encrypted: profile.vault_infura_key, iv: profile.infura_iv })
            });
            const keyData = await resKey.json();
            const apiKey = keyData.text;
            if (apiKey) {
              localStorage.setItem(`ss-infura-key-${user.id}`, apiKey);
              setInfuraApiKeyState(apiKey);
            }
          }

          // 3. ATOMIC DERIVATION: Derive all 39 blockchain nodes in-process
          onStatusUpdate?.('Deriving Multi-Chain Wallets...');
          const derived = await deriveAllWallets(mnemonic);
          
          // Cache derived addresses for instant subsequent hydrations
          localStorage.setItem(`wallet_addr_cache_${user.id}`, JSON.stringify(derived));
          localStorage.setItem(`wallet_fingerprint_${user.id}`, `${mnemonic.length}:${mnemonic.slice(0, 10)}`);
          
          setWallets(derived);
        } else {
          throw new Error("Decryption handshake failed.");
        }
      }

      // 4. Recover Account ID
      if (profile.account_number) {
        localStorage.setItem(`account_number_${user.id}`, profile.account_number);
        setAccountNumber(profile.account_number);
      }

      toast({ title: "Identity Recovered" });
    } catch (e: any) {
      console.error("[RECOVERY_FAIL]:", e.message);
      throw new Error(e.message || "Handshake failed.");
    } finally {
      setIsWalletLoading(false);
    }
  }, [user, profile, toast]);

  const deleteWallet = useCallback(() => {
    if (user) {
      purgeLocalWalletCache(user.id);
      setWallets(null);
      setAccountNumber(null);
      router.replace('/wallet-session');
    }
  }, [user, router]);

  const logout = useCallback(async () => {
    if (user) {
      purgeLocalWalletCache(user.id);
    }
    setWallets(null); setBalances({}); setAccountNumber(null);
    if (signOut) await signOut();
    window.location.href = '/auth/login';
  }, [signOut, user]);

  const updateInfuraKey = useCallback(async (key: string | null) => {
    if (!user) return;
    if (key) {
      try {
        await saveInfuraToCloud(user.id, key);
        setInfuraApiKeyState(key);
        localStorage.setItem(`ss-infura-key-${user.id}`, key);
      } catch (e) {
        setInfuraApiKeyState(key);
        localStorage.setItem(`ss-infura-key-${user.id}`, key);
      }
    } else {
      setInfuraApiKeyState(null);
      localStorage.removeItem(`ss-infura-key-${user.id}`);
    }
  }, [user]);

  const runCloudDiagnostic = useCallback(async (options?: { forceUI?: boolean }) => {
    if (!user || !wallets || wallets.length === 0 || !accountNumber || chainsWithLogos.length === 0) return;
    if (isAuditRunningRef.current) return;

    const fingerprint = `registry_audit_v2_${user.id}_${wallets[0].address}`;
    const hasAudited = localStorage.getItem(fingerprint);

    if (!options?.forceUI && (hasAudited === 'true' || hasTriggeredAuditInSessionRef.current)) {
        return;
    }

    isAuditRunningRef.current = true;
    hasTriggeredAuditInSessionRef.current = true;
    
    try {
        await backgroundSyncWorker.performCloudAudit(user.id, wallets, profile, accountNumber, chainsWithLogos, (u) => {
            setSyncDiagnostic(p => ({ ...p, ...u }));
            if (u.status === 'completed') {
                localStorage.setItem(fingerprint, 'true');
            }
        });
    } finally { 
        isAuditRunningRef.current = false; 
    }
  }, [user?.id, wallets, accountNumber, profile, chainsWithLogos]);

  useEffect(() => {
    if (isInitialized && !isWalletLoading && wallets && wallets.length > 0 && hasFetchedInitialData) {
      const timer = setTimeout(() => {
        runCloudDiagnostic();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isInitialized, isWalletLoading, !!wallets, hasFetchedInitialData, runCloudDiagnostic]);

  const getAvailableAssetsForChain = useCallback((chainId: number) => {
    return getInitialAssets(chainId).map(a => ({ ...a, balance: '0' } as AssetRow));
  }, []);

  const addUserToken = useCallback((token: AssetRow) => {
    setUserAddedTokens(prev => {
        const next = [...prev, token];
        if (user) localStorage.setItem(`custom_tokens_${user.id}`, JSON.stringify(next));
        registerCustomTokens(next);
        return next;
    });
  }, [user, registerCustomTokens]);

  const contextValue = useMemo(() => ({
    isInitialized, isWalletLoading, hasNewNotifications, setHasNewNotifications,
    viewingNetwork: effectiveViewingNetwork,
    setNetwork: updateNetwork,
    allAssets, 
    allChains: chainsWithLogos,
    allChainsMap,
    isRefreshing, wallets, balances, accountNumber,
    prices,
    refresh, generateWallet, importWallet, saveToVault, restoreFromCloud,
    deleteWallet, deleteWalletPermanently, logout, 
    getAddressForChain: (c: any, w: any) => getAddressForChainUtil(c, w), 
    infuraApiKey, setInfuraApiKey: updateInfuraKey,
    hiddenTokenKeys, toggleTokenVisibility: (cid: number, sym: string) => {
        setHiddenTokenKeys(prev => {
            const n = new Set(prev); const k = `${cid}:${sym}`;
            if (n.has(k)) n.delete(k); else n.add(k);
            if (user) localStorage.setItem(`hidden_tokens_${user.id}`, JSON.stringify(Array.from(n)));
            return n;
        });
    }, 
    userAddedTokens, addUserToken,
    getAvailableAssetsForChain, isRequestOverlayOpen, setIsRequestOverlayOpen, isNotificationsOpen, setIsNotificationsOpen,
    activeFulfillmentId, setActiveFulfillmentId, hasFetchedInitialData,
    syncDiagnostic, runCloudDiagnostic
  }), [
    isInitialized, isWalletLoading, hasNewNotifications, effectiveViewingNetwork, allAssets,
    chainsWithLogos, allChainsMap, isRefreshing, wallets, balances, accountNumber, infuraApiKey,
    prices,
    hiddenTokenKeys, userAddedTokens, isRequestOverlayOpen, isNotificationsOpen,
    activeFulfillmentId, setActiveFulfillmentId, hasFetchedInitialData, syncDiagnostic, runCloudDiagnostic,
    refresh, generateWallet, importWallet, saveToVault, restoreFromCloud, deleteWallet, deleteWalletPermanently, logout, 
    updateNetwork, user, getAvailableAssetsForChain, updateInfuraKey, addUserToken
  ]);

  return <WalletContext.Provider value={contextValue}>{children}</WalletContext.Provider>;
}

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (context === undefined) throw new Error('useWallet must be used within WalletProvider');
  return context;
};
