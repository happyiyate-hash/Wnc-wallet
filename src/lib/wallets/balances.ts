
import type { AssetRow } from '@/lib/types';
import evmNetworks from '@/lib/evmNetworks.json';

/**
 * ASSET PROVISIONING PROTOCOL
 * Version: 4.1.0 (Native Restoration)
 * Restores the native token of the network to ensure gas and balance visibility.
 * Following user feedback, the native coin of the active chain is now always provisioned.
 */
export function getInitialAssets(chainId: number): Omit<AssetRow, 'balance' | 'priceUsd' | 'fiatValueUsd' | 'pctChange24h' | 'iconUrl'>[] {
    const networks = evmNetworks as any;
    const config = networks[chainId];
    
    if (!config) return [];

    // Determine native decimals for institutional precision
    let decimals = 18;
    const sym = config.symbol?.toUpperCase();
    
    // Ecosystem-specific decimal mapping
    if (sym === 'BTC') decimals = 8;
    if (sym === 'XRP') decimals = 6;
    if (sym === 'DOT') decimals = 10;
    if (sym === 'KSM') decimals = 12;
    if (sym === 'SOL') decimals = 9;
    if (sym === 'NEAR') decimals = 24;
    if (sym === 'ADA') decimals = 6;
    if (sym === 'ALGO') decimals = 6;
    if (sym === 'TRX') decimals = 6;

    // The Native Token of the current network (e.g., BNB, ETH, BTC, XRP etc.)
    // This node is required for transaction authorization and gas evaluation.
    return [{
        chainId: config.chainId,
        address: config.symbol, // convention for native reference
        name: config.name,
        symbol: config.symbol,
        isNative: true,
        coingeckoId: config.coingeckoId,
        decimals: decimals
    }];
}
