
import type { AssetRow } from '@/lib/types';

/**
 * MOCK_USER_ASSETS
 * Strictly synchronized with the user's provided network list.
 * Every entry uses the exact name and symbol required for correct logo fetching.
 */
const MOCK_USER_ASSETS: { [key: number]: Omit<AssetRow, 'balance' | 'priceUsd' | 'fiatValueUsd' | 'pctChange24h' | 'iconUrl'>[] } = {
  1: [ // Ethereum Mainnet
    { chainId: 1, address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', name: 'Ethereum Mainnet', symbol: 'ETH', isNative: true, coingeckoId: 'ethereum' },
    { chainId: 1, address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', name: 'USDC', symbol: 'USDC', coingeckoId: 'usd-coin' },
    { chainId: 1, address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', name: 'Uniswap', symbol: 'UNI', coingeckoId: 'uniswap' },
  ],
  59144: [ // Linea
    { chainId: 59144, address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', name: 'Linea', symbol: 'LINEA', isNative: true, coingeckoId: 'ethereum' },
  ],
  137: [ // Polygon
    { chainId: 137, address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', name: 'Polygon', symbol: 'MATIC', isNative: true, coingeckoId: 'polygon-ecosystem-token' },
    { chainId: 137, address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', name: 'USDC', symbol: 'USDC', coingeckoId: 'usd-coin' },
  ],
  8453: [ // Base
    { chainId: 8453, address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', name: 'Base', symbol: 'BASE', isNative: true, coingeckoId: 'ethereum' },
  ],
  81457: [ // Blast
    { chainId: 81457, address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', name: 'Blast', symbol: 'BLAST', isNative: true, coingeckoId: 'ethereum' },
  ],
  10: [ // Optimism
    { chainId: 10, address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', name: 'Optimism', symbol: 'OP', isNative: true, coingeckoId: 'ethereum' },
  ],
  42161: [ // Arbitrum One
    { chainId: 42161, address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', name: 'Arbitrum One', symbol: 'ARB', isNative: true, coingeckoId: 'ethereum' },
  ],
  11297108109: [ // Palm
    { chainId: 11297108109, address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', name: 'Palm', symbol: 'PALM', isNative: true, coingeckoId: 'palm' },
  ],
  43114: [ // Avalanche C-Chain
    { chainId: 43114, address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', name: 'Avalanche C-Chain', symbol: 'AVAX', isNative: true, coingeckoId: 'avalanche-2' },
  ],
  42220: [ // Celo
    { chainId: 42220, address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', name: 'Celo', symbol: 'CELO', isNative: true, coingeckoId: 'celo' },
  ],
  324: [ // ZKsync Era
    { chainId: 324, address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', name: 'ZKsync Era', symbol: 'ZKS', isNative: true, coingeckoId: 'ethereum' },
  ],
  56: [ // BSC
    { chainId: 56, address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', name: 'BSC', symbol: 'BNB', isNative: true, coingeckoId: 'binancecoin' },
  ],
  1313161554: [ // Hemi
    { chainId: 1313161554, address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', name: 'Hemi', symbol: 'HEMI', isNative: true, coingeckoId: 'hemi' },
  ],
  5000: [ // Mantle
    { chainId: 5000, address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', name: 'Mantle', symbol: 'MNT', isNative: true, coingeckoId: 'mantle' },
  ],
  204: [ // opBNB
    { chainId: 204, address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', name: 'opBNB', symbol: 'BNB', isNative: true, coingeckoId: 'binancecoin' },
  ],
  534352: [ // Scroll
    { chainId: 534352, address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', name: 'Scroll', symbol: 'SCR', isNative: true, coingeckoId: 'ethereum' },
  ],
  1329: [ // Sei Mainnet
    { chainId: 1329, address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', name: 'Sei Mainnet', symbol: 'SEI', isNative: true, coingeckoId: 'sei-network' },
  ],
  1750: [ // Swellchain
    { chainId: 1750, address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', name: 'Swellchain', symbol: 'SWELL', isNative: true, coingeckoId: 'swell-network' },
  ],
  130: [ // Unichain
    { chainId: 130, address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', name: 'Unichain', symbol: 'UNI', isNative: true, coingeckoId: 'uniswap' },
  ],
  99999: [ // Monad
    { chainId: 99999, address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', name: 'Monad', symbol: 'MON', isNative: true, coingeckoId: 'ethereum' },
  ],
  88888: [ // MegaETH
    { chainId: 88888, address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', name: 'MegaETH', symbol: 'MEGA', isNative: true, coingeckoId: 'ethereum' },
  ],
  77777: [ // Sei Testnet
    { chainId: 77777, address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', name: 'Sei Testnet', symbol: 'SEI', isNative: true, coingeckoId: 'sei-network' },
  ],
  66666: [ // Starknet
    { chainId: 66666, address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', name: 'Starknet', symbol: 'STRK', isNative: true, coingeckoId: 'starknet' },
  ]
};

export function getInitialAssets(chainId: number): Omit<AssetRow, 'balance' | 'priceUsd' | 'fiatValueUsd' | 'pctChange24h' | 'iconUrl'>[] {
    return MOCK_USER_ASSETS[chainId] || [];
}
