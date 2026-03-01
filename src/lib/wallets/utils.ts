
import type { WalletWithMetadata } from '@/lib/types';

/**
 * RESOLVES THE CORRECT ADDRESS FOR A GIVEN CHAIN
 * Ensures that if you are on XRP, you get the 'r...' address, 
 * if on Polkadot the SS58 address, and if on EVM the '0x...' address.
 */
export function getAddressForChain(chain: any, wallets: WalletWithMetadata[]): string | undefined {
  if (!wallets || !chain) return undefined;

  // Determine the target ecosystem type (defaulting to 'evm')
  const targetType = chain.type || 'evm';

  // Find the derived wallet that matches this specific chain ecosystem
  const matchingWallet = wallets.find((w) => w.type === targetType);

  // Fallback to the first wallet if no specific type match is found (unlikely)
  return matchingWallet?.address || wallets[0]?.address;
}
