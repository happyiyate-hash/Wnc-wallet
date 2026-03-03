
'use client';

import React, { createContext, useContext, useState, ReactNode, useMemo, useEffect, useCallback, useRef } from 'react';
import { usePathname } from 'next/navigation';
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
  const pathname = usePathname();
  
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
  const activeMnemonicRef = useRef<string | null>(null);

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

      if (currentWallets && currentWallets.length > 0) {
        const walletPayload = currentWallets.map(w => ({ type: w.type, address: w.address }));
        await supabase.rpc('sync_user_wallets', {
            p_user_id: user.id,
            p_wallets: walletPayload
        });
      }

      await refreshProfile();
    } catch (e: any) {
      console.error("Registry Sync Interrupted:", e.message);
    }
  }, [user, wallets, accountNumber, refreshProfile]);

  const saveToVault = useCallback(async () => {
    if (!user || !supabase) return;
    try {
      const { data: { session } } = await supabase!.auth.getSession();
      const updates: any = {};
      const mnemonic = localStorage.getItem(`wallet_mnemonic_${user.id}`);
      const localInfuraKey = localStorage.getItem('infura_api_key');

      if (mnemonic) {
        const res = await fetch('/api/wallet/encrypt-phrase', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
          body: JSON.stringify({ phrase: mnemonic })
        });
        const data = await res.json();
        if (res.ok) { updates.vault_phrase = data.encrypted; updates.iv = data.iv; }
      }

      if (localInfuraKey) {
        const res = await fetch('/api/wallet/encrypt-phrase', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
          body: JSON.stringify({ phrase: localInfuraKey })
        });
        const data = await res.json();
        if (res.ok) { updates.vault_infura_key = data.encrypted; updates.infura_iv = data.iv; }
      }

      if (Object.keys(updates).length > 0) {
        const { error } = await supabase!.from('profiles').update(updates).eq('id', user.id);
        if (error) throw error;
      }
    } catch (e: any) { 
      console.error("Vault Backup Failed:", e.message); 
    }
  }, [user]);

  const generateWallet = useCallback(async (): Promise<string> => {
    if (!user) throw new Error("Authentication required");
    const { generateMnemonic } = await import('bip39');
    const mnemonic = generateMnemonic();
    localStorage.setItem(`wallet_mnemonic_${user.id}`, mnemonic);
    activeMnemonicRef.current = mnemonic;
    const derived = await deriveAllWallets(mnemonic, profile);
    setWallets(derived);
    await syncAllAddresses(derived);
    await saveToVault();
    return mnemonic;
  }, [user, profile, syncAllAddresses, saveToVault]);

  const importWallet = useCallback(async (mnemonic: string) => {
    if (!user) throw new Error("Authentication required");
    const { validateMnemonic } = await import('bip39');
    if (!validateMnemonic(mnemonic)) throw new Error("Invalid mnemonic");
    localStorage.setItem(`wallet_mnemonic_${user.id}`, mnemonic);
    activeMnemonicRef.current = mnemonic;
    const derived = await deriveAllWallets(mnemonic, profile);
    setWallets(derived);
    await syncAllAddresses(derived);
    await saveToVault();
  }, [user, profile, syncAllAddresses, saveToVault]);

  const restoreFromCloud = useCallback(async (onStatusUpdate?: (status: string) => void) => {
    if (!user || !profile?.vault_phrase || !profile.iv) throw new Error("No cloud backup found");
    
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
      activeMnemonicRef.current = phrase;
      onStatusUpdate?.('Deriving...');
      const derived = await deriveAllWallets(phrase, profile);
      setWallets(derived);
      
      if (profile.vault_infura_key && profile.infura_iv) {
        const keyRes = await fetch('/api/wallet/decrypt-phrase', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
          body: JSON.stringify({ encrypted: profile.vault_infura_key, iv: profile.infura_iv })
        });
        const { phrase: key } = await keyRes.json();
        if (key) {
          setInfuraApiKey(key);
          localStorage.setItem('infura_api_key', key);
        }
      }
      
      await syncAllAddresses(derived);
    }
  }, [user, profile, syncAllAddresses]);

  const runCloudDiagnostic = useCallback(async (options?: { forceUI?: boolean }) => {
    if (!wallets || !profile || !user || !supabase) return;
    if (wallets.length === 0) return;

    const auditKey = `identity_audit_${user.id}`;
    const hasAudited = sessionStorage.getItem(auditKey);
    if (!options?.forceUI && hasAudited === 'verified') return;
    
    sessionStorage.setItem(auditKey, 'verified');

    const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    
    const chains: { label: string; type: string }[] = [
      { label: 'EVM', type: 'evm' }, { label: 'XRP', type: 'xrp' }, { label: 'Polkadot', type: 'polkadot' }, 
      { label: 'Kusama', type: 'kusama' }, { label: 'NEAR', type: 'near' }, { label: 'BTC', type: 'btc' }, 
      { label: 'LTC', type: 'ltc' }, { label: 'DOGE', type: 'doge' }, { label: 'SOL', type: 'solana' }, 
      { label: 'Cosmos', type: 'cosmos' }, { label: 'OSMO', type: 'osmosis' }, { label: 'SECRET', type: 'secret' }, 
      { label: 'INJ', type: 'injective' }, { label: 'TIA', type: 'celestia' }, { label: 'ADA', type: 'cardano' }, 
      { label: 'TRX', type: 'tron' }, { label: 'ALGO', type: 'algorand' }, { label: 'HBAR', type: 'hedera' }, 
      { label: 'XTZ', type: 'tezos' }, { label: 'APT', type: 'aptos' }, { label: 'SUI', type: 'sui' }
    ];

    setSyncDiagnostic(prev => ({ ...prev, status: 'checking', progress: 0 }));
    await wait(500);

    const { data: cloudWallets } = await supabase.from('wallets').select('blockchain_id, address').eq('user_id', user.id);
    const getCloudAddr = (type: string) => cloudWallets?.find(w => w.blockchain_id === type)?.address || null;

    for (let i = 0; i < chains.length; i++) {
      const chainInfo = chains[i];
      const local = wallets.find(w => w.type === chainInfo.type)?.address || null;
      let cloud = getCloudAddr(chainInfo.type);
      const progress = ((i + 1) / (chains.length + 1)) * 100;

      setSyncDiagnostic(prev => ({ 
        ...prev, 
        chain: chainInfo.label, 
        status: 'checking', 
        localValue: local, 
        cloudValue: cloud || 'None', 
        progress 
      }));
      await wait(500);

      if (local && local !== cloud) {
        setSyncDiagnostic(prev => ({ ...prev, status: 'mismatch' }));
        await wait(1200);
        setSyncDiagnostic(prev => ({ ...prev, status: 'syncing' }));
        
        await supabase.rpc('sync_user_wallets', {
            p_user_id: user.id,
            p_wallets: [{ type: chainInfo.type, address: local }]
        });
        
        await wait(500);
        setSyncDiagnostic(prev => ({ ...prev, status: 'success', cloudValue: local }));
      } else {
        setSyncDiagnostic(prev => ({ ...prev, status: 'success' }));
      }

      await wait(500);
    }

    setSyncDiagnostic(prev => ({ 
      ...prev, 
      chain: 'Vault', 
      status: 'checking', 
      localValue: 'Encrypted Phrase', 
      cloudValue: profile?.vault_phrase ? 'Stored' : 'Missing', 
      progress: 98 
    }));
    await wait(600);

    if (!profile?.vault_phrase) {
      setSyncDiagnostic(prev => ({ ...prev, status: 'mismatch' }));
      await wait(1200);
      setSyncDiagnostic(prev => ({ ...prev, status: 'syncing' }));
      await saveToVault();
      await wait(600);
    }

    setSyncDiagnostic(prev => ({ ...prev, status: 'completed', progress: 100 }));
    setIsSynced(true);
    setTimeout(() => setSyncDiagnostic(prev => ({ ...prev, status: 'idle' })), 3000);
  }, [wallets, profile, user, saveToVault]);

  const startEngine = useCallback(async () => {
    if (!wallets || !viewingNetwork || !user) {
        return;
    }
    
    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();
    setIsRefreshing(true);
    
    try {
        const newPrices = await fetchGlobalMarketData(chainsWithLogos, userAddedTokens, rates, prices);
        setPrices(newPrices);
        localStorage.setItem(`market_prices_${user.id}`, JSON.stringify(newPrices));
        
        const currentChain = viewingNetwork;
        const priorityBalances = await fetchBalancesForChain(currentChain);
        setBalances(prev => {
            const next = { ...prev, [currentChain.chainId]: priorityBalances };
            localStorage.setItem(`wallet_balances_${user.id}`, JSON.stringify(next));
            return next;
        });
    } catch (e) {
        console.warn("Handshake Advisory: Market sync limited.");
    } finally { 
        setIsRefreshing(false); 
    }
  }, [wallets, viewingNetwork, user, chainsWithLogos, userAddedTokens, rates, prices]);

  const fetchBalancesForChain = useCallback(async (chain: ChainConfig) => {
    if (!wallets || (!infuraApiKey && chain.type === 'evm')) return [];
    const walletForChain = wallets.find(w => w.type === (chain.type || 'evm'));
    if (!walletForChain) return [];
    
    const combinedAssetsList = getAvailableAssetsForChain(chain.chainId);
    
    const getAdapter = () => {
        const { xrpAdapterFactory } = require('@/lib/wallets/adapters/xrp');
        const { polkadotAdapterFactory } = require('@/lib/wallets/adapters/polkadot');
        const { kusamaAdapterFactory } = require('@/lib/wallets/adapters/kusama');
        const { nearAdapterFactory } = require('@/lib/wallets/adapters/near');
        const { bitcoinAdapterFactory } = require('@/lib/wallets/adapters/bitcoin');
        const { litecoinAdapterFactory } = require('@/lib/wallets/adapters/litecoin');
        const { dogecoinAdapterFactory } = require('@/lib/wallets/adapters/dogecoin');
        const { solanaAdapterFactory } = require('@/lib/wallets/adapters/solana');
        const { cosmosAdapterFactory } = require('@/lib/wallets/adapters/cosmos');
        const { celestiaAdapterFactory } = require('@/lib/wallets/adapters/celestia');
        const { cardanoAdapterFactory } = require('@/lib/wallets/adapters/cardano');
        const { tronAdapterFactory } = require('@/lib/wallets/adapters/tron');
        const { algorandAdapterFactory } = require('@/lib/wallets/adapters/algorand');
        const { hederaAdapterFactory } = require('@/lib/wallets/adapters/hedera');
        const { tezosAdapterFactory } = require('@/lib/wallets/adapters/tezos');
        const { aptosAdapterFactory } = require('@/lib/wallets/adapters/aptos');
        const { suiAdapterFactory } = require('@/lib/wallets/adapters/sui');
        const { evmAdapterFactory } = require('@/lib/wallets/adapters/evm');

        if (chain.type === 'xrp') return xrpAdapterFactory(chain);
        if (chain.type === 'polkadot') return polkadotAdapterFactory(chain);
        if (chain.type === 'kusama') return kusamaAdapterFactory(chain);
        if (chain.type === 'near') return nearAdapterFactory(chain);
        if (chain.type === 'btc') return bitcoinAdapterFactory(chain);
        if (chain.type === 'ltc') return litecoinAdapterFactory(chain);
        if (chain.type === 'doge') return dogecoinAdapterFactory(chain);
        if (chain.type === 'solana') return solanaAdapterFactory(chain);
        if (chain.type === 'cosmos') return cosmosAdapterFactory(chain);
        if (chain.type === 'celestia') return celestiaAdapterFactory(chain);
        if (chain.type === 'cardano') return cardanoAdapterFactory(chain);
        if (chain.type === 'tron') return tronAdapterFactory(chain);
        if (chain.type === 'algorand') return algorandAdapterFactory(chain);
        if (chain.type === 'hedera') return hederaAdapterFactory(chain);
        if (chain.type === 'tezos') return tezosAdapterFactory(chain);
        if (chain.type === 'aptos') return aptosAdapterFactory(chain);
        if (chain.type === 'sui') return suiAdapterFactory(chain);
        return evmAdapterFactory(chain, infuraApiKey);
    };

    const adapter = getAdapter();
    if (adapter) {
        try {
            const results = await adapter.fetchBalances(walletForChain.address, combinedAssetsList);
            return results.map(r => ({ ...r, updatedAt: Date.now() }));
        } catch (e) { return combinedAssetsList; }
    }
    return combinedAssetsList;
  }, [wallets, infuraApiKey, getAvailableAssetsForChain]);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setWallets(null);
      setBalances({});
      setAccountNumber(null);
      setIsWalletLoading(false);
      setIsInitialized(true);
      setHasFetchedInitialData(true);
      return;
    }

    async function initSequence() {
      setIsWalletLoading(true);
      try {
        const savedMnemonic = localStorage.getItem(`wallet_mnemonic_${user.id}`);
        if (savedMnemonic) {
          activeMnemonicRef.current = savedMnemonic;
          const derived = await deriveAllWallets(savedMnemonic, profile);
          setWallets(derived);
        }

        const localAcc = localStorage.getItem(`account_number_${user.id}`);
        setAccountNumber(profile?.account_number || localAcc || `835${Math.floor(Math.random() * 9000000 + 1000000)}`);

        const savedKey = localStorage.getItem('infura_api_key');
        if (savedKey) setInfuraApiKey(savedKey);
        
        const cachedBalances = localStorage.getItem(`wallet_balances_${user.id}`);
        const cachedPrices = localStorage.getItem(`market_prices_${user.id}`);
        if (cachedBalances) try { setBalances(JSON.parse(cachedBalances)); } catch (e) {}
        if (cachedPrices) try { setPrices(JSON.parse(cachedPrices)); } catch (e) {}

        setIsInitialized(true);

        if (activeMnemonicRef.current) {
          await startEngine();
        }
        
        setHasFetchedInitialData(true);
      } catch (e) {
        console.error("Institutional Handshake Failed:", e);
        setHasFetchedInitialData(true);
      } finally {
        setIsWalletLoading(false);
      }
    }

    initSequence();
  }, [user, authLoading, profile, startEngine]);

  useEffect(() => {
    if (isInitialized && hasFetchedInitialData && user) {
        if (priceIntervalRef.current) clearInterval(priceIntervalRef.current);
        priceIntervalRef.current = setInterval(startEngine, 30000);
    }
    return () => { if (priceIntervalRef.current) clearInterval(priceIntervalRef.current); };
  }, [isInitialized, hasFetchedInitialData, user, startEngine]);

  const logout = useCallback(async () => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    if (priceIntervalRef.current) clearInterval(priceIntervalRef.current);
    
    const prevUserId = user?.id;
    await authSignOut();
    
    localStorage.removeItem('infura_api_key');
    if (prevUserId) {
        localStorage.removeItem(`wallet_mnemonic_${prevUserId}`);
        localStorage.removeItem(`wallet_balances_${prevUserId}`);
        localStorage.removeItem(`market_prices_${prevUserId}`);
        localStorage.removeItem(`hidden_tokens_${prevUserId}`);
        localStorage.removeItem(`custom_tokens_${prevUserId}`);
        localStorage.removeItem(`account_number_${prevUserId}`);
        sessionStorage.removeItem(`identity_audit_${prevUserId}`);
    }
    
    setWallets(null); setBalances({}); setAccountNumber(null);
    window.location.href = '/auth/login';
  }, [authSignOut, user?.id]);

  const deleteWallet = useCallback(() => {
    if (!user) return;
    localStorage.removeItem(`wallet_mnemonic_${user.id}`);
    localStorage.removeItem(`wallet_balances_${user.id}`);
    localStorage.removeItem(`market_prices_${user.id}`);
    localStorage.removeItem(`custom_tokens_${user.id}`);
    localStorage.removeItem(`hidden_tokens_${user.id}`);
    localStorage.removeItem(`account_number_${user.id}`);
    setWallets(null); setBalances({}); setAccountNumber(null);
    toast({ title: "Local Cache Purged" });
  }, [user, toast]);

  const deleteWalletPermanently = useCallback(async () => {
    if (!user || !supabase) return;
    try {
      const { error } = await supabase.from('profiles').update({ 
          vault_phrase: null, iv: null, vault_infura_key: null, infura_iv: null, updated_at: new Date().toISOString()
      }).eq('id', user.id);
      if (error) throw error;
      deleteWallet();
      await refreshProfile();
      toast({ title: "Vault Destroyed" });
    } catch (e: any) { toast({ variant: "destructive", title: "Error", description: e.message }); }
  }, [user, deleteWallet, refreshProfile, toast]);

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
        const priceId = (asset.priceId || asset.coingeckoId || asset.address)?.toLowerCase();
        const priceInfo = prices[priceId];
        const priceUsd = priceInfo?.price || 0;
        const pctChange24h = priceInfo?.change || 0;
        return { ...asset, balance, priceUsd, pctChange24h, fiatValueUsd: parseFloat(balance) * priceUsd } as AssetRow;
    });
    return [wncAsset, ...onChainAssets].filter((asset) => !hiddenTokenKeys.has(`${viewingNetwork.chainId}:${asset.symbol}`));
  }, [viewingNetwork, balances, prices, hiddenTokenKeys, getAvailableAssetsForChain, profile?.wnc_earnings, userAddedTokens]);

  const value = useMemo(() => ({
    isInitialized,
    isAssetsLoading: areLogosLoading,
    isWalletLoading,
    hasNewNotifications,
    setHasNewNotifications,
    viewingNetwork: viewingNetwork || (chainsWithLogos[0] || {} as ChainConfig),
    setNetwork: (net: ChainConfig) => { setViewingNetwork(net); setFetchError(null); localStorage.setItem('last_viewed_chain_id', net.chainId.toString()); },
    allAssets: assetsForCurrentNetwork,
    allChains: chainsWithLogos,
    allChainsMap,
    isRefreshing,
    isTokenLoading: () => false,
    wallets,
    balances,
    prices,
    accountNumber,
    refresh: startEngine,
    generateWallet,
    importWallet,
    saveToVault,
    restoreFromCloud,
    logout,
    deleteWallet,
    deleteWalletPermanently,
    fetchError,
    getAddressForChain,
    infuraApiKey,
    setInfuraApiKey: (k: string | null) => { 
      setInfuraApiKey(k); 
      if (k) { localStorage.setItem('infura_api_key', k); if (user) saveToVault(); }
      else { localStorage.removeItem('infura_api_key'); if (user) saveToVault(); }
    },
    hiddenTokenKeys,
    toggleTokenVisibility,
    userAddedTokens,
    addUserToken,
    getAvailableAssetsForChain,
    isSynced,
    syncAllAddresses,
    syncDiagnostic,
    runCloudDiagnostic,
    isRequestOverlayOpen,
    setIsRequestOverlayOpen,
    isNotificationsOpen,
    setIsNotificationsOpen,
    activeFulfillmentId,
    setActiveFulfillmentId,
    hasFetchedInitialData
  }), [
    isInitialized, user, wallets, areLogosLoading, isWalletLoading, hasNewNotifications, viewingNetwork, 
    assetsForCurrentNetwork, chainsWithLogos, allChainsMap, isRefreshing, balances, prices, accountNumber, syncDiagnostic, 
    isSynced, isRequestOverlayOpen, isNotificationsOpen, activeFulfillmentId, hasFetchedInitialData, 
    generateWallet, importWallet, saveToVault, restoreFromCloud, startEngine, logout, deleteWallet, deleteWalletPermanently, 
    getAddressForChain, setInfuraApiKey, toggleTokenVisibility, addUserToken, getAvailableAssetsForChain, syncAllAddresses, runCloudDiagnostic
  ]);

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (context === undefined) throw new Error('useWallet must be used within WalletProvider');
  return context;
}
