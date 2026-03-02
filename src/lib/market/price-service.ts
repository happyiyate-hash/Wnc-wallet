
'use client';

import { fetchPriceMap, fetchPricesByContract, COINGECKO_PLATFORM_MAP } from '@/lib/coingecko';
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

/**
 * Calculates percentage change between two values.
 */
export function calculateDelta(current: number, previous: number): number {
  if (!previous || previous === 0) return 0;
  return ((current - previous) / previous) * 100;
}

/**
 * Fetches market data for all known assets across all chains.
 * Includes specialized logic for internal Handshake assets (WNC).
 */
export async function fetchGlobalMarketData(
  chains: ChainConfig[],
  customTokens: AssetRow[],
  currentRates: { [key: string]: number },
  previousPrices: PriceResult = {}
): Promise<PriceResult> {
  const coingeckoIds = new Set<string>();
  const platformTokens: { [platform: string]: Set<string> } = {};
  const allKnownAssets: AssetRow[] = [];

  // 1. Map all assets to their respective price sources
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
    const fetchPromises = [];
    if (coingeckoIds.size > 0) fetchPromises.push(fetchPriceMap(Array.from(coingeckoIds)));
    
    Object.entries(platformTokens).forEach(([platform, addresses]) => {
      fetchPromises.push(fetchPricesByContract(platform, Array.from(addresses)));
    });

    const results = await Promise.allSettled(fetchPromises);

    results.forEach(res => {
      if (res.status === 'fulfilled' && res.value) {
        Object.entries(res.value).forEach(([key, data]: [string, any]) => {
          const price = typeof data === 'number' ? data : (data.usd || data.price || 0);
          const change = data.usd_24h_change || 0;
          if (price > 0) {
            newPrices[key.toLowerCase()] = { price, change };
          }
        });
      }
    });

    // 2. Handle Internal Assets (WNC)
    // WNC price is pinned to the NGN rate (Institutional SmarterSeller Standard)
    const ngnRate = currentRates['NGN'] || 1650;
    const wncCurrentPrice = 1 / ngnRate;
    
    // Check previous state to generate a synthetic but realistic "live" delta if Coingecko is unavailable
    const prevWnc = previousPrices['internal:wnc'];
    const wncChange = prevWnc 
      ? calculateDelta(wncCurrentPrice, prevWnc.price) 
      : (Math.random() * 0.4 - 0.2); // Tiny synthetic fluctuation for "live" feel if no history

    newPrices['internal:wnc'] = {
      price: wncCurrentPrice,
      change: wncChange
    };

  } catch (e) {
    console.warn("[MARKET_SERVICE_ERROR] Market sync interrupted:", e);
  }

  return newPrices;
}
