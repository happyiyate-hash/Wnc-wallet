
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

    let decimals = 18;
    if (config.type === 'btc' || config.type === 'ltc' || config.type === 'doge') decimals = 8;
    else if (config.type === 'solana') decimals = 9;
    else if (config.type === 'cosmos' || config.type === 'osmosis' || config.type === 'secret' || config.type === 'celestia') decimals = 6;
    else if (config.type === 'cardano') decimals = 6;
    else if (config.type === 'tron') decimals = 6;
    else if (config.type === 'hedera') decimals = 8;
    else if (config.type === 'tezos') decimals = 6;
    else if (config.type === 'aptos') decimals = 8;
    else if (config.name.toLowerCase().includes('injective')) decimals = 18;

    const nativeAsset = {
        chainId: config.chainId,
        address: config.type === 'evm' ? '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' : config.symbol,
        name: config.name,
        symbol: config.symbol,
        isNative: true,
        coingeckoId: config.coingeckoId,
        decimals: decimals
    };

    return [nativeAsset, ...(MOCK_EXTRAS[chainId] || [])];
}
