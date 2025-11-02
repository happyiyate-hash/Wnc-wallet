'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback, useMemo } from 'react';
import type { AssetRow, ChainConfig, WalletWithMetadata, UserProfile, IWalletAdapter, AdapterFactory } from '@/lib/types';
import { fetchAssetPrices } from '@/lib/coingecko';
import { useNetworkLogos } from '@/hooks/useNetworkLogos';
import { mnemonicToSeedSync } from 'bip39';
import { HDNodeWallet } from 'ethers';
import { getInitialAssets } from '@/lib/wallets/balances';
import { evmAdapterFactory } from '@/lib/wallets/adapters/evm';

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

const getAdapter: AdapterFactory = (chain) => {
    // For now, we only support EVM. In the future, we can add more chain types.
    // e.g., if (isSolana(chain)) return solanaAdapterFactory(chain);
    return evmAdapterFactory(chain);
}

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
      // NOTE: In a real app, mnemonic should be encrypted with a user password.
      // Storing it in plaintext in localStorage is insecure and for demo purposes only.
      const newWallet = deriveWalletFromMnemonic(mnemonic);
      localStorage.setItem('walletMnemonic', mnemonic); 
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
      if (!wallet) return;

      const adapter = getAdapter(viewingNetwork);
      if (!adapter) {
        console.warn(`No adapter found for network: ${viewingNetwork.name}`);
        setAllAssets([]);
        return;
      }
  
      setIsRefreshing(true);
      try {
          // 1. Get the initial list of assets for the current chain
          const baseAssets = getInitialAssets(viewingNetwork.chainId);
          if (baseAssets.length === 0) {
              setAllAssets([]);
              return;
          }

          // 2. Fetch live balances using the appropriate adapter
          const assetsWithBalances = await adapter.fetchBalances(wallet.address, baseAssets, viewingNetwork);
          
          // 3. Fetch prices for assets that have a balance
          const assetsToPrice = assetsWithBalances.filter(a => parseFloat(a.balance) > 0);
          const assetsWithPrices = await fetchAssetPrices(assetsToPrice);
  
          // 4. Combine data and enrich with logos
          const finalAssets = assetsWithBalances.map((asset) => {
              const pricedAsset = assetsWithPrices.find(p => p.coingeckoId === asset.coingeckoId) || asset;
              const networkInfo = allChainsMap[asset.chainId];
              return {
                  ...pricedAsset,
                  iconUrl: asset.iconUrl,
                  // If token icon is missing, fall back to network icon
                  ...( !asset.iconUrl && { iconUrl: networkInfo?.iconUrl })
              };
          });
          setAllAssets(finalAssets);
  
      } catch (error) {
          console.error("Failed to refresh assets:", error);
      } finally {
          setIsRefreshing(false);
      }
  }, [wallets, viewingNetwork, allChainsMap]);
  

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
    if (isInitialized && wallets && !areLogosLoading && viewingNetwork) {
      refreshAssets();
    }
  }, [isInitialized, wallets, viewingNetwork, areLogosLoading, refreshAssets]);

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
