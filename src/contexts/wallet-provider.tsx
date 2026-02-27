'use client';

import React, { createContext, useContext, useState, ReactNode, useMemo, useEffect, useCallback, useRef } from 'react';
import type { AssetRow, ChainConfig, WalletWithMetadata, LocalSession } from '@/lib/types';
import { useNetworkLogos } from '@/hooks/useNetworkLogos';
import { ethers } from 'ethers';
import * as xrpl from 'xrpl';
import { Keyring } from '@polkadot/keyring';
import { cryptoWaitReady } from '@polkadot/util-crypto';
import { getInitialAssets } from '@/lib/wallets/balances';
import { useUser } from './user-provider';
import { useToast } from '@/hooks/use-toast';
import { fetchPriceMap, fetchPricesByContract, COINGECKO_PLATFORM_MAP } from '@/lib/coingecko';
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
  prices: { [key: string]: PriceInfo };
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
  getAvailableAssetsForChain: (chainId: number) => AssetRow[];
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: ReactNode }) {
  const { chainsWithLogos, areLogosLoading } = useNetworkLogos();
  const { user, loading: authLoading, signOut: authSignOut, profile, refreshProfile, activeSessionId, addSession } = useUser();
  const { toast } = useToast();
  
  const [viewingNetwork, setViewingNetwork] = useState<ChainConfig | null>(null);
  const [wallets, setWallets] = useState<WalletWithMetadata[] | null>(null);
  const [balances, setBalances] = useState<{ [key: string]: AssetRow[] }>({});
  const [prices, setPrices] = useState<{ [key: string]: PriceInfo }>({});
  const [tokenRegistry, setTokenRegistry] = useState<{ [chainId: number]: any[] }>({});
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isWalletLoading, setIsWalletLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [infuraApiKey, setInfuraApiKey] = useState<string | null>(null);

  const [hiddenTokenKeys, setHiddenTokenKeys] = useState<Set<string>>(new Set());
  const [userAddedTokens, setUserAddedTokens] = useState<AssetRow[]>([]);

  const isBackgroundSyncRunning = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const priceIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const latestBalancesRef = useRef(balances);
  const latestUserTokensRef = useRef(userAddedTokens);

  useEffect(() => { latestBalancesRef.current = balances; }, [balances]);
  useEffect(() => { latestUserTokensRef.current = userAddedTokens; }, [userAddedTokens]);

  const loadWalletFromMnemonic = useCallback(async (mnemonic: string) => {
    if (!mnemonic) return;
    try {
      const cleanMnemonic = mnemonic.trim();
      if (!ethers.Mnemonic.isValidMnemonic(cleanMnemonic)) throw new Error("Invalid BIP39 Mnemonic");
      
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
    } catch (e: any) {
      console.error("Wallet Derivation Error:", e.message);
      throw e;
    }
  }, []);

  // Watchdog sync for database user_identity
  useEffect(() => {
    const syncIdentities = async () => {
      if (!user || !wallets || !supabase) return;

      try {
        const { data: dbIdentities } = await supabase
          .from('user_identity')
          .select('blockchain_name, wallet_address')
          .eq('user_id', user.id);

        for (const wallet of wallets) {
          const dbMatch = dbIdentities?.find(db => db.blockchain_name === wallet.type);

          if (!dbMatch || dbMatch.wallet_address !== wallet.address) {
            await supabase.from('user_identity').upsert({
              user_id: user.id,
              blockchain_name: wallet.type,
              wallet_address: wallet.address
            }, { onConflict: 'user_id, blockchain_name' });
          }
        }
      } catch (e) {
        console.warn("Silent Watchdog Sync Error:", e);
      }
    };

    if (user && wallets) syncIdentities();
  }, [user?.id, wallets, activeSessionId]);

  const handleSetApiKey = useCallback((key: string | null) => {
    setInfuraApiKey(key);
    if (key) localStorage.setItem('infura_api_key', key);
    else localStorage.removeItem('infura_api_key');
  }, []);

  useEffect(() => {
    const initLocalSession = async () => {
      if (authLoading || !activeSessionId) {
          if (!activeSessionId) {
              setWallets(null);
              setBalances({});
          }
          return;
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
        
        const savedMnemonic = localStorage.getItem(`wallet_mnemonic_${activeSessionId}`);
        if (savedMnemonic) await loadWalletFromMnemonic(savedMnemonic);
      } catch (e) {
        console.error("Session recovery failure:", e);
      } finally {
        setIsWalletLoading(false);
      }
    };
    initLocalSession();
  }, [authLoading, activeSessionId, loadWalletFromMnemonic]);

  const toggleTokenVisibility = useCallback((chainId: number, symbol: string) => {
    if (!activeSessionId) return;
    setHiddenTokenKeys(prev => {
        const next = new Set(prev);
        const key = `${chainId}:${symbol}`;
        if (next.has(key)) next.delete(key);
        else next.add(key);
        localStorage.setItem(`hidden_tokens_${activeSessionId}`, JSON.stringify(Array.from(next)));
        return next;
    });
  }, [activeSessionId]);

  const addUserToken = useCallback((token: AssetRow) => {
    if (!activeSessionId) return;
    setUserAddedTokens(prev => {
        const exists = prev.find(t => t.chainId === token.chainId && t.symbol === token.symbol);
        if (exists) return prev;
        const next = [...prev, { ...token, address: token.address?.toLowerCase() }];
        localStorage.setItem(`custom_tokens_${activeSessionId}`, JSON.stringify(next));
        return next;
    });
  }, [activeSessionId]);

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
            contract: token.contract_address?.toLowerCase(),
            logo_url: token.logo_url,
            priceSource: token.token_details.priceSource,
            priceId: token.token_details.priceId || token.token_details.coingeckoId
          }));
        }
      } catch (e) {}
    });
    await Promise.all(fetchPromises);
    setTokenRegistry(registry);
  }, [chainsWithLogos]);

  const fetchGlobalPrices = useCallback(async () => {
    const coingeckoIds = new Set<string>();
    const contractLookups: { [chainId: number]: Set<string> } = {};
    const allKnownAssets: AssetRow[] = [];
    chainsWithLogos.forEach(chain => {
        allKnownAssets.push(...getInitialAssets(chain.chainId).map(a => ({...a, balance: '0'} as AssetRow)));
    });
    allKnownAssets.push(...latestUserTokensRef.current);
    Object.values(latestBalancesRef.current).forEach(list => { allKnownAssets.push(...list); });

    allKnownAssets.forEach(asset => {
        const effectiveId = asset.priceId || asset.coingeckoId;
        if (effectiveId) coingeckoIds.add(effectiveId.toLowerCase().trim());
        else if (asset.address && asset.address.startsWith('0x') && COINGECKO_PLATFORM_MAP[asset.chainId]) {
            if (!contractLookups[asset.chainId]) contractLookups[asset.chainId] = new Set();
            contractLookups[asset.chainId].add(asset.address.toLowerCase().trim());
        }
    });

    const newPrices: { [key: string]: PriceInfo } = {};
    try {
        if (coingeckoIds.size > 0) {
            const priceMap = await fetchPriceMap(Array.from(coingeckoIds));
            Object.entries(priceMap).forEach(([id, data]) => {
                if (data && typeof data.usd === 'number') newPrices[id.toLowerCase()] = { price: data.usd, change: data.usd_24h_change || 0 };
            });
        }
        const contractPromises = Object.entries(contractLookups).map(async ([chainId, addresses]) => {
            const platformId = COINGECKO_PLATFORM_MAP[parseInt(chainId)];
            if (platformId) {
                const results = await fetchPricesByContract(platformId, Array.from(addresses));
                Object.entries(results).forEach(([addr, info]) => {
                    if (info && typeof info.usd === 'number') newPrices[addr.toLowerCase()] = { price: info.usd, change: info.usd_24h_change || 0 };
                });
            }
        });
        await Promise.all(contractPromises);
        setPrices(prev => ({ ...prev, ...newPrices }));
    } catch (e) { console.warn("Price pulse failure:", e); }
  }, [chainsWithLogos]);

  useEffect(() => {
    if (isInitialized) {
        fetchGlobalPrices(); 
        if (priceIntervalRef.current) clearInterval(priceIntervalRef.current);
        priceIntervalRef.current = setInterval(fetchGlobalPrices, 10000);
    }
    return () => { if (priceIntervalRef.current) clearInterval(priceIntervalRef.current); };
  }, [isInitialized, fetchGlobalPrices]);

  const fetchBalancesForChain = useCallback(async (chain: ChainConfig) => {
    if (!wallets || !infuraApiKey) return [];
    const walletForChain = wallets.find(w => w.type === (chain.type || 'evm'));
    if (!walletForChain) return [];
    const apiTokens = tokenRegistry[chain.chainId] || [];
    const baseAssets = getInitialAssets(chain.chainId).map(a => ({ ...a, balance: '0' } as AssetRow));
    const customAssets = latestUserTokensRef.current.filter(t => t.chainId === chain.chainId);
    const combinedAssetsList = [...baseAssets, ...customAssets].reduce((acc, curr) => {
        if (!acc.find(a => a.symbol === curr.symbol)) acc.push(curr);
        return acc;
    }, [] as AssetRow[]).map(a => {
        const apiMeta = apiTokens.find(t => t.symbol === a.symbol || (t.contract && t.contract === a.address?.toLowerCase()));
        return { ...a, name: apiMeta?.name || a.name, decimals: apiMeta?.decimals || a.decimals || 18, iconUrl: apiMeta?.logo_url || a.iconUrl || chain.iconUrl, address: a.address?.toLowerCase(), priceId: apiMeta?.priceId || a.priceId || a.coingeckoId, coingeckoId: apiMeta?.priceId || a.coingeckoId } as AssetRow;
    });
    let adapter = null;
    if (chain.type === 'xrp') adapter = xrpAdapterFactory(chain);
    else if (chain.type === 'polkadot') adapter = polkadotAdapterFactory(chain);
    else adapter = evmAdapterFactory(chain, infuraApiKey);
    if (adapter) {
        try {
            const results = await adapter.fetchBalances(walletForChain.address, combinedAssetsList);
            return results.map(r => ({ ...r, updatedAt: Date.now() }));
        } catch (e) { console.warn(`RPC Balance Error for ${chain.name}:`, e); return combinedAssetsList; }
    }
    return combinedAssetsList;
  }, [wallets, infuraApiKey, tokenRegistry]);

  const getAvailableAssetsForChain = useCallback((chainId: number): AssetRow[] => {
    const base = getInitialAssets(chainId).map(a => ({ ...a, balance: '0' } as AssetRow));
    const custom = latestUserTokensRef.current.filter(t => t.chainId === chainId);
    return [...base, ...custom].reduce((acc, curr) => {
        if (!acc.find(a => a.symbol === curr.symbol)) acc.push(curr);
        return acc;
    }, [] as AssetRow[]);
  }, []);

  const manualRefresh = useCallback(async () => {
    if (!viewingNetwork || !infuraApiKey || !wallets) return;
    setIsRefreshing(true);
    try {
        await Promise.all([
            fetchBalancesForChain(viewingNetwork).then(freshBalances => { setBalances(prev => ({ ...prev, [viewingNetwork.chainId]: freshBalances })); }),
            fetchGlobalPrices()
        ]);
    } catch (e) { setFetchError("Connection limited."); } finally { setIsRefreshing(false); }
  }, [viewingNetwork, infuraApiKey, wallets, fetchBalancesForChain, fetchGlobalPrices]);

  const startEngine = useCallback(async () => {
    if (!isInitialized || !wallets || !infuraApiKey || !viewingNetwork || !activeSessionId) return;
    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();
    setIsRefreshing(true);
    try {
        fetchGlobalPrices();
        const priorityBalances = await fetchBalancesForChain(viewingNetwork);
        setBalances(prev => {
            const next = { ...prev, [viewingNetwork.chainId]: priorityBalances };
            if (activeSessionId) localStorage.setItem(`wallet_balances_${activeSessionId}`, JSON.stringify(next));
            return next;
        });
    } catch (e) {} finally { setIsRefreshing(false); }
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
                if (activeSessionId) localStorage.setItem(`wallet_balances_${activeSessionId}`, JSON.stringify(next));
                return next;
            });
        } catch (e) {}
    }
    isBackgroundSyncRunning.current = false;
  }, [isInitialized, wallets, infuraApiKey, viewingNetwork, chainsWithLogos, fetchBalancesForChain, activeSessionId, fetchGlobalPrices]);

  useEffect(() => {
    if (isInitialized && wallets && infuraApiKey && viewingNetwork?.chainId) {
        startEngine();
    }
    return () => { if (abortControllerRef.current) abortControllerRef.current.abort(); };
  }, [isInitialized, wallets?.[0]?.address, infuraApiKey, viewingNetwork?.chainId, startEngine, userAddedTokens.length]);

  useEffect(() => {
    if (!areLogosLoading && !isInitialized) {
      const savedChainId = localStorage.getItem('last_viewed_chain_id');
      const restoredChain = savedChainId ? chainsWithLogos.find(c => c.chainId === parseInt(savedChainId)) : null;
      setViewingNetwork(restoredChain || chainsWithLogos[0] || null);
      setIsInitialized(true);
      if (chainsWithLogos.length > 0) fetchTokenRegistry();
    }
  }, [areLogosLoading, chainsWithLogos, fetchTokenRegistry, isInitialized]);

  const saveToVault = useCallback(async () => {
    if (!activeSessionId || !supabase || !wallets || !profile) return;
    const mnemonic = localStorage.getItem(`wallet_mnemonic_${activeSessionId}`);
    const currentApiKey = localStorage.getItem('infura_api_key');
    
    const updatedSession: LocalSession = {
        id: activeSessionId,
        profile: profile,
        encryptedMnemonic: mnemonic,
        encryptedApiKey: currentApiKey,
        lastActive: Date.now()
    };
    addSession(updatedSession);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const payload: any = {};
      if (mnemonic) {
          const res = await fetch('/api/wallet/encrypt-phrase', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` }, body: JSON.stringify({ phrase: mnemonic }), });
          const data = await res.json();
          if (res.ok) { payload.vault_phrase = data.encrypted; payload.iv = data.iv; }
      }
      if (currentApiKey) {
          const res = await fetch('/api/wallet/encrypt-phrase', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` }, body: JSON.stringify({ phrase: currentApiKey }), });
          const data = await res.json();
          if (res.ok) { payload.vault_infura_key = data.encrypted; payload.infura_iv = data.iv; }
      }
      if (Object.keys(payload).length > 0) {
          await supabase.from('profiles').update(payload).eq('id', activeSessionId);
          toast({ title: "Cloud Vault Synced" });
          refreshProfile();
      }
    } catch (e) {}
  }, [activeSessionId, wallets, toast, refreshProfile, profile, addSession]);

  const restoreFromCloud = useCallback(async () => {
    if (!activeSessionId || !supabase) return;
    setIsWalletLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data: freshProfile, error: profileError } = await supabase.from('profiles').select('*').eq('id', activeSessionId).single();
      if (profileError || !freshProfile) throw new Error("Cloud access retrieval failure.");
      if (freshProfile.vault_phrase && freshProfile.iv) {
          const res = await fetch('/api/wallet/decrypt-phrase', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` }, body: JSON.stringify({ encrypted: freshProfile.vault_phrase, iv: freshProfile.iv }), });
          const data = await res.json();
          if (res.ok && data.phrase) { await loadWalletFromMnemonic(data.phrase); localStorage.setItem(`wallet_mnemonic_${activeSessionId}`, data.phrase); }
      }
      if (freshProfile.vault_infura_key && freshProfile.infura_iv) {
          const res = await fetch('/api/wallet/decrypt-phrase', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` }, body: JSON.stringify({ encrypted: freshProfile.vault_infura_key, iv: freshProfile.infura_iv }), });
          const data = await res.json();
          if (res.ok && data.phrase) { setInfuraApiKey(data.phrase); localStorage.setItem('infura_api_key', data.phrase); }
      }
      toast({ title: "Access Restored" });
      refreshProfile();
    } catch (e: any) { throw e; } finally { setIsWalletLoading(false); }
  }, [activeSessionId, loadWalletFromMnemonic, toast, refreshProfile]);

  const generateWallet = useCallback(async () => {
    setIsWalletLoading(true);
    try {
        const mnemonic = ethers.Mnemonic.entropyToPhrase(ethers.randomBytes(16));
        if (activeSessionId) {
            const { data: profileCheck } = await supabase!.from('profiles').select('vault_phrase').eq('id', activeSessionId).single();
            if (profileCheck?.vault_phrase) throw new Error('CLOUDV_EXISTS');
            localStorage.setItem(`wallet_mnemonic_${activeSessionId}`, mnemonic);
        }
        await loadWalletFromMnemonic(mnemonic);
        await saveToVault();
        return mnemonic;
    } finally { setIsWalletLoading(false); }
  }, [activeSessionId, loadWalletFromMnemonic, saveToVault]);

  const importWallet = useCallback(async (mnemonic: string) => {
    setIsWalletLoading(true);
    try {
        await loadWalletFromMnemonic(mnemonic);
        if (activeSessionId) localStorage.setItem(`wallet_mnemonic_${activeSessionId}`, mnemonic.trim());
        await saveToVault();
    } finally { setIsWalletLoading(false); }
  }, [activeSessionId, loadWalletFromMnemonic, saveToVault]);

  const assetsForCurrentNetwork = useMemo(() => {
    if (!viewingNetwork) return [];
    const available = getAvailableAssetsForChain(viewingNetwork.chainId);
    const listWithBalances = available.map(asset => {
        const balanceObj = balances[viewingNetwork.chainId]?.find(b => b.symbol === asset.symbol || (b.address && asset.address && b.address.toLowerCase() === asset.address.toLowerCase()));
        return { ...asset, balance: balanceObj?.balance || '0', updatedAt: balanceObj?.updatedAt || asset.updatedAt };
    });
    return listWithBalances.filter(asset => !hiddenTokenKeys.has(`${viewingNetwork.chainId}:${asset.symbol}`)).map(asset => {
        const effectivePriceId = (asset.priceId || asset.coingeckoId)?.toLowerCase().trim();
        const market = (effectivePriceId ? prices[effectivePriceId] : null) || (asset.address ? prices[asset.address.toLowerCase().trim()] : null);
        const price = market?.price ?? 0;
        const balanceNum = parseFloat(asset.balance || '0');
        return { ...asset, priceUsd: price, pctChange24h: market?.change ?? 0, fiatValueUsd: balanceNum * price };
    });
  }, [balances, viewingNetwork, hiddenTokenKeys, prices, getAvailableAssetsForChain]);

  const value: WalletContextType = {
    isInitialized: isInitialized && !authLoading,
    isAssetsLoading: areLogosLoading,
    isWalletLoading,
    hasNewNotifications: false,
    viewingNetwork: viewingNetwork || (chainsWithLogos[0] || {} as ChainConfig),
    setNetwork: (net) => { setViewingNetwork(net); setFetchError(null); localStorage.setItem('last_viewed_chain_id', net.chainId.toString()); },
    allAssets: assetsForCurrentNetwork,
    allChains: chainsWithLogos,
    allChainsMap: chainsWithLogos.reduce((acc, c) => ({ ...acc, [c.chainId]: c }), {}),
    isRefreshing,
    isTokenLoading: () => false,
    wallets,
    balances,
    prices,
    refresh: manualRefresh,
    generateWallet,
    importWallet,
    saveToVault,
    restoreFromCloud,
    logout: () => { 
        // Only clear Supabase session, keep local wallet vault
        authSignOut(); 
    },
    deleteWallet: () => { 
        if (activeSessionId) { 
            localStorage.removeItem(`wallet_mnemonic_${activeSessionId}`); 
            localStorage.removeItem(`wallet_balances_${activeSessionId}`); 
        } 
        setWallets(null); 
        setBalances({}); 
    },
    fetchError,
    getAddressForChain: (chain, w) => getAddressForChainUtil(chain, w),
    infuraApiKey,
    setInfuraApiKey: handleSetApiKey,
    hiddenTokenKeys,
    toggleTokenVisibility,
    userAddedTokens,
    addUserToken,
    getAvailableAssetsForChain
  };

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (context === undefined) throw new Error('useWallet must be used within a WalletProvider');
  return context;
}
