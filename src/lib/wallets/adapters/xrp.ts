'use client';

import * as xrpl from 'xrpl';
import type { AssetRow, ChainConfig, IWalletAdapter } from '@/lib/types';

/**
 * XRP Ledger Adapter
 * Handles real-time balance fetching for XRPL accounts.
 * Hardened with connection timeouts and resilient WebSocket handling.
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
            // Add connection timeout to prevent hanging on unstable workstations
            await Promise.race([
                client.connect(),
                new Promise((_, reject) => setTimeout(() => reject(new Error('XRPL_CONNECTION_TIMEOUT')), 8000))
            ]);

            if (!client.isConnected()) {
                throw new Error("WS_NOT_CONNECTED");
            }

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
            // Handle websocket closure or account not found
            if (error.data?.error === 'actNotFound' || error.message?.includes('Account not found')) {
                return assets.map(asset => ({ ...asset, balance: '0' }) as AssetRow);
            }
            
            // Log warning but return zero to prevent background refresh crashes
            console.warn(`[XRPL_ADAPTER_ERROR] ${this.rpcUrl}:`, error.message || error);
            return assets.map(asset => ({ ...asset, balance: '0' }) as AssetRow);
        } finally {
            // Ensure client is disconnected even on error
            if (client.isConnected()) {
                try {
                    await client.disconnect();
                } catch (e) {
                    // Silent fail on disconnect
                }
            }
        }
    }
}

export const xrpAdapterFactory = (chain: ChainConfig): IWalletAdapter | null => {
    if (chain.type === 'xrp') return new XrpAdapter(chain);
    return null;
};
