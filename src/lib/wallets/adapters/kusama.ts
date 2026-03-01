
'use client';

import { ApiPromise, WsProvider } from '@polkadot/api';
import type { AssetRow, ChainConfig, IWalletAdapter } from '@/lib/types';

/**
 * Kusama (KSM) Adapter
 * Optimized for Substrate-based balance discovery via WebSocket.
 */
class KusamaAdapter implements IWalletAdapter {
    private rpcUrl: string;

    constructor(chain: ChainConfig) {
        this.rpcUrl = chain.rpcUrl;
    }

    async fetchBalances(
        ownerAddress: string,
        assets: Omit<AssetRow, 'balance'>[]
    ): Promise<AssetRow[]> {
        let api: ApiPromise | null = null;
        let provider: WsProvider | null = null;

        try {
            provider = new WsProvider(this.rpcUrl, 10000);
            
            api = await Promise.race([
                ApiPromise.create({ provider }),
                new Promise<null>((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 12000))
            ]) as ApiPromise;

            if (!api) throw new Error("API_INIT_FAILED");

            await api.isReadyOrError;

            const { data: balance } = await api.query.system.account(ownerAddress) as any;
            
            // 1 KSM = 10^12 planck
            const freeBalance = balance.free.toBigInt();
            const balanceKsm = Number(freeBalance) / 1_000_000_000_000;

            return assets.map(asset => {
                if (asset.symbol === 'KSM') {
                    return { ...asset, balance: balanceKsm.toString() } as AssetRow;
                }
                return { ...asset, balance: '0' } as AssetRow;
            });
        } catch (error: any) {
            console.warn(`Kusama Balance Fetch Failure (${this.rpcUrl}):`, error.message);
            return assets.map(asset => ({ ...asset, balance: '0' }) as AssetRow);
        } finally {
            if (api) await api.disconnect();
            if (provider) await provider.disconnect();
        }
    }
}

export const kusamaAdapterFactory = (chain: ChainConfig): IWalletAdapter | null => {
    if (chain.type === 'kusama') return new KusamaAdapter(chain);
    return null;
};
