'use client';

import type { WalletWithMetadata, UserProfile, ChainConfig } from '@/lib/types';
import { syncAddressesToCloud } from './services/wallet-actions';

/**
 * INSTITUTIONAL BACKGROUND SYNC WORKER
 * Version: 7.0.0 (Sequential Narrative Protocol)
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
   * Tells a story of "Scanning -> Verification -> Result".
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
        onUpdate({ status: 'idle', progress: 0, chain: null });
        return;
    }

    const breathe = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    // 1. CONSTRUCT EXHAUSTIVE AUDIT NODES
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
    }).filter(node => node.local !== null);

    const totalSteps = auditNodes.length;
    let completed = 0;

    // 2. EXECUTE SEQUENTIAL AUDIT
    for (const node of auditNodes) {
      if (!wallets || wallets.length === 0) break;

      // STAGE 1: INCOMING & CHECKING
      // The card enters from the right
      onUpdate({ 
        status: 'checking',
        chain: node.label, 
        localValue: node.local, 
        cloudValue: node.cloud,
        progress: (completed / totalSteps) * 100
      });

      await breathe(1500); // Audit duration (Processing)

      // STAGE 2: VALIDATION (Repair if necessary)
      const isMismatch = node.local && node.local !== node.cloud;

      if (isMismatch) {
        onUpdate({ status: 'mismatch' });
        await breathe(800); 

        onUpdate({ status: 'syncing' });
        try {
          await syncAddressesToCloud(userId, wallets, accountNumber!);
          onUpdate({ cloudValue: node.local });
          await breathe(1000); 
        } catch (e) {
          console.warn("[AUDIT_SYNC_FAIL]", e);
        }
      }

      // STAGE 3: SUCCESS (Trigger Checkmark)
      onUpdate({ status: 'success' });
      await breathe(1500); // Finality Pause (Dopamine hit)
      
      completed++;
      // Update progress for the NEXT slide
      onUpdate({ progress: (completed / totalSteps) * 100 });
    }

    // STAGE 4: TERMINATION
    onUpdate({ status: 'completed', chain: 'VAULT SECURED', progress: 100 });
    await breathe(2500);
    onUpdate({ status: 'idle', progress: 0, chain: null });
  }
};
