
'use client';

import evmNetworks from '@/lib/evmNetworks.json';
import { ChainConfig } from '@/lib/types';

/**
 * INSTITUTIONAL RPC REGISTRY
 * Version: 3.0.0 (39-Chain Synchronized)
 * Resolves verified RPC endpoints from environment variables or internal defaults.
 */

export function getRPC(chainName: string, infuraKey: string | null = null): string {
  const name = chainName.toLowerCase();

  // 1. Environment Variable Priority Handshake
  const envKey = name.toUpperCase().replace(/\s+/g, '_') + '_RPC';
  const customRpc = process.env[`NEXT_PUBLIC_${envKey}`] || process.env[envKey];
  if (customRpc) return customRpc;

  // 2. Registry Handshake (evmNetworks.json)
  const allChains = Object.values(evmNetworks) as ChainConfig[];
  const chain = allChains.find(c => 
    c.name.toLowerCase() === name || 
    c.symbol.toLowerCase() === name ||
    c.type?.toLowerCase() === name
  );

  if (chain) {
    return chain.rpcUrl.replace('{API_KEY}', infuraKey || '');
  }

  // 3. Protocol Defaults (Fallbacks)
  const defaults: Record<string, string> = {
    solana: 'https://api.mainnet-beta.solana.com',
    bitcoin: 'https://blockstream.info/api',
    litecoin: 'https://litecoinblockexplorer.net/api',
    dogecoin: 'https://explorer.dogecoinev.com/api',
    'xrp ledger': 'wss://xrplcluster.com',
    polkadot: 'wss://polkadot-rpc.publicnode.com',
    near: 'https://rpc.mainnet.near.org'
  };

  if (defaults[name]) return defaults[name];

  throw new Error(`RPC_NODE_NOT_FOUND: No verified endpoint for ${chainName}`);
}
