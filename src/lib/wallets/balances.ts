
import type { AssetRow } from '@/lib/types';

/**
 * MOCK_USER_ASSETS
 * Synchronized with supported networks.
 */
const MOCK_USER_ASSETS: { [key: number]: Omit<AssetRow, 'balance' | 'priceUsd' | 'fiatValueUsd' | 'pctChange24h' | 'iconUrl'>[] } = {
  1: [ // Ethereum Mainnet
    { chainId: 1, address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', name: 'Ethereum Mainnet', symbol: 'ETH', isNative: true, coingeckoId: 'ethereum' },
    { chainId: 1, address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', name: 'USDC', symbol: 'USDC', coingeckoId: 'usd-coin' },
  ],
  144: [ // XRP Ledger
    { chainId: 144, address: 'XRP', name: 'XRP Ledger', symbol: 'XRP', isNative: true, coingeckoId: 'ripple' },
  ],
  137: [ // Polygon
    { chainId: 137, address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', name: 'Polygon', symbol: 'MATIC', isNative: true, coingeckoId: 'polygon-ecosystem-token' },
  ],
  8453: [ // Base
    { chainId: 8453, address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', name: 'Base', symbol: 'BASE', isNative: true, coingeckoId: 'ethereum' },
  ],
  10: [ // Optimism
    { chainId: 10, address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', name: 'Optimism', symbol: 'OP', isNative: true, coingeckoId: 'ethereum' },
  ],
  42161: [ // Arbitrum One
    { chainId: 42161, address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', name: 'Arbitrum One', symbol: 'ARB', isNative: true, coingeckoId: 'ethereum' },
  ]
};

export function getInitialAssets(chainId: number): Omit<AssetRow, 'balance' | 'priceUsd' | 'fiatValueUsd' | 'pctChange24h' | 'iconUrl'>[] {
    return MOCK_USER_ASSETS[chainId] || [];
}
