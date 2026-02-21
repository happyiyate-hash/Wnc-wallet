/**
 * Fetches a token's logo URL using reliable public CDNs.
 * This removes dependency on private Supabase tables for static assets.
 * 
 * Sources:
 * 1. Trust Wallet Assets (Excellent coverage for mainnet tokens)
 * 2. Cryptoicons (Fallback)
 * 3. CoinGecko (As a symbolic hint)
 *
 * @param {string | null | undefined} symbol - The symbol of the token (e.g., 'ETH').
 * @param {string | null | undefined} networkName - The name of the network (unused in CDN logic but kept for interface compatibility).
 * @returns {string|null} The public logo URL.
 */
export function getTokenLogoUrl(
    symbol?: string | null,
    networkName?: string | null,
): string | null {
    if (!symbol) return null;

    const sym = symbol.toLowerCase();

    // Map common symbols to their primary network addresses or IDs for known CDN patterns
    const hardcodedMaps: Record<string, string> = {
        'eth': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png',
        'btc': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/bitcoin/info/logo.png',
        'sol': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/solana/info/logo.png',
        'bnb': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/binance/info/logo.png',
        'matic': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/polygon/info/logo.png',
        'pol': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/polygon/info/logo.png',
        'avax': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/avalanchex/info/logo.png',
        'usdc': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png',
        'usdt': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0.dAC17F958D2ee523a2206206994597C13D831ec7/logo.png',
    };

    if (hardcodedMaps[sym]) {
        return hardcodedMaps[sym];
    }

    // Default to a generic but reliable crypto icon CDN
    return `https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/${sym}.png`;
}
