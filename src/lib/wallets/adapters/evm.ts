import { ethers } from 'ethers';
import type { AssetRow, ChainConfig, IWalletAdapter } from '@/lib/types';

const ERC20_ABI = [
    "function balanceOf(address owner) view returns (uint256)",
    "function decimals() view returns (uint8)"
];

const getRpcUrl = (chain: ChainConfig, apiKey: string | null): string | null => {
    const finalApiKey = apiKey || 'YOUR_INFURA_KEY_HERE';
    if (finalApiKey === 'YOUR_INFURA_KEY_HERE') {
        console.warn(`Using default/placeholder Infura RPC for ${chain.name}. Please provide an API key for production use.`);
    }
    if (!chain.rpcBase) return null;
    return `${chain.rpcBase}${finalApiKey}`;
}

class EvmAdapter implements IWalletAdapter {
    private provider: ethers.JsonRpcProvider | null;

    constructor(chain: ChainConfig, apiKey: string | null) {
        const rpcUrl = getRpcUrl(chain, apiKey);
        if (rpcUrl) {
            this.provider = new ethers.JsonRpcProvider(rpcUrl);
        } else {
            this.provider = null;
        }
    }

    async fetchBalances(
        ownerAddress: string,
        assets: Omit<AssetRow, 'balance'>[]
    ): Promise<AssetRow[]> {
        if (!this.provider) {
            console.error("EVM adapter is not initialized, provider is missing.");
            return assets.map(asset => ({ ...asset, balance: '0' }));
        }

        const provider = this.provider;

        const balancePromises = assets.map(async (asset): Promise<AssetRow> => {
            let balanceBigInt: bigint;
            try {
                if (asset.isNative) {
                    balanceBigInt = await provider.getBalance(ownerAddress);
                    return {
                        ...asset,
                        balance: ethers.formatEther(balanceBigInt),
                    };
                } else {
                    const tokenContract = new ethers.Contract(asset.address, ERC20_ABI, provider);
                    const [balance, decimals] = await Promise.all([
                        tokenContract.balanceOf(ownerAddress),
                        tokenContract.decimals()
                    ]);
                    
                    return {
                        ...asset,
                        balance: ethers.formatUnits(balance, decimals),
                    };
                }
            } catch (error) {
                console.error(`Failed to fetch balance for ${asset.symbol} on chain`, error);
                return {
                    ...asset,
                    balance: '0', // Return zero balance on error
                };
            }
        });

        return Promise.all(balancePromises);
    }
}

export const evmAdapterFactory = (chain: ChainConfig, apiKey: string | null): IWalletAdapter | null => {
    // This adapter is only for EVM chains. We can add checks here for chain type if needed later.
    return new EvmAdapter(chain, apiKey);
};