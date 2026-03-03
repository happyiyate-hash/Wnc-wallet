
'use client';

import type { WalletWithMetadata, UserProfile, ChainConfig } from '@/lib/types';
import { syncAddressesToCloud } from './services/wallet-actions';

/**
 * INSTITUTIONAL BACKGROUND SYNC WORKER
 * Optimized for "Snap-Dwell-Snap" rhythm.
 * transitions are snappy, while verification states stay deliberate.
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
   * Performs a sequential, logic-gated audit of the vault.
   * Sharp transitions with intentional dwellers for readability.
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

    // Helper for deliberate logical pauses (Secure Dwell Times)
    const breathe = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    // 1. Initial Settlement Pause: App-ready buffer
    onUpdate({ status: 'idle', progress: 0 });
    await breathe(1000);

    // 2. CONSTRUCT AUDIT SEQUENCE (Symbol-Only Branding)
    const evmChains = allChains.filter(c => (c.type || 'evm') === 'evm');
    const nonEvmChains = allChains.filter(c => c.type && c.type !== 'evm');

    interface AuditNode {
      label: string;
      type: string;
      localAddr: string | null;
      cloudAddr: string | null;
    }

    const sequence: AuditNode[] = [];

    // Node A: Unified EVM Protocol
    if (evmChains.length > 0) {
      const localWallet = wallets.find(w => w.type === 'evm');
      sequence.push({
        label: 'EVM',
        type: 'evm',
        localAddr: localWallet?.address || null,
        cloudAddr: profile?.evm_address || null
      });
    }

    // Nodes B-Z: Ecosystem-Specific Symbols
    nonEvmChains.forEach(c => {
      const localWallet = wallets.find(w => w.type === c.type);
      const fieldName = `${c.type}_address`;
      sequence.push({
        label: c.symbol.toUpperCase(),
        type: c.type || 'unknown',
        localAddr: localWallet?.address || null,
        cloudAddr: (profile as any)?.[fieldName] || null
      });
    });

    const totalSteps = sequence.length;
    let completed = 0;

    // 3. SNAP-DWELL-SNAP AUDIT LOOP
    for (const node of sequence) {
      // STEP 1: APPEAR (Fast Transition triggered by chain change)
      onUpdate({ 
        status: 'checking',
        chain: node.label, 
        localValue: node.localAddr, 
        cloudValue: node.cloudAddr,
        progress: (completed / totalSteps) * 100
      });

      // DWELL: Stay for a bit so user can read addresses
      await breathe(800);

      // STEP 2: LOGICAL COMPARISON
      const isMismatch = node.localAddr && node.localAddr !== node.cloudAddr;

      if (isMismatch) {
        // TRIGGER MISMATCH: Immediate Visual Change
        onUpdate({ status: 'mismatch' });
        await breathe(1000); // Dwell on the mismatch state

        // REPAIR: Syncing phase
        onUpdate({ status: 'syncing' });
        
        try {
          await syncAddressesToCloud(userId, wallets, accountNumber);
          // UI REFLECTION: Update the displayed cloud side to match local
          onUpdate({ cloudValue: node.localAddr });
          await breathe(800); // Dwell on the fix
        } catch (e) {
          console.error(`[REGISTRY_REPAIR_FAIL] ${node.label}:`, e);
          onUpdate({ status: 'idle' });
          return;
        }
      }

      // STEP 3: VERIFIED (Success Dwell)
      onUpdate({ status: 'success' });
      
      // Deliberate Dwell on Success (Stay for a bit)
      await breathe(1000); 
      
      completed++;
      onUpdate({ progress: (completed / totalSteps) * 100 });
      
      // Post-dwell pause before snapping to next (triggers exit animation)
      await breathe(200);
    }

    // FINAL STEP: AUDIT SUMMARY
    onUpdate({ status: 'completed', chain: 'VAULT', progress: 100 });
    await breathe(2000);
    onUpdate({ status: 'idle', progress: 0 });
  }
};
