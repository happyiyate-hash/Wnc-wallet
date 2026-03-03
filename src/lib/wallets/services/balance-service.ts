
'use client';

import type { AssetRow, ChainConfig, WalletWithMetadata } from '@/lib/types';
import { getInitialAssets } from '@/lib/wallets/balances';

/**
 * INSTITUTIONAL BALANCE SERVICE
 * Pure logic node for fetching account balances across multiple ecosystems.
 */
export async function fetchBalancesForChain(
  chain: ChainConfig,
  wallets: WalletWithMetadata[],
  infuraApiKey: string | null,
  userAddedTokens: AssetRow[]
): Promise<AssetRow[]> {
  const walletForChain = wallets.find(w => w.type === (chain.type || 'evm'));
  if (!walletForChain) return [];

  // Get available assets for this specific chain
  const base = getInitialAssets(chain.chainId).map(a => ({ ...a, balance: '0' } as AssetRow));
  const custom = userAddedTokens.filter(t => t.chainId === chain.chainId);
  const combinedAssetsList = [...base, ...custom].reduce((acc, curr) => {
    const identifier = curr.isNative ? curr.symbol : curr.address?.toLowerCase();
    if (!acc.find(a => (a.isNative ? a.symbol : a.address?.toLowerCase()) === identifier)) {
      acc.push(curr);
    }
    return acc;
  }, [] as AssetRow[]);

  try {
    const { evmAdapterFactory } = await import('@/lib/wallets/adapters/evm');
    const { xrpAdapterFactory } = await import('@/lib/wallets/adapters/xrp');
    const { polkadotAdapterFactory } = await import('@/lib/wallets/adapters/polkadot');
    const { kusamaAdapterFactory } = await import('@/lib/wallets/adapters/kusama');
    const { nearAdapterFactory } = await import('@/lib/wallets/adapters/near');
    const { solanaAdapterFactory } = await import('@/lib/wallets/adapters/solana');

    let adapter = null;
    if (chain.type === 'xrp') adapter = xrpAdapterFactory(chain);
    else if (chain.type === 'polkadot') adapter = polkadotAdapterFactory(chain);
    else if (chain.type === 'kusama') adapter = kusamaAdapterFactory(chain);
    else if (chain.type === 'near') adapter = nearAdapterFactory(chain);
    else if (chain.type === 'solana') adapter = solanaAdapterFactory(chain);
    else adapter = evmAdapterFactory(chain, infuraApiKey);

    if (adapter) {
      const results = await adapter.fetchBalances(walletForChain.address, combinedAssetsList);
      return results.map(r => ({ ...r, updatedAt: Date.now() }));
    }
  } catch (e) {
    console.warn(`Balance Fetch Advisory for ${chain.name}:`, e);
  }
  
  return combinedAssetsList;
}
