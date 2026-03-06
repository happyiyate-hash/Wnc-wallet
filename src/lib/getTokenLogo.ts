'use server';

import { logoSupabase } from './supabase/logo-server';

/**
 * WEVINA INSTITUTIONAL REGISTRY SERVICE
 * Implementation based on Developer API Guide: Direct Supabase Access
 */

const CDN_BASE_URL = 'https://lbltgeldesxkgdrblfxj.supabase.co';

export async function getDirectLogoUrl(tokenName: string, tokenSymbol: string): Promise<string | null> {
  if (!logoSupabase) return null;

  try {
    // 1. Prioritize lookup by the full token name for accuracy
    const { data: nameData } = await logoSupabase
      .from('token_logos')
      .select('public_url')
      .ilike('name', tokenName)
      .limit(1)
      .maybeSingle();

    if (nameData?.public_url) return nameData.public_url;

    // 2. Fall back to the symbol search
    const { data: symbolData } = await logoSupabase
      .from('token_logos')
      .select('public_url')
      .ilike('symbol', tokenSymbol)
      .limit(1)
      .maybeSingle();

    return symbolData?.public_url || null;
  } catch (error) {
    console.error("[REGISTRY_LOGO_FAIL]:", error);
    return null;
  }
}

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
      logo_url: token.logo_url, // Relative path from DB
      priceSource: token.token_details.priceSource,
      priceId: token.token_details.priceId || token.token_details.coingeckoId,
    }));
  } catch (e) {
    console.error("[REGISTRY_METADATA_FAIL]:", e);
    return [];
  }
}

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
