'use client';

import { supabase } from '@/lib/supabase/client';
import type { WalletWithMetadata } from '@/lib/types';

/**
 * INSTITUTIONAL WALLET ACTIONS SERVICE
 * Handles data persistence, cloud synchronization, and cache management.
 * Optimized for secure encryption-first storage.
 */

export async function syncAddressesToCloud(
  userId: string,
  wallets: WalletWithMetadata[],
  accountNumber: string
) {
  if (!supabase) return;

  try {
    const { error } = await supabase
      .from('profiles')
      .update({ 
        account_number: accountNumber, 
        updated_at: new Date().toISOString(),
        evm_address: wallets.find(w => w.type === 'evm')?.address,
        xrp_address: wallets.find(w => w.type === 'xrp')?.address,
        polkadot_address: wallets.find(w => w.type === 'polkadot')?.address,
        kusama_address: wallets.find(w => w.type === 'kusama')?.address,
        near_address: wallets.find(w => w.type === 'near')?.address,
        solana_address: wallets.find(w => w.type === 'solana')?.address,
        btc_address: wallets.find(w => w.type === 'btc')?.address,
        ltc_address: wallets.find(w => w.type === 'ltc')?.address,
        doge_address: wallets.find(w => w.type === 'doge')?.address,
        cosmos_address: wallets.find(w => w.type === 'cosmos')?.address,
        osmosis_address: wallets.find(w => w.type === 'osmosis')?.address,
        secret_address: wallets.find(w => w.type === 'secret')?.address,
        injective_address: wallets.find(w => w.type === 'injective')?.address,
        celestia_address: wallets.find(w => w.type === 'celestia')?.address,
        cardano_address: wallets.find(w => w.type === 'cardano')?.address,
        tron_address: wallets.find(w => w.type === 'tron')?.address,
        algorand_address: wallets.find(w => w.type === 'algorand')?.address,
        hedera_address: wallets.find(w => w.type === 'hedera')?.address,
        tezos_address: wallets.find(w => w.type === 'tezos')?.address,
        aptos_address: wallets.find(w => w.type === 'aptos')?.address,
        sui_address: wallets.find(w => w.type === 'sui')?.address,
      })
      .eq('id', userId);

    if (error) throw error;
  } catch (e: any) {
    console.error("Registry Sync Interrupted:", e.message);
    throw e;
  }
}

export async function saveVaultToCloud(userId: string, mnemonic: string) {
  if (!supabase) return;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch('/api/wallet/encrypt-phrase', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json', 
        'Authorization': `Bearer ${session?.access_token}` 
      },
      body: JSON.stringify({ phrase: mnemonic })
    });
    
    if (res.ok) {
      const data = await res.json();
      await supabase.from('profiles').update({
        vault_phrase: data.encrypted,
        iv: data.iv
      }).eq('id', userId);
    }
  } catch (e) {
    console.error("Vault Backup Advisory:", e);
  }
}

export async function saveInfuraToCloud(userId: string, apiKey: string) {
  if (!supabase) return;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch('/api/wallet/encrypt-phrase', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json', 
        'Authorization': `Bearer ${session?.access_token}` 
      },
      body: JSON.stringify({ text: apiKey })
    });
    
    if (res.ok) {
      const data = await res.json();
      await supabase.from('profiles').update({
        vault_infura_key: data.encrypted,
        infura_iv: data.iv
      }).eq('id', userId);
    }
  } catch (e) {
    console.error("Infura Backup Advisory:", e);
  }
}

export function purgeLocalWalletCache(userId: string) {
  const keys = [
    'wallet_mnemonic', 
    'infura_api_key', 
    'account_number', 
    'custom_tokens', 
    'hidden_tokens',
    'profile_cache',
    'audit_done'
  ];
  keys.forEach(key => {
    localStorage.removeItem(`${key}_${userId}`);
    // Also remove global keys to prevent any leakage
    localStorage.removeItem(key);
  });
}
