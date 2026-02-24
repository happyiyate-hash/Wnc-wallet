
'use client';

import { logoSupabase } from './supabase/logo-client';

/**
 * WEVINA TOKEN LOGO RESOLUTION SYSTEM
 * Direct lookup via the dedicated metadata project.
 */

/**
 * Fetches a token's direct logo URL from Supabase storage.
 * Lookup priorities: Name match (ILIKE) -> Symbol match (ILIKE).
 */
export async function getDirectLogoUrl(tokenName: string, tokenSymbol: string): Promise<string | null> {
  if (!logoSupabase) return null;

  try {
    // 1. Prioritize lookup by the full token name for accuracy
    if (tokenName && tokenName.trim()) {
        const { data: nameData } = await logoSupabase
          .from('token_logos')
          .select('public_url')
          .ilike('name', tokenName.trim())
          .limit(1)
          .maybeSingle();

        if (nameData?.public_url) {
          return nameData.public_url;
        }
    }

    // 2. Fallback to the symbol
    if (tokenSymbol && tokenSymbol.trim()) {
        const { data: symbolData } = await logoSupabase
          .from('token_logos')
          .select('public_url')
          .ilike('symbol', tokenSymbol.trim())
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
