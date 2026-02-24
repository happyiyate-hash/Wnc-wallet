
'use client';

import { logoSupabase } from './supabase/logo-client';

/**
 * WEVINA TOKEN LOGO RESOLUTION SYSTEM
 * Direct lookup via the dedicated metadata project (gcghriodmljkusdduhzl).
 * Priority: Exact Name -> Exact Symbol -> Cleaned Name.
 */

/**
 * Cleans a token name to improve lookup match rates for non-exact matches.
 */
function cleanTokenName(name: string): string {
  return name
    .replace(/Mainnet/gi, '')
    .replace(/Network/gi, '')
    .replace(/Chain/gi, '')
    .replace(/Ecosystem Token/gi, '')
    .replace(/ETH/gi, '') // Remove redundant ETH suffix for L2s
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Fetches a token's direct logo URL from Supabase storage.
 * Lookup priorities: Full Exact Name (provided in list) -> Symbol -> Clean Name.
 */
export async function getDirectLogoUrl(tokenName: string, tokenSymbol: string): Promise<string | null> {
  if (!logoSupabase) return null;

  try {
    const searchName = tokenName?.trim();
    const searchSymbol = tokenSymbol?.trim();

    // 1. Try EXACT Full Name Match (e.g. "Blast", "ZKsync Era")
    if (searchName) {
        const { data: nameData } = await logoSupabase
          .from('token_logos')
          .select('public_url')
          .ilike('name', searchName)
          .limit(1)
          .maybeSingle();

        if (nameData?.public_url) return nameData.public_url;
    }

    // 2. Try EXACT Symbol Match (e.g. "BLAST", "ZKS")
    if (searchSymbol && searchSymbol.length > 1) {
        const { data: symbolData } = await logoSupabase
          .from('token_logos')
          .select('public_url')
          .ilike('symbol', searchSymbol)
          .limit(1)
          .maybeSingle();

        if (symbolData?.public_url) return symbolData.public_url;
    }

    // 3. Fallback to Cleaned Name Match
    const cleanedName = searchName ? cleanTokenName(searchName) : null;
    if (cleanedName && cleanedName !== searchName) {
        const { data: cleanData } = await logoSupabase
          .from('token_logos')
          .select('public_url')
          .ilike('name', cleanedName)
          .limit(1)
          .maybeSingle();

        if (cleanData?.public_url) return cleanData.public_url;
    }

    return null;
  } catch (error) {
    console.warn("Logo lookup error:", error);
    return null;
  }
}

/**
 * Prepares a logo path prediction for the internal CDN layer.
 */
export function getTokenLogoUrl(
    symbol?: string | null,
    name?: string | null,
): string | null {
    if (!symbol) return null;
    const sym = symbol.toLowerCase();
    const nameSlug = name ? name.toLowerCase().replace(/\s+/g, '-') : sym;
    return `/api/cdn/logo/${nameSlug}/${sym}`;
}
