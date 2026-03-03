'use client';

import React, { createContext, useContext, useState, ReactNode, useMemo, useEffect, useCallback, useRef } from 'react';
import { usePathname } from 'next/navigation';
import type { AssetRow, ChainConfig, WalletWithMetadata, IWalletAdapter, UserProfile } from '@/lib/types';
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

// ADAPTERS
import { xrpAdapterFactory } from '@/lib/wallets/adapters/xrp';
import { polkadotAdapterFactory } from '@/lib/wallets/adapters/polkadot';
import { kusamaAdapterFactory } from '@/lib/wallets/adapters/kusama';
import { nearAdapterFactory } from '@/lib/wallets/adapters/near';
import { evmAdapterFactory } from '@/lib/wallets/adapters/evm';
import { bitcoinAdapterFactory } from '@/lib/wallets/adapters/bitcoin';
import { litecoinAdapterFactory } from '@/lib/wallets/adapters/litecoin';
import { dogecoinAdapterFactory } from '@/lib/wallets/adapters/dogecoin';
import { solanaAdapterFactory } from '@/lib/wallets/adapters/solana';
import { cosmosAdapterFactory } from '@/lib/wallets/adapters/cosmos';
import { osmosisAdapterFactory } from '@/lib/wallets/adapters/osmosis';
import { secretAdapterFactory } from '@/lib/wallets/adapters/secret';
import { injectiveAdapterFactory } from '@/lib/wallets/adapters/injective';
import { celestiaAdapterFactory } from '@/lib/wallets/adapters/celestia';
import { cardanoAdapterFactory } from '@/lib/wallets/adapters/cardano';
import { tronAdapterFactory } from '@/lib/wallets/adapters/tron';
import { algorandAdapterFactory } from '@/lib/wallets/adapters/algorand';
import { hederaAdapterFactory } from '@/lib/wallets/adapters/hedera';
import { tezosAdapterFactory } from '@/lib/wallets/adapters/tezos';
import { aptosAdapterFactory } from '@/lib/wallets/adapters/aptos';
import { suiAdapterFactory } from '@/lib/wallets/adapters/sui';

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
  resolveLocalDerivation: (mnemonic: string) => Promise<void>;
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
  const initialFetchTriggeredRef = useRef(false);

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

  /**
   * INSTITUTIONAL DIAGNOSTIC SENTINEL
   * Re-engineered for deliberate, smooth verification steps.
   */
  const runCloudDiagnostic = useCallback(async (options?: { forceUI?: boolean }) => {
    if (!wallets || !profile || !user || !supabase) return;
    if (wallets.length === 0) return;

    const hasAuditedInThisTabSession = sessionStorage.getItem(`identity_audit_${user.id}`);
    if (!options?.forceUI && hasAuditedInThisTabSession && isSynced) return;

    // SLOWED DOWN FOR VISUAL IMPACT
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

    const { data: cloudWallets } = await supabase.from('wallets').select('blockchain_id, address').eq('user_id', user.id);
    const getCloudAddr = (type: string) => cloudWallets?.find(w => w.blockchain_id === type)?.address || null;

    for (let i = 0; i < chains.length; i++) {
      const chainInfo = chains[i];
      const local = wallets.find(w => w.type === chainInfo.type)?.address || null;
      let cloud = getCloudAddr(chainInfo.type);
      const progress = (i / chains.length) * 100;

      setSyncDiagnostic(prev => ({ 
        ...prev, 
        chain: chainInfo.label, 
        status: 'checking', 
        localValue: local, 
        cloudValue: cloud || 'None', 
        progress 
      }));
      
      // Deliberate pause for user to verify entrance
      await wait(1200); 

      if (local && local !== cloud) {
        setSyncDiagnostic(prev => ({ ...prev, status: 'mismatch' }));
        await wait(1000);
        setSyncDiagnostic(prev => ({ ...prev, status: 'syncing' }));
        
        await supabase.rpc('sync_user_wallets', {
            p_user_id: user.id,
            p_wallets: [{ type: chainInfo.type, address: local }]
        });
        
        await wait(1500); // Reconciliation time
        setSyncDiagnostic(prev => ({ ...prev, status: 'success', cloudValue: local }));
        await wait(1500); // Visual lock pause
      } else {
        setSyncDiagnostic(prev => ({ ...prev, status: 'success' }));
        await wait(1200); // Verification pause
      }
    }

    setSyncDiagnostic(prev => ({ 
      ...prev, 
      chain: 'Vault', 
      status: 'checking', 
      localValue: 'Encrypted Phrase', 
      cloudValue: profile?.vault_phrase ? 'Stored' : 'Missing', 
      progress: 95 
    }));
    await wait(1500);

    if (!profile?.vault_phrase) {
      setSyncDiagnostic(prev => ({ ...prev, status: 'syncing' }));
      await saveToVault();
      await wait(2000);
    }

    setSyncDiagnostic(prev => ({ ...prev, status: 'completed', progress: 100 }));
    
    sessionStorage.setItem(`identity_audit_${user.id}`, 'verified');
    setIsSynced(true);
    setTimeout(() => setSyncDiagnostic(prev => ({ ...prev, status: 'idle' })), 3000);
  }, [wallets, profile, user, saveToVault, isSynced]);

  /**
   * GROWTH HANDSHAKE PROTOCOL
   * Links a new referred node to its referrer in the institutional registry.
   */
  const handleReferralHandshake = useCallback(async () => {
    if (!user || !profile || !supabase) return;
    
    // Check if user was referred (from auth metadata)
    const refCode = user.user_metadata?.referral_code;
    const sessionRefHandled = sessionStorage.getItem(`ref_handshake_${user.id}`);
    
    if (refCode && !profile.referral_handled && !sessionRefHandled) {
        try {
            // 1. Resolve referrer ID from the 6-char code
            const { data: referrer, error: refError } = await supabase
                .from('profiles')
                .select('id')
                .filter('account_number', 'ilike', `%${refCode}`)
                .maybeSingle();

            if (!refError && referrer && referrer.id !== user.id) {
                // 2. Insert Referral Record
                await supabase.from('referrals').insert({
                    referrer_id: referrer.id,
                    referred_id: user.id,
                    status: 'pending',
                    reward_amount: 100
                });

                // 3. Mark Handled
                await supabase.from('profiles').update({ referral_handled: true }).eq('id', user.id);
                sessionStorage.setItem(`ref_handshake_${user.id}`, 'linked');
                await refreshProfile();
            }
        } catch (e) {
            console.warn("[REFERRAL_HANDSHAKE_FAIL]", e);
        }
    }
  }, [user, profile, refreshProfile]);

  const generateWallet = async (): Promise<string> => {
    const mnemonic = (await import('bip39')).generateMnemonic();
    const derived = await deriveAllWallets(mnemonic, profile);
    if (user) {
        setWallets(derived);
        localStorage.setItem(`wallet_mnemonic_${user.id}`, mnemonic);
        
        const randomSuffix = Math.floor(Math.random() * 9000000 + 1000000);
        const newId = `835${randomSuffix}`;
        setAccountNumber(newId);
        localStorage.setItem(`account_number_${user.id}`, newId);

        await saveToVault();
        await syncAllAddresses(derived);
        
        sessionStorage.removeItem(`identity_audit_${user.id}`);
        setIsSynced(false); 
    }
    return mnemonic;
  };

  const importWallet = async (mnemonic: string) => {
    const derived = await deriveAllWallets(mnemonic, profile);
    if (derived && user) {
        setWallets(derived);
        localStorage.setItem(`wallet_mnemonic_${user.id}`, mnemonic);
        
        if (!accountNumber) {
            const randomSuffix = Math.floor(Math.random() * 9000000 + 1000000);
            const newId = `835${randomSuffix}`;
            setAccountNumber(newId);
            localStorage.setItem(`account_number_${user.id}`, newId);
        }

        await saveToVault();
        await syncAllAddresses(derived);
        
        sessionStorage.removeItem(`identity_audit_${user.id}`);
        setIsSynced(false);
    }
  };

  const restoreFromCloud = async (onStatusUpdate?: (status: string) => void) => {
    if (!user || !supabase) throw new Error("Registry connection failed.");
    setIsWalletLoading(true);
    try {
      onStatusUpdate?.('Fetching Vault...');
      const { data: latestProfile, error: pError } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      if (pError || !latestProfile) throw new Error("Could not locate cloud vault.");

      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      onStatusUpdate?.('Decrypting Nodes...');
      const results = await Promise.all([
        latestProfile.vault_phrase ? fetch('/api/wallet/decrypt-phrase', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ encrypted: latestProfile.vault_phrase, iv: latestProfile.iv })
        }).then(r => r.json()).then(d => d.phrase) : Promise.resolve(null),
        latestProfile.vault_infura_key ? fetch('/api/wallet/decrypt-phrase', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ encrypted: latestProfile.vault_infura_key, iv: latestProfile.infura_iv })
        }).then(r => r.json()).then(d => d.phrase) : Promise.resolve(null)
      ]);

      const [mnemonicVal, infuraVal] = results;
      if (mnemonicVal) localStorage.setItem(`wallet_mnemonic_${user.id}`, mnemonicVal);
      if (infuraVal) { setInfuraApiKey(infuraVal); localStorage.setItem('infura_api_key', infuraVal); }

      if (mnemonicVal) {
        onStatusUpdate?.('Establishing Identity...');
        const derived = await deriveAllWallets(mnemonicVal, latestProfile);
        if (derived) { 
          setWallets(derived);
          setIsSynced(false); 
          sessionStorage.removeItem(`identity_audit_${user.id}`);
        }
      }

      if (latestProfile.account_number) { 
        setAccountNumber(latestProfile.account_number); 
        localStorage.setItem(`account_number_${user.id}`, latestProfile.account_number); 
      }

      await refreshProfile();
      onStatusUpdate?.('Restoration Complete');
      toast({ title: "Vault Restored" });
    } catch (e: any) { throw e; } finally { setIsWalletLoading(false); }
  };

  const fetchBalancesForChain = useCallback(async (chain: ChainConfig) => {
    if (!wallets || (!infuraApiKey && chain.type === 'evm')) return [];
    const walletForChain = wallets.find(w => w.type === (chain.type || 'evm'));
    if (!walletForChain) return [];
    const combinedAssetsList = getAvailableAssetsForChain(chain.chainId);
    let adapter = null;
    if (chain.type === 'xrp') adapter = xrpAdapterFactory(chain);
    else if (chain.type === 'polkadot') adapter = polkadotAdapterFactory(chain);
    else if (chain.type === 'kusama') adapter = kusamaAdapterFactory(chain);
    else if (chain.type === 'near') adapter = nearAdapterFactory(chain);
    else if (chain.type === 'btc') adapter = bitcoinAdapterFactory(chain);
    else if (chain.type === 'ltc') adapter = litecoinAdapterFactory(chain);
    else if (chain.type === 'doge') adapter = dogecoinAdapterFactory(chain);
    else if (chain.type === 'solana') adapter = solanaAdapterFactory(chain);
    else if (chain.type === 'cosmos') adapter = cosmosAdapterFactory(chain);
    else if (chain.type === 'celestia') adapter = celestiaAdapterFactory(chain);
    else if (chain.type === 'cardano') adapter = cardanoAdapterFactory(chain);
    else if (chain.type === 'tron') adapter = tronAdapterFactory(chain);
    else if (chain.type === 'algorand') adapter = algorandAdapterFactory(chain);
    else if (chain.type === 'hedera') adapter = hederaAdapterFactory(chain);
    else if (chain.type === 'tezos') adapter = tezosAdapterFactory(chain);
    else if (chain.type === 'aptos') adapter = aptosAdapterFactory(chain);
    else if (chain.type === 'sui') adapter = suiAdapterFactory(chain);
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
    if (!isInitialized || !wallets || !viewingNetwork || !user) return;
    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();
    setIsRefreshing(true);
    try {
        const newPrices = await fetchGlobalMarketData(chainsWithLogos, userAddedTokens, rates, prices);
        setPrices(newPrices);
        localStorage.setItem(`market_prices_${user.id}`, JSON.stringify(newPrices));
        
        const priorityBalances = await fetchBalancesForChain(viewingNetwork);
        setBalances(prev => {
            const next = { ...prev, [viewingNetwork.chainId]: priorityBalances };
            localStorage.setItem(`wallet_balances_${user.id}`, JSON.stringify(next));
            return next;
        });
    } catch (e) {} finally { setIsRefreshing(false); }
  }, [isInitialized, wallets, viewingNetwork, user, fetchBalancesForChain, chainsWithLogos, userAddedTokens, rates, prices]);

  const logout = useCallback(async () => {
    setIsWalletLoading(true);
    try {
      const prevUserId = user?.id;
      if (abortControllerRef.current) abortControllerRef.current.abort();
      if (priceIntervalRef.current) clearInterval(priceIntervalRef.current);
      
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
          sessionStorage.removeItem(`ref_handshake_${prevUserId}`);
      }
      setWallets(null); setBalances({}); setAccountNumber(null); setIsSynced(true);
      window.location.href = '/auth/login';
    } catch (e) {
      window.location.reload();
    } finally {
      setIsWalletLoading(false);
    }
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

  useEffect(() => {
    const initLocalSession = async () => {
      if (authLoading) return;
      if (!user) { setWallets(null); setBalances({}); setAccountNumber(null); setIsWalletLoading(false); return; }
      
      const localAcc = localStorage.getItem(`account_number_${user.id}`);
      let targetAcc = profile?.account_number || localAcc;
      if (!targetAcc) {
          targetAcc = `835${Math.floor(Math.random() * 9000000 + 1000000)}`;
          localStorage.setItem(`account_number_${user.id}`, targetAcc);
          syncAllAddresses();
      }
      setAccountNumber(targetAcc);

      setIsWalletLoading(true);
      const savedMnemonic = localStorage.getItem(`wallet_mnemonic_${user.id}`);
      const cachedBalances = localStorage.getItem(`wallet_balances_${user.id}`);
      const cachedPrices = localStorage.getItem(`market_prices_${user.id}`);
      const savedKey = localStorage.getItem('infura_api_key');
      
      if (savedKey) setInfuraApiKey(savedKey);
      if (cachedBalances) try { setBalances(JSON.parse(cachedBalances)); } catch (e) {}
      if (cachedPrices) try { setPrices(JSON.parse(cachedPrices)); } catch (e) {}
      
      if (savedMnemonic) { 
        const derived = await deriveAllWallets(savedMnemonic, profile); 
        setWallets(derived); 
      }
      
      const savedHidden = localStorage.getItem(`hidden_tokens_${user.id}`);
      if (savedHidden) try { setHiddenTokenKeys(new Set(JSON.parse(savedHidden))); } catch (e) {}
      const savedCustom = localStorage.getItem(`custom_tokens_${user.id}`);
      if (savedCustom) try { setUserAddedTokens(JSON.parse(savedCustom)); } catch (e) {}
      setIsWalletLoading(false);
    };
    initLocalSession();
  }, [authLoading, user, profile]);

  useEffect(() => {
    if (!areLogosLoading && !isInitialized) {
      const savedChainId = localStorage.getItem('last_viewed_chain_id');
      const restoredChain = savedChainId ? chainsWithLogos.find(c => c.chainId === parseInt(savedChainId)) : null;
      setViewingNetwork(restoredChain || chainsWithLogos.find(c => c.chainId === 1) || chainsWithLogos[0] || null);
      setIsInitialized(true);
    }
  }, [areLogosLoading, chainsWithLogos, isInitialized]);

  useEffect(() => {
    if (isInitialized && wallets && !initialFetchTriggeredRef.current) { initialFetchTriggeredRef.current = true; startEngine(); }
  }, [isInitialized, wallets, startEngine]);

  useEffect(() => {
    if (isInitialized) {
        if (priceIntervalRef.current) clearInterval(priceIntervalRef.current);
        priceIntervalRef.current = setInterval(startEngine, 30000);
    }
    return () => { if (priceIntervalRef.current) clearInterval(priceIntervalRef.current); };
  }, [isInitialized, startEngine]);

  useEffect(() => {
    if (pathname !== '/') return;
    if (!profile || !user || !wallets || !isInitialized || isWalletLoading) return;
    
    // Trigger Referral Handshake first
    handleReferralHandshake();

    const hasAuditedInThisTabSession = sessionStorage.getItem(`identity_audit_${user.id}`);
    
    if (!hasAuditedInThisTabSession || !isSynced) {
        const timer = setTimeout(() => {
          runCloudDiagnostic();
        }, 3000); 
        return () => clearTimeout(timer);
    }
  }, [profile, user, wallets, isInitialized, isWalletLoading, runCloudDiagnostic, isSynced, pathname, handleReferralHandshake]);

  const value: WalletContextType = {
    isInitialized: isInitialized && !authLoading,
    isAssetsLoading: areLogosLoading,
    isWalletLoading,
    hasNewNotifications,
    setHasNewNotifications,
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
    resolveLocalDerivation: (m) => deriveAllWallets(m, profile).then(d => { setWallets(d); }),
    saveToVault,
    restoreFromCloud,
    logout,
    deleteWallet,
    deleteWalletPermanently,
    fetchError,
    getAddressForChain,
    infuraApiKey,
    setInfuraApiKey: (k) => { 
      setInfuraApiKey(k); 
      if (k) {
        localStorage.setItem('infura_api_key', k);
        if (user) saveToVault();
      } else {
        localStorage.removeItem('infura_api_key');
        if (user) saveToVault();
      }
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
    setActiveFulfillmentId
  };

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (context === undefined) throw new Error('useWallet must be used within WalletProvider');
  return context;
}
