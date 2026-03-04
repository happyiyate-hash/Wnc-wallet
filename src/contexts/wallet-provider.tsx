
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
import { getInitialAssets } from '@/lib/wallets/balances';

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
  const { user, loading: authLoading, profile, refreshProfile, signOut } = useUser();
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

  /**
   * INSTITUTIONAL INITIALIZATION SEQUENCE
   * Hardened to ensure local hardware node is derived before terminal flips to "Initialized".
   */
  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      setWallets(null);
      setAccountNumber(null);
      setIsWalletLoading(false);
      setIsInitialized(true);
      return;
    }

    const run = async () => {
      try {
        console.log("[VAULT_HANDSHAKE] Booting terminal for identity:", user.id);
        
        const savedMnemonic = localStorage.getItem(`wallet_mnemonic_${user.id}`);
        const savedInfura = localStorage.getItem(`infura_api_key_${user.id}`);
        const savedAcc = localStorage.getItem(`account_number_${user.id}`);
        
        if (savedInfura) setInfuraApiKeyState(savedInfura);
        if (savedAcc) setAccountNumber(savedAcc);

        if (savedMnemonic) {
          console.log("[VAULT_HANDSHAKE] Local mnemonic detected. Deriving 33-chain nodes...");
          const derived = await Promise.race([
            deriveAllWallets(savedMnemonic),
            new Promise<any>((_, reject) => setTimeout(() => reject(new Error("HANDSHAKE_TIMEOUT")), 10000))
          ]);
          setWallets(derived);
          console.log("[VAULT_HANDSHAKE] Hardware nodes derived successfully.");
        } else {
          console.log("[VAULT_HANDSHAKE] No local keys detected on this device.");
        }

        const savedHidden = localStorage.getItem(`hidden_tokens_${user.id}`);
        if (savedHidden) setHiddenTokenKeys(new Set(JSON.parse(savedHidden)));

        const savedCustom = localStorage.getItem(`custom_tokens_${user.id}`);
        if (savedCustom) setUserAddedTokens(JSON.parse(savedCustom));

        // Registry completion flip
        setIsInitialized(true);
      } catch (e: any) {
        console.error("[VAULT_HANDSHAKE_ERROR]", e);
        setIsInitialized(true);
      } finally {
        setIsWalletLoading(false);
      }
    };

    run();
  }, [authLoading, user?.id]);

  const effectiveViewingNetwork = useMemo(() => {
    return viewingNetwork || (chainsWithLogos[0] || { chainId: 1, name: 'Ethereum', symbol: 'ETH', rpcUrl: 'https://mainnet.infura.io/v3/{API_KEY}', type: 'evm' } as ChainConfig);
  }, [viewingNetwork, chainsWithLogos]);

  const handleSetPrices = useCallback((newPrices: PriceResult) => {
    setPrices(prev => ({ ...prev, ...newPrices }));
  }, []);

  const handleSetBalances = useCallback((update: (prev: any) => any) => {
    setBalances(prev => update(prev));
  }, []);

  const { refresh } = useWalletEngine({
    wallets, 
    viewingNetwork: effectiveViewingNetwork, 
    user, 
    chainsWithLogos, 
    userAddedTokens, 
    rates, 
    infuraApiKey,
    setPrices: handleSetPrices,
    setBalances: handleSetBalances,
    setIsRefreshing, 
    setHasFetchedInitialData
  });

  /**
   * EXPLICIT ENGINE TRIGGER
   */
  useEffect(() => {
    if (!isInitialized || isWalletLoading || !wallets || wallets.length === 0) return;
    refresh();
  }, [isInitialized, isWalletLoading, wallets, refresh]);

  /**
   * CENTRALIZED ASSET REGISTRY
   */
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

    const wncAsset = {
      chainId: effectiveViewingNetwork.chainId,
      address: 'internal:wnc',
      symbol: 'WNC',
      name: 'Wevinacoin',
      balance: profile?.wnc_earnings?.toString() || '0',
      isNative: false,
      priceUsd: prices['internal:wnc']?.price || 0.0006,
      fiatValueUsd: (profile?.wnc_earnings || 0) * (prices['internal:wnc']?.price || 0.0006),
      pctChange24h: prices['internal:wnc']?.change || 0,
      decimals: 0
    };

    const chainBalances = balances[effectiveViewingNetwork.chainId] || [];
    const onChainAssets = registry.map(asset => {
      const balDoc = chainBalances.find(b => 
        asset.isNative ? b.symbol === asset.symbol : b.address?.toLowerCase() === asset.address?.toLowerCase()
      );
      
      const priceId = (asset.priceId || asset.coingeckoId || asset.address || '').toLowerCase();
      const marketData = prices[priceId];
      const balNum = parseFloat(balDoc?.balance || '0');

      return {
        ...asset,
        balance: balDoc?.balance || '0',
        priceUsd: marketData?.price || 0,
        fiatValueUsd: balNum * (marketData?.price || 0),
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
    
    localStorage.setItem(`wallet_mnemonic_${user.id}`, mnemonic);
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
    
    localStorage.setItem(`wallet_mnemonic_${user.id}`, mnemonic);
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
      const mnemonic = localStorage.getItem(`wallet_mnemonic_${user.id}`);
      if (!mnemonic) throw new Error("Local mnemonic not found");
      await saveVaultToCloud(user.id, mnemonic);
      toast({ title: "Vault Synchronized", description: "Encrypted backup committed to cloud." });
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
      toast({ title: "Vault Destroyed", description: "Identity nodes purged from global registry." });
      router.replace('/wallet-session');
    } catch (e: any) {
      toast({ variant: "destructive", title: "Action Failed", description: e.message });
    }
  }, [user, router, toast]);

  const restoreFromCloud = useCallback(async (onStatusUpdate?: (status: string) => void) => {
    if (!user || (!profile?.vault_phrase && !profile?.vault_infura_key)) throw new Error("No cloud backup detected.");
    const { data: { session } } = await supabase!.auth.getSession();
    if (!session) throw new Error("Authentication required.");
    
    onStatusUpdate?.('Restoring Vault Registry...');
    
    try {
      if (profile.vault_phrase) {
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

      if (profile.account_number) {
        localStorage.setItem(`account_number_${user.id}`, profile.account_number);
        setAccountNumber(profile.account_number);
      }

      if (profile.vault_infura_key) {
        onStatusUpdate?.('Restoring RPC Infrastructure...');
        const res = await fetch('/api/wallet/decrypt-phrase', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
          body: JSON.stringify({ encrypted: profile.vault_infura_key, iv: profile.infura_iv })
        });
        const data = await res.json();
        if (data.phrase) {
          localStorage.setItem(`infura_api_key_${user.id}`, data.phrase);
          setInfuraApiKeyState(data.phrase);
        }
      }

      toast({ title: "Identity Recovered", description: "Dual-node synchronization complete." });
    } catch (e) {
      throw new Error("Handshake failed during decryption.");
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
    setWallets(null); setBalances({}); setAccountNumber(null);
    if (signOut) await signOut();
    window.location.href = '/auth/login';
  }, [signOut]);

  const updateInfuraKey = useCallback(async (key: string | null) => {
    if (!user) return;
    
    if (key) {
      try {
        await saveInfuraToCloud(user.id, key);
        setInfuraApiKeyState(key);
        localStorage.setItem(`infura_api_key_${user.id}`, key);
        toast({ title: "RPC Secured", description: "Private node encrypted and synchronized." });
      } catch (e) {
        setInfuraApiKeyState(key);
        localStorage.setItem(`infura_api_key_${user.id}`, key);
      }
    } else {
      setInfuraApiKeyState(null);
      localStorage.removeItem(`infura_api_key_${user.id}`);
    }
  }, [user, toast]);

  const runCloudDiagnostic = useCallback(async (options?: { forceUI?: boolean }) => {
    if (!user || !wallets || wallets.length === 0 || !accountNumber || chainsWithLogos.length === 0) {
        setSyncDiagnostic(prev => ({ ...prev, status: 'idle' }));
        return;
    }
    if (isAuditRunningRef.current) return;
    const auditKey = `audit_done_${user.id}`;
    if (localStorage.getItem(auditKey) === 'true' && !options?.forceUI) return;
    isAuditRunningRef.current = true;
    try {
        await backgroundSyncWorker.performCloudAudit(user.id, wallets, profile, accountNumber, chainsWithLogos, (u) => {
            setSyncDiagnostic(p => ({ ...p, ...u }));
            if (u.status === 'completed') localStorage.setItem(auditKey, 'true');
        });
    } finally { isAuditRunningRef.current = false; }
  }, [user?.id, wallets, accountNumber, profile, chainsWithLogos]);

  const getAvailableAssetsForChain = useCallback((chainId: number) => {
    const base = getInitialAssets(chainId);
    const custom = userAddedTokens.filter(t => t.chainId === chainId);
    
    return [...base, ...custom].reduce((acc, curr) => {
      const identifier = curr.isNative ? curr.symbol : curr.address?.toLowerCase();
      if (!acc.find(a => (a.isNative ? a.symbol : a.address?.toLowerCase()) === identifier)) {
        acc.push(curr);
      }
      return acc;
    }, [] as any[]);
  }, [userAddedTokens]);

  const contextValue = useMemo(() => ({
    isInitialized, isAssetsLoading: areLogosLoading, isWalletLoading, hasNewNotifications, setHasNewNotifications,
    viewingNetwork: effectiveViewingNetwork,
    setNetwork: setViewingNetwork,
    allAssets, 
    allChains: chainsWithLogos,
    allChainsMap,
    isRefreshing, wallets, balances, prices, accountNumber,
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
    isInitialized, areLogosLoading, isWalletLoading, hasNewNotifications, effectiveViewingNetwork, allAssets,
    chainsWithLogos, allChainsMap, isRefreshing, wallets, balances, prices, accountNumber, infuraApiKey,
    hiddenTokenKeys, userAddedTokens, isRequestOverlayOpen, isNotificationsOpen,
    activeFulfillmentId, hasFetchedInitialData, syncDiagnostic, runCloudDiagnostic, refresh, generateWallet, 
    importWallet, saveToVault, restoreFromCloud, deleteWallet, deleteWalletPermanently, logout, updateInfuraKey, user, getAvailableAssetsForChain
  ]);

  return <WalletContext.Provider value={contextValue}>{children}</WalletContext.Provider>;
}

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (context === undefined) throw new Error('useWallet must be used within WalletProvider');
  return context;
};
