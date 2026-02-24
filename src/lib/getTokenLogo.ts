import { logoSupabase } from './supabase/logo-client';

/**
 * WEVINA TOKEN LOGO RESOLUTION SYSTEM
 * 
 * Direct lookup via the metadata Supabase instance.
 */

/**
 * Fetches the CDN URL for a token's logo using the metadata database.
 * Priority: Exact name match -> Symbol match.
 * 
 * @param {string} name - The full name of the token.
 * @param {string} symbol - The symbol of the token.
 * @returns {Promise<string|null>} The logo path or null.
 */
export async function getLogoUrlFromApi(name: string, symbol: string): Promise<string | null> {
    if (!logoSupabase) return null;

    try {
        // 1. Prioritize lookup by full name for accuracy
        const { data: nameData } = await logoSupabase
            .from('token_logos')
            .select('public_url')
            .ilike('name', name)
            .limit(1)
            .single();

        if (nameData) return nameData.public_url;

        // 2. Fallback to symbol search
        const { data: symbolData } = await logoSupabase
            .from('token_logos')
            .select('public_url')
            .ilike('symbol', symbol)
            .limit(1)
            .single();

        return symbolData ? symbolData.public_url : null;
    } catch (error) {
        console.error('Failed to fetch logo from metadata DB:', error);
        return null;
    }
}

/**
 * Synchronous version for immediate UI rendering.
 * Returns a predicted path while waiting for metadata fetches.
 */
export function getTokenLogoUrl(
    symbol?: string | null,
    name?: string | null,
): string | null {
    if (!symbol) return null;

    const sym = symbol.toLowerCase();
    const nameSlug = name ? name.toLowerCase().replace(/\s+/g, '-') : sym;
    
    // Returns relative path compatible with Wevina CDN layer
    return `/api/cdn/logo/${nameSlug}/${sym}`;
}
