
'use client';

import * as xrpl from 'xrpl';
import type { AssetRow, ChainConfig, IWalletAdapter } from '@/lib/types';

/**
 * XRP Ledger Adapter
 * Handles real-time balance fetching for XRPL accounts.
 */
class XrpAdapter implements IWalletAdapter {
    private rpcUrl: string;

    constructor(chain: ChainConfig) {
        this.rpcUrl = chain.rpcUrl;
    }

    async fetchBalances(
        ownerAddress: string,
        assets: Omit<AssetRow, 'balance'>[]
    ): Promise<AssetRow[]> {
        const client = new xrpl.Client(this.rpcUrl);
        try {
            await client.connect();
            const response = await client.request({
                command: "account_info",
                account: ownerAddress,
                ledger_index: "validated"
            });

            const balanceDrops = response.result.account_data.Balance;
            const balanceXrp = xrpl.dropsToXrp(balanceDrops);

            return assets.map(asset => {
                if (asset.symbol === 'XRP') {
                    return { ...asset, balance: balanceXrp } as AssetRow;
                }
                return { ...asset, balance: '0' } as AssetRow;
            });
        } catch (error: any) {
            // If account is not found, it likely has 0 balance or is not activated (needs 10 XRP)
            if (error.data?.error === 'actNotFound') {
                return assets.map(asset => ({ ...asset, balance: '0' }) as AssetRow);
            }
            console.warn("XRPL Balance Fetch Error:", error.message);
            return assets.map(asset => ({ ...asset, balance: '0' }) as AssetRow);
        } finally {
            await client.disconnect();
        }
    }
}

export const xrpAdapterFactory = (chain: ChainConfig): IWalletAdapter | null => {
    if (chain.type === 'xrp') return new XrpAdapter(chain);
    return null;
};
