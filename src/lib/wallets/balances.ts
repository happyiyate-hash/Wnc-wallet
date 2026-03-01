
import type { AssetRow } from '@/lib/types';
import evmNetworks from '@/lib/evmNetworks.json';

/**
 * Dynamic Asset Initialization
 * Generates the native token for any supported chain.
 */
export function getInitialAssets(chainId: number): Omit<AssetRow, 'balance' | 'priceUsd' | 'fiatValueUsd' | 'pctChange24h' | 'iconUrl'>[] {
    const networks = evmNetworks as any;
    const config = networks[chainId];
    
    if (!config) return [];

    // Base mock assets for specific chains
    const MOCK_EXTRAS: { [key: number]: any[] } = {
      1: [
        { chainId: 1, address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', name: 'USDC', symbol: 'USDC', coingeckoId: 'usd-coin', decimals: 6 },
      ]
    };

    const nativeAsset = {
        chainId: config.chainId,
        address: config.type === 'evm' ? '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' : config.symbol,
        name: config.name,
        symbol: config.symbol,
        isNative: true,
        coingeckoId: config.coingeckoId,
        decimals: (config.type === 'btc' || config.type === 'ltc' || config.type === 'doge') ? 8 : (config.type === 'solana' ? 9 : (config.type === 'cosmos' || config.type === 'osmosis' || config.type === 'secret' || config.type === 'celestia') ? 6 : (config.name.toLowerCase().includes('injective') ? 18 : 18))
    };

    return [nativeAsset, ...(MOCK_EXTRAS[chainId] || [])];
}
