'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback, useMemo } from 'react';
import type { AssetRow, ChainConfig, WalletWithMetadata, UserProfile } from '@/lib/types';
import { getTokenLogoUrl } from '@/lib/getTokenLogo';
import { ALL_CHAINS_LIST } from '@/lib/user-networks';
import { fetchAssetPrices } from '@/lib/coingecko';

// A mock list of user assets per chain. In a real app, this would come from a wallet connection.
const USER_ASSETS_BY_CHAIN: { [key: number]: Omit<AssetRow, 'priceUsd' | 'fiatValueUsd' | 'pctChange24h' | 'iconUrl'>[] } = {
  1: [ // Ethereum
    { chainId: 1, address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', name: 'Ethereum', symbol: 'ETH', balance: '10.5', isNative: true, coingeckoId: 'ethereum' },
    { chainId: 1, address: '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984', name: 'Uniswap', symbol: 'UNI', balance: '500', coingeckoId: 'uniswap' },
    { chainId: 1, address: '0xdac17f958d2ee523a2206206994597c13d831ec7', name: 'Tether', symbol: 'USDT', balance: '10000', coingeckoId: 'tether' },
  ],
  137: [ // Polygon
    { chainId: 137, address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', name: 'Matic', symbol: 'MATIC', balance: '2500', isNative: true, coingeckoId: 'matic-network' },
    { chainId: 137, address: '0x7ceb23fd6bc0add59e62ac25578270cff1b9f619', name: 'Wrapped Ether', symbol: 'WETH', balance: '5', coingeckoId: 'weth' },
  ],
  10: [ // Optimism
    { chainId: 10, address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', name: 'Ethereum', symbol: 'ETH', balance: '8', isNative: true, coingeckoId: 'ethereum' },
    { chainId: 10, address: '0x4200000000000000000000000000000000000042', name: 'Optimism', symbol: 'OP', balance: '1200', coingeckoId: 'optimism' },
  ],
  42161: [ // Arbitrum
    { chainId: 42161, address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', name: 'Ethereum', symbol: 'ETH', balance: '12', isNative: true, coingeckoId: 'ethereum' },
    { chainId: 42161, address: '0x912ce59144191c1204e64559fe8253a0e49e6548', name: 'Arbitrum', symbol: 'ARB', balance: '3000', coingeckoId: 'arbitrum' },
  ],
  8453: [ // Base
    { chainId: 8453, address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', name: 'Ethereum', symbol: 'ETH', balance: '15', isNative: true, coingeckoId: 'base' },
  ],
}

interface WalletContextType {
  wallets: WalletWithMetadata[] | null;
  isInitialized: boolean;
  hasNewNotifications: boolean;
  viewingNetwork: ChainConfig;
  setNetwork: (network: ChainConfig) => void;
  allAssets: AssetRow[];
  allChainsMap: { [key: number]: ChainConfig };
  isRefreshing: boolean;
  refresh: () => void;
  setWallets: (wallets: WalletWithMetadata[] | null) => void;
  profile: UserProfile | null;
  user: any; // Keeping for compatibility with TokenDetailCard
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [wallets, setWallets] = useState<WalletWithMetadata[] | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [hasNewNotifications, setHasNewNotifications] = useState(true);
  const [viewingNetwork, setViewingNetwork] = useState<ChainConfig>(ALL_CHAINS_LIST[0]);
  const [allAssets, setAllAssets] = useState<AssetRow[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  const allChainsMap = useMemo(() => {
    return ALL_CHAINS_LIST.reduce((acc, chain) => {
      acc[chain.chainId] = chain;
      return acc;
    }, {} as { [key: number]: ChainConfig });
  }, []);

  const setNetwork = (network: ChainConfig) => {
    setViewingNetwork(network);
    // Clear assets for the old network immediately for a snappier feel
    setAllAssets([]);
  };

  const refreshAssets = useCallback(async (network: ChainConfig) => {
    if (isRefreshing) return;
    setIsRefreshing(true);

    const baseAssetsForChain = USER_ASSETS_BY_CHAIN[network.chainId] || [];
    if (baseAssetsForChain.length === 0) {
      setAllAssets([]);
      setIsRefreshing(false);
      return;
    }
    
    // Set skeleton assets immediately
    const skeletonAssets: AssetRow[] = baseAssetsForChain.map(asset => ({
        ...asset,
        priceUsd: 0,
        fiatValueUsd: 0,
        pctChange24h: 0,
        iconUrl: '',
    }));
    setAllAssets(skeletonAssets);
    
    try {
      // Use the new centralized service to fetch prices
      const assetsWithPrices = await fetchAssetPrices(baseAssetsForChain);
      
      // Fetch logos and combine data
      const assetsWithData = await Promise.all(
        assetsWithPrices.map(async (asset) => {
          const iconUrl = await getTokenLogoUrl(asset.symbol, network.name);
          return {
            ...asset,
            iconUrl: iconUrl || undefined,
          };
        })
      );
      
      setAllAssets(assetsWithData);

    } catch (error) {
      console.error("Failed to fetch asset prices:", error);
      // Even if fetching fails, we keep the skeleton with balances
      const assetsWithBalances = baseAssetsForChain.map(asset => ({...asset}));
      setAllAssets(assetsWithBalances as AssetRow[]);
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing]);


  useEffect(() => {
    // Simulate loading wallet from storage
    const storedWallet = { address: '0x1234567890123456789012345678901234567890' };
    setWallets([storedWallet]);
    setProfile({ username: 'TestUser' });
    setIsInitialized(true);
  }, []);

  useEffect(() => {
    if (isInitialized && wallets) {
      refreshAssets(viewingNetwork);
    }
  // This dependency array is correct. We only want to re-run when these specific items change.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInitialized, wallets, viewingNetwork.chainId]);

  const value: WalletContextType = {
    wallets,
    setWallets,
    isInitialized,
    hasNewNotifications,
    viewingNetwork,
    setNetwork,
    allAssets,
    allChainsMap,
    isRefreshing,
    refresh: () => refreshAssets(viewingNetwork),
    profile,
    user: profile,
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
