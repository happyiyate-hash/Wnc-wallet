
'use client';

import { ApiPromise, WsProvider } from '@polkadot/api';
import type { AssetRow, ChainConfig, IWalletAdapter } from '@/lib/types';

/**
 * Polkadot (DOT) Adapter
 * Hardened version with connection timeouts and resilient error handling.
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
        let provider: WsProvider | null = null;

        try {
            // Add a 10-second timeout to the provider initialization
            provider = new WsProvider(this.rpcUrl, 10000);
            
            // Connect with a specific timeout to prevent app hanging
            api = await Promise.race([
                ApiPromise.create({ provider }),
                new Promise<null>((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 12000))
            ]) as ApiPromise;

            if (!api) throw new Error("API_INIT_FAILED");

            // Wait for the specific "ready" state or fail fast
            await api.isReadyOrError;

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
            console.warn(`Polkadot Balance Fetch Silent Failure (${this.rpcUrl}):`, error.message);
            // Graceful fallback to zero to prevent UI blocking
            return assets.map(asset => ({ ...asset, balance: '0' }) as AssetRow);
        } finally {
            if (api) await api.disconnect();
            if (provider) await provider.disconnect();
        }
    }
}

export const polkadotAdapterFactory = (chain: ChainConfig): IWalletAdapter | null => {
    if (chain.type === 'polkadot') return new PolkadotAdapter(chain);
    return null;
};
