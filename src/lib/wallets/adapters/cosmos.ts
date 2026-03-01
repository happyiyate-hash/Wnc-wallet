
'use client';

import { StargateClient } from "@cosmjs/stargate";
import type { AssetRow, ChainConfig, IWalletAdapter } from '@/lib/types';

/**
 * Cosmos Hub (ATOM) Adapter
 * Handles real-time balance fetching via Tendermint RPC.
 */
class CosmosAdapter implements IWalletAdapter {
    private rpcUrl: string;

    constructor(chain: ChainConfig) {
        this.rpcUrl = chain.rpcUrl;
    }

    async fetchBalances(
        ownerAddress: string,
        assets: Omit<AssetRow, 'balance'>[]
    ): Promise<AssetRow[]> {
        try {
            const client = await StargateClient.connect(this.rpcUrl);
            const balance = await client.getBalance(ownerAddress, "uatom");
            
            // 1 ATOM = 1,000,000 uatom
            const balanceAtom = (Number(balance.amount) / 1_000_000).toString();

            return assets.map(asset => {
                if (asset.symbol === 'ATOM') {
                    return { ...asset, balance: balanceAtom } as AssetRow;
                }
                return { ...asset, balance: '0' } as AssetRow;
            });
        } catch (error: any) {
            console.warn(`[COSMOS_ADAPTER_ERROR] ${this.rpcUrl}:`, error.message);
            // Fallback to zero to prevent UI blocking during background refresh
            return assets.map(asset => ({ ...asset, balance: '0' }) as AssetRow);
        }
    }
}

export const cosmosAdapterFactory = (chain: ChainConfig): IWalletAdapter | null => {
    if (chain.type === 'cosmos') return new CosmosAdapter(chain);
    return null;
};
