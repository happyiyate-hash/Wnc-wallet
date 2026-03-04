
import type { AssetRow } from '@/lib/types';
import evmNetworks from '@/lib/evmNetworks.json';

/**
 * ASSET PROVISIONING PROTOCOL
 * Version: 4.0.0 (The Great Purge)
 * This node ensures that only Bitcoin (BTC) is returned for initial discovery.
 * All other cryptocurrencies have been removed per institutional request.
 */
export function getInitialAssets(chainId: number): Omit<AssetRow, 'balance' | 'priceUsd' | 'fiatValueUsd' | 'pctChange24h' | 'iconUrl'>[] {
    const networks = evmNetworks as any;
    const config = networks[chainId];
    
    if (!config) return [];

    // ONLY BITCOIN (BTC) is authorized for display. 
    // Wevina Nodes (WNC) are injected separately in the wallet-provider.
    if (config.symbol === 'BTC' || config.type === 'btc') {
        return [{
            chainId: config.chainId,
            address: config.symbol,
            name: 'Bitcoin',
            symbol: 'BTC',
            isNative: true,
            coingeckoId: 'bitcoin',
            decimals: 8
        }];
    }

    // Return empty for all other networks to ensure only BTC remains
    return [];
}
