'use client';

import React, { createContext, useContext, useState, ReactNode, useMemo, useEffect, useCallback, useRef } from 'react';
import type { AssetRow, ChainConfig, WalletWithMetadata, IWalletAdapter, UserProfile } from '@/lib/types';
import { useNetworkLogos } from '@/hooks/useNetworkLogos';
import { ethers } from 'ethers';
import * as xrpl from 'xrpl';
import * as bip39 from 'bip39';
import { Keyring } from '@polkadot/keyring';
import { cryptoWaitReady } from '@polkadot/util-crypto';
import { getInitialAssets } from '@/lib/wallets/balances';
import { useUser } from './user-provider';
import { useToast } from '@/hooks/use-toast';
import { fetchPriceMap, fetchPricesByContract, COINGECKO_PLATFORM_MAP } from '@/lib/coingecko';
import { supabase } from '@/lib/supabase/client';
import { xrpAdapterFactory } from '@/lib/wallets/adapters/xrp';
import { polkadotAdapterFactory } from '@/lib/wallets/adapters/polkadot';
import { evmAdapterFactory } from '@/lib/wallets/adapters/evm';
import { getAddressForChain as getAddressForChainUtil } from '@/lib/wallets/utils';

export type SyncDiagnosticState = {
  status: 'idle' | 'checking' | 'mismatch' | 'syncing' | 'success' | 'completed';
  chain: 'EVM' | 'XRP' | 'Polkadot' | 'Vault' | null;
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
  syncAllAddresses: () => Promise<void>;
  syncDiagnostic: SyncDiagnosticState;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: ReactNode }) {
  const { chainsWithLogos, areLogosLoading } = useNetworkLogos();
  const { user, loading: authLoading, signOut: authSignOut, profile, activeSessionId, refreshProfile } = useUser();
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

  // Sync Diagnostic State
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

  useEffect(() => { latestUserTokensRef.current = userAddedTokens; }, [userAddedTokens]);

  const allChainsMap = useMemo(() => {
    return chainsWithLogos.reduce((acc, c) => ({ ...acc, [c.chainId]: c }), {} as { [key: string]: ChainConfig });
  }, [chainsWithLogos]);

  const getAvailableAssetsForChain = useCallback((chainId: number): AssetRow[] => {
    const base = getInitialAssets(chainId).map(a => ({ ...a, balance: '0' } as AssetRow));
    const custom = latestUserTokensRef.current.filter(t => t.chainId === chainId);
    const combined = [...base, ...custom].reduce((acc, curr) => {
        if (!acc.find(a => a.symbol === curr.symbol)) acc.push(curr);
        return acc;
    }, [] as AssetRow[]);
    return combined;
  }, []);

  const assetsForCurrentNetwork = useMemo(() => {
    if (!viewingNetwork) return [];
    const chainId = viewingNetwork.chainId;
    const chainBalances = balances[chainId] || getInitialAssets(chainId).map(a => ({ ...a, balance: '0' } as AssetRow));
    const addedTokens = userAddedTokens.filter(t => t.chainId === chainId);
    
    const combined = [...chainBalances, ...addedTokens].reduce((acc, curr) => {
        if (!acc.find(a => a.symbol === curr.symbol)) acc.push(curr);
        return acc;
    }, [] as AssetRow[]);

    return combined.map(asset => {
      const priceId = (asset.priceId || asset.coingeckoId || asset.address)?.toLowerCase();
      const priceInfo = prices[priceId];
      const price = priceInfo?.price ?? 0;
      const change = priceInfo?.change ?? 0;
      
      return {
        ...asset,
        priceUsd: price,
        pctChange24h: change,
        fiatValueUsd: price * (parseFloat(asset.balance) || 0)
      };
    }).filter(asset => {
      const key = `${chainId}:${asset.symbol}`;
      return !hiddenTokenKeys.has(key);
    });
  }, [viewingNetwork, balances, hiddenTokenKeys, userAddedTokens, prices]);

  const loadWalletFromMnemonic = useCallback(async (mnemonic: string) => {
    if (!mnemonic) return null;
    try {
      const cleanMnemonic = mnemonic.trim();
      if (!bip39.validateMnemonic(cleanMnemonic)) throw new Error("Invalid BIP39 Mnemonic");
      
      const evmWallet = ethers.Wallet.fromPhrase(cleanMnemonic);
      const xrpWallet = xrpl.Wallet.fromMnemonic(cleanMnemonic);
      
      await cryptoWaitReady();
      const keyring = new Keyring({ type: 'sr25519' });
      const dotWallet = keyring.addFromMnemonic(cleanMnemonic);
      
      const derived: WalletWithMetadata[] = [
        { address: evmWallet.address, privateKey: evmWallet.privateKey, type: 'evm' },
        { address: xrpWallet.address, seed: xrpWallet.seed, type: 'xrp' },
        { address: dotWallet.address, type: 'polkadot' }
      ];
      setWallets(derived);
      return derived;
    } catch (e: any) { 
      console.error("Wallet Derivation Error:", e.message);
      throw e; 
    }
  }, []);

  const generateWallet = async (): Promise<string> => {
    const mnemonic = bip39.generateMnemonic();
    await loadWalletFromMnemonic(mnemonic);
    if (activeSessionId) {
        localStorage.setItem(`wallet_mnemonic_${activeSessionId}`, mnemonic);
        setIsSynced(false);
        const randomSuffix = Math.floor(Math.random() * 9000000 + 1000000);
        const newId = `835${randomSuffix}`;
        setAccountNumber(newId);
        localStorage.setItem(`account_number_${activeSessionId}`, newId);
    }
    return mnemonic;
  };

  const importWallet = async (mnemonic: string) => {
    await loadWalletFromMnemonic(mnemonic);
    if (activeSessionId) {
        localStorage.setItem(`wallet_mnemonic_${activeSessionId}`, mnemonic);
        setIsSynced(false);
        if (!accountNumber) {
            const randomSuffix = Math.floor(Math.random() * 9000000 + 1000000);
            const newId = `835${randomSuffix}`;
            setAccountNumber(newId);
            localStorage.setItem(`account_number_${activeSessionId}`, newId);
        }
    }
  };

  const syncAllAddresses = async () => {
    if (!activeSessionId || !supabase || !wallets) return;
    
    let targetAcc = accountNumber;
    if (!targetAcc) {
        const randomSuffix = Math.floor(Math.random() * 9000000 + 1000000);
        targetAcc = `835${randomSuffix}`;
        setAccountNumber(targetAcc);
        localStorage.setItem(`account_number_${activeSessionId}`, targetAcc);
    }

    try {
      const updates: any = {
        account_number: targetAcc,
        updated_at: new Date().toISOString()
      };

      wallets.forEach(w => {
        if (w.type === 'evm') updates.evm_address = w.address;
        if (w.type === 'xrp') updates.xrp_address = w.address;
        if (w.type === 'polkadot') updates.polkadot_address = w.address;
      });

      const { error } = await supabase!
        .from('profiles')
        .update(updates)
        .eq('id', activeSessionId);

      if (error) throw error;

      await refreshProfile();
    } catch (e: any) {
      console.error("Address Sync Failed:", e.message);
      throw e;
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
        if (res.ok) {
          updates.vault_phrase = data.encrypted;
          updates.iv = data.iv;
        }
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
        if (res.ok) {
          updates.vault_infura_key = data.encrypted;
          updates.infura_iv = data.iv;
        }
      }

      // Merge addresses into profile update
      wallets.forEach(w => {
        if (w.type === 'evm') updates.evm_address = w.address;
        if (w.type === 'xrp') updates.xrp_address = w.address;
        if (w.type === 'polkadot') updates.polkadot_address = w.address;
      });
      
      if (!accountNumber) {
          const randomSuffix = Math.floor(Math.random() * 9000000 + 1000000);
          updates.account_number = `835${randomSuffix}`;
          setAccountNumber(updates.account_number);
          localStorage.setItem(`account_number_${activeSessionId}`, updates.account_number);
      } else {
          updates.account_number = accountNumber;
      }

      const { error } = await supabase!
        .from('profiles')
        .update(updates)
        .eq('id', activeSessionId);
      if (error) throw error;

      await refreshProfile();
    } catch (e: any) {
      console.error("Vault Backup Failed:", e.message);
    }
  };

  const restoreFromCloud = async () => {
    if (!profile || !activeSessionId || !supabase) {
      throw new Error("No cloud backup found for this identity.");
    }

    try {
      const { data: { session } } = await supabase!.auth.getSession();

      if (profile.vault_phrase && profile.iv) {
        const res = await fetch('/api/wallet/decrypt-phrase', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`
          },
          body: JSON.stringify({ encrypted: profile.vault_phrase, iv: profile.iv })
        });

        const data = await res.json();
        if (res.ok) {
          const phrase = data.phrase;
          await loadWalletFromMnemonic(phrase);
          localStorage.setItem(`wallet_mnemonic_${activeSessionId}`, phrase);
        }
      }

      if (profile.vault_infura_key && profile.infura_iv) {
        const res = await fetch('/api/wallet/decrypt-phrase', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`
          },
          body: JSON.stringify({ encrypted: profile.vault_infura_key, iv: profile.infura_iv })
        });

        const data = await res.json();
        if (res.ok) {
          const key = data.phrase;
          setInfuraApiKey(key);
          localStorage.setItem('infura_api_key', key);
        }
      }
      
      if (profile.account_number) {
          setAccountNumber(profile.account_number);
          localStorage.setItem(`account_number_${activeSessionId}`, profile.account_number);
      }

      toast({ title: "Vault Access Restored", description: "Your multi-chain nodes and RPCs are now active." });
    } catch (e: any) {
      throw e;
    }
  };

  const fetchGlobalPrices = useCallback(async () => {
    const coingeckoIds = new Set<string>();
    const platformTokens: { [platform: string]: Set<string> } = {};

    chainsWithLogos.forEach(chain => {
        getInitialAssets(chain.chainId).forEach(a => { 
            if (a.coingeckoId) coingeckoIds.add(a.coingeckoId.toLowerCase());
            else if (!a.isNative && a.address?.startsWith('0x')) {
                const platform = COINGECKO_PLATFORM_MAP[chain.chainId];
                if (platform) {
                    if (!platformTokens[platform]) platformTokens[platform] = new Set();
                    platformTokens[platform].add(a.address.toLowerCase());
                }
            }
        });
    });

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

        if (Object.keys(newPrices).length > 0) setPrices(prev => ({ ...prev, ...newPrices }));
    } catch (e) {
        console.warn("[PRICE_ORACLE_REFRESH_FAILED]", e);
    }
  }, [chainsWithLogos]);

  const fetchBalancesForChain = useCallback(async (chain: ChainConfig) => {
    if (!wallets || !infuraApiKey) return [];
    const walletForChain = wallets.find(w => w.type === (chain.type || 'evm'));
    if (!walletForChain) return [];
    
    const combinedAssetsList = getAvailableAssetsForChain(chain.chainId);
    let adapter = null;
    if (chain.type === 'xrp') adapter = xrpAdapterFactory(chain);
    else if (chain.type === 'polkadot') adapter = polkadotAdapterFactory(chain);
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
    if (!isInitialized || !wallets || !infuraApiKey || !viewingNetwork || !activeSessionId) return;
    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();
    setIsRefreshing(true);
    try {
        const priorityBalances = await fetchBalancesForChain(viewingNetwork);
        setBalances(prev => {
            const next = { ...prev, [viewingNetwork.chainId]: priorityBalances };
            localStorage.setItem(`wallet_balances_${activeSessionId}`, JSON.stringify(next));
            return next;
        });
    } catch (e) {} finally { setIsRefreshing(false); }
  }, [isInitialized, wallets, infuraApiKey, viewingNetwork, fetchBalancesForChain, activeSessionId]);

  const runCloudDiagnostic = useCallback(async () => {
    if (!wallets || !profile || !activeSessionId) return;

    const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    const chains: ('EVM' | 'XRP' | 'Polkadot')[] = ['EVM', 'XRP', 'Polkadot'];
    
    setSyncDiagnostic(prev => ({ ...prev, status: 'checking', progress: 0 }));

    for (let i = 0; i < chains.length; i++) {
      const chain = chains[i];
      const type = chain.toLowerCase() as 'evm' | 'xrp' | 'polkadot';
      const local = wallets.find(w => w.type === type)?.address || null;
      const cloud = profile[`${type}_address` as keyof UserProfile] as string || null;
      
      setSyncDiagnostic(prev => ({ 
        ...prev, 
        chain, 
        status: 'checking', 
        localValue: local, 
        cloudValue: cloud,
        progress: (i / chains.length) * 100 
      }));
      
      await wait(1200);

      if (local !== cloud) {
        setSyncDiagnostic(prev => ({ ...prev, status: 'mismatch' }));
        await wait(800);
        setSyncDiagnostic(prev => ({ ...prev, status: 'syncing' }));
        await syncAllAddresses(); // RPC call to update cloud
        await wait(1000);
        setSyncDiagnostic(prev => ({ ...prev, status: 'success', cloudValue: local }));
        await wait(800);
      } else {
        setSyncDiagnostic(prev => ({ ...prev, status: 'success' }));
        await wait(600);
      }
    }

    // Final Mnemonic Check
    setSyncDiagnostic(prev => ({ ...prev, chain: 'Vault', status: 'checking', localValue: 'Encrypted Phrase', cloudValue: profile.vault_phrase ? 'Stored' : 'Missing' }));
    await wait(1000);
    if (!profile.vault_phrase) {
      setSyncDiagnostic(prev => ({ ...prev, status: 'syncing' }));
      await saveToVault();
      await wait(1000);
    }
    
    setSyncDiagnostic(prev => ({ ...prev, status: 'completed', progress: 100 }));
    setTimeout(() => {
      setSyncDiagnostic(prev => ({ ...prev, status: 'idle' }));
    }, 3000);

  }, [wallets, profile, activeSessionId, syncAllAddresses, saveToVault]);

  const toggleTokenVisibility = useCallback((chainId: number, symbol: string) => {
    setHiddenTokenKeys(prev => {
      const next = new Set(prev);
      const key = `${chainId}:${symbol}`;
      if (next.has(key)) next.delete(key);
      else next.add(key);
      if (activeSessionId) localStorage.setItem(`hidden_tokens_${activeSessionId}`, JSON.stringify(Array.from(next)));
      return next;
    });
  }, [activeSessionId]);

  const addUserToken = useCallback((token: AssetRow) => {
    setUserAddedTokens(prev => {
      const exists = prev.find(t => t.chainId === token.chainId && t.symbol === token.symbol);
      if (exists) return prev;
      const next = [...prev, token];
      if (activeSessionId) localStorage.setItem(`custom_tokens_${activeSessionId}`, JSON.stringify(next));
      return next;
    });
  }, [activeSessionId]);

  const handleSetApiKey = useCallback((key: string | null) => {
    setInfuraApiKey(key);
    if (key) localStorage.setItem('infura_api_key', key);
    else localStorage.removeItem('infura_api_key');
  }, []);

  // Sync Watchdog: Trigger diagnostic on app settle
  useEffect(() => {
    if (!profile || !activeSessionId || !wallets || !isInitialized) return;

    const checkInitialSync = () => {
      const evmLocal = wallets.find(w => w.type === 'evm')?.address;
      const xrpLocal = wallets.find(w => w.type === 'xrp')?.address;
      const dotLocal = wallets.find(w => w.type === 'polkadot')?.address;

      const needsSync = !profile.vault_phrase || 
                        (evmLocal && profile.evm_address !== evmLocal) ||
                        (xrpLocal && profile.xrp_address !== xrpLocal) ||
                        (dotLocal && profile.polkadot_address !== dotLocal);

      setIsSynced(!needsSync);
      
      // Auto-trigger diagnostic if out of sync
      if (needsSync && syncDiagnostic.status === 'idle') {
        runCloudDiagnostic();
      }
    };

    checkInitialSync();
  }, [profile, activeSessionId, wallets, isInitialized, runCloudDiagnostic]);

  useEffect(() => {
    const initLocalSession = async () => {
      if (authLoading) return;
      if (!activeSessionId) {
          setWallets(null); setBalances({}); setAccountNumber(null); setIsWalletLoading(false); return;
      }
      setIsWalletLoading(true);
      try {
        const savedKey = localStorage.getItem('infura_api_key');
        if (savedKey) setInfuraApiKey(savedKey);
        
        const cachedBalances = localStorage.getItem(`wallet_balances_${activeSessionId}`);
        if (cachedBalances) try { setBalances(JSON.parse(cachedBalances)); } catch (e) {}
        
        const savedHidden = localStorage.getItem(`hidden_tokens_${activeSessionId}`);
        if (savedHidden) try { setHiddenTokenKeys(new Set(JSON.parse(savedHidden))); } catch (e) {}
        
        const savedCustom = localStorage.getItem(`custom_tokens_${activeSessionId}`);
        if (savedCustom) try { setUserAddedTokens(JSON.parse(savedCustom)); } catch (e) {}
        
        if (profile?.account_number) {
            setAccountNumber(profile.account_number);
            localStorage.setItem(`account_number_${activeSessionId}`, profile.account_number);
        } else {
            const localAcc = localStorage.getItem(`account_number_${activeSessionId}`);
            if (localAcc) setAccountNumber(localAcc);
        }

        const savedMnemonic = localStorage.getItem(`wallet_mnemonic_${activeSessionId}`);
        if (savedMnemonic) await loadWalletFromMnemonic(savedMnemonic);
      } catch (e) {} finally { setIsWalletLoading(false); }
    };
    initLocalSession();
  }, [authLoading, activeSessionId, profile, loadWalletFromMnemonic]);

  useEffect(() => {
    if (isInitialized) {
        fetchGlobalPrices(); 
        if (priceIntervalRef.current) clearInterval(priceIntervalRef.current);
        priceIntervalRef.current = setInterval(fetchGlobalPrices, 15000);
    }
    return () => { if (priceIntervalRef.current) clearInterval(priceIntervalRef.current); };
  }, [isInitialized, fetchGlobalPrices]);

  useEffect(() => {
    if (isInitialized && wallets && infuraApiKey && viewingNetwork?.chainId) startEngine();
  }, [isInitialized, wallets?.[0]?.address, infuraApiKey, viewingNetwork?.chainId, startEngine, userAddedTokens.length]);

  useEffect(() => {
    if (!areLogosLoading && !isInitialized) {
      const savedChainId = localStorage.getItem('last_viewed_chain_id');
      const restoredChain = savedChainId ? chainsWithLogos.find(c => c.chainId === parseInt(savedChainId)) : null;
      setViewingNetwork(restoredChain || chainsWithLogos[0] || null);
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
    syncDiagnostic
  };

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (context === undefined) throw new Error('useWallet must be used within WalletProvider');
  return context;
}
