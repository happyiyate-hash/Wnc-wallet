
'use client';

import React, { createContext, useContext, useState, ReactNode, useMemo, useEffect, useCallback, useRef } from 'react';
import type { AssetRow, ChainConfig, WalletWithMetadata, IWalletAdapter, UserProfile, WalletRegistryEntry } from '@/lib/types';
import { useNetworkLogos } from '@/hooks/useNetworkLogos';
import { ethers } from 'ethers';
import * as xrpl from 'xrpl';
import * as bip39 from 'bip39';
import { Keyring } from '@polkadot/keyring';
import { cryptoWaitReady } from '@polkadot/util-crypto';
import { KeyPair, utils } from "near-api-js";
import * as bitcoin from "bitcoinjs-lib";
import BIP32Factory from "bip32";
import * as ecc from "tiny-secp256k1";
import { getInitialAssets } from '@/lib/wallets/balances';
import { useUser } from './user-provider';
import { useCurrency } from './currency-provider';
import { useToast } from '@/hooks/use-toast';
import { fetchPriceMap, fetchPricesByContract, COINGECKO_PLATFORM_MAP } from '@/lib/coingecko';
import { supabase } from '@/lib/supabase/client';
import { xrpAdapterFactory } from '@/lib/wallets/adapters/xrp';
import { polkadotAdapterFactory } from '@/lib/wallets/adapters/polkadot';
import { nearAdapterFactory } from '@/lib/wallets/adapters/near';
import { evmAdapterFactory } from '@/lib/wallets/adapters/evm';
import { bitcoinAdapterFactory } from '@/lib/wallets/adapters/bitcoin';
import { getAddressForChain as getAddressForChainUtil } from '@/lib/wallets/utils';

const bip32 = BIP32Factory(ecc);

