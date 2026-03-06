
import type { AssetRow } from '@/lib/types';
import evmNetworks from '@/lib/evmNetworks.json';

/**
 * INSTITUTIONAL ASSET WHITELIST & PROVISIONING PROTOCOL
 * Version: 5.0.0 (Hybrid Routing Standard)
 * 
 * Defines the strictly allowed tokens per chain for Swaps and Fees.
 * Only these assets are provisioned in the terminal to ensure liquidity depth.
 */

interface WhitelistConfig {
    [chainId: number]: {
        symbol: string;
        name: string;
        address: string;
        decimals: number;
        coingeckoId: string;
    }[];
}

const WHITELIST: WhitelistConfig = {
    // Ethereum Mainnet
    1: [
        { symbol: 'USDT', name: 'Tether USD', address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6, coingeckoId: 'tether' },
        { symbol: 'USDC', name: 'USD Coin', address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6, coingeckoId: 'usd-coin' },
        { symbol: 'WBTC', name: 'Wrapped Bitcoin', address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', decimals: 8, coingeckoId: 'wrapped-bitcoin' },
        { symbol: 'DAI', name: 'Dai Stablecoin', address: '0x6B175474E89094C44Da98b954EedeAC495271d0F', decimals: 18, coingeckoId: 'dai' },
    ],
    // Polygon
    137: [
        { symbol: 'USDT', name: 'Tether USD', address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', decimals: 6, coingeckoId: 'tether' },
        { symbol: 'USDC', name: 'USD Coin', address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', decimals: 6, coingeckoId: 'usd-coin' },
        { symbol: 'WBTC', name: 'Wrapped Bitcoin', address: '0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6', decimals: 8, coingeckoId: 'wrapped-bitcoin' },
    ],
    // BNB Chain
    56: [
        { symbol: 'USDT', name: 'Tether USD', address: '0x55d398326f99059fF775485246999027B3197955', decimals: 18, coingeckoId: 'tether' },
        { symbol: 'USDC', name: 'USD Coin', address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', decimals: 18, coingeckoId: 'usd-coin' },
        { symbol: 'BTCB', name: 'Binance Bitcoin', address: '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c', decimals: 18, coingeckoId: 'binance-bitcoin' },
    ],
    // Solana (Handled as standard address registry)
    501: [
        { symbol: 'USDT', name: 'Tether USD (SPL)', address: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', decimals: 6, coingeckoId: 'tether' },
        { symbol: 'USDC', name: 'USD Coin (SPL)', address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', decimals: 6, coingeckoId: 'usd-coin' },
    ]
};

export function getInitialAssets(chainId: number): Omit<AssetRow, 'balance' | 'priceUsd' | 'fiatValueUsd' | 'pctChange24h' | 'iconUrl'>[] {
    const networks = evmNetworks as any;
    const config = networks[chainId];
    
    if (!config) return [];

    // 1. Core Native Token (Gas Node)
    const nativeAsset = {
        chainId: config.chainId,
        address: config.symbol, 
        name: config.name,
        symbol: config.symbol,
        isNative: true,
        coingeckoId: config.coingeckoId,
        decimals: getNativeDecimals(config.symbol)
    };

    // 2. Institutional Whitelist (Trade Nodes)
    const whitelistedTokens = WHITELIST[chainId] || [];
    const formattedWhitelisted = whitelistedTokens.map(t => ({
        chainId: config.chainId,
        address: t.address,
        name: t.name,
        symbol: t.symbol,
        isNative: false,
        coingeckoId: t.coingeckoId,
        decimals: t.decimals
    }));

    return [nativeAsset, ...formattedWhitelisted];
}

function getNativeDecimals(sym: string): number {
    const s = sym.toUpperCase();
    if (s === 'BTC') return 8;
    if (s === 'XRP') return 6;
    if (s === 'DOT') return 10;
    if (s === 'KSM') return 12;
    if (s === 'SOL') return 9;
    if (s === 'NEAR') return 24;
    return 18;
}
