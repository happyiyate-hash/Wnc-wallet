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
  
  const [allAssetsCache, setAllAssetsCache] = useState<{ [chainId: number]: AssetRow[] }>({});
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  // This effect initializes the asset cache with base assets and logos.
  useEffect(() => {
    if (!areLogosLoading && chainsWithLogos.length > 0) {
      setViewingNetwork(prev => chainsWithLogos.find(c => c.chainId === prev.chainId) || chainsWithLogos[0]);
      
      const initializeAssetCache = async () => {
        const initialCache: { [chainId: number]: AssetRow[] } = {};
        for (const chain of chainsWithLogos) {
            const baseAssets = getInitialAssets(chain.chainId);
            const assetsWithPlaceholders = await Promise.all(baseAssets.map(async (asset) => ({
                ...asset,
                balance: '0',
                fiatValueUsd: 0,
                priceUsd: 0,
                pctChange24h: 0,
                iconUrl: await getTokenLogoUrl(asset.symbol, chain.name),
            })));
            initialCache[chain.chainId] = assetsWithPlaceholders;
        }
        setAllAssetsCache(initialCache);
      };

      initializeAssetCache();
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
    if (!wallets || !wallets.length || !infuraApiKey || !networkToRefresh) {
      return;
    }
    const wallet = wallets[0];
    if (!wallet) return;

    let baseAssets = allAssetsCache[networkToRefresh.chainId] || getInitialAssets(networkToRefresh.chainId);
    
    // Crucial Guard: If there are no assets for this chain, do not proceed.
    if (!baseAssets || baseAssets.length === 0) {
        console.log(`No assets to refresh for network: ${networkToRefresh.name}`);
        return;
    }

    setIsRefreshing(true);
    try {
        // We assume logos are already in the cache from the initial load
        setAllAssetsCache(prev => ({
            ...prev,
            [networkToRefresh.chainId]: baseAssets,
        }));
        
        const adapter = evmAdapterFactory(networkToRefresh, infuraApiKey);
        if (!adapter) {
            console.warn(`No adapter found for network: ${networkToRefresh.name}`);
            setAllAssetsCache(prev => ({ ...prev, [networkToRefresh.chainId]: baseAssets }));
            return;
        }

        const assetsWithPrices = await fetchAssetPrices(baseAssets);
        const assetsWithBalances = await adapter.fetchBalances(wallet.address, assetsWithPrices);
        
        const finalAssets = assetsWithBalances.map(asset => ({
            ...asset,
            fiatValueUsd: (asset.priceUsd ?? 0) * parseFloat(asset.balance),
        }));
        
        setAllAssetsCache(prev => ({
            ...prev,
            [networkToRefresh.chainId]: finalAssets,
        }));

    } catch (error) {
        console.error(`Failed to refresh assets for ${networkToRefresh.name}:`, error);
    } finally {
        setIsRefreshing(false);
    }
  }, [wallets, infuraApiKey, allAssetsCache]);
  

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

  // This is the key change: This useEffect now only triggers a refresh when the network changes.
  // It does NOT depend on allAssetsCache, which prevents the infinite loop.
  useEffect(() => {
    if (isInitialized && wallets && !areLogosLoading && infuraApiKey && viewingNetwork?.chainId) {
      refreshAssets(viewingNetwork);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInitialized, wallets, areLogosLoading, infuraApiKey, viewingNetwork]);


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
    refresh: () => refreshAssets(viewingNetwork),
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
