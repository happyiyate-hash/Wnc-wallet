
'use client';

import {
  JsonRpcProvider,
  Connection,
} from "@mysten/sui.js";
import type { AssetRow, ChainConfig, IWalletAdapter } from '@/lib/types';

/**
 * Sui (SUI) Adapter
 * Handles real-time balance discovery via the Sui Fullnode API.
 */
class SuiAdapter implements IWalletAdapter {
    private provider: JsonRpcProvider;

    constructor(chain: ChainConfig) {
        this.provider = new JsonRpcProvider(new Connection({ fullnode: chain.rpcUrl }));
    }

    async fetchBalances(
        ownerAddress: string,
        assets: Omit<AssetRow, 'balance'>[]
    ): Promise<AssetRow[]> {
        try {
            // Sui balances are aggregated from coin objects
            const coins = await this.provider.getCoins({ 
                owner: ownerAddress, 
                coinType: "0x2::sui::SUI" 
            });
            
            let totalMist = 0;
            coins.data.forEach((c: any) => {
                totalMist += Number(c.balance);
            });

            // 1 SUI = 1,000,000,000 MIST
            const balanceSui = (totalMist / 1_000_000_000).toString();

            return assets.map(asset => {
                if (asset.symbol === 'SUI') {
                    return { ...asset, balance: balanceSui } as AssetRow;
                }
                // Placeholder for other Sui objects/tokens
                return { ...asset, balance: '0' } as AssetRow;
            });
        } catch (error: any) {
            console.warn(`[SUI_ADAPTER_ERROR] ${ownerAddress}:`, error.message);
            return assets.map(asset => ({ ...asset, balance: '0' }) as AssetRow);
        }
    }
}

export const suiAdapterFactory = (chain: ChainConfig): IWalletAdapter | null => {
    if (chain.type === 'sui') return new SuiAdapter(chain);
    return null;
};
