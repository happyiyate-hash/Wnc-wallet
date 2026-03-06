
'use server';

import { logoSupabase } from './supabase/logo-server';

/**
 * INSTITUTIONAL REGISTRY SERVICE
 * Implementation: Direct Supabase Access (Hardened Server Action)
 * Version: 8.0.0 (Hardened Production Sync)
 */

const LOGO_CDN_BASE = 'https://gcghriodmljkusdduhzl.supabase.co';

/**
 * Fetches all tokens for a given network directly from the metadata registry.
 * This is the recommended and fastest method for bulk discovery.
 */
export async function fetchNetworkTokens(networkName: string): Promise<any[]> {
  if (!logoSupabase) return [];

  try {
    const { data, error } = await logoSupabase
      .from('token_metadata')
      .select('token_details, contract_address, network, logo_url')
      .eq('network', networkName.toLowerCase());

    if (error || !data) {
      console.warn(`[REGISTRY_FETCH_FAIL] ${networkName}:`, error?.message);
      return [];
    }

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
    console.warn("[REGISTRY_METADATA_FAIL]: Handshake deferred.");
    return [];
  }
}

/**
 * Fetches a specific token's direct logo URL from the registry.
 */
export async function getDirectLogoUrl(tokenName: string, tokenSymbol: string): Promise<string | null> {
  if (!logoSupabase) return null;

  try {
    const { data: nameData } = await logoSupabase
      .from('token_logos')
      .select('public_url')
      .ilike('name', tokenName)
      .limit(1)
      .maybeSingle();

    if (nameData?.public_url) return nameData.public_url;

    const { data: symbolData } = await logoSupabase
      .from('token_logos')
      .select('public_url')
      .ilike('symbol', tokenSymbol)
      .limit(1)
      .maybeSingle();

    return symbolData?.public_url || null;
  } catch (error) {
    return null;
  }
}

/**
 * Bulk fetch prices for a list of contract addresses from the metadata registry.
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

/**
 * Prepares a full URL from a relative CDN path.
 * Must be async to comply with Next.js Server Action standards.
 */
export async function getFullLogoUrl(relativeUrl: string | null | undefined): Promise<string | null> {
    if (!relativeUrl || typeof relativeUrl !== 'string') return null;
    if (relativeUrl.startsWith('http')) return relativeUrl;
    
    return `${LOGO_CDN_BASE}${relativeUrl.startsWith('/') ? relativeUrl : '/' + relativeUrl}`;
}
