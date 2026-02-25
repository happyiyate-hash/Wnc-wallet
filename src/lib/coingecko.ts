import type { AssetRow } from '@/lib/types';

const COINGECKO_API_URL = 'https://api.coingecko.com/api/v3';

/**
 * A generic fetcher function for CoinGecko API.
 */
async function fetcher(url: string) {
    const res = await fetch(url);
    if (!res.ok) {
        const error = new Error('An error occurred while fetching CoinGecko data.');
        try {
            const info = await res.json();
            console.error('CoinGecko API Error:', info);
        } catch (e) {
            console.error('Could not parse CoinGecko error JSON');
        }
        throw error;
    }
    return res.json();
}

/**
 * Fetches a map of prices and 24h changes for a list of CoinGecko IDs.
 * Independent of balances or chains.
 */
export async function fetchPriceMap(ids: string[]): Promise<{ [id: string]: { usd: number, usd_24h_change: number } }> {
    if (ids.length === 0) return {};
    
    // Remove duplicates and empty strings
    const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
    
    try {
        const priceUrl = `${COINGECKO_API_URL}/simple/price?ids=${uniqueIds.join(',')}&vs_currencies=usd&include_24hr_change=true`;
        return await fetcher(priceUrl);
    } catch (e) {
        console.warn("CoinGecko fetchPriceMap failed:", e);
        return {};
    }
}

/**
 * DEPRECATED: Use fetchPriceMap for independent price fetching.
 * Kept for backward compatibility if needed by other components.
 */
export async function fetchAssetPrices(
    baseAssets: Omit<AssetRow, 'priceUsd' | 'fiatValueUsd' | 'pctChange24h'>[]
): Promise<AssetRow[]> {
    const ids = baseAssets.map(a => a.coingeckoId).filter(Boolean) as string[];
    const pricesData = await fetchPriceMap(ids);

    return baseAssets.map((asset) => {
        const priceInfo = asset.coingeckoId ? pricesData[asset.coingeckoId] : null;
        const priceUsd = priceInfo?.usd ?? 0;
        const balance = parseFloat(asset.balance);

        return {
            ...asset,
            priceUsd: priceUsd,
            fiatValueUsd: balance * priceUsd,
            pctChange24h: priceInfo?.usd_24h_change ?? 0,
        };
    }) as AssetRow[];
}

/**
 * Fetches historical chart data for a specific token from CoinGecko.
 */
export async function fetchChartData(coingeckoId: string, days: string) {
    const daysParam = days === '1D' ? '1' : days.slice(0, -1);
    const url = `${COINGECKO_API_URL}/coins/${coingeckoId}/market_chart?vs_currency=usd&days=${daysParam}`;
    
    try {
        const data = await fetcher(url);
        return data.prices.map(([timestamp, price]: [number, number]) => ({
            time: timestamp,
            price: price,
        }));
    } catch (error) {
        console.error(`Failed to fetch chart data for ${coingeckoId}`, error);
        return [];
    }
}

/**
 * Fetches detailed market statistics for a single token.
 */
export async function fetchSingleTokenDetails(coingeckoId: string) {
    const url = `${COINGECKO_API_URL}/coins/${coingeckoId}?localization=false&tickers=false&community_data=false&developer_data=false&sparkline=false`;
    return fetcher(url);
}
