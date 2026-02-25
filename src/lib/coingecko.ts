
const COINGECKO_API_URL = 'https://api.coingecko.com/api/v3';

/**
 * CoinGecko Platform IDs mapped from Chain IDs
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
    130: 'unichain'
};

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
 */
export async function fetchPriceMap(ids: string[]): Promise<{ [id: string]: { usd: number, usd_24h_change: number } }> {
    if (ids.length === 0) return {};
    
    // Ensure unique, clean IDs
    const uniqueIds = Array.from(new Set(ids.filter(Boolean).map(id => id.toLowerCase().trim())));
    if (uniqueIds.length === 0) return {};
    
    try {
        const priceUrl = `${COINGECKO_API_URL}/simple/price?ids=${uniqueIds.join(',')}&vs_currencies=usd&include_24hr_change=true`;
        return await fetcher(priceUrl);
    } catch (e) {
        console.warn("CoinGecko fetchPriceMap failed:", e);
        return {};
    }
}

/**
 * Fetches prices for tokens on a specific platform using contract addresses.
 * CRITICAL: Addresses MUST be lowercased for CoinGecko.
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
        
        const result: any = {};
        Object.entries(data).forEach(([addr, info]: [string, any]) => {
            result[addr.toLowerCase()] = {
                usd: info.usd,
                usd_24h_change: info.usd_24h_change
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
export async function fetchChartData(coingeckoId: string, days: string) {
    const daysParam = days === '1D' ? '1' : days.slice(0, -1);
    const url = `${COINGECKO_API_URL}/coins/${coingeckoId.toLowerCase()}/market_chart?vs_currency=usd&days=${daysParam}`;
    
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
    const url = `${COINGECKO_API_URL}/coins/${coingeckoId.toLowerCase()}?localization=false&tickers=false&community_data=false&developer_data=false&sparkline=false`;
    return fetcher(url);
}
