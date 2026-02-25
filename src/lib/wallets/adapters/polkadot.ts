
'use client';

import { ApiPromise, WsProvider } from '@polkadot/api';
import type { AssetRow, ChainConfig, IWalletAdapter } from '@/lib/types';

/**
 * Polkadot (DOT) Adapter
 * Handles balance fetching via Substrate API.
 */
class PolkadotAdapter implements IWalletAdapter {
    private rpcUrl: string;

    constructor(chain: ChainConfig) {
        this.rpcUrl = chain.rpcUrl;
    }

    async fetchBalances(
        ownerAddress: string,
        assets: Omit<AssetRow, 'balance'>[]
    ): Promise<AssetRow[]> {
        let api: ApiPromise | null = null;
        try {
            const provider = new WsProvider(this.rpcUrl);
            api = await ApiPromise.create({ provider });

            const { data: balance } = await api.query.system.account(ownerAddress) as any;
            
            // 1 DOT = 10^10 planck
            const freeBalance = balance.free.toBigInt();
            const balanceDot = Number(freeBalance) / 10_000_000_000;

            return assets.map(asset => {
                if (asset.symbol === 'DOT') {
                    return { ...asset, balance: balanceDot.toString() } as AssetRow;
                }
                return { ...asset, balance: '0' } as AssetRow;
            });
        } catch (error: any) {
            console.warn("Polkadot Balance Fetch Error:", error.message);
            return assets.map(asset => ({ ...asset, balance: '0' }) as AssetRow);
        } finally {
            if (api) await api.disconnect();
        }
    }
}

export const polkadotAdapterFactory = (chain: ChainConfig): IWalletAdapter | null => {
    if (chain.type === 'polkadot') return new PolkadotAdapter(chain);
    return null;
};
