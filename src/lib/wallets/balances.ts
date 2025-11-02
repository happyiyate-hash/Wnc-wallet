import type { AssetRow } from '@/lib/types';

// In a real app, this would likely be a user-specific, stored list of tokens,
// perhaps fetched from a database or a token list service.
// For this demo, we'll use a hardcoded list of common tokens per chain.
const MOCK_USER_ASSETS: { [key: number]: Omit<AssetRow, 'balance' | 'priceUsd' | 'fiatValueUsd' | 'pctChange24h' | 'iconUrl'>[] } = {
  1: [ // Ethereum
    { chainId: 1, address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', name: 'Ethereum', symbol: 'ETH', isNative: true, coingeckoId: 'ethereum' },
    { chainId: 1, address: '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984', name: 'Uniswap', symbol: 'UNI', coingeckoId: 'uniswap' },
    { chainId: 1, address: '0xdac17f958d2ee523a2206206994597c13d831ec7', name: 'Tether', symbol: 'USDT', coingeckoId: 'tether' },
  ],
  137: [ // Polygon
    { chainId: 137, address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', name: 'Matic', symbol: 'MATIC', isNative: true, coingeckoId: 'matic-network' },
    { chainId: 137, address: '0x7ceb23fd6bc0add59e62ac25578270cff1b9f619', name: 'Wrapped Ether', symbol: 'WETH', coingeckoId: 'weth' },
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
  // Add other chains as needed...
  56: [ // BSC
    { chainId: 56, address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', name: 'BNB', symbol: 'BNB', isNative: true, coingeckoId: 'binancecoin' },
    { chainId: 56, address: '0xe9e7cea3dedca5984780bafc599bd69add087d56', name: 'Binance USD', symbol: 'BUSD', coingeckoId: 'binance-usd' },
  ],
  43114: [ // Avalanche
    { chainId: 43114, address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', name: 'Avalanche', symbol: 'AVAX', isNative: true, coingeckoId: 'avalanche-2' },
    { chainId: 43114, address: '0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7', name: 'Wrapped AVAX', symbol: 'WAVAX', coingeckoId: 'wrapped-avax' },
  ],
};


// Helper to get the initial list of assets for a chain
export function getInitialAssets(chainId: number): Omit<AssetRow, 'balance'>[] {
    // In a real app, this would be a more sophisticated system for managing user tokens.
    return MOCK_USER_ASSETS[chainId] || [];
}
