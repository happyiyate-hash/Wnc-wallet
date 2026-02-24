
'use client';

import React, { createContext, useContext, useState, ReactNode, useMemo, useEffect, useCallback } from 'react';
import type { AssetRow, ChainConfig, WalletWithMetadata } from '@/lib/types';
import { useNetworkLogos } from '@/hooks/useNetworkLogos';
import { ethers } from 'ethers';
import { getInitialAssets } from '@/lib/wallets/balances';
import { fetchAssetPrices } from '@/lib/coingecko';
import { useUser } from './user-provider';
import { supabase } from '@/lib/supabase/client';
import { useToast } from '@/hooks/use-toast';

const PUBLIC_RPC_MAP: Record<number | string, string> = {
  1: "https://rpc.ankr.com/eth",
  137: "https://rpc.ankr.com/polygon",
  42161: "https://rpc.ankr.com/arbitrum",
  10: "https://rpc.ankr.com/optimism",
  8453: "https://rpc.ankr.com/base",
  81457: "https://rpc.ankr.com/blast",
  56: "https://rpc.ankr.com/bsc",
  43114: "https://rpc.ankr.com/avalanche",
  324: "https://rpc.ankr.com/zksync_era",
  42220: "https://rpc.ankr.com/celo",
  534352: "https://rpc.ankr.com/scroll",
  1329: "https://rpc.ankr.com/sei",
  5000: "https://rpc.ankr.com/mantle",
  204: "https://rpc.ankr.com/opbnb",
  130: "https://rpc.ankr.com/unichain",
  1750: "https://rpc.ankr.com/swellchain",
  11297108109: "https://rpc.ankr.com/palm",
  59144: "https://rpc.ankr.com/linea",
  1313161554: "https://rpc.ankr.com/hemi",
};

