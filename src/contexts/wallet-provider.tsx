'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback, useMemo } from 'react';
import type { AssetRow, ChainConfig, WalletWithMetadata, UserProfile } from '@/lib/types';
import { getTokenLogoUrl } from '@/lib/getTokenLogo';
import { fetchAssetPrices } from '@/lib/coingecko';
import { useNetworkLogos } from '@/hooks/useNetworkLogos';
import { mnemonicToSeedSync } from 'bip39';
import { HDNodeWallet, Wallet } from 'ethers';
import { getInitialAssets, fetchBalances } from '@/lib/wallets/balances';

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
  createWalletWithMnemonic: (mnemonic: string) => void;
  importWalletWithMnemonic: (mnemonic: string) => void;
  profile: UserProfile | null;
  user: any; 
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

  const { chainsWithLogos, areLogosLoading } = useNetworkLogos();
  const [viewingNetwork, setViewingNetwork] = useState<ChainConfig>(chainsWithLogos[0]);
  
  const [allAssets, setAllAssets] = useState<AssetRow[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);

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
    setAllAssets([]); 
  };

  const createWalletWithMnemonic = (mnemonic: string) => {
      const newWallet = deriveWalletFromMnemonic(mnemonic);
      localStorage.setItem('walletMnemonic', mnemonic); // WARNING: Insecure, for demo purposes only
      setMnemonic(mnemonic);
      setWallets([newWallet]);
      setProfile({ username: 'NewUser' });
  };
  
  const importWalletWithMnemonic = (mnemonic: string) => {
      // Logic is the same as creating for this basic implementation
      createWalletWithMnemonic(mnemonic);
  };

  const refreshAssets = useCallback(async () => {
      const wallet = wallets?.[0];
      if (isRefreshing || !wallet) return;
  
      setIsRefreshing(true);
      try {
          // 1. Get the initial list of assets for the current chain
          const baseAssets = getInitialAssets(viewingNetwork.chainId);
          if (baseAssets.length === 0) {
              setAllAssets([]);
              return;
          }

          // 2. Fetch live balances for these assets
          const assetsWithBalances = await fetchBalances(wallet.address, baseAssets, viewingNetwork);
          
          // 3. Fetch prices for assets that have a balance
          const assetsToPrice = assetsWithBalances.filter(a => parseFloat(a.balance) > 0);
          const assetsWithPrices = await fetchAssetPrices(assetsToPrice);
  
          // 4. Fetch logos for all assets (even those with no balance)
          const assetsWithLogos = await Promise.all(
              assetsWithBalances.map(async (asset) => {
                  const pricedAsset = assetsWithPrices.find(p => p.address === asset.address) || asset;
                  const iconUrl = await getTokenLogoUrl(asset.symbol, viewingNetwork.name);
                  return {
                      ...pricedAsset,
                      iconUrl: iconUrl,
                  };
              })
          );
          setAllAssets(assetsWithLogos);
  
      } catch (error) {
          console.error("Failed to refresh assets:", error);
          // Optionally set assets to a state indicating an error
      } finally {
          setIsRefreshing(false);
      }
  }, [isRefreshing, viewingNetwork, wallets]);
  

  useEffect(() => {
    try {
        const savedMnemonic = localStorage.getItem('walletMnemonic');
        if (savedMnemonic) {
            setMnemonic(savedMnemonic);
            const mainWallet = deriveWalletFromMnemonic(savedMnemonic);
            setWallets([mainWallet]);
            setProfile({ username: 'ReturningUser' });
        }
    } catch (error) {
        console.error("Could not access localStorage or derive wallet:", error);
    }
    setIsInitialized(true);
  }, []);

  useEffect(() => {
    if (isInitialized && wallets && !areLogosLoading) {
      refreshAssets();
    }
  }, [isInitialized, wallets, viewingNetwork.chainId, areLogosLoading, refreshAssets]);

  const value: WalletContextType = {
    wallets,
    isInitialized,
    hasNewNotifications,
    viewingNetwork,
    setNetwork,
    allAssets,
    allChains: chainsWithLogos,
    allChainsMap,
    isRefreshing,
    refresh: refreshAssets,
    createWalletWithMnemonic,
    importWalletWithMnemonic,
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
