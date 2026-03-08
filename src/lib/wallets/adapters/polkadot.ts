
'use client';

import { ApiPromise, WsProvider } from '@polkadot/api';
import type { AssetRow, ChainConfig, IWalletAdapter } from '@/lib/types';

/**
 * POLKADOT (DOT) ADAPTER - HARDENED VERSION
 * Version: 5.0.0 (Resilient Reconnect Protocol)
 * 
 * Implements strict provider-ready checks and auto-reconnect parameters
 * to mitigate "1006:: Abnormal Closure" errors on public RPC nodes.
 */

const DOT_ENDPOINTS = [
    "wss://rpc.polkadot.io",
    "wss://polkadot.api.onfinality.io/public-ws",
    "wss://dot.api.capy.node",
    "wss://polkadot-rpc.publicnode.com"
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
        const endpoints = [this.chain.rpcUrl, ...DOT_ENDPOINTS.filter(e => e !== this.chain.rpcUrl)];
        
        for (const url of endpoints) {
            let api: ApiPromise | null = null;
            let provider: WsProvider | null = null;

            try {
                // 1. Establish Provider with Auto-Reconnect & Long Timeout
                provider = new WsProvider(url, {
                    timeout: 30000,
                    reconnect: true
                }); 
                
                // 2. WAIT FOR PROVIDER READY (Critical Handshake)
                await Promise.race([
                    provider.isReady,
                    new Promise((_, reject) => setTimeout(() => reject(new Error('WS_CONNECT_TIMEOUT')), 10000))
                ]);

                // 3. Initialize API with high-fidelity error boundaries
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

                // 4. Verification Handshake
                await api.isReadyOrError;

                // 5. Execute Storage Query (Safe-mode)
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
                // Silencing expected socket closures to prevent UI noise
                const isNormalClosure = error.message?.includes('1000') || error.message?.includes('Normal Closure');
                if (!isNormalClosure) {
                    console.warn(`[DOT_ADAPTER_RECOVERY] Node ${url} deferred:`, error.message);
                }
                continue; 
            } finally {
                // 6. Clean Lifecycle Termination
                try {
                    if (api) await api.disconnect();
                    if (provider) await provider.disconnect();
                } catch (e) {}
            }
        }

        return assets.map(asset => ({ ...asset, balance: '0' }) as AssetRow);
    }
}

export const polkadotAdapterFactory = (chain: ChainConfig): IWalletAdapter | null => {
    if (chain.type === 'polkadot') return new PolkadotAdapter(chain);
    return null;
};