interface WalletContextType {
  isInitialized: boolean;
  isAssetsLoading: boolean;
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
  refresh: () => Promise<void>;
  importWallet: (mnemonic: string) => Promise<void>;
  generateWallet: () => Promise<string>;
  saveToVault: () => Promise<void>;
  restoreFromCloud: () => Promise<void>;
  logout: () => void;
  deleteWallet: () => void;
  fetchError: string | null;
  getAddressForChain: (chain: ChainConfig, wallets: WalletWithMetadata[]) => string | undefined;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: ReactNode }) {
  const { chainsWithLogos, areLogosLoading } = useNetworkLogos();
  const { user, profile, loading: authLoading, refreshProfile, signOut: authSignOut } = useUser();
  const { toast } = useToast();
  
  const [viewingNetwork, setViewingNetwork] = useState<ChainConfig | null>(null);
  const [wallets, setWallets] = useState<WalletWithMetadata[] | null>(null);
  const [balances, setBalances] = useState<{ [key: string]: AssetRow[] }>({});
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadingTokens, setLoadingTokens] = useState<Record<string, boolean>>({});
  const [isInitialized, setIsInitialized] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const isTokenLoading = useCallback((chainId: number, symbol: string) => {
    return loadingTokens[`${chainId}:${symbol}`] || false;
  }, [loadingTokens]);

  const getAddressForChain = useCallback((chain: ChainConfig, wallets: WalletWithMetadata[]): string | undefined => {
    if (wallets && wallets.length > 0) return wallets[0].address;
    return undefined;
  }, []);

  const getAuthToken = useCallback(async () => {
    if (!supabase) return null;
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token;
  }, []);

  const loadWalletFromMnemonic = useCallback((mnemonic: string) => {
    if (!user || !mnemonic) return;
    
    try {
      const cleanMnemonic = mnemonic.trim();
      if (!ethers.Mnemonic.isValidMnemonic(cleanMnemonic)) {
        throw new Error("Invalid mnemonic phrase structure.");
      }

      const wallet = ethers.Wallet.fromPhrase(cleanMnemonic);
      
      setWallets([{ 
        address: wallet.address, 
        privateKey: wallet.privateKey,
        avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${wallet.address}`
      }]);
      
      localStorage.setItem(`wallet_mnemonic_${user.id}`, cleanMnemonic);
    } catch (e: any) {
      console.error("Mnemonic load error:", e);
      throw new Error(e.message || "Invalid mnemonic phrase.");
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading && user) {
      const savedMnemonic = localStorage.getItem(`wallet_mnemonic_${user.id}`);
      if (savedMnemonic) {
        try {
          loadWalletFromMnemonic(savedMnemonic);
        } catch (e) {
          localStorage.removeItem(`wallet_mnemonic_${user.id}`);
        }
      }
    } else if (!authLoading && !user) {
      setWallets(null);
      setBalances({});
    }
  }, [authLoading, user, loadWalletFromMnemonic]);

  useEffect(() => {
    if (chainsWithLogos.length > 0) {
      if (!viewingNetwork) {
        setViewingNetwork(chainsWithLogos[0]);
      }
      setIsInitialized(true);
    }
  }, [chainsWithLogos, viewingNetwork]);

  const saveToVaultInternal = async (mnemonic: string) => {
    if (!user || !supabase) return;
    try {
      const token = await getAuthToken();
      if (!token) throw new Error("No active session");

      const response = await fetch('/api/wallet/encrypt-phrase', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ phrase: mnemonic })
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Encryption failed');
      
      const { encrypted, iv } = data;
      const { error: updateError } = await supabase.from('profiles').update({ vault_phrase: encrypted, iv: iv }).eq('id', user.id);
      if (updateError) throw updateError;

      await refreshProfile();
    } catch (e: any) {
      console.error("Cloud backup failed", e);
      toast({ variant: "destructive", title: "Backup Failed", description: e.message || "Could not sync keys to Cloud Vault." });
    }
  };

  const generateWallet = useCallback(async () => {
    if (!user) return '';
    const wallet = ethers.Wallet.createRandom();
    const mnemonic = wallet.mnemonic?.phrase || '';
    if (mnemonic) {
      loadWalletFromMnemonic(mnemonic);
      await saveToVaultInternal(mnemonic);
      toast({ title: "Wallet Created", description: "Your new keys are secured in your cloud vault." });
    }
    return mnemonic;
  }, [loadWalletFromMnemonic, toast, user]);

  const importWallet = useCallback(async (mnemonic: string) => {
    if (!user) return;
    try {
      loadWalletFromMnemonic(mnemonic);
      await saveToVaultInternal(mnemonic);
      toast({ title: "Wallet Imported", description: "Success! Your wallet is now active." });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Import Error", description: e.message });
    }
  }, [loadWalletFromMnemonic, toast, user]);

  const restoreFromCloud = async () => {
    if (!user || !supabase) {
        toast({ variant: "destructive", title: "Restore Failed", description: "Login required to access cloud vault." });
        return;
    }
    
    setIsRefreshing(true);
    try {
      await refreshProfile();
      
      const { data: latestProfile, error: fetchError } = await supabase
        .from('profiles')
        .select('vault_phrase, iv')
        .eq('id', user.id)
        .single();

      if (fetchError || !latestProfile?.vault_phrase || !latestProfile?.iv) {
        throw new Error("No cloud backup found for this account.");
      }

      const token = await getAuthToken();
      if (!token) throw new Error("Unauthorized: Please log in again.");

      const response = await fetch('/api/wallet/decrypt-phrase', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ 
          encrypted: latestProfile.vault_phrase, 
          iv: latestProfile.iv 
        })
      });
      
      const data = await response.json();
      
      if (response.ok && data.phrase) {
        loadWalletFromMnemonic(data.phrase);
        toast({ title: "Cloud Restore Success", description: "Welcome back! Access restored from vault." });
      } else {
        throw new Error(data.message || "Decryption failed on the server.");
      }
    } catch (e: any) {
      console.error("Restore error:", e);
      toast({ variant: "destructive", title: "Restore Failed", description: e.message });
    } finally {
      setIsRefreshing(false);
    }
  };

  const saveToVault = async () => {
    if (!user) return;
    const mnemonic = localStorage.getItem(`wallet_mnemonic_${user.id}`);
    if (mnemonic) await saveToVaultInternal(mnemonic);
    toast({ title: "Vault Synced", description: "Your backup is up to date." });
  };

  const logout = useCallback(() => {
    if (user) {
      localStorage.removeItem(`wallet_mnemonic_${user.id}`);
    }
    setWallets(null);
    setBalances({});
    authSignOut();
  }, [user, authSignOut]);

  const deleteWallet = useCallback(() => {
    if (user) {
      localStorage.removeItem(`wallet_mnemonic_${user.id}`);
    }
    setWallets(null);
    setBalances({});
  }, [user]);

  const fetchBalances = useCallback(async () => {
    if (!wallets || wallets.length === 0 || !viewingNetwork) return;
    
    setIsRefreshing(true);
    setFetchError(null);

    const initialAssets = getInitialAssets(viewingNetwork.chainId);
    const newLoadingState = initialAssets.reduce((acc, asset) => {
      acc[`${viewingNetwork.chainId}:${asset.symbol}`] = true;
      return acc;
    }, {} as Record<string, boolean>);
    setLoadingTokens(prev => ({ ...prev, ...newLoadingState }));

    try {
      const rpcUrl = PUBLIC_RPC_MAP[viewingNetwork.chainId] || viewingNetwork.rpcBase;
      if (!rpcUrl) {
        throw new Error(`RPC not configured for ${viewingNetwork.name}`);
      }

      const provider = new ethers.JsonRpcProvider(rpcUrl);
      
      const balancePromises = initialAssets.map(async (asset) => {
        try {
          if (asset.isNative) {
            const bal = await provider.getBalance(wallets[0].address);
            return { ...asset, balance: ethers.formatEther(bal) };
          } else {
            const abi = ["function balanceOf(address owner) view returns (uint256)", "function decimals() view returns (uint8)"];
            const contract = new ethers.Contract(asset.address, abi, provider);
            const [bal, decimals] = await Promise.all([
              contract.balanceOf(wallets[0].address),
              contract.decimals()
            ]);
            return { ...asset, balance: ethers.formatUnits(bal, decimals) };
          }
        } catch (e) {
          console.warn(`Balance fetch failed for ${asset.symbol} on ${viewingNetwork.name}:`, e);
          return { ...asset, balance: '0' };
        } finally {
          setLoadingTokens(prev => {
            const next = { ...prev };
            delete next[`${viewingNetwork.chainId}:${asset.symbol}`];
            return next;
          });
        }
      });

      const rawBalances = await Promise.all(balancePromises);
      const assetsWithPrices = await fetchAssetPrices(rawBalances);

      setBalances(prev => ({
        ...prev,
        [viewingNetwork.chainId]: assetsWithPrices
      }));
    } catch (e: any) {
      console.error("Fetch balances failed", e);
      setFetchError(e.message || "Could not fetch balances.");
      setLoadingTokens({});
    } finally {
      setIsRefreshing(false);
    }
  }, [wallets, viewingNetwork]);

  useEffect(() => {
    if (isInitialized && wallets && viewingNetwork) {
        fetchBalances();
    }
  }, [isInitialized, wallets, viewingNetwork, fetchBalances]);

  const allChainsMap = useMemo(() => {
    return chainsWithLogos.reduce((acc, chain) => {
      acc[chain.chainId] = chain;
      return acc;
    }, {} as { [key: number]: ChainConfig });
  }, [chainsWithLogos]);

  const assetsForCurrentNetwork = useMemo(() => {
    if (!viewingNetwork) return [];
    const initial = getInitialAssets(viewingNetwork.chainId).map(a => ({ ...a, balance: '0' } as AssetRow));
    const live = balances[viewingNetwork.chainId] || [];
    
    return initial.map(item => {
      const liveItem = live.find(l => l.symbol === item.symbol && l.address === item.address && l.chainId === viewingNetwork.chainId);
      return liveItem || item;
    });
  }, [balances, viewingNetwork]);

  const value: WalletContextType = {
    isInitialized: isInitialized && !authLoading,
    isAssetsLoading: areLogosLoading,
    hasNewNotifications: false,
    viewingNetwork: viewingNetwork || chainsWithLogos[0],
    setNetwork: (net) => {
        setViewingNetwork(net);
        setFetchError(null);
    },
    allAssets: assetsForCurrentNetwork,
    allChains: chainsWithLogos,
    allChainsMap,
    isRefreshing,
    isTokenLoading,
    wallets,
    balances,
    refresh: fetchBalances,
    generateWallet,
    importWallet,
    saveToVault,
    restoreFromCloud,
    logout,
    deleteWallet,
    fetchError,
    getAddressForChain
  };

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (context === undefined) throw new Error('useWallet must be used within a WalletProvider');
  return context;
}
