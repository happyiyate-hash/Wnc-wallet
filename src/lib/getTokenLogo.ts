
'use client';

import { logoSupabase } from './supabase/logo-client';

/**
 * WEVINA TOKEN LOGO RESOLUTION SYSTEM
 * Version: 4.1.0 (Name-Priority Handshake)
 * 
 * Specifically optimized to prevent symbol collisions (e.g., ETH on Blast vs ETH on Mainnet).
 * Priorities: Specific Name > Cleaned Name > Symbol.
 */

/**
 * Cleans a token name to improve lookup match rates while preserving ecosystem identity.
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
 * Fetches a token's direct logo URL from Supabase storage with Name-Priority logic.
 */
export async function getDirectLogoUrl(tokenName: string, tokenSymbol: string): Promise<string | null> {
  if (!logoSupabase) return null;

  try {
    const searchName = tokenName?.trim();
    const searchSymbol = tokenSymbol?.trim();

    // 1. PRIMARY HANDSHAKE: Exact Full Name Match (Highest Precision)
    // This ensures "Blast" or "Base" is found even if the symbol is just "ETH"
    if (searchName && searchName.length > 2) {
        const { data: nameData } = await logoSupabase
          .from('token_logos')
          .select('public_url')
          .ilike('name', searchName)
          .limit(1)
          .maybeSingle();

        if (nameData?.public_url) return nameData.public_url;
    }

    // 2. SECONDARY HANDSHAKE: Cleaned Name Match
    const cleanedName = searchName ? cleanTokenName(searchName) : null;
    if (cleanedName && cleanedName !== searchName && cleanedName.length > 2) {
        const { data: cleanData } = await logoSupabase
          .from('token_logos')
          .select('public_url')
          .ilike('name', cleanedName)
          .limit(1)
          .maybeSingle();

        if (cleanData?.public_url) return cleanData.public_url;
    }

    // 3. FALLBACK HANDSHAKE: Exact Symbol Match
    // Only used if name resolution fails to prevent ETH collisions
    if (searchSymbol && searchSymbol.length > 1) {
        const { data: symbolData } = await logoSupabase
          .from('token_logos')
          .select('public_url')
          .ilike('symbol', searchSymbol)
          .limit(1)
          .maybeSingle();

        if (symbolData?.public_url) return symbolData.public_url;
    }

    return null;
  } catch (error) {
    console.warn("[LOGO_RESOLVER_ADVISORY] Registry lookup deferred:", error);
    return null;
  }
}

/**
 * Prepares a logo path prediction for the internal CDN layer.
 * Prioritizes name slug for the path.
 */
export function getTokenLogoUrl(
    symbol?: string | null,
    name?: string | null,
): string | null {
    if (!symbol && !name) return null;
    const identifier = (name || symbol || '').toLowerCase().replace(/\s+/g, '-');
    const sym = (symbol || '').toLowerCase();
    return `/api/cdn/logo/${identifier}/${sym}`;
}
