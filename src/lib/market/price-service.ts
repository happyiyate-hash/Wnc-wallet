'use client';

import { fetchPriceMap, fetchPricesByContract, COINGECKO_PLATFORM_MAP } from '@/lib/coingecko';
import { logoSupabase } from '@/lib/supabase/logo-client';
import type { AssetRow, ChainConfig } from '@/lib/types';
import { getInitialAssets } from '@/lib/wallets/balances';

/**
 * INSTITUTIONAL MARKET DYNAMICS SERVICE
 * Handles price discovery, delta calculations, and internal asset valuation.
 */

export interface PriceResult {
  [id: string]: {
    price: number;
    change: number;
  };
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Calculates percentage change between two values.
 */
export function calculateDelta(current: number, previous: number): number {
  if (!previous || previous === 0) return 0;
  return ((current - previous) / previous) * 100;
}

/**
 * Generates a deterministic "Daily Opening Price" for internal assets.
 */
function getWncOpeningPrice(currentPrice: number): number {
  const now = new Date();
  const dateString = `${now.getUTCFullYear()}-${now.getUTCMonth()}-${now.getUTCDate()}`;
  
  let hash = 0;
  for (let i = 0; i < dateString.length; i++) {
    hash = ((hash << 5) - hash) + dateString.charCodeAt(i);
    hash |= 0;
  }
  
  const absHash = Math.abs(hash);
  const varianceFactor = (absHash % 500) - 250; 
  const variancePercent = varianceFactor / 10000; 
  
  return currentPrice * (1 + variancePercent);
}

/**
 * STAGED PRICE DISCOVERY HANDSHAKE (UNIVERSAL)
 * Fetches market data for all known assets across all chains.
 * Implements Batch Rate-Limit Protection.
 */
export async function fetchGlobalMarketData(
  chains: ChainConfig[],
  customTokens: AssetRow[],
  currentRates: { [key: string]: number }
): Promise<PriceResult> {
  const coingeckoIds = new Set<string>();
  const platformTokens: { [platform: string]: Set<string> } = {};
  const allKnownAssets: AssetRow[] = [];

  // 1. REGISTRY MAPPING
  chains.forEach(chain => {
    const base = getInitialAssets(chain.chainId);
    allKnownAssets.push(...base.map(a => ({ ...a, chainId: chain.chainId }) as AssetRow));
  });
  
  allKnownAssets.push(...customTokens);

  allKnownAssets.forEach(a => {
    if (a.coingeckoId) {
      coingeckoIds.add(a.coingeckoId.toLowerCase());
    } else if (!a.isNative && a.address?.startsWith('0x')) {
      const platform = COINGECKO_PLATFORM_MAP[a.chainId];
      if (platform) {
        if (!platformTokens[platform]) platformTokens[platform] = new Set();
        platformTokens[platform].add(a.address.toLowerCase());
      }
    }
  });

  const newPrices: PriceResult = {};

  try {
    // STAGE 1: Standard ID Batch
    if (coingeckoIds.size > 0) {
        const idPrices = await fetchPriceMap(Array.from(coingeckoIds));
        Object.entries(idPrices).forEach(([key, data]: [string, any]) => {
            newPrices[key.toLowerCase()] = { 
                price: typeof data === 'number' ? data : (data.usd || 0), 
                change: data.usd_24h_change || 0 
            };
        });
    }

    // STAGE 2: SEQUENTIAL CONTRACT BATCHING (Rate-Limit Sentinel)
    const platforms = Object.entries(platformTokens);
    for (const [platform, addresses] of platforms) {
        const contractPrices = await fetchPricesByContract(platform, Array.from(addresses));
        Object.entries(contractPrices).forEach(([key, data]: [string, any]) => {
            newPrices[key.toLowerCase()] = { 
                price: data.usd || 0, 
                change: data.usd_24h_change || 0 
            };
        });
        // Institutional Breather between chain nodes
        await sleep(200);
    }

    // STAGE 3: INSTITUTIONAL FALLBACK (CDN/Metadata Project)
    const missingTokens = allKnownAssets.filter(a => {
        const id = (a.priceId || a.coingeckoId || a.address || '').toLowerCase();
        return !newPrices[id];
    });

    if (missingTokens.length > 0 && logoSupabase) {
        try {
            const contractList = missingTokens.map(t => (t.address || '').toLowerCase()).filter(Boolean);
            const { data: metadataPrices } = await logoSupabase
                .from('token_metadata')
                .select('contract_address, token_details')
                .in('contract_address', contractList);

            if (metadataPrices) {
                metadataPrices.forEach(m => {
                    const price = m.token_details?.priceUsd;
                    if (price) {
                        newPrices[m.contract_address.toLowerCase()] = { 
                            price: price, 
                            change: m.token_details?.pctChange24h || 0 
                        };
                    }
                });
            }
        } catch (e) {
            console.warn("[CDN_FALLBACK_ADVISORY] Metadata sync deferred.");
        }
    }

    // 2. INTERNAL SETTLEMENT VALUATION (WNC)
    const ngnRate = currentRates['NGN'] || 1650;
    const wncCurrentPrice = 1 / ngnRate;
    const wncOpeningPrice = getWncOpeningPrice(wncCurrentPrice);
    const wncChange = calculateDelta(wncCurrentPrice, wncOpeningPrice);

    newPrices['internal:wnc'] = {
      price: wncCurrentPrice,
      change: wncChange
    };

  } catch (e) {
    console.warn("[MARKET_SERVICE_ERROR] Handshake interrupted:", e);
  }

  return newPrices;
}
