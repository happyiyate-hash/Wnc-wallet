'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import type { AssetRow, Chain, WalletWithMetadata } from '@/lib/types';

interface WalletContextType {
  wallets: WalletWithMetadata[] | null;
  isInitialized: boolean;
  hasNewNotifications: boolean;
  viewingNetwork: Chain;
  allAssets: AssetRow[];
  isRefreshing: boolean;
  refresh: () => void;
  setWallets: (wallets: WalletWithMetadata[] | null) => void;
}

const mockEthChain: Chain = {
  chainId: 1,
  name: 'Ethereum',
  iconUrl: '/eth.png',
};

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [wallets, setWallets] = useState<WalletWithMetadata[] | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [hasNewNotifications, setHasNewNotifications] = useState(false);
  const [viewingNetwork, setViewingNetwork] = useState<Chain>(mockEthChain);
  const [allAssets, setAllAssets] = useState<AssetRow[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refresh = useCallback(() => {
    setIsRefreshing(true);
    // Simulate fetching assets
    setTimeout(() => {
      const mockAssets: AssetRow[] = [
        {
          chainId: 1,
          address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
          symbol: 'ETH',
          name: 'Ethereum',
          balance: '10.5',
          fiatValueUsd: 35000,
          priceUsd: 3500,
          pctChange24h: 2.5,
          iconUrl: 'https://picsum.photos/seed/eth/40/40',
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
          iconUrl: 'https://picsum.photos/seed/uni/40/40',
        },
      ];
      setAllAssets(mockAssets);
      setIsRefreshing(false);
    }, 1500);
  }, []);

  useEffect(() => {
    setIsInitialized(true);
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
