import type { AssetRow } from '@/lib/types';

/**
 * MOCK_USER_ASSETS
 * Strictly categorized by chainId to prevent cross-chain asset pollution.
 * Every entry must have a coingeckoId for accurate USD valuation.
 */
const MOCK_USER_ASSETS: { [key: number]: Omit<AssetRow, 'balance' | 'priceUsd' | 'fiatValueUsd' | 'pctChange24h' | 'iconUrl'>[] } = {
  1: [ // Ethereum Mainnet
    { chainId: 1, address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', name: 'Ethereum', symbol: 'ETH', isNative: true, coingeckoId: 'ethereum' },
    { chainId: 1, address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', name: 'USDC', symbol: 'USDC', coingeckoId: 'usd-coin' },
    { chainId: 1, address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', name: 'Tether', symbol: 'USDT', coingeckoId: 'tether' },
  ],
  137: [ // Polygon
    { chainId: 137, address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', name: 'Polygon Ecosystem Token', symbol: 'POL', isNative: true, coingeckoId: 'polygon-ecosystem-token' },
    { chainId: 137, address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', name: 'USDC', symbol: 'USDC', coingeckoId: 'usd-coin' },
  ],
  10: [ // Optimism
    { chainId: 10, address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', name: 'Optimism ETH', symbol: 'ETH', isNative: true, coingeckoId: 'ethereum' },
    { chainId: 10, address: '0x4200000000000000000000000000000000000042', name: 'Optimism', symbol: 'OP', coingeckoId: 'optimism' },
  ],
  42161: [ // Arbitrum
    { chainId: 42161, address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', name: 'Arbitrum ETH', symbol: 'ETH', isNative: true, coingeckoId: 'ethereum' },
    { chainId: 42161, address: '0x912ce59144191c1204e64559fe8253a0e49e6548', name: 'Arbitrum', symbol: 'ARB', coingeckoId: 'arbitrum' },
  ],
  8453: [ // Base
    { chainId: 8453, address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', name: 'Base ETH', symbol: 'ETH', isNative: true, coingeckoId: 'ethereum' },
    { chainId: 8453, address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', name: 'USDC', symbol: 'USDC', coingeckoId: 'usd-coin' },
  ],
  56: [ // BSC
    { chainId: 56, address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', name: 'BNB', symbol: 'BNB', isNative: true, coingeckoId: 'binancecoin' },
  ],
  43114: [ // Avalanche
    { chainId: 43114, address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', name: 'Avalanche', symbol: 'AVAX', isNative: true, coingeckoId: 'avalanche-2' },
  ],
  59144: [ // Linea
    { chainId: 59144, address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', name: 'Linea ETH', symbol: 'ETH', isNative: true, coingeckoId: 'ethereum' },
  ],
  81457: [ // Blast
    { chainId: 81457, address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', name: 'Blast ETH', symbol: 'ETH', isNative: true, coingeckoId: 'ethereum' },
  ],
  324: [ // ZKsync
    { chainId: 324, address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', name: 'ZKsync ETH', symbol: 'ETH', isNative: true, coingeckoId: 'ethereum' },
  ],
  534352: [ // Scroll
    { chainId: 534352, address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', name: 'Scroll ETH', symbol: 'ETH', isNative: true, coingeckoId: 'ethereum' },
  ],
};

// Helper to get the initial list of assets for a chain
export function getInitialAssets(chainId: number): Omit<AssetRow, 'balance' | 'priceUsd' | 'fiatValueUsd' | 'pctChange24h' | 'iconUrl'>[] {
    return MOCK_USER_ASSETS[chainId] || [];
}
