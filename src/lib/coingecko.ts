import type { AssetRow } from '@/lib/types';

const COINGECKO_API_URL = 'https://api.coingecko.com/api/v3';

/**
 * A generic fetcher function for CoinGecko API.
 * @param url The CoinGecko API URL to fetch.
 * @returns The JSON response.
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
 * Fetches prices and 24h change for a given list of base assets.
 * @param baseAssets An array of assets without price data.
 * @returns A promise that resolves to an array of assets with price data.
 */
export async function fetchAssetPrices(
    baseAssets: Omit<AssetRow, 'priceUsd' | 'fiatValueUsd' | 'pctChange24h'>[]
): Promise<AssetRow[]> {
    const coingeckoIds = baseAssets.map(a => a.coingeckoId).filter(Boolean) as string[];
    
    // Guard against making a request with no IDs.
    if (coingeckoIds.length === 0) {
        // Return assets with default zero values if no price data can be fetched.
        return baseAssets.map(asset => ({
            ...asset,
            priceUsd: 0,
            fiatValueUsd: 0,
            pctChange24h: 0,
        })) as AssetRow[];
    }

    const priceUrl = `${COINGECKO_API_URL}/simple/price?ids=${coingeckoIds.join(',')}&vs_currencies=usd&include_24hr_change=true`;
    const pricesData = await fetcher(priceUrl);

    const assetsWithData = baseAssets.map((asset) => {
        const priceInfo = asset.coingeckoId ? pricesData[asset.coingeckoId] : null;
        const priceUsd = priceInfo?.usd ?? 0;
        const balance = parseFloat(asset.balance);

        return {
            ...asset,
            priceUsd: priceUsd,
            fiatValueUsd: balance * priceUsd,
            pctChange24h: priceInfo?.usd_24h_change ?? 0,
        };
    });

    return assetsWithData as AssetRow[];
}


/**
 * Fetches historical chart data for a specific token from CoinGecko.
 * @param coingeckoId The CoinGecko ID of the token.
 * @param days The number of days to fetch data for ('1D', '7D', etc.).
 * @returns A promise that resolves to an array of chart data points.
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
        return []; // Return empty array on error
    }
}

/**
 * Fetches detailed market statistics for a single token.
 * @param coingeckoId The CoinGecko ID of the token.
 * @returns A promise that resolves to the detailed token data.
 */
export async function fetchSingleTokenDetails(coingeckoId: string) {
    const url = `${COINGECKO_API_URL}/coins/${coingeckoId}?localization=false&tickers=false&community_data=false&developer_data=false&sparkline=false`;
    return fetcher(url);
}
