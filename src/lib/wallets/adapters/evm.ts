
'use client';

import { ethers } from 'ethers';
import type { AssetRow, ChainConfig, IWalletAdapter } from '@/lib/types';

/**
 * EVM Adapter
 * Handles all EVM and EVM-Compatible chains using standard JSON-RPC.
 */
class EvmAdapter implements IWalletAdapter {
    private provider: ethers.JsonRpcProvider | null = null;

    constructor(chain: ChainConfig, apiKey: string | null) {
        if (!apiKey) return;
        const rpcUrl = chain.rpcUrl.replace('{API_KEY}', apiKey);
        try {
            this.provider = new ethers.JsonRpcProvider(rpcUrl, undefined, { staticNetwork: true });
        } catch (e) {
            console.error(`EVM Provider Init Error for ${chain.name}:`, e);
        }
    }

    async fetchBalances(
        ownerAddress: string,
        assets: Omit<AssetRow, 'balance'>[]
    ): Promise<AssetRow[]> {
        if (!this.provider) {
            return assets.map(asset => ({ ...asset, balance: '0' }) as AssetRow);
        }

        const balancePromises = assets.map(async (asset): Promise<AssetRow> => {
            try {
                let balanceBigInt: bigint;
                const decimals = asset.decimals || 18;

                if (asset.isNative) {
                    balanceBigInt = await this.provider!.getBalance(ownerAddress);
                    return {
                        ...asset,
                        balance: ethers.formatUnits(balanceBigInt, decimals),
                    } as AssetRow;
                } else {
                    const abi = ["function balanceOf(address owner) view returns (uint256)"];
                    const contract = new ethers.Contract(asset.address, abi, this.provider!);
                    balanceBigInt = await contract.balanceOf(ownerAddress);
                    
                    return {
                        ...asset,
                        balance: ethers.formatUnits(balanceBigInt, decimals),
                    } as AssetRow;
                }
            } catch (error) {
                console.warn(`Failed to fetch balance for ${asset.symbol}:`, error);
                return { ...asset, balance: '0' } as AssetRow;
            }
        });

        return Promise.all(balancePromises);
    }
}

export const evmAdapterFactory = (chain: ChainConfig, apiKey: string | null): IWalletAdapter | null => {
    if (chain.type === 'evm') return new EvmAdapter(chain, apiKey);
    return null;
};
