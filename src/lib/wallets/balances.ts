import type { AssetRow } from '@/lib/types';

// In a real app, this would likely be a user-specific, stored list of tokens,
// perhaps fetched from a database or a token list service.
// For this demo, we'll use a hardcoded list of common tokens per chain.
const MOCK_USER_ASSETS: { [key: number]: Omit<AssetRow, 'balance' | 'priceUsd' | 'fiatValueUsd' | 'pctChange24h' | 'iconUrl'>[] } = {
  1: [ // Ethereum
    { chainId: 1, address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', name: 'Ethereum', symbol: 'ETH', isNative: true, coingeckoId: 'ethereum' },
  ],
  137: [ // Polygon
    { chainId: 137, address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', name: 'Polygon Ecosystem Token', symbol: 'POL', isNative: true, coingeckoId: 'polygon-ecosystem-token' },
  ],
  10: [ // Optimism
    { chainId: 10, address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', name: 'Ethereum', symbol: 'ETH', isNative: true, coingeckoId: 'ethereum' },
    { chainId: 10, address: '0x4200000000000000000000000000000000000042', name: 'Optimism', symbol: 'OP', coingeckoId: 'optimism' },
  ],
  42161: [ // Arbitrum
    { chainId: 42161, address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', name: 'Ethereum', symbol: 'ETH', isNative: true, coingeckoId: 'ethereum' },
    { chainId: 42161, address: '0x912ce59144191c1204e64559fe8253a0e49e6548', name: 'Arbitrum', symbol: 'ARB', coingeckoId: 'arbitrum' },
  ],
  8453: [ // Base
    { chainId: 8453, address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', name: 'Ethereum', symbol: 'ETH', isNative: true, coingeckoId: 'ethereum' },
  ],
  56: [ // BSC
    { chainId: 56, address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', name: 'BNB', symbol: 'BNB', isNative: true, coingeckoId: 'binancecoin' },
  ],
  43114: [ // Avalanche
    { chainId: 43114, address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', name: 'Avalanche', symbol: 'AVAX', isNative: true, coingeckoId: 'avalanche-2' },
  ],
};


// Helper to get the initial list of assets for a chain
export function getInitialAssets(chainId: number): Omit<AssetRow, 'balance'>[] {
    // In a real app, this would be a more sophisticated system for managing user tokens.
    return MOCK_USER_ASSETS[chainId] || [];
}
