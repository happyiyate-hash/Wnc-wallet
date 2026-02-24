
/**
 * WEVINA TOKEN LOGO RESOLUTION SYSTEM
 * 
 * Migrated from static maps to dedicated CDN caching layer.
 * Uses the /api/logo endpoint for on-demand path resolution.
 */

const WEVINA_API_KEY = 'wevina_fc4ba8d7082f478aa21476941059de0a';

/**
 * Fetches the CDN URL for a token's logo using the metadata API.
 * This is used as a fallback or for individual token resolution.
 * 
 * @param {string} name - The full name of the token.
 * @param {string} symbol - The symbol of the token.
 * @returns {Promise<string|null>} The logo path or null.
 */
export async function getLogoUrlFromApi(name: string, symbol: string): Promise<string | null> {
    if (typeof window === 'undefined') return null;
    
    const baseUrl = window.location.origin;
    const url = new URL(`${baseUrl}/api/logo`);
    url.searchParams.set('name', name);
    url.searchParams.set('symbol', symbol);

    try {
        const response = await fetch(url.toString(), {
            headers: { 'x-api-key': WEVINA_API_KEY }
        });
        if (!response.ok) return null;
        const data = await response.json();
        // Prepend domain to the returned path (/api/cdn/logo/...)
        return `${baseUrl}${data.logo_url}`;
    } catch (error) {
        return null;
    }
}

/**
 * Synchronous version for UI building.
 * Predicted path strategy while waiting for metadata fetch.
 */
export function getTokenLogoUrl(
    symbol?: string | null,
    chainId?: number | null,
): string | null {
    if (!symbol) return null;

    // We build the predicted API CDN path structure
    // This allows immediate rendering if the metadata is already being fetched
    const sym = symbol.toLowerCase();
    
    // For native tokens, we have a stable mapping
    const nativeMaps: Record<string, string> = {
        'eth': 'ethereum',
        'pol': 'polygon',
        'matic': 'polygon',
        'bnb': 'binance-coin',
        'avax': 'avalanche',
        'ftm': 'fantom',
        'sol': 'solana',
        'btc': 'bitcoin'
    };

    const nameSlug = nativeMaps[sym] || sym;
    return `/api/cdn/logo/${nameSlug}/${sym}`;
}
