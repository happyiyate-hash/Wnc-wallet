
/**
 * Fetches a token's logo URL using reliable public CDNs.
 * Optimized for multi-chain context by incorporating chainId.
 * 
 * @param {string | null | undefined} symbol - The symbol of the token (e.g., 'ETH').
 * @param {number | null | undefined} chainId - The ID of the network.
 * @returns {string|null} The public logo URL.
 */
export function getTokenLogoUrl(
    symbol?: string | null,
    chainId?: number | null,
): string | null {
    if (!symbol) return null;

    const sym = symbol.toLowerCase();

    // Native chain icons mapping (strict resolution for all 19 chains)
    const hardcodedMaps: Record<string, string> = {
        'eth-1': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png',
        'eth-59144': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/linea/info/logo.png',
        'eth-10': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/optimism/info/logo.png',
        'eth-42161': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/arbitrum/info/logo.png',
        'eth-8453': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/info/logo.png',
        'eth-534352': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/scroll/info/logo.png',
        'eth-81457': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/blast/info/logo.png',
        'eth-324': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/zksync/info/logo.png',
        
        'pol-137': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/polygon/info/logo.png',
        'bnb-56': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/binance/info/logo.png',
        'bnb-204': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/binance/info/logo.png',
        'avax-43114': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/avalanchex/info/logo.png',
        'celo-42220': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/celo/info/logo.png',
        'mnt-5000': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/mantle/info/logo.png',
        'sei-1329': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/sei/info/logo.png',
        'hemi-1313161554': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/hemi/info/logo.png',
        'uni-130': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/uniswap/info/logo.png',
        'swell-1750': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/swell/info/logo.png',
        'palm-11297108109': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/palm/info/logo.png',
        
        'btc': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/bitcoin/info/logo.png',
        'sol': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/solana/info/logo.png',
    };

    const key = chainId ? `${sym}-${chainId}` : sym;
    if (hardcodedMaps[key]) return hardcodedMaps[key];
    if (hardcodedMaps[sym]) return hardcodedMaps[sym];

    // Fallback to a generic but reliable crypto icon CDN
    return `https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/${sym}.png`;
}
