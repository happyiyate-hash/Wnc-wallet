'use client';

import type { WalletWithMetadata, UserProfile, ChainConfig } from '@/lib/types';
import { syncAddressesToCloud } from './services/wallet-actions';

/**
 * INSTITUTIONAL BACKGROUND SYNC WORKER
 * Optimized for grouped EVM verification and high-fidelity logical heartbeats.
 * HIGH-SPEED VERSION: Artificial delays reduced for faster execution while maintaining sequential integrity.
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
   * Forces the UI to wait for database responses and comparison results.
   */
  async performCloudAudit(
    userId: string,
    wallets: WalletWithMetadata[],
    profile: UserProfile | null,
    accountNumber: string,
    allChains: ChainConfig[],
    onUpdate: (update: Partial<SyncDiagnostic>) => void,
    checkAborted: () => boolean = () => false
  ) {
    if (!userId || !wallets || wallets.length === 0 || allChains.length === 0) return;

    // Helper for deliberate logical pauses (Secure Dwell Times)
    const breathe = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    // 1. Initial Settlement Pause
    onUpdate({ status: 'idle', progress: 0 });
    await breathe(1000); 

    // ABORT CHECK
    if (checkAborted()) { onUpdate({ status: 'idle' }); return; }

    // 2. CONSTRUCT AUDIT SEQUENCE
    const evmChains = allChains.filter(c => (c.type || 'evm') === 'evm');
    const nonEvmChains = allChains.filter(c => c.type && c.type !== 'evm');

    interface AuditNode {
      label: string;
      type: string;
      localAddr: string | null;
      cloudAddr: string | null;
    }

    const sequence: AuditNode[] = [];

    if (evmChains.length > 0) {
      const localWallet = wallets.find(w => w.type === 'evm');
      sequence.push({
        label: 'EVM',
        type: 'evm',
        localAddr: localWallet?.address || null,
        cloudAddr: profile?.evm_address || null
      });
    }

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

    // 3. HIGH-SPEED SEQUENTIAL AUDIT LOOP
    for (const node of sequence) {
      if (checkAborted()) {
        onUpdate({ status: 'idle' });
        return;
      }

      // STEP 1: INITIALIZE SCAN
      onUpdate({ 
        status: 'checking',
        chain: node.label, 
        localValue: node.localAddr, 
        cloudValue: node.cloudAddr,
        progress: (completed / totalSteps) * 100
      });

      await breathe(400); 

      // STEP 2: LOGICAL COMPARISON
      const isMismatch = node.localAddr && node.localAddr !== node.cloudAddr;

      if (isMismatch) {
        onUpdate({ status: 'mismatch' });
        await breathe(800); 

        if (checkAborted()) { onUpdate({ status: 'idle' }); return; }

        // STEP 3: ATOMIC REGISTRY REPAIR
        onUpdate({ status: 'syncing' });
        
        try {
          await syncAddressesToCloud(userId, wallets, accountNumber);
          onUpdate({ cloudValue: node.localAddr });
          await breathe(400); 
        } catch (e) {
          console.error(`[REGISTRY_REPAIR_FAIL] ${node.label}:`, e);
          onUpdate({ status: 'idle' });
          return;
        }
      }

      // STEP 5: VERIFICATION COMPLETE
      onUpdate({ status: 'success' });
      completed++;
      
      await breathe(200); 
      onUpdate({ progress: (completed / totalSteps) * 100 });
      await breathe(200); 
    }

    // FINAL STEP: AUDIT SUMMARY
    if (!checkAborted()) {
      onUpdate({ status: 'completed', chain: 'VAULT', progress: 100 });
      await breathe(2000); 
      onUpdate({ status: 'idle', progress: 0 });
    }
  }
};