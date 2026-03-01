
'use client';

import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import type { AssetRow, ChainConfig, IWalletAdapter } from '@/lib/types';

/**
 * Solana (SOL) Adapter
 * Real-time balance fetching via Solana JSON-RPC.
 */
class SolanaAdapter implements IWalletAdapter {
    private connection: Connection;

    constructor(chain: ChainConfig) {
        this.connection = new Connection(chain.rpcUrl, "confirmed");
    }

    async fetchBalances(
        ownerAddress: string,
        assets: Omit<AssetRow, 'balance'>[]
    ): Promise<AssetRow[]> {
        try {
            const pubkey = new PublicKey(ownerAddress);
            const balance = await this.connection.getBalance(pubkey);
            const balanceSol = (balance / LAMPORTS_PER_SOL).toString();

            return assets.map(asset => {
                if (asset.symbol === 'SOL') {
                    return { ...asset, balance: balanceSol } as AssetRow;
                }
                // Placeholder for SPL tokens
                return { ...asset, balance: '0' } as AssetRow;
            });
        } catch (error: any) {
            console.warn(`[SOLANA_ADAPTER_ERROR] ${ownerAddress}:`, error.message);
            return assets.map(asset => ({ ...asset, balance: '0' }) as AssetRow);
        }
    }
}

export const solanaAdapterFactory = (chain: ChainConfig): IWalletAdapter | null => {
    if (chain.type === 'solana') return new SolanaAdapter(chain);
    return null;
};
