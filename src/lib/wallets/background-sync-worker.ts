'use client';

import type { WalletWithMetadata, UserProfile, ChainConfig } from '@/lib/types';
import { syncAddressesToCloud } from './services/wallet-actions';

/**
 * INSTITUTIONAL BACKGROUND SYNC WORKER
 * Version: 5.0.0 (Network-Aware Comparison Protocol)
 * 
 * Performs granular address matching between local storage and cloud registry.
 * Uses explicit blockchain identifiers to resolve "none" assumptions.
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
   * Performs a strict sequential audit of the vault registry per network.
   */
  async performCloudAudit(
    userId: string,
    wallets: WalletWithMetadata[] | null,
    profile: UserProfile | null,
    accountNumber: string | null,
    allChains: ChainConfig[],
    onUpdate: (update: Partial<SyncDiagnostic>) => void
  ) {
    if (!userId || !wallets || wallets.length === 0 || !accountNumber || allChains.length === 0) {
        onUpdate({ status: 'idle', progress: 0 });
        return;
    }

    const breathe = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    // 1. CONSTRUCT GRANULAR AUDIT SEQUENCE
    const auditNodes: { label: string; type: string; local: string | null; cloud: string | null }[] = [];

    // Group chains by their unique wallet types (EVM, BTC, SOL, etc.)
    const uniqueTypes = Array.from(new Set(allChains.map(c => c.type || 'evm')));

    uniqueTypes.forEach(type => {
      const localWallet = wallets.find(w => w.type === type);
      const fieldName = `${type}_address`;
      
      // Resolve the display label (e.g., 'EVM', 'XRP')
      const chainSample = allChains.find(c => (c.type || 'evm') === type);
      const label = type === 'evm' ? 'EVM' : (chainSample?.symbol.toUpperCase() || type.toUpperCase());

      auditNodes.push({
        label,
        type,
        local: localWallet?.address || null,
        cloud: (profile as any)?.[fieldName] || null
      });
    });

    const totalSteps = auditNodes.length;
    let completed = 0;

    // 2. EXECUTE NETWORK-SPECIFIC COMPARISON
    for (const node of auditNodes) {
      if (!wallets || wallets.length === 0) {
          onUpdate({ status: 'idle' });
          return;
      }

      onUpdate({ 
        status: 'checking',
        chain: node.label, 
        localValue: node.local, 
        cloudValue: node.cloud,
        progress: (completed / totalSteps) * 100
      });

      await breathe(600);

      // CRITICAL LOGIC: If local exists but cloud is missing or different, it's a mismatch.
      // We don't assume "none" means synchronized if a local node is active.
      const isMismatch = node.local && node.local !== node.cloud;

      if (isMismatch) {
        onUpdate({ status: 'mismatch' });
        await breathe(800); 

        onUpdate({ status: 'syncing' });
        
        try {
          // Trigger atomic repair node
          await syncAddressesToCloud(userId, wallets, accountNumber!);
          onUpdate({ cloudValue: node.local });
          await breathe(400); 
        } catch (e) {
          console.error(`[SYNC_REPAIR_FAIL] ${node.label}:`, e);
          onUpdate({ status: 'idle' });
          return;
        }
      }

      onUpdate({ status: 'success' });
      await breathe(600); 
      
      completed++;
      onUpdate({ progress: (completed / totalSteps) * 100 });
    }

    onUpdate({ status: 'completed', chain: 'ALL NODES', progress: 100 });
    await breathe(1500);
    onUpdate({ status: 'idle', progress: 0 });
  }
};
