
'use client';

import type { WalletWithMetadata, UserProfile, ChainConfig } from '@/lib/types';
import { syncAddressesToCloud } from './services/wallet-actions';

/**
 * INSTITUTIONAL BACKGROUND SYNC WORKER
 * Implements a strict SEQUENTIAL handshake protocol.
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
   * Checks every node in the registry one-by-one with deliberate logical pauses.
   */
  async performCloudAudit(
    userId: string,
    wallets: WalletWithMetadata[],
    profile: UserProfile | null,
    accountNumber: string,
    allChains: ChainConfig[],
    onUpdate: (update: Partial<SyncDiagnostic>) => void
  ) {
    if (!userId || !wallets || wallets.length === 0 || allChains.length === 0) return;

    // Helper for deliberate logical pauses (Secure Beats)
    const breathe = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    // 1. Initial Settlement Pause: Wait for dashboard to stabilize
    onUpdate({ status: 'idle', progress: 0 });
    await breathe(3000);

    const totalSteps = allChains.length;
    let completed = 0;

    // 2. SEQUENTIAL HANDSHAKE LOOP
    // We use a for...of loop to ensure we AWAIT every single operation
    for (const chain of allChains) {
      const localWallet = wallets.find(w => w.type === (chain.type || 'evm'));
      const localAddr = localWallet?.address || null;
      
      // Determine which field in UserProfile corresponds to this chain
      const fieldName = chain.type === 'evm' ? 'evm_address' : `${chain.type}_address`;
      const cloudAddr = (profile as any)?.[fieldName] || null;

      // STEP A: INITIALIZE SCAN
      onUpdate({ 
        status: 'checking',
        chain: chain.name.toUpperCase(), 
        localValue: localAddr, 
        cloudValue: cloudAddr,
        progress: (completed / totalSteps) * 100
      });

      // Deliberate "Thinking" Beat - Allows the user to read the chain name
      await breathe(700);

      // STEP B: LOGICAL COMPARISON (Real Logic Gating)
      const isMismatch = localAddr && localAddr !== cloudAddr;

      if (isMismatch) {
        onUpdate({ status: 'mismatch' });
        await breathe(1200); // Visual alert dwell

        // STEP C: ATOMIC REGISTRY REPAIR
        onUpdate({ status: 'syncing' });
        
        try {
          // Perform bulk sync but within the loop context to ensure data is updated for next iterations
          await syncAddressesToCloud(userId, wallets, accountNumber);
          await breathe(800); // Confirmation dwell
        } catch (e) {
          console.error(`[REGISTRY_REPAIR_FAIL] ${chain.name}:`, e);
          onUpdate({ status: 'idle' });
          return;
        }
      }

      // STEP D: VERIFICATION COMPLETE
      completed++;
      onUpdate({ 
        status: 'success', 
        progress: (completed / totalSteps) * 100 
      });
      
      // Verification heartbeat pause
      await breathe(400);
    }

    // FINAL STEP: AUDIT SUMMARY
    onUpdate({ status: 'completed', chain: 'REGISTRY', progress: 100 });
    
    // Final Dwell: Professional confirmation before dismissal
    await breathe(3500);
    onUpdate({ status: 'idle', progress: 0 });
  }
};
