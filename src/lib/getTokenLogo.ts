'use client';

import { logoSupabase } from './supabase/logo-client';

/**
 * WEVINA TOKEN LOGO RESOLUTION SYSTEM
 * Direct lookup via the dedicated metadata Supabase instance (gcghriodmljkusdduhzl).
 */

/**
 * Fetches a token's direct logo URL from Supabase storage.
 * lookup priorities: Exact name match -> Symbol match.
 */
export async function getDirectLogoUrl(tokenName: string, tokenSymbol: string): Promise<string | null> {
  if (!logoSupabase) return null;

  try {
    // 1. Prioritize lookup by the full token name for accuracy (Case-insensitive)
    if (tokenName) {
        const { data: nameData } = await logoSupabase
          .from('token_logos')
          .select('public_url')
          .ilike('name', tokenName)
          .limit(1)
          .maybeSingle();

        if (nameData?.public_url) {
          return nameData.public_url;
        }
    }

    // 2. If no match is found by name, fall back to the symbol (Case-insensitive)
    if (tokenSymbol) {
        const { data: symbolData } = await logoSupabase
          .from('token_logos')
          .select('public_url')
          .ilike('symbol', tokenSymbol)
          .limit(1)
          .maybeSingle();

        if (symbolData?.public_url) {
            return symbolData.public_url;
        }
    }

    return null;
  } catch (error) {
    console.warn("Logo lookup error:", error);
    return null;
  }
}

/**
 * Prepares a logo path prediction for the CDN caching layer.
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
