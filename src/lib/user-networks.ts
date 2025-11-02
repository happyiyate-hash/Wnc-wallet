import type { ChainConfig } from './types';

// Mock data for chain configurations
export const ALL_CHAINS_LIST: ChainConfig[] = [
  {
    chainId: 1,
    name: 'Ethereum',
    currencySymbol: 'ETH',
    themeColor: '#627EEA',
    iconUrl: '', // Will be fetched dynamically
    coingeckoId: 'ethereum',
  },
  {
    chainId: 137,
    name: 'Polygon',
    currencySymbol: 'MATIC',
    themeColor: '#8247E5',
    iconUrl: '',
    coingeckoId: 'matic-network',
  },
  {
    chainId: 10,
    name: 'Optimism',
    currencySymbol: 'ETH',
    themeColor: '#FF0420',
    iconUrl: '',
    coingeckoId: 'optimism',
  },
  {
    chainId: 42161,
    name: 'Arbitrum One',
    currencySymbol: 'ETH',
    themeColor: '#28A0F0',
    iconUrl: '',
    coingeckoId: 'arbitrum',
  },
  {
    chainId: 8453,
    name: 'Base',
    currencySymbol: 'ETH',
    themeColor: '#0052FF',
    iconUrl: '',
    coingeckoId: 'base',
  },
];
