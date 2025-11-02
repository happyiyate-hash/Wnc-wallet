import type { ChainConfig } from './types';

// Mock data for chain configurations
export const ALL_CHAINS_LIST: ChainConfig[] = [
  {
    chainId: 1,
    name: 'Ethereum',
    currencySymbol: 'ETH',
    themeColor: '#627EEA',
    iconUrl: '', // Will be fetched dynamically
  },
  {
    chainId: 137,
    name: 'Polygon',
    currencySymbol: 'MATIC',
    themeColor: '#8247E5',
    iconUrl: '',
  },
  {
    chainId: 10,
    name: 'Optimism',
    currencySymbol: 'ETH',
    themeColor: '#FF0420',
    iconUrl: '',
  },
  {
    chainId: 42161,
    name: 'Arbitrum One',
    currencySymbol: 'ETH',
    themeColor: '#28A0F0',
    iconUrl: '',
  },
  {
    chainId: 8453,
    name: 'Base',
    currencySymbol: 'ETH',
    themeColor: '#0052FF',
    iconUrl: '',
  },
];
