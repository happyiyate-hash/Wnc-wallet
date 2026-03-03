
'use client';

import type { WalletWithMetadata, UserProfile } from '@/lib/types';
import { syncAddressesToCloud } from './services/wallet-actions';

/**
 * INSTITUTIONAL BACKGROUND SYNC WORKER
 * Implements a strict sequential handshake protocol.
 * Optimized for high-fidelity verification beats rather than raw speed.
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
   * Performs a high-fidelity, sequential audit of the vault.
   * Checks each node one-by-one with deliberate pauses for visual confirmation.
   */
  async performCloudAudit(
    userId: string,
    wallets: WalletWithMetadata[],
    profile: UserProfile | null,
    accountNumber: string,
    onUpdate: (update: Partial<SyncDiagnostic>) => void
  ) {
    if (!userId || !wallets || wallets.length === 0) return;

    // Helper for deliberate logical pauses (Smooth Beats)
    const breathe = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    // Initial Settlement Pause: Wait for dashboard to stabilize
    onUpdate({ status: 'idle', progress: 0 });
    await breathe(3000);

    const chainsToAudit = [
      { id: 'evm', name: 'Ethereum', field: 'evm_address' },
      { id: 'xrp', name: 'XRP Ledger', field: 'xrp_address' },
      { id: 'solana', name: 'Solana', field: 'solana_address' },
      { id: 'near', name: 'NEAR', field: 'near_address' },
      { id: 'polkadot', name: 'Polkadot', field: 'polkadot_address' }
    ];

    let totalMismatchesDetected = 0;
    const totalSteps = chainsToAudit.length;

    for (let i = 0; i < totalSteps; i++) {
      const config = chainsToAudit[i];
      const localWallet = wallets.find(w => w.type === config.id);
      const localAddr = localWallet?.address || null;
      const cloudAddr = (profile as any)?.[config.field] || null;

      // STEP 1: INITIALIZE SCAN
      onUpdate({ 
        status: 'checking',
        chain: config.name, 
        localValue: localAddr, 
        cloudValue: cloudAddr,
        progress: (i / totalSteps) * 100
      });

      // Deliberate "Thinking" Beat
      await breathe(1200);

      // STEP 2: LOGICAL COMPARISON
      const isMismatch = localAddr !== cloudAddr;

      if (isMismatch) {
        totalMismatchesDetected++;
        onUpdate({ status: 'mismatch' });
        await breathe(1500); // Let user see the red alert

        // STEP 3: ATOMIC CORRECTION
        onUpdate({ status: 'syncing' });
        
        try {
          // Real await: The animation stays on "Syncing" until the DB confirms success
          await syncAddressesToCloud(userId, wallets, accountNumber);
          await breathe(1000); // Visual stability pause
        } catch (e) {
          console.error(`[REGISTRY_REPAIR_FAIL] ${config.name}:`, e);
          onUpdate({ status: 'idle' });
          return;
        }
      }

      // STEP 4: VERIFICATION COMPLETE
      onUpdate({ status: 'success', progress: ((i + 1) / totalSteps) * 100 });
      await breathe(800); // Deliberate "Checked" state pause
    }

    // FINAL STEP: AUDIT SUMMARY
    onUpdate({ status: 'completed', chain: 'Registry', progress: 100 });
    
    // Final Dwell: Keep the success banner visible before gliding out
    await breathe(3000);
    onUpdate({ status: 'idle', progress: 0 });
  }
};
