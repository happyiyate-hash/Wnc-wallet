const COINGECKO_API_URL = 'https://api.coingecko.com/api/v3';

/**
 * CoinGecko Platform IDs mapped from Chain IDs
 * Comprehensive mapping for institutional asset discovery.
 */
export const COINGECKO_PLATFORM_MAP: { [chainId: number]: string } = {
    1: 'ethereum',
    137: 'polygon-pos',
    10: 'optimistic-ethereum',
    42161: 'arbitrum-one',
    8453: 'base',
    56: 'binance-smart-chain',
    43114: 'avalanche',
    59144: 'linea',
    250: 'fantom',
    42220: 'celo',
    324: 'zksync',
    534352: 'scroll',
    5000: 'mantle',
    1329: 'sei-network',
    130: 'unichain',
    81457: 'blast',
    204: 'opbnb',
    43111: 'hemi',
    1923: 'swell-network',
    11297108109: 'palm'
};

/**
 * A generic fetcher function for CoinGecko API.
 */
async function fetcher(url: string) {
    try {
        const res = await fetch(url);
        if (!res.ok) {
            const error = new Error(`CoinGecko Error: ${res.status}`);
            console.warn(`[COINGECKO_FETCH_WARNING] ${url} returned ${res.status}`);
            throw error;
        }
        return res.json();
    } catch (e) {
        return null;
    }
}

/**
 * Generates synthetic historical data for internal assets (WNC).
 * Fluctuates relative to a base value to simulate a "live" comparison chart.
 */
function generateInternalChartData(baseValue: number, days: string) {
    const data = [];
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    
    let daysNum = 1;
    if (days === '1W') daysNum = 7;
    else if (days === '1M') daysNum = 30;
    else if (days === '3M') daysNum = 90;
    else if (days === '1Y') daysNum = 365;
    else if (days === 'All') daysNum = 730;

    const points = days === '1D' ? 48 : 100;
    const interval = (daysNum * dayMs) / points;

    // Start from a simulated past value and walk to the current baseValue
    // This ensures the chart ends at the "current" price shown in the UI
    let currentValue = baseValue * (1 + (Math.random() * 0.1 - 0.05)); // +/- 5% start
    const stepSize = (baseValue - currentValue) / points;

    for (let i = 0; i <= points; i++) {
        const time = now - ((points - i) * interval);
        // Add random walk "noise"
        const noise = 1 + (Math.random() * 0.01 - 0.005); 
        currentValue = (currentValue + stepSize) * noise;
        
        // Ensure we strictly end at baseValue for the last point
        const finalVal = i === points ? baseValue : currentValue;
        data.push({ time, price: finalVal });
    }
    return data;
}

/**
 * Fetches a map of prices and 24h changes for a list of CoinGecko IDs.
 */
export async function fetchPriceMap(ids: string[]): Promise<{ [id: string]: { usd: number, usd_24h_change: number } }> {
    if (ids.length === 0) return {};
    
    const uniqueIds = Array.from(new Set(ids.filter(Boolean).map(id => id.toLowerCase().trim())));
    if (uniqueIds.length === 0) return {};
    
    try {
        const priceUrl = `${COINGECKO_API_URL}/simple/price?ids=${uniqueIds.join(',')}&vs_currencies=usd&include_24hr_change=true`;
        const data = await fetcher(priceUrl);
        return data || {};
    } catch (e) {
        console.warn("CoinGecko fetchPriceMap failed:", e);
        return {};
    }
}

/**
 * Fetches prices for tokens on a specific platform using contract addresses.
 */
export async function fetchPricesByContract(platformId: string, addresses: string[]): Promise<{ [address: string]: { usd: number, usd_24h_change: number } }> {
    if (!platformId || addresses.length === 0) return {};
    
    const cleanAddresses = addresses
        .filter(addr => addr && addr.startsWith('0x'))
        .map(addr => addr.toLowerCase().trim())
        .join(',');
        
    if (!cleanAddresses) return {};

    try {
        const url = `${COINGECKO_API_URL}/simple/token_price/${platformId}?contract_addresses=${cleanAddresses}&vs_currencies=usd&include_24hr_change=true`;
        const data = await fetcher(url);
        
        if (!data) return {};

        const result: any = {};
        Object.entries(data).forEach(([addr, info]: [string, any]) => {
            result[addr.toLowerCase()] = {
                usd: info.usd || 0,
                usd_24h_change: info.usd_24h_change || 0
            };
        });
        return result;
    } catch (e) {
        console.warn(`CoinGecko contract fetch failed for ${platformId}:`, e);
        return {};
    }
}

/**
 * Fetches historical chart data for a specific token from CoinGecko.
 */
export async function fetchChartData(coingeckoId: string, days: string, currentPrice?: number) {
    // Handle Internal WNC Handshake with dynamic current price
    if (coingeckoId === 'internal:wnc') {
        const price = currentPrice || 0.000606;
        return generateInternalChartData(price, days);
    }

    const daysParam = days === '1D' ? '1' : days.slice(0, -1);
    const url = `${COINGECKO_API_URL}/coins/${coingeckoId.toLowerCase()}/market_chart?vs_currency=usd&days=${daysParam}`;
    
    try {
        const data = await fetcher(url);
        if (!data || !data.prices) return [];
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
export async function fetchSingleTokenDetails(coingeckoId: string, currentPrice?: number) {
    if (coingeckoId === 'internal:wnc') {
        const price = currentPrice || 0.000606;
        return {
            id: 'wnc',
            symbol: 'wnc',
            name: 'Wevina Cloud',
            market_cap_rank: 0,
            market_data: {
                current_price: { usd: price },
                high_24h: { usd: price * 1.02 },
                low_24h: { usd: price * 0.98 },
                price_change_percentage_24h: 1.25,
                market_cap: { usd: 0 },
                total_volume: { usd: 0 },
                circulating_supply: 0,
                total_supply: 0,
                max_supply: null,
                ath: { usd: price * 1.5 },
                atl: { usd: price * 0.5 }
            }
        };
    }
    const url = `${COINGECKO_API_URL}/coins/${coingeckoId.toLowerCase()}?localization=false&tickers=false&community_data=false&developer_data=false&sparkline=false`;
    return fetcher(url);
}