export type SyncDiagnosticState = {
  status: 'idle' | 'checking' | 'mismatch' | 'syncing' | 'success' | 'completed';
  chain: 'EVM' | 'XRP' | 'Polkadot' | 'NEAR' | 'BTC' | 'Vault' | null;
  localValue: string | null;
  cloudValue: string | null;
  progress: number;
};

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
  prices: { [key: string]: PriceInfo };
  accountNumber: string | null;
  refresh: () => Promise<void>;
  importWallet: (mnemonic: string) => Promise<void>;
  generateWallet: () => Promise<string>;
  saveToVault: () => Promise<void>;
  restoreFromCloud: () => Promise<void>;
  logout: () => Promise<void>;
  deleteWallet: () => void;
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
  activeFulfillmentId: string | null;
  setActiveFulfillmentId: (id: string | null) => void;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: ReactNode }) {
  const { chainsWithLogos, areLogosLoading } = useNetworkLogos();
  const { user, loading: authLoading, signOut: authSignOut, profile, activeSessionId, refreshProfile } = useUser();
  const { rates } = useCurrency();
  const { toast } = useToast();
  
  const [viewingNetwork, setViewingNetwork] = useState<ChainConfig | null>(null);
  const [wallets, setWallets] = useState<WalletWithMetadata[] | null>(null);
  const [balances, setBalances] = useState<{ [key: string]: AssetRow[] }>({});
  const [prices, setPrices] = useState<{ [key: string]: PriceInfo }>({});
  const [accountNumber, setAccountNumber] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isWalletLoading, setIsWalletLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [infuraApiKey, setInfuraApiKey] = useState<string | null>(null);
  const [isSynced, setIsSynced] = useState(true);

  const [isRequestOverlayOpen, setIsRequestOverlayOpen] = useState(false);
  const [activeFulfillmentId, setActiveFulfillmentId] = useState<string | null>(null);

  const [syncDiagnostic, setSyncDiagnostic] = useState<SyncDiagnosticState>({
    status: 'idle',
    chain: null,
    localValue: null,
    cloudValue: null,
    progress: 0
  });

  const [hiddenTokenKeys, setHiddenTokenKeys] = useState<Set<string>>(new Set());
  const [userAddedTokens, setUserAddedTokens] = useState<AssetRow[]>([]);

  const abortControllerRef = useRef<AbortController | null>(null);
  const priceIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const latestUserTokensRef = useRef(userAddedTokens);
  const hasRunInitialDiagnostic = useRef<string | null>(null);
  const initialFetchTriggeredRef = useRef(false);

  useEffect(() => { latestUserTokensRef.current = userAddedTokens; }, [userAddedTokens]);

  const allChainsMap = useMemo(() => {
    return chainsWithLogos.reduce((acc, c) => ({ ...acc, [c.chainId]: c }), {} as { [key: string]: ChainConfig });
  }, [chainsWithLogos]);

  const getAvailableAssetsForChain = useCallback((chainId: number): AssetRow[] => {
    const base = getInitialAssets(chainId).map(a => ({ ...a, balance: '0' } as AssetRow));
    const currentCustom = userAddedTokens.length > 0 ? userAddedTokens : latestUserTokensRef.current;
    const custom = currentCustom.filter(t => t.chainId === chainId);
    
    const combined = [...base, ...custom].reduce((acc, curr) => {
        const identifier = curr.isNative ? curr.symbol : curr.address?.toLowerCase();
        if (!acc.find(a => (a.isNative ? a.symbol : a.address?.toLowerCase()) === identifier)) {
            acc.push(curr);
        }
        return acc;
    }, [] as AssetRow[]);
    return combined;
  }, [userAddedTokens]);

  const fetchGlobalPrices = useCallback(async () => {
    const coingeckoIds = new Set<string>();
    const platformTokens: { [platform: string]: Set<string> } = {};

    const allKnownAssets: AssetRow[] = [];
    chainsWithLogos.forEach(chain => {
        allKnownAssets.push(...getInitialAssets(chain.chainId).map(a => ({ ...a, chainId: chain.chainId }) as AssetRow));
    });
    allKnownAssets.push(...latestUserTokensRef.current);

    allKnownAssets.forEach(a => { 
        if (a.coingeckoId) {
            coingeckoIds.add(a.coingeckoId.toLowerCase());
        } else if (!a.isNative && a.address?.startsWith('0x')) {
            const platform = COINGECKO_PLATFORM_MAP[a.chainId];
            if (platform) {
                if (!platformTokens[platform]) platformTokens[platform] = new Set();
                platformTokens[platform].add(a.address.toLowerCase());
            }
        }
    });

    if (coingeckoIds.size === 0 && Object.keys(platformTokens).length === 0) return;

    try {
        const fetchPromises = [];
        if (coingeckoIds.size > 0) fetchPromises.push(fetchPriceMap(Array.from(coingeckoIds)));
        Object.entries(platformTokens).forEach(([platform, addresses]) => {
            fetchPromises.push(fetchPricesByContract(platform, Array.from(addresses)));
        });

        const results = await Promise.allSettled(fetchPromises);
        const newPrices: { [id: string]: PriceInfo } = {};

        results.forEach(res => {
            if (res.status === 'fulfilled' && res.value) {
                Object.entries(res.value).forEach(([key, data]: [string, any]) => {
                    const price = typeof data === 'number' ? data : (data.usd || data.price || 0);
                    const change = data.usd_24h_change || 0;
                    if (price > 0) newPrices[key.toLowerCase()] = { price, change };
                });
            }
        });

        if (Object.keys(newPrices).length > 0) {
            setPrices(prev => ({ ...prev, ...newPrices }));
        }
    } catch (e) {
        console.warn("[PRICE_ORACLE_RETRY]", e);
    }
  }, [chainsWithLogos]);

  const fetchBalancesForChain = useCallback(async (chain: ChainConfig) => {
    if (!wallets || (!infuraApiKey && chain.type === 'evm')) return [];
    const walletForChain = wallets.find(w => w.type === (chain.type || 'evm'));
    if (!walletForChain) return [];
    
    const combinedAssetsList = getAvailableAssetsForChain(chain.chainId);
    let adapter = null;
    if (chain.type === 'xrp') adapter = xrpAdapterFactory(chain);
    else if (chain.type === 'polkadot') adapter = polkadotAdapterFactory(chain);
    else if (chain.type === 'near') adapter = nearAdapterFactory(chain);
    else if (chain.type === 'btc') adapter = bitcoinAdapterFactory(chain);
    else adapter = evmAdapterFactory(chain, infuraApiKey);
    
    if (adapter) {
        try {
            const results = await adapter.fetchBalances(walletForChain.address, combinedAssetsList);
            return results.map(r => ({ ...r, updatedAt: Date.now() }));
        } catch (e) { return combinedAssetsList; }
    }
    return combinedAssetsList;
  }, [wallets, infuraApiKey, getAvailableAssetsForChain]);

  const startEngine = useCallback(async () => {
    if (!isInitialized || !wallets || !viewingNetwork || !activeSessionId) return;
    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();
    setIsRefreshing(true);
    try {
        await fetchGlobalPrices();
        const priorityBalances = await fetchBalancesForChain(viewingNetwork);
        setBalances(prev => {
            const next = { ...prev, [viewingNetwork.chainId]: priorityBalances };
            localStorage.setItem(`wallet_balances_${activeSessionId}`, JSON.stringify(next));
            return next;
        });
    } catch (e) {} finally { setIsRefreshing(false); }
  }, [isInitialized, wallets, viewingNetwork, fetchBalancesForChain, activeSessionId, fetchGlobalPrices]);

  const assetsForCurrentNetwork = useMemo(() => {
    if (!viewingNetwork) return [];
    
    const wncPriceUsd = 1 / (rates['NGN'] || 1650); 
    const wncPctChange = -0.42 + (Math.sin(Date.now() / 3600000) * 0.2); 

    const wncAsset: AssetRow = {
        chainId: viewingNetwork.chainId,
        address: 'internal:wnc',
        symbol: 'WNC',
        name: 'Wevinacoin', 
        balance: profile?.wnc_earnings?.toString() || '0',
        isNative: false,
        priceUsd: wncPriceUsd,
        fiatValueUsd: (profile?.wnc_earnings || 0) * wncPriceUsd,
        pctChange24h: wncPctChange, 
        decimals: 0,
        iconUrl: null 
    };

    const available = getAvailableAssetsForChain(viewingNetwork.chainId);
    const chainBalances = balances[viewingNetwork.chainId] || [];

    const onChainAssets = available
      .map((asset) => {
        const balDoc = chainBalances.find((b) => (b.isNative ? b.symbol : b.address?.toLowerCase()) === (asset.isNative ? asset.symbol : asset.address?.toLowerCase()));
        const balance = balDoc?.balance || '0';
        
        const priceId = (asset.priceId || asset.coingeckoId || asset.address)?.toLowerCase();
        const priceInfo = prices[priceId];
        
        const priceUsd = priceInfo?.price || 0;
        const pctChange24h = priceInfo?.change || 0;
        const fiatValueUsd = parseFloat(balance) * priceUsd;

        return {
          ...asset,
          balance,
          priceUsd,
          pctChange24h,
          fiatValueUsd,
        } as AssetRow;
      });

    return [wncAsset, ...onChainAssets].filter((asset) => !hiddenTokenKeys.has(`${viewingNetwork.chainId}:${asset.symbol}`));
  }, [viewingNetwork, balances, prices, hiddenTokenKeys, getAvailableAssetsForChain, profile?.wnc_earnings, rates]);

  const loadWalletFromMnemonic = useCallback(async (mnemonic: string) => {
    if (!mnemonic) return null;
    try {
      const cleanMnemonic = mnemonic.trim();
      if (!cleanMnemonic || cleanMnemonic.split(' ').length < 12) return null;
      if (!bip39.validateMnemonic(cleanMnemonic)) throw new Error("Invalid BIP39 Mnemonic");
      
      const evmWallet = ethers.Wallet.fromPhrase(cleanMnemonic);
      const xrpWallet = xrpl.Wallet.fromMnemonic(cleanMnemonic);
      
      await cryptoWaitReady();
      const keyring = new Keyring({ type: 'sr25519' });
      const dotWallet = keyring.addFromMnemonic(cleanMnemonic);
      
      // DETERMINISTIC NEAR DERIVATION
      const seed = bip39.mnemonicToSeedSync(cleanMnemonic);
      const nearSecretKey = seed.slice(0, 32);
      const nearBase58Secret = utils.serialize.base_encode(nearSecretKey);
      const nearKeyPair = KeyPair.fromString(`ed25519:${nearBase58Secret}`);
      const nearAddress = Buffer.from(nearKeyPair.getPublicKey().data).toString('hex');

      // DETERMINISTIC BITCOIN DERIVATION (BIP84 Native SegWit)
      const btcSeed = bip39.mnemonicToSeedSync(cleanMnemonic);
      const btcRoot = bip32.fromSeed(btcSeed);
      const btcChild = btcRoot.derivePath("m/84'/0'/0'/0/0");
      const { address: btcAddress } = bitcoin.payments.p2wpkh({
          pubkey: btcChild.publicKey,
          network: bitcoin.networks.bitcoin,
      });

      const derived: WalletWithMetadata[] = [
        { address: evmWallet.address, privateKey: evmWallet.privateKey, type: 'evm' },
        { address: xrpWallet.address, seed: xrpWallet.seed, type: 'xrp' },
        { address: dotWallet.address, type: 'polkadot' },
        { address: nearAddress, type: 'near' },
        { address: btcAddress!, type: 'btc' }
      ];
      setWallets(derived);
      return derived;
    } catch (e: any) { 
      console.error("Wallet Derivation Error:", e.message);
      return null; 
    }
  }, []);

  const syncAllAddresses = useCallback(async (providedWallets?: WalletWithMetadata[]) => {
    const currentWallets = providedWallets || wallets;
    if (!activeSessionId || !supabase || !currentWallets) return;
    
    let targetAcc = accountNumber;
    if (!targetAcc) {
        const randomSuffix = Math.floor(Math.random() * 9000000 + 1000000);
        targetAcc = `835${randomSuffix}`;
        setAccountNumber(targetAcc);
        localStorage.setItem(`account_number_${activeSessionId}`, targetAcc);
    }

    try {
      await supabase
        .from('profiles')
        .update({ account_number: targetAcc, updated_at: new Date().toISOString() })
        .eq('id', activeSessionId);

      const walletPayload = currentWallets.map(w => ({ type: w.type, address: w.address }));
      const { error: syncError } = await supabase.rpc('sync_user_wallets', {
          p_user_id: activeSessionId,
          p_wallets: walletPayload
      });

      if (syncError) throw syncError;
      setIsSynced(true);
      await refreshProfile();
    } catch (e: any) {
      console.error("Address Sync Failed:", e.message);
      throw e;
    }
  }, [activeSessionId, wallets, accountNumber, refreshProfile]);

  const generateWallet = async (): Promise<string> => {
    const mnemonic = bip39.generateMnemonic();
    const derived = await loadWalletFromMnemonic(mnemonic);
    if (activeSessionId) {
        localStorage.setItem(`wallet_mnemonic_${activeSessionId}`, mnemonic);
        setIsSynced(false);
        const randomSuffix = Math.floor(Math.random() * 9000000 + 1000000);
        const newId = `835${randomSuffix}`;
        setAccountNumber(newId);
        localStorage.setItem(`account_number_${activeSessionId}`, newId);
        if (derived) await syncAllAddresses(derived);
    }
    return mnemonic;
  };

  const importWallet = async (mnemonic: string) => {
    const derived = await loadWalletFromMnemonic(mnemonic);
    if (derived && activeSessionId) {
        localStorage.setItem(`wallet_mnemonic_${activeSessionId}`, mnemonic);
        setIsSynced(false);
        if (!accountNumber) {
            const randomSuffix = Math.floor(Math.random() * 9000000 + 1000000);
            const newId = `835${randomSuffix}`;
            setAccountNumber(newId);
            localStorage.setItem(`account_number_${activeSessionId}`, newId);
        }
        await syncAllAddresses(derived);
    }
  };

  const saveToVault = async () => {
    if (!activeSessionId || !supabase || !wallets) return;
    try {
      const { data: { session } } = await supabase!.auth.getSession();
      const updates: any = {};
      const mnemonic = localStorage.getItem(`wallet_mnemonic_${activeSessionId}`);

      if (mnemonic) {
        const res = await fetch('/api/wallet/encrypt-phrase', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`
          },
          body: JSON.stringify({ phrase: mnemonic })
        });
        const data = await res.json();
        if (res.ok) { updates.vault_phrase = data.encrypted; updates.iv = data.iv; }
      }

      if (infuraApiKey) {
        const res = await fetch('/api/wallet/encrypt-phrase', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`
          },
          body: JSON.stringify({ phrase: infuraApiKey })
        });
        const data = await res.json();
        if (res.ok) { updates.vault_infura_key = data.encrypted; updates.infura_iv = data.iv; }
      }

      if (!accountNumber) {
          const randomSuffix = Math.floor(Math.random() * 9000000 + 1000000);
          updates.account_number = `835${randomSuffix}`;
          setAccountNumber(updates.account_number);
          localStorage.setItem(`account_number_${activeSessionId}`, updates.account_number);
      } else { updates.account_number = accountNumber; }

      const { error } = await supabase!.from('profiles').update(updates).eq('id', activeSessionId);
      if (error) throw error;
      await syncAllAddresses();
      await refreshProfile();
    } catch (e: any) { console.error("Vault Backup Failed:", e.message); }
  };

  const restoreFromCloud = async () => {
    if (!profile || !activeSessionId || !supabase) throw new Error("No cloud backup found.");
    try {
      const { data: { session } } = await supabase!.auth.getSession();
      if (profile.vault_phrase && profile.iv) {
        const res = await fetch('/api/wallet/decrypt-phrase', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
          body: JSON.stringify({ encrypted: profile.vault_phrase, iv: profile.iv })
        });
        const data = await res.json();
        if (res.ok) {
          const derived = await loadWalletFromMnemonic(data.phrase);
          localStorage.setItem(`wallet_mnemonic_${activeSessionId}`, data.phrase);
          if (derived) await syncAllAddresses(derived);
        }
      }
      if (profile.account_number) { setAccountNumber(profile.account_number); localStorage.setItem(`account_number_${activeSessionId}`, profile.account_number); }
      toast({ title: "Vault Restored" });
    } catch (e: any) { throw e; }
  };

  const runCloudDiagnostic = useCallback(async (options?: { forceUI?: boolean }) => {
    if (!wallets || !profile || !activeSessionId || !supabase) return;
    const isFirstSession = !sessionStorage.getItem(`synced_${activeSessionId}`);
    const { data: cloudWallets } = await supabase.from('wallets').select('blockchain_id, address').eq('user_id', activeSessionId);
    const getCloudAddr = (type: string) => cloudWallets?.find(w => w.blockchain_id === type)?.address || null;
    const hasMismatch = wallets.some(w => w.address !== getCloudAddr(w.type)) || (!profile.vault_phrase);
    if (!hasMismatch && !isFirstSession && !options?.forceUI) { setIsSynced(true); return; }
    const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    const chains: ('EVM' | 'XRP' | 'Polkadot' | 'NEAR' | 'BTC')[] = ['EVM', 'XRP', 'Polkadot', 'NEAR', 'BTC'];
    setSyncDiagnostic(prev => ({ ...prev, status: 'checking', progress: 0 }));
    for (let i = 0; i < chains.length; i++) {
      const chain = chains[i];
      const type = chain.toLowerCase();
      const local = wallets.find(w => w.type === type)?.address || null;
      const cloud = getCloudAddr(type);
      setSyncDiagnostic(prev => ({ ...prev, chain, status: 'checking', localValue: local, cloudValue: cloud, progress: (i / chains.length) * 100 }));
      await wait(800);
      if (local !== cloud) {
        setSyncDiagnostic(prev => ({ ...prev, status: 'mismatch' })); await wait(600);
        setSyncDiagnostic(prev => ({ ...prev, status: 'syncing' })); await syncAllAddresses(wallets); await wait(800);
        setSyncDiagnostic(prev => ({ ...prev, status: 'success', cloudValue: local })); await wait(600);
      } else { setSyncDiagnostic(prev => ({ ...prev, status: 'success' })); await wait(400); }
    }
    setSyncDiagnostic(prev => ({ ...prev, chain: 'Vault', status: 'checking', localValue: 'Encrypted Phrase', cloudValue: profile.vault_phrase ? 'Stored' : 'Missing' }));
    await wait(800);
    if (!profile.vault_phrase) { setSyncDiagnostic(prev => ({ ...prev, status: 'syncing' })); await saveToVault(); await wait(800); }
    setSyncDiagnostic(prev => ({ ...prev, status: 'completed', progress: 100 }));
    sessionStorage.setItem(`synced_${activeSessionId}`, 'true'); setIsSynced(true);
    setTimeout(() => setSyncDiagnostic(prev => ({ ...prev, status: 'idle' })), 2500);
  }, [wallets, profile, activeSessionId, syncAllAddresses, saveToVault]);

  const toggleTokenVisibility = useCallback((chainId: number, symbol: string) => {
    setHiddenTokenKeys(prev => {
      const next = new Set(prev); const key = `${chainId}:${symbol}`;
      if (next.has(key)) next.delete(key); else next.add(key);
      if (activeSessionId) localStorage.setItem(`hidden_tokens_${activeSessionId}`, JSON.stringify(Array.from(next)));
      return next;
    });
  }, [activeSessionId]);

  const addUserToken = useCallback((token: AssetRow) => {
    setUserAddedTokens(prev => {
      const exists = prev.find(t => t.chainId === token.chainId && (t.isNative ? t.symbol === token.symbol : t.address?.toLowerCase() === token.address?.toLowerCase()));
      if (exists) return prev;
      const next = [...prev, token];
      if (activeSessionId) localStorage.setItem(`custom_tokens_${activeSessionId}`, JSON.stringify(next));
      return next;
    });
    fetchGlobalPrices();
  }, [activeSessionId, fetchGlobalPrices]);

  const handleSetApiKey = useCallback((key: string | null) => {
    setInfuraApiKey(key);
    if (key) localStorage.setItem('infura_api_key', key);
    else localStorage.removeItem('infura_api_key');
  }, []);

  // 1. INITIAL SESSION HYDRATION
  useEffect(() => {
    const initLocalSession = async () => {
      if (authLoading) return;
      if (!activeSessionId) { setWallets(null); setBalances({}); setAccountNumber(null); setIsWalletLoading(false); return; }
      
      const savedMnemonic = localStorage.getItem(`wallet_mnemonic_${activeSessionId}`);
      const cachedBalances = localStorage.getItem(`wallet_balances_${activeSessionId}`);
      const localAcc = localStorage.getItem(`account_number_${activeSessionId}`);
      const savedKey = localStorage.getItem('infura_api_key');

      if (savedKey) setInfuraApiKey(savedKey);
      if (cachedBalances) try { setBalances(JSON.parse(cachedBalances)); } catch (e) {}
      if (localAcc) setAccountNumber(localAcc);
      if (profile?.account_number) setAccountNumber(profile.account_number);

      if (savedMnemonic) {
          setIsWalletLoading(false); 
          await loadWalletFromMnemonic(savedMnemonic);
          if (isInitialized) fetchGlobalPrices();
      } else {
          setIsWalletLoading(true);
          const failsafe = setTimeout(() => setIsWalletLoading(false), 10000);
          try {
            const savedHidden = localStorage.getItem(`hidden_tokens_${activeSessionId}`);
            if (savedHidden) try { setHiddenTokenKeys(new Set(JSON.parse(savedHidden))); } catch (e) {}
            const savedCustom = localStorage.getItem(`custom_tokens_${activeSessionId}`);
            if (savedCustom) try { setUserAddedTokens(JSON.parse(savedCustom)); } catch (e) {}
          } catch (e) {} finally { clearTimeout(failsafe); setIsWalletLoading(false); }
      }
    };
    initLocalSession();
  }, [authLoading, activeSessionId, profile, loadWalletFromMnemonic, isInitialized, fetchGlobalPrices]);

  // 2. AGGRESSIVE INITIAL FETCH TRIGGER
  useEffect(() => {
    if (isInitialized && wallets && !initialFetchTriggeredRef.current) {
      initialFetchTriggeredRef.current = true;
      fetchGlobalPrices();
      startEngine();
    }
  }, [isInitialized, wallets, fetchGlobalPrices, startEngine]);

  // 3. REGULAR INTERVAL REFRESH
  useEffect(() => {
    if (isInitialized) {
        if (priceIntervalRef.current) clearInterval(priceIntervalRef.current);
        priceIntervalRef.current = setInterval(() => { fetchGlobalPrices(); startEngine(); }, 30000);
    }
    return () => { if (priceIntervalRef.current) clearInterval(priceIntervalRef.current); };
  }, [isInitialized, fetchGlobalPrices, startEngine]);

  // 4. CLOUD DIAGNOSTIC
  useEffect(() => {
    if (!profile || !activeSessionId || !wallets || !isInitialized) return;
    if (hasRunInitialDiagnostic.current !== activeSessionId) {
        hasRunInitialDiagnostic.current = activeSessionId;
        runCloudDiagnostic();
    }
  }, [profile, activeSessionId, wallets, isInitialized, runCloudDiagnostic]);

  // 5. ASSET READY HANDLER
  useEffect(() => {
    if (!areLogosLoading && !isInitialized) {
      const savedChainId = localStorage.getItem('last_viewed_chain_id');
      const restoredChain = savedChainId ? chainsWithLogos.find(c => c.chainId === parseInt(savedChainId)) : null;
      setViewingNetwork(restoredChain || chainsWithLogos.find(c => c.chainId === 1) || chainsWithLogos[0] || null);
      setIsInitialized(true);
    }
  }, [areLogosLoading, chainsWithLogos, isInitialized]);

  const logout = useCallback(async () => {
    setIsWalletLoading(true);
    const prevSessionId = activeSessionId;
    await authSignOut();
    localStorage.removeItem('infura_api_key');
    if (prevSessionId) {
        localStorage.removeItem(`wallet_mnemonic_${prevSessionId}`);
        localStorage.removeItem(`wallet_balances_${prevSessionId}`);
        localStorage.removeItem(`hidden_tokens_${prevSessionId}`);
        localStorage.removeItem(`custom_tokens_${prevSessionId}`);
        localStorage.removeItem(`account_number_${prevSessionId}`);
    }
    setWallets(null); setBalances({}); setAccountNumber(null); setIsSynced(true); setIsWalletLoading(false);
  }, [authSignOut, activeSessionId]);

  const value: WalletContextType = {
    isInitialized: isInitialized && !authLoading,
    isAssetsLoading: areLogosLoading,
    isWalletLoading,
    hasNewNotifications: false,
    viewingNetwork: viewingNetwork || (chainsWithLogos[0] || {} as ChainConfig),
    setNetwork: (net) => { setViewingNetwork(net); setFetchError(null); localStorage.setItem('last_viewed_chain_id', net.chainId.toString()); },
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
    deleteWallet: () => {},
    fetchError,
    getAddressForChain: (chain, w) => getAddressForChainUtil(chain, w),
    infuraApiKey,
    setInfuraApiKey: handleSetApiKey,
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
    activeFulfillmentId,
    setActiveFulfillmentId
  };

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (context === undefined) throw new Error('useWallet must be used within WalletProvider');
  return context;
}
