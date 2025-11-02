'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback, useMemo } from 'react';
import type { AssetRow, ChainConfig, WalletWithMetadata, UserProfile } from '@/lib/types';
import { getTokenLogoUrl } from '@/lib/getTokenLogo';
import { fetchAssetPrices } from '@/lib/coingecko';
import { useNetworkLogos } from '@/hooks/useNetworkLogos';

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
    { chainId: 8453, address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', name: 'Ethereum', symbol: 'ETH', balance: '15', isNative: true, coingeckoId: 'ethereum' }, // Note: CoinGecko ID for ETH on Base might need adjustment
  ],
}

interface WalletContextType {
  wallets: WalletWithMetadata[] | null;
  isInitialized: boolean;
  hasNewNotifications: boolean;
  viewingNetwork: ChainConfig;
  setNetwork: (network: ChainConfig) => void;
  allAssets: AssetRow[];
  allChains: ChainConfig[];
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

  // This state will now hold the chains with their fetched logo URLs
  const { chainsWithLogos, areLogosLoading } = useNetworkLogos();

  // The viewing network is derived from the chainsWithLogos, ensuring it has the logo URL.
  const [viewingNetwork, setViewingNetwork] = useState<ChainConfig>(chainsWithLogos[0]);
  
  const [allAssets, setAllAssets] = useState<AssetRow[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  // Update the viewingNetwork state when chainsWithLogos is populated
  useEffect(() => {
    if (!areLogosLoading && chainsWithLogos.length > 0) {
      setViewingNetwork(prev => chainsWithLogos.find(c => c.chainId === prev.chainId) || chainsWithLogos[0]);
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
    setAllAssets([]); // Clear assets immediately for a snappier feel
  };

  const refreshAssets = useCallback(async () => {
    if (isRefreshing) return;

    const baseAssetsForChain = USER_ASSETS_BY_CHAIN[viewingNetwork.chainId] || [];
    if (baseAssetsForChain.length === 0) {
        setAllAssets([]);
        return;
    }

    setIsRefreshing(true);
    
    try {
      const assetsWithPrices = await fetchAssetPrices(baseAssetsForChain);
      
      const assetsWithData = await Promise.all(
        assetsWithPrices.map(async (asset) => {
          const iconUrl = await getTokenLogoUrl(asset.symbol, viewingNetwork.name);
          return {
            ...asset,
            iconUrl: iconUrl,
          };
        })
      );
      
      setAllAssets(assetsWithData);

    } catch (error) {
      console.error("Failed to fetch asset prices:", error);
      const assetsWithBalancesAndLogos = await Promise.all(
        baseAssetsForChain.map(async (asset) => {
            const iconUrl = await getTokenLogoUrl(asset.symbol, viewingNetwork.name);
            return {
                ...asset,
                priceUsd: 0,
                fiatValueUsd: 0,
                pctChange24h: 0,
                iconUrl: iconUrl,
            } as AssetRow;
        })
      );
      setAllAssets(assetsWithBalancesAndLogos);
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing, viewingNetwork]);


  useEffect(() => {
    const storedWallet = { address: '0x1234567890123456789012345678901234567890' };
    setWallets([storedWallet]);
    setProfile({ username: 'TestUser' });
    setIsInitialized(true);
  }, []);

  useEffect(() => {
    if (isInitialized && wallets && !areLogosLoading) {
      refreshAssets();
    }
  }, [isInitialized, wallets, viewingNetwork.chainId, areLogosLoading, refreshAssets]);

  const value: WalletContextType = {
    wallets,
    setWallets,
    isInitialized,
    hasNewNotifications,
    viewingNetwork,
    setNetwork,
    allAssets,
    allChains: chainsWithLogos,
    allChainsMap,
    isRefreshing,
    refresh: refreshAssets,
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
