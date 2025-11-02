import { ethers } from 'ethers';
import type { AssetRow, ChainConfig, IWalletAdapter } from '@/lib/types';

const ERC20_ABI = [
    "function balanceOf(address owner) view returns (uint256)",
    "function decimals() view returns (uint8)"
];

const getRpcUrl = (chain: ChainConfig): string => {
    // In a real app, you would securely fetch the user's Infura API key
    const infuraApiKey = process.env.NEXT_PUBLIC_INFURA_API_KEY || 'YOUR_INFURA_KEY_HERE';
    if (infuraApiKey === 'YOUR_INFURA_KEY_HERE') {
        console.warn(`Using default Infura RPC for ${chain.name}. Please provide an API key for production use.`);
    }
    return `${chain.rpcBase}${infuraApiKey}`;
}

class EvmAdapter implements IWalletAdapter {
    private provider: ethers.JsonRpcProvider;

    constructor(chain: ChainConfig) {
        const rpcUrl = getRpcUrl(chain);
        this.provider = new ethers.JsonRpcProvider(rpcUrl);
    }

    async fetchBalances(
        ownerAddress: string,
        assets: Omit<AssetRow, 'balance'>[]
    ): Promise<AssetRow[]> {
        const balancePromises = assets.map(async (asset): Promise<AssetRow> => {
            let balanceBigInt: bigint;
            try {
                if (asset.isNative) {
                    balanceBigInt = await this.provider.getBalance(ownerAddress);
                    return {
                        ...asset,
                        balance: ethers.formatEther(balanceBigInt),
                    };
                } else {
                    const tokenContract = new ethers.Contract(asset.address, ERC20_ABI, this.provider);
                    // Use Promise.all to fetch balance and decimals concurrently
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

export const evmAdapterFactory = (chain: ChainConfig): IWalletAdapter => {
    return new EvmAdapter(chain);
};
