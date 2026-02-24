
'use client';

import { logoSupabase } from './supabase/logo-client';

/**
 * WEVINA TOKEN LOGO RESOLUTION SYSTEM
 * 
 * Direct lookup via the dedicated metadata Supabase instance.
 */

/**
 * Fetches a token's direct logo URL from the dedicated Supabase storage.
 * lookup priorities: Exact name match -> Symbol match.
 * 
 * @param {string} tokenName - The full name of the token (e.g., 'Wrapped Ether').
 * @param {string} tokenSymbol - The symbol of the token (e.g., 'WETH').
 * @returns {Promise<string|null>} The direct public URL to the logo, or null if not found.
 */
export async function getDirectLogoUrl(tokenName: string, tokenSymbol: string): Promise<string | null> {
  if (!logoSupabase) return null;

  try {
    // 1. Prioritize lookup by the full token name for accuracy
    const { data: nameData, error: nameError } = await logoSupabase
      .from('token_logos')
      .select('public_url')
      .ilike('name', tokenName)
      .limit(1)
      .single();

    if (nameData) {
      return nameData.public_url;
    }

    // 2. If no match is found by name, fall back to the symbol
    const { data: symbolData } = await logoSupabase
      .from('token_logos')
      .select('public_url')
      .ilike('symbol', tokenSymbol)
      .limit(1)
      .single();

    return symbolData ? symbolData.public_url : null;
  } catch (error) {
    // Gracefully handle "No rows found" or network issues
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
