
'use client';

import { ApiPromise, WsProvider } from '@polkadot/api';
import type { AssetRow, ChainConfig, IWalletAdapter } from '@/lib/types';

/**
 * POLKADOT (DOT) ADAPTER - HARDENED VERSION
 * Implements Fallback RPCs and strict socket lifecycle management.
 */

const DOT_ENDPOINTS = [
    "wss://rpc.polkadot.io",
    "wss://polkadot-rpc.publicnode.com",
    "wss://polkadot.api.onfinality.io/public-ws",
    "wss://dot.api.capy.node"
];

class PolkadotAdapter implements IWalletAdapter {
    private chain: ChainConfig;

    constructor(chain: ChainConfig) {
        this.chain = chain;
    }

    async fetchBalances(
        ownerAddress: string,
        assets: Omit<AssetRow, 'balance'>[]
    ): Promise<AssetRow[]> {
        // Start with the configured RPC, then try fallbacks
        const endpoints = [this.chain.rpcUrl, ...DOT_ENDPOINTS.filter(e => e !== this.chain.rpcUrl)];
        
        for (const url of endpoints) {
            let api: ApiPromise | null = null;
            let provider: WsProvider | null = null;

            try {
                console.log(`[DOT_ADAPTER] Attempting connection to ${url}`);
                provider = new WsProvider(url, 5000); // 5s connection timeout
                
                // Hardened initialization with racing timeout
                api = await Promise.race([
                    ApiPromise.create({ 
                        provider,
                        throwOnConnect: true,
                        noInitWarn: true 
                    }),
                    new Promise<null>((_, reject) => 
                        setTimeout(() => reject(new Error('POLKADOT_INIT_TIMEOUT')), 15000)
                    )
                ]) as ApiPromise;

                if (!api) throw new Error("INIT_FAILED");

                // Wait for the API to be ready (metadata fetched)
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
                console.warn(`[DOT_ADAPTER_FAIL] Endpoint ${url} rejected:`, error.message);
                // Cycle to next endpoint
                continue;
            } finally {
                // CRITICAL: Always purge sockets to prevent 1006 Abnormal Closure on subsequent fetches
                if (api) await api.disconnect().catch(() => {});
                if (provider) await provider.disconnect().catch(() => {});
            }
        }

        // If all fallbacks fail, return zero to keep UI stable
        return assets.map(asset => ({ ...asset, balance: '0' }) as AssetRow);
    }
}

export const polkadotAdapterFactory = (chain: ChainConfig): IWalletAdapter | null => {
    if (chain.type === 'polkadot') return new PolkadotAdapter(chain);
    return null;
};
