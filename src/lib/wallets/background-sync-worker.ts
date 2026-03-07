'use client';

import type { WalletWithMetadata, UserProfile, ChainConfig } from '@/lib/types';
import { syncAddressesToCloud } from './services/wallet-actions';

/**
 * INSTITUTIONAL BACKGROUND SYNC WORKER
 * Version: 5.1.0 (Stable Sequence Protocol)
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
   * Slowed down for visual clarity and human-readable verification.
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

    // 1. CONSTRUCT AUDIT NODES
    // We group by unique wallet types to audit each cryptographic standard once
    const uniqueTypes = Array.from(new Set(allChains.map(c => c.type || 'evm')));
    const auditNodes = uniqueTypes.map(type => {
      const localWallet = wallets.find(w => w.type === type);
      const fieldName = `${type}_address`;
      
      const chainSample = allChains.find(c => (c.type || 'evm') === type);
      const label = type === 'evm' ? 'EVM' : (chainSample?.symbol.toUpperCase() || type.toUpperCase());

      return {
        label,
        type,
        local: localWallet?.address || null,
        cloud: (profile as any)?.[fieldName] || null
      };
    });

    const totalSteps = auditNodes.length;
    let completed = 0;

    // 2. EXECUTE SEQUENTIAL AUDIT
    for (const node of auditNodes) {
      // Periodic hardware check
      if (!wallets || wallets.length === 0) break;

      onUpdate({ 
        status: 'checking',
        chain: node.label, 
        localValue: node.local, 
        cloudValue: node.cloud,
        progress: (completed / totalSteps) * 100
      });

      await breathe(1000); // Wait for user to read the entry

      // Check for node mismatch
      const isMismatch = node.local && node.local !== node.cloud;

      if (isMismatch) {
        onUpdate({ status: 'mismatch' });
        await breathe(1200); 

        onUpdate({ status: 'syncing' });
        try {
          await syncAddressesToCloud(userId, wallets, accountNumber!);
          onUpdate({ cloudValue: node.local });
          await breathe(800); 
        } catch (e) {
          onUpdate({ status: 'idle' });
          return;
        }
      }

      onUpdate({ status: 'success' });
      await breathe(1000); // Visual confirmation of checkmark
      
      completed++;
      onUpdate({ progress: (completed / totalSteps) * 100 });
    }

    onUpdate({ status: 'completed', chain: 'SECURED', progress: 100 });
    await breathe(2000);
    onUpdate({ status: 'idle', progress: 0 });
  }
};
