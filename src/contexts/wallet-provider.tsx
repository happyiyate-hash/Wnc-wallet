'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback, useMemo } from 'react';
import type { AssetRow, ChainConfig, WalletWithMetadata, UserProfile } from '@/lib/types';
import { fetchAssetPrices } from '@/lib/coingecko';
import { useNetworkLogos } from '@/hooks/useNetworkLogos';
import { mnemonicToSeedSync } from 'bip39';
import { HDNodeWallet } from 'ethers';
import { getInitialAssets } from '@/lib/wallets/balances';
import { evmAdapterFactory } from '@/lib/wallets/adapters/evm';
import { getTokenLogoUrl } from '@/lib/getTokenLogo';

interface WalletContextType {
  wallets: WalletWithMetadata[] | null;
  isInitialized: boolean;
  hasNewNotifications: boolean;
  viewingNetwork: ChainConfig;
  setNetwork: (network: ChainConfig) => void;
  allAssets: AssetRow[]; // This will be the filtered list for the current network
  allChains: ChainConfig[];
  allChainsMap: { [key: string]: ChainConfig };
  isRefreshing: boolean;
  refresh: () => void;
  createWalletWithMnemonic: (mnemonic: string) => void;
  importWalletWithMnemonic: (mnemonic: string) => void;
  profile: UserProfile | null;
  user: any;
  infuraApiKey: string | null;
  setInfuraApiKey: (key: string | null) => void;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

const deriveWalletFromMnemonic = (mnemonic: string): WalletWithMetadata => {
    const seed = mnemonicToSeedSync(mnemonic);
    const hdNode = HDNodeWallet.fromSeed(seed);
    const wallet = hdNode.derivePath("m/44'/60'/0'/0/0");
    return {
        address: wallet.address,
        privateKey: wallet.privateKey
    };
};

export function WalletProvider({ children }: { children: ReactNode }) {
  const [wallets, setWallets] = useState<WalletWithMetadata[] | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [hasNewNotifications, setHasNewNotifications] = useState(true);
  const [mnemonic, setMnemonic] = useState<string | null>(null);
  const [infuraApiKey, setInfuraApiKeyInternal] = useState<string | null>(null);

  const { chainsWithLogos, areLogosLoading } = useNetworkLogos();
  const [viewingNetwork, setViewingNetwork] = useState<ChainConfig>(chainsWithLogos[0]);
  
  // This state now holds assets for ALL chains, keyed by chainId
  const [allAssetsCache, setAllAssetsCache] = useState<{ [chainId: number]: AssetRow[] }>({});
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    if (!areLogosLoading && chainsWithLogos.length > 0) {
      setViewingNetwork(prev => chainsWithLogos.find(c => c.chainId === prev.chainId) || chainsWithLogos[0]);
      
      // Pre-populate the cache with the structure of assets for each chain
      const initialCache: { [chainId: number]: AssetRow[] } = {};
      for (const chain of chainsWithLogos) {
          initialCache[chain.chainId] = getInitialAssets(chain.chainId).map(asset => ({...asset, balance: '0'}));
      }
      setAllAssetsCache(initialCache);
    }
  }, [chainsWithLogos, areLogosLoading]);

  const allChainsMap = useMemo(() => {
    return chainsWithLogos.reduce((acc, chain) => {
      acc[chain.chainId] = chain;
      return acc;
    }, {} as { [key: number]: ChainConfig });
  }, [chainsWithLogos]);

  const setNetwork = (network: ChainConfig) => {
    setViewingNetwork(network);
  };
  
  const setInfuraApiKey = (key: string | null) => {
    if (key) {
        localStorage.setItem('infuraApiKey', key);
    } else {
        localStorage.removeItem('infuraApiKey');
    }
    setInfuraApiKeyInternal(key);
  };

  const createWalletWithMnemonic = (mnemonic: string) => {
      localStorage.setItem('walletMnemonic', mnemonic); 
      setMnemonic(mnemonic);
      const newWallet = deriveWalletFromMnemonic(mnemonic);
      setWallets([newWallet]);
      setProfile({ username: 'NewUser' });
  };
  
  const importWalletWithMnemonic = (mnemonic: string) => {
      createWalletWithMnemonic(mnemonic);
  };

  const refreshAssets = useCallback(async (networkToRefresh: ChainConfig) => {
    if (!wallets || !wallets.length || !infuraApiKey) {
      return;
    }
    const wallet = wallets[0];
    if (!wallet) return;

    setIsRefreshing(true);
    try {
        const baseAssets = getInitialAssets(networkToRefresh.chainId);
        if (baseAssets.length === 0) {
            setAllAssetsCache(prev => ({...prev, [networkToRefresh.chainId]: []}));
            return;
        };

        const adapter = evmAdapterFactory(networkToRefresh, infuraApiKey);
        if (!adapter) {
            console.warn(`No adapter found for network: ${networkToRefresh.name}`);
            setAllAssetsCache(prev => ({...prev, [networkToRefresh.chainId]: []}));
            return;
        }

        const assetsWithPrices = await fetchAssetPrices(baseAssets);
        const assetsWithBalances = await adapter.fetchBalances(wallet.address, assetsWithPrices);
        
        const assetsWithLogos = await Promise.all(assetsWithBalances.map(async (asset) => {
            const iconUrl = await getTokenLogoUrl(asset.symbol, networkToRefresh.name);
            return { 
                ...asset, 
                iconUrl,
                fiatValueUsd: (asset.priceUsd ?? 0) * parseFloat(asset.balance),
            };
        }));
        
        setAllAssetsCache(prev => ({
            ...prev,
            [networkToRefresh.chainId]: assetsWithLogos as AssetRow[],
        }));

    } catch (error) {
        console.error(`Failed to refresh assets for ${networkToRefresh.name}:`, error);
        // Don't wipe out assets on error, keep stale data
    } finally {
        setIsRefreshing(false);
    }
  }, [wallets, infuraApiKey]);
  

  useEffect(() => {
    try {
        const savedMnemonic = localStorage.getItem('walletMnemonic');
        if (savedMnemonic) {
            setMnemonic(savedMnemonic);
            const mainWallet = deriveWalletFromMnemonic(savedMnemonic);
            setWallets([mainWallet]);
            setProfile({ username: 'ReturningUser' });
        }
        const savedApiKey = localStorage.getItem('infuraApiKey');
        if (savedApiKey) {
          setInfuraApiKeyInternal(savedApiKey);
        }
    } catch (error) {
        console.error("Could not access localStorage or derive wallet:", error);
    }
    setIsInitialized(true);
  }, []);

  // Effect to fetch data for the current network when it changes or on initial load
  useEffect(() => {
    if (isInitialized && wallets && !areLogosLoading && infuraApiKey && viewingNetwork) {
      refreshAssets(viewingNetwork);
    }
    // Intentionally not including refreshAssets in dependencies to avoid re-triggering
  }, [isInitialized, wallets, areLogosLoading, infuraApiKey, viewingNetwork]);


  // The `allAssets` exposed to the context is now just the filtered slice for the current network
  const assetsForCurrentNetwork = allAssetsCache[viewingNetwork?.chainId] || [];

  const value: WalletContextType = {
    wallets,
    isInitialized,
    hasNewNotifications,
    viewingNetwork,
    setNetwork,
    allAssets: assetsForCurrentNetwork,
    allChains: chainsWithLogos,
    allChainsMap,
    isRefreshing,
    refresh: () => refreshAssets(viewingNetwork), // Refresh button refreshes current network
    createWalletWithMnemonic,
    importWalletWithMnemonic,
    profile,
    user: profile,
    infuraApiKey,
    setInfuraApiKey,
  };

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}
