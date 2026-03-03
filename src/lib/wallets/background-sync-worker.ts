
'use client';

import { supabase } from '@/lib/supabase/client';
import type { WalletWithMetadata, UserProfile } from '@/lib/types';
import { syncAddressesToCloud } from './services/wallet-actions';

/**
 * INSTITUTIONAL BACKGROUND SYNC WORKER
 * Decouples heavy registry auditing from the UI thread.
 * Slowed cadence for high-fidelity deliberate handshake.
 */

export interface SyncDiagnostic {
  status: 'idle' | 'checking' | 'mismatch' | 'syncing' | 'success' | 'completed';
  chain: string | null;
  localValue: string | null;
  cloudValue: string | null;
  progress: number;
}

export const backgroundSyncWorker = {
  /**
   * Performs a high-fidelity audit of local addresses against the cloud registry.
   * Triggers background corrections if mismatches are detected.
   */
  async performCloudAudit(
    userId: string,
    wallets: WalletWithMetadata[],
    profile: UserProfile | null,
    accountNumber: string,
    onUpdate: (update: Partial<SyncDiagnostic>) => void
  ) {
    if (!userId || !wallets || wallets.length === 0) return;

    // Helper to yield the main thread for smooth animations (Extended beat)
    const breathe = (ms = 800) => new Promise(resolve => setTimeout(resolve, ms));

    onUpdate({ status: 'checking', progress: 5, chain: 'Registry' });
    await breathe(1000);

    const chainsToAudit = [
      { id: 'evm', name: 'Ethereum', field: 'evm_address' },
      { id: 'xrp', name: 'XRP Ledger', field: 'xrp_address' },
      { id: 'solana', name: 'Solana', field: 'solana_address' },
      { id: 'near', name: 'NEAR', field: 'near_address' },
      { id: 'polkadot', name: 'Polkadot', field: 'polkadot_address' }
    ];

    let detectedMismatches = false;
    const totalSteps = chainsToAudit.length;

    for (let i = 0; i < totalSteps; i++) {
      const config = chainsToAudit[i];
      const localWallet = wallets.find(w => w.type === config.id);
      const localAddr = localWallet?.address || null;
      const cloudAddr = (profile as any)?.[config.field] || null;

      onUpdate({ 
        chain: config.name, 
        localValue: localAddr, 
        cloudValue: cloudAddr,
        progress: 10 + ((i / totalSteps) * 40)
      });

      // Audit Logic
      if (localAddr && localAddr !== cloudAddr) {
        detectedMismatches = true;
        onUpdate({ status: 'mismatch' });
        await breathe(1500); // Allow user to see the mismatch (Red Alert)
      } else {
        await breathe(600); // Deliberate scanning beat
      }
    }

    // Secondary Check: Ensure Master Account Number is registered
    if (!profile?.account_number || profile.account_number !== accountNumber) {
        detectedMismatches = true;
    }

    // RECONCILIATION PHASE
    if (detectedMismatches) {
      onUpdate({ status: 'syncing', chain: 'Registry', progress: 60 });
      await breathe(1200);
      
      try {
        await syncAddressesToCloud(userId, wallets, accountNumber);
        onUpdate({ status: 'success', progress: 100 });
      } catch (e) {
        console.error("[WORKER_SYNC_FAIL]", e);
        onUpdate({ status: 'idle' });
        return;
      }
    } else {
      onUpdate({ status: 'completed', progress: 100 });
    }

    // Success Dwell (Extended)
    await breathe(2500);
    onUpdate({ status: 'idle', progress: 0 });
  }
};
