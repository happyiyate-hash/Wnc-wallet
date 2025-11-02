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

const getAdapter: AdapterFactory = (chain, apiKey) => {
    return evmAdapterFactory(chain, apiKey);
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [wallets, setWallets] = useState<WalletWithMetadata[] | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [hasNewNotifications, setHasNewNotifications] = useState(true);
  const [mnemonic, setMnemonic] = useState<string | null>(null);
  const [infuraApiKey, setInfuraApiKeyInternal] = useState<string | null>(null);

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

  const refreshAssets = useCallback(async () => {
    if (!wallets || !wallets.length || !infuraApiKey) {
      console.log("Wallet or API key not ready for refresh.");
      setAllAssets([]);
      return;
    }
    const wallet = wallets[0];
    if (!wallet) return;

    const baseAssets = getInitialAssets(viewingNetwork.chainId);
    if (baseAssets.length === 0) {
        setAllAssets([]);
        return;
    }
  
    const adapter = getAdapter(viewingNetwork, infuraApiKey);
    if (!adapter) {
      console.warn(`No adapter found for network: ${viewingNetwork.name}`);
      setAllAssets([]);
      return;
    }
  
    setIsRefreshing(true);
    try {
        const assetsWithBalances = await adapter.fetchBalances(wallet.address, baseAssets);
        const assetsToPrice = assetsWithBalances.filter(a => parseFloat(a.balance) > 0);
        
        let assetsWithPrices = assetsWithBalances;
        if (assetsToPrice.length > 0) {
          assetsWithPrices = await fetchAssetPrices(assetsToPrice) as AssetRow[];
        }

        const finalAssets = assetsWithPrices.map((asset) => {
            const pricedAsset = assetsWithPrices.find(p => p.coingeckoId === asset.coingeckoId) || asset;
            const networkInfo = allChainsMap[asset.chainId];
            return {
                ...pricedAsset,
                iconUrl: asset.iconUrl,
                ...(!asset.iconUrl && networkInfo && { iconUrl: networkInfo.iconUrl }),
            };
        });
        setAllAssets(finalAssets as AssetRow[]);
  
    } catch (error) {
        console.error("Failed to refresh assets:", error);
    } finally {
        setIsRefreshing(false);
    }
  }, [wallets, viewingNetwork, allChainsMap, infuraApiKey]);
  

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

  useEffect(() => {
    if (isInitialized && wallets && !areLogosLoading && viewingNetwork && infuraApiKey) {
      refreshAssets();
    }
  }, [isInitialized, wallets, viewingNetwork, areLogosLoading, infuraApiKey, refreshAssets]);

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
