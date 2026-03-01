
'use client';

import axios from 'axios';
import type { AssetRow, ChainConfig, IWalletAdapter } from '@/lib/types';

/**
 * Bitcoin (BTC) Adapter
 * Fetches balances from Blockstream's public API.
 */
class BitcoinAdapter implements IWalletAdapter {
    private apiUrl: string;

    constructor(chain: ChainConfig) {
        this.apiUrl = chain.rpcUrl; 
    }

    async fetchBalances(
        ownerAddress: string,
        assets: Omit<AssetRow, 'balance'>[]
    ): Promise<AssetRow[]> {
        try {
            const response = await axios.get(`${this.apiUrl}/address/${ownerAddress}`);
            const { funded_txo_sum, spent_txo_sum } = response.data.chain_stats;
            
            const balanceSats = funded_txo_sum - spent_txo_sum;
            const balanceBtc = (balanceSats / 100_000_000).toString();

            return assets.map(asset => {
                if (asset.symbol === 'BTC') {
                    return { ...asset, balance: balanceBtc } as AssetRow;
                }
                return { ...asset, balance: '0' } as AssetRow;
            });
        } catch (error: any) {
            console.warn(`[BTC_ADAPTER_ERROR] ${ownerAddress}:`, error.message);
            return assets.map(asset => ({ ...asset, balance: '0' }) as AssetRow);
        }
    }
}

export const bitcoinAdapterFactory = (chain: ChainConfig): IWalletAdapter | null => {
    if (chain.type === 'btc') return new BitcoinAdapter(chain);
    return null;
};
