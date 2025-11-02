import { ethers } from 'ethers';
import type { AssetRow, ChainConfig } from '@/lib/types';
import evmNetworks from '@/lib/evmNetworks.json';

// In a real app, this would likely be a user-specific, stored list of tokens.
// For this example, we'll use a hardcoded list of common tokens per chain.
const MOCK_USER_ASSETS: { [key: number]: Omit<AssetRow, 'balance' | 'priceUsd' | 'fiatValueUsd' | 'pctChange24h' | 'iconUrl'>[] } = {
  1: [ // Ethereum
    { chainId: 1, address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', name: 'Ethereum', symbol: 'ETH', isNative: true, coingeckoId: 'ethereum' },
    { chainId: 1, address: '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984', name: 'Uniswap', symbol: 'UNI', coingeckoId: 'uniswap' },
    { chainId: 1, address: '0xdac17f958d2ee523a2206206994597c13d831ec7', name: 'Tether', symbol: 'USDT', coingeckoId: 'tether' },
  ],
  137: [ // Polygon
    { chainId: 137, address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', name: 'Matic', symbol: 'MATIC', isNative: true, coingeckoId: 'matic-network' },
    { chainId: 137, address: '0x7ceb23fd6bc0add59e62ac25578270cff1b9f619', name: 'Wrapped Ether', symbol: 'WETH', coingeckoId: 'weth' },
  ],
  10: [ // Optimism
    { chainId: 10, address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', name: 'Ethereum', symbol: 'ETH', isNative: true, coingeckoId: 'ethereum' },
    { chainId: 10, address: '0x4200000000000000000000000000000000000042', name: 'Optimism', symbol: 'OP', coingeckoId: 'optimism' },
  ],
  42161: [ // Arbitrum
    { chainId: 42161, address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', name: 'Ethereum', symbol: 'ETH', isNative: true, coingeckoId: 'ethereum' },
    { chainId: 42161, address: '0x912ce59144191c1204e64559fe8253a0e49e6548', name: 'Arbitrum', symbol: 'ARB', coingeckoId: 'arbitrum' },
  ],
  8453: [ // Base
    { chainId: 8453, address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', name: 'Ethereum', symbol: 'ETH', isNative: true, coingeckoId: 'ethereum' },
  ],
};

const ERC20_ABI = [
    "function balanceOf(address owner) view returns (uint256)",
    "function decimals() view returns (uint8)"
];

// Helper to get the initial list of assets for a chain
export function getInitialAssets(chainId: number): Omit<AssetRow, 'balance'>[] {
    return MOCK_USER_ASSETS[chainId] || [];
}

const getRpcUrl = (chain: ChainConfig) => {
    // In a real app, you would securely fetch the user's Infura API key
    const infuraApiKey = process.env.NEXT_PUBLIC_INFURA_API_KEY || 'YOUR_INFURA_KEY_HERE';
    if (infuraApiKey === 'YOUR_INFURA_KEY_HERE') {
        console.warn("Using default Infura RPC. Please provide an API key for production use.");
    }
    return `${chain.rpcBase}${infuraApiKey}`;
}

/**
 * Fetches the balances for a list of assets on a specific chain.
 * @param ownerAddress The address to check balances for.
 * @param assets The list of assets to check.
 * @param chain The configuration of the chain to connect to.
 * @returns A promise that resolves to an array of assets with their live balances.
 */
export async function fetchBalances(
    ownerAddress: string,
    assets: Omit<AssetRow, 'balance'>[],
    chain: ChainConfig
): Promise<AssetRow[]> {
    const rpcUrl = getRpcUrl(chain);
    const provider = new ethers.JsonRpcProvider(rpcUrl);

    const balancePromises = assets.map(async (asset) => {
        let balanceBigInt: bigint;
        try {
            if (asset.isNative) {
                balanceBigInt = await provider.getBalance(ownerAddress);
            } else {
                const tokenContract = new ethers.Contract(asset.address, ERC20_ABI, provider);
                const [balance, decimals] = await Promise.all([
                    tokenContract.balanceOf(ownerAddress),
                    tokenContract.decimals()
                ]);
                // We return the formatted balance directly for ERC20 tokens
                return {
                    ...asset,
                    balance: ethers.formatUnits(balance, decimals),
                };
            }
            // For native assets, we format it here
            return {
                ...asset,
                balance: ethers.formatEther(balanceBigInt),
            };

        } catch (error) {
            console.error(`Failed to fetch balance for ${asset.symbol} on ${chain.name}`, error);
            return {
                ...asset,
                balance: '0', // Return zero balance on error
            };
        }
    });

    return Promise.all(balancePromises);
}
