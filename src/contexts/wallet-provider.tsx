'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import type { AssetRow, ChainConfig, WalletWithMetadata, UserProfile } from '@/lib/types';
import { getTokenLogoUrl } from '@/lib/getTokenLogo';
import { ALL_CHAINS_LIST } from '@/lib/user-networks';

interface WalletContextType {
  wallets: WalletWithMetadata[] | null;
  isInitialized: boolean;
  hasNewNotifications: boolean;
  viewingNetwork: ChainConfig;
  setNetwork: (network: ChainConfig) => void;
  allAssets: AssetRow[];
  isRefreshing: boolean;
  refresh: () => void;
  setWallets: (wallets: WalletWithMetadata[] | null) => void;
  profile: UserProfile | null;
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

  const setNetwork = (network: ChainConfig) => {
    setViewingNetwork(network);
  };

  const refreshAssets = useCallback(async (network: ChainConfig) => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    
    // Simulate fetching assets
    const mockAssets: Omit<AssetRow, 'iconUrl'>[] = [
      {
        chainId: 1,
        address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
        symbol: 'ETH',
        name: 'Ethereum',
        balance: '10.5',
        fiatValueUsd: 35000,
        priceUsd: 3500,
        pctChange24h: 2.5,
      },
      {
        chainId: 1,
        address: '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984',
        symbol: 'UNI',
        name: 'Uniswap',
        balance: '500',
        fiatValueUsd: 5000,
        priceUsd: 10,
        pctChange24h: -1.2,
      },
      {
        chainId: 1,
        address: '0xNotARealToken',
        symbol: 'XYZ',
        name: 'Imaginary Token',
        balance: '1000',
        fiatValueUsd: 100,
        priceUsd: 0.1,
        pctChange24h: 5.5,
      }
    ];

    const assetsWithLogos = await Promise.all(
      mockAssets.map(async (asset) => {
        let logoUrl = await getTokenLogoUrl(asset.symbol, network.name);
        // Fallback to network logo if token logo is not found
        if (!logoUrl) {
            logoUrl = network.iconUrl || `https://picsum.photos/seed/${asset.symbol}/32/32`;
        }
        return {
          ...asset,
          iconUrl: logoUrl,
        };
      })
    );
    
    setAllAssets(assetsWithLogos);
    setIsRefreshing(false);

  }, [isRefreshing]);

  const refreshNetworkLogo = useCallback(async (network: ChainConfig) => {
    const networkLogoUrl = await getTokenLogoUrl(network.currencySymbol, network.name);
    setViewingNetwork(currentNetwork => {
        if (currentNetwork.chainId === network.chainId) {
            return { ...currentNetwork, iconUrl: networkLogoUrl || currentNetwork.iconUrl };
        }
        return currentNetwork;
    });
  }, []);

  useEffect(() => {
    // Simulate loading wallet from storage
    const storedWallet = { address: '0x1234567890123456789012345678901234567890' };
    setWallets([storedWallet]);
    setProfile({ username: 'TestUser' });
    setIsInitialized(true);
  }, []);

  useEffect(() => {
    if (wallets && viewingNetwork) {
        refreshNetworkLogo(viewingNetwork);
        refreshAssets(viewingNetwork);
    }
  }, [wallets, viewingNetwork.chainId]);

  const value = {
    wallets,
    setWallets,
    isInitialized,
    hasNewNotifications,
    viewingNetwork,
    setNetwork,
    allAssets,
    isRefreshing,
    refresh: () => refreshAssets(viewingNetwork),
    profile
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
