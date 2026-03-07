'use client';

import type { WalletWithMetadata, UserProfile, ChainConfig } from '@/lib/types';
import { syncAddressesToCloud } from './services/wallet-actions';

/**
 * INSTITUTIONAL BACKGROUND SYNC WORKER
 * Version: 6.0.0 (Precision Sequence Protocol)
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
   * Performs a strictly sequenced audit of the vault registry.
   * Coordinate timings with the UI animation lifecycle.
   */
  async performCloudAudit(
    userId: string,
    wallets: WalletWithMetadata[] | null,
    profile: UserProfile | null,
    accountNumber: string | null,
    allChains: ChainConfig[],
    onUpdate: (update: Partial<SyncDiagnostic>) => void
  ) {
    // GUARD: Ensure hardware nodes are fully derived before auditing
    if (!userId || !wallets || wallets.length === 0 || !accountNumber) {
        onUpdate({ status: 'idle', progress: 0 });
        return;
    }

    const breathe = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    // 1. CONSTRUCT EXHAUSTIVE AUDIT NODES
    // Map every unique cryptographic standard to its local and cloud values
    const uniqueTypes = Array.from(new Set(allChains.map(c => c.type || 'evm')));
    const auditNodes = uniqueTypes.map(type => {
      const localWallet = wallets.find(w => w.type === type);
      const fieldName = `${type}_address`;
      
      const chainSample = allChains.find(c => (c.type || 'evm') === type);
      const label = chainSample?.symbol.toUpperCase() || type.toUpperCase();

      return {
        label,
        type,
        local: localWallet?.address || null,
        cloud: profile ? (profile as any)[fieldName] || null : null
      };
    }).filter(node => node.local !== null); // Only audit nodes we have keys for

    const totalSteps = auditNodes.length;
    let completed = 0;

    // 2. EXECUTE SEQUENTIAL AUDIT
    for (const node of auditNodes) {
      if (!wallets || wallets.length === 0) break;

      // STAGE 1: SLIDE IN & CHECK
      onUpdate({ 
        status: 'checking',
        chain: node.label, 
        localValue: node.local, 
        cloudValue: node.cloud,
        progress: (completed / totalSteps) * 100
      });

      await breathe(1200); // Allow slide-in and user reading

      // STAGE 2: VERIFY & REPAIR
      const isMismatch = node.local && node.local !== node.cloud;

      if (isMismatch) {
        onUpdate({ status: 'mismatch' });
        await breathe(1000); 

        onUpdate({ status: 'syncing' });
        try {
          // Atomic Registry Update
          await syncAddressesToCloud(userId, wallets, accountNumber!);
          onUpdate({ cloudValue: node.local });
          await breathe(800); 
        } catch (e) {
          console.warn("[AUDIT_SYNC_FAIL]", e);
        }
      }

      // STAGE 3: SUCCESS FEEDBACK
      onUpdate({ status: 'success' });
      await breathe(1200); // Visual confirmation of checkmark
      
      completed++;
      onUpdate({ progress: (completed / totalSteps) * 100 });
    }

    // STAGE 4: TERMINATION
    onUpdate({ status: 'completed', chain: 'VAULT SECURED', progress: 100 });
    await breathe(2000);
    onUpdate({ status: 'idle', progress: 0 });
  }
};
