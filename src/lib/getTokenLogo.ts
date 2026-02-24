
'use client';

import { logoSupabase } from './supabase/logo-client';

/**
 * WEVINA TOKEN LOGO RESOLUTION SYSTEM
 * Direct lookup via the dedicated metadata project.
 */

/**
 * Cleans a token name to improve lookup match rates.
 * e.g., "Ethereum Mainnet" -> "Ethereum"
 */
function cleanTokenName(name: string): string {
  return name
    .replace(/Mainnet/gi, '')
    .replace(/Network/gi, '')
    .replace(/Chain/gi, '')
    .replace(/Ecosystem Token/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Fetches a token's direct logo URL from Supabase storage.
 * Lookup priorities: Full Name -> Clean Name -> Symbol.
 */
export async function getDirectLogoUrl(tokenName: string, tokenSymbol: string): Promise<string | null> {
  if (!logoSupabase) return null;

  try {
    const searchName = tokenName?.trim();
    const cleanedName = searchName ? cleanTokenName(searchName) : null;

    // 1. Try Full Name Match
    if (searchName) {
        const { data: nameData } = await logoSupabase
          .from('token_logos')
          .select('public_url')
          .ilike('name', searchName)
          .limit(1)
          .maybeSingle();

        if (nameData?.public_url) return nameData.public_url;
    }

    // 2. Try Cleaned Name Match (e.g. "Ethereum Mainnet" -> "Ethereum")
    if (cleanedName && cleanedName !== searchName) {
        const { data: cleanData } = await logoSupabase
          .from('token_logos')
          .select('public_url')
          .ilike('name', cleanedName)
          .limit(1)
          .maybeSingle();

        if (cleanData?.public_url) return cleanData.public_url;
    }

    // 3. Fallback to the symbol
    if (tokenSymbol && tokenSymbol.trim()) {
        const { data: symbolData } = await logoSupabase
          .from('token_logos')
          .select('public_url')
          .ilike('symbol', tokenSymbol.trim())
          .limit(1)
          .maybeSingle();

        if (symbolData?.public_url) return symbolData.public_url;
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
