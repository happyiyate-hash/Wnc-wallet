
'use client';

import TronWeb from "tronweb";
import type { AssetRow, ChainConfig, IWalletAdapter } from '@/lib/types';

/**
 * TRON Protocol Adapter
 * Handles real-time balance discovery via the TRON Grid API.
 */
class TronAdapter implements IWalletAdapter {
    private tronWeb: TronWeb;

    constructor(chain: ChainConfig) {
        this.tronWeb = new TronWeb({
            fullHost: chain.rpcUrl || "https://api.trongrid.io"
        });
    }

    async fetchBalances(
        ownerAddress: string,
        assets: Omit<AssetRow, 'balance'>[]
    ): Promise<AssetRow[]> {
        try {
            // Fetch native TRX balance (unit: Sun)
            const balanceSun = await this.tronWeb.trx.getBalance(ownerAddress);
            const balanceTrx = (balanceSun / 1_000_000).toString();

            return assets.map(asset => {
                if (asset.symbol === 'TRX') {
                    return { ...asset, balance: balanceTrx } as AssetRow;
                }
                // TODO: Implement TRC20/TRC10 token discovery
                return { ...asset, balance: '0' } as AssetRow;
            });
        } catch (error: any) {
            console.warn(`[TRX_ADAPTER_ERROR] ${ownerAddress}:`, error.message);
            return assets.map(asset => ({ ...asset, balance: '0' }) as AssetRow);
        }
    }
}

export const tronAdapterFactory = (chain: ChainConfig): IWalletAdapter | null => {
    if (chain.type === 'tron') return new TronAdapter(chain);
    return null;
};
