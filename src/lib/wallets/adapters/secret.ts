
'use client';

import { StargateClient } from "@cosmjs/stargate";
import type { AssetRow, ChainConfig, IWalletAdapter } from '@/lib/types';

/**
 * Secret Network (SCRT) Adapter
 * Real-time balance fetching via Secret Tendermint RPC.
 */
class SecretAdapter implements IWalletAdapter {
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
            const balance = await client.getBalance(ownerAddress, "uscrt");
            
            // 1 SCRT = 1,000,000 uscrt
            const balanceScrt = (Number(balance.amount) / 1_000_000).toString();

            return assets.map(asset => {
                if (asset.symbol === 'SCRT') {
                    return { ...asset, balance: balanceScrt } as AssetRow;
                }
                return { ...asset, balance: '0' } as AssetRow;
            });
        } catch (error: any) {
            console.warn(`[SECRET_ADAPTER_ERROR] ${this.rpcUrl}:`, error.message);
            // Fallback to zero to prevent blocking the UI
            return assets.map(asset => ({ ...asset, balance: '0' }) as AssetRow);
        }
    }
}

export const secretAdapterFactory = (chain: ChainConfig): IWalletAdapter | null => {
    if (chain.type === 'secret') return new SecretAdapter(chain);
    return null;
};
