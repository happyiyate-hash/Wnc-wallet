import { supabase } from '@/lib/supabase/cdn';

/**
 * Fetches a token's logo URL directly from the Supabase 'token_logos' table.
 * This is the single source of truth for all token logos not handled by local SVGs.
 *
 * It first tries a precise match using the network name and symbol.
 * If that fails, it falls back to searching by symbol only.
 *
 * @param {string | null | undefined} symbol - The symbol of the token (e.g., 'ETH').
 * @param {string | null | undefined} networkName - The name of the network (e.g., 'Ethereum', 'Optimism').
 * @returns {Promise<string|null>} A promise that resolves to the public logo URL, or null if not found.
 */
export async function getTokenLogoUrl(
    symbol?: string | null,
    networkName?: string | null,
): Promise<string | null> {
    // If supabase is not configured, we can't fetch logos from it.
    if (!supabase || !symbol) return null;

    try {
        // First, try a precise match with network name and symbol.
        // This correctly distinguishes between ETH on Ethereum vs. ETH on Base.
        if (networkName) {
            const { data: networkSpecificData, error: networkSpecificError } = await supabase
                .from('token_logos')
                .select('public_url')
                .ilike('symbol', symbol)
                .ilike('name', `%${networkName}%`)
                .limit(1)
                .single();

            if (networkSpecificData) {
                return networkSpecificData.public_url;
            }
            if (networkSpecificError && networkSpecificError.code !== 'PGRST116') {
                 console.warn(`Error fetching network-specific logo for ${symbol} on ${networkName}:`, networkSpecificError.message);
            }
        }
        
        // Fallback: If no network-specific logo is found, search by symbol only.
        // This is useful for globally unique tokens or as a last resort.
        const { data: symbolOnlyData, error: symbolOnlyError } = await supabase
            .from('token_logos')
            .select('public_url')
            .ilike('symbol', symbol)
            .limit(1)
            .single();

        if (symbolOnlyError && symbolOnlyError.code !== 'PGRST116') {
            console.warn(`Error fetching fallback logo for symbol '${symbol}':`, symbolOnlyError.message);
        }

        return symbolOnlyData ? symbolOnlyData.public_url : null;

    } catch (e: any) {
        console.error(`An unexpected error occurred in getTokenLogoUrl for symbol ${symbol}:`, e.message);
        return null;
    }
}
