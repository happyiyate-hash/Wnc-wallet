'use server';

import { logoSupabase } from './supabase/logo-server';
import type { AssetRow } from './types';

/**
 * WEVINA INSTITUTIONAL REGISTRY SERVICE (SERVER-SIDE)
 * Version: 6.0.0 (Flattened Metadata & Pricing)
 * 
 * Provides secure backend handshakes for branding and asset metadata.
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
 * High-precision logo resolution following the Developer API Guide.
 */
export async function getDirectLogoUrl(tokenName: string, tokenSymbol: string): Promise<string | null> {
  if (!logoSupabase) return null;

  try {
    const searchName = tokenName?.trim();
    const searchSymbol = tokenSymbol?.trim();

    // 1. PRIMARY: Exact Name Match
    if (searchName) {
        const { data: nameData } = await logoSupabase
          .from('token_logos')
          .select('public_url')
          .ilike('name', searchName)
          .limit(1)
          .maybeSingle();

        if (nameData?.public_url) return nameData.public_url;
    }

    // 2. SECONDARY: Cleaned Name
    const cleaned = searchName ? cleanTokenName(searchName) : null;
    if (cleaned && cleaned !== searchName) {
        const { data: cleanData } = await logoSupabase
          .from('token_logos')
          .select('public_url')
          .ilike('name', cleaned)
          .limit(1)
          .maybeSingle();

        if (cleanData?.public_url) return cleanData.public_url;
    }

    // 3. FALLBACK: Symbol Match
    if (searchSymbol) {
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
    return null;
  }
}

/**
 * Fetches all flattened tokens for a specific network.
 */
export async function fetchNetworkTokens(networkName: string): Promise<any[]> {
  if (!logoSupabase) return [];

  try {
    const { data, error } = await logoSupabase
      .from('token_metadata')
      .select('token_details, contract_address, network, logo_url')
      .eq('network', networkName.toLowerCase());

    if (error || !data) return [];

    return data.map(token => ({
      symbol: token.token_details.symbol,
      name: token.token_details.name,
      decimals: token.token_details.decimals || 18,
      network: token.network,
      contract: token.contract_address,
      logo_url: token.logo_url,
      priceSource: token.token_details.priceSource,
      priceId: token.token_details.priceId || token.token_details.coingeckoId,
    }));
  } catch (e) {
    return [];
  }
}

/**
 * Fetches real-time pricing data for custom assets from the metadata registry.
 */
export async function fetchTokenPricesFromMetadata(contracts: string[]): Promise<any[]> {
  if (!logoSupabase || contracts.length === 0) return [];

  try {
    const { data } = await logoSupabase
      .from('token_metadata')
      .select('contract_address, token_details')
      .in('contract_address', contracts.map(c => c.toLowerCase()));

    return data || [];
  } catch (e) {
    return [];
  }
}

export async function getTokenLogoUrl(symbol?: string | null, name?: string | null): Promise<string | null> {
    if (!symbol && !name) return null;
    const identifier = (name || symbol || '').toLowerCase().replace(/\s+/g, '-');
    const sym = (symbol || '').toLowerCase();
    return `/api/cdn/logo/${identifier}/${sym}`;
}
