'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import type { AssetRow, Chain, WalletWithMetadata, UserProfile } from '@/lib/types';
import { getTokenLogoUrl } from '@/lib/getTokenLogo';

interface WalletContextType {
  wallets: WalletWithMetadata[] | null;
  isInitialized: boolean;
  hasNewNotifications: boolean;
  viewingNetwork: Chain;
  allAssets: AssetRow[];
  isRefreshing: boolean;
  refresh: () => void;
  setWallets: (wallets: WalletWithMetadata[] | null) => void;
  profile: UserProfile | null;
}

const mockEthChain: Chain = {
  chainId: 1,
  name: 'Ethereum',
  iconUrl: 'https://picsum.photos/seed/ethchain/32/32',
};

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [wallets, setWallets] = useState<WalletWithMetadata[] | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [hasNewNotifications, setHasNewNotifications] = useState(true);
  const [viewingNetwork, setViewingNetwork] = useState<Chain>(mockEthChain);
  const [allAssets, setAllAssets] = useState<AssetRow[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);


  const refresh = useCallback(() => {
    setIsRefreshing(true);
    
    const fetchAssets = async () => {
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
      ];

      const assetsWithLogos = await Promise.all(
        mockAssets.map(async (asset) => {
          const logoUrl = await getTokenLogoUrl(asset.symbol, viewingNetwork.name);
          return {
            ...asset,
            iconUrl: logoUrl || `https://picsum.photos/seed/${asset.symbol}/40/40`,
          };
        })
      );
      
      setAllAssets(assetsWithLogos);
      setIsRefreshing(false);
    };

    fetchAssets();

  }, [viewingNetwork.name]);

  useEffect(() => {
    // Simulate loading wallet from storage
    const storedWallet = { address: '0x1234567890123456789012345678901234567890' };
    setWallets([storedWallet]);
    setProfile({ username: 'TestUser' });
    setIsInitialized(true);
  }, []);

  useEffect(() => {
    if (wallets) {
        refresh();
    }
  }, [wallets, refresh]);

  const value = {
    wallets,
    setWallets,
    isInitialized,
    hasNewNotifications,
    viewingNetwork,
    allAssets,
    isRefreshing,
    refresh,
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
