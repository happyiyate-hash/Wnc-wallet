
'use client';

import type { WalletWithMetadata, UserProfile, ChainConfig } from '@/lib/types';
import { syncAddressesToCloud } from './services/wallet-actions';

/**
 * INSTITUTIONAL BACKGROUND SYNC WORKER
 * Optimized for grouped EVM verification and symbol-only branding.
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
   * Performs a sequential audit of the vault.
   * Groups all EVM chains into a single check to increase efficiency.
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

    // 2. CONSTRUCT GROUPED AUDIT SEQUENCE
    // We group all EVM chains because they share the same address derivation.
    const evmChains = allChains.filter(c => (c.type || 'evm') === 'evm');
    const nonEvmChains = allChains.filter(c => c.type && c.type !== 'evm');

    interface AuditNode {
      label: string;
      type: string;
      localAddr: string | null;
      cloudAddr: string | null;
    }

    const sequence: AuditNode[] = [];

    // Step A: Unified EVM Node
    if (evmChains.length > 0) {
      const localWallet = wallets.find(w => w.type === 'evm');
      sequence.push({
        label: 'EVM',
        type: 'evm',
        localAddr: localWallet?.address || null,
        cloudAddr: profile?.evm_address || null
      });
    }

    // Step B: Individual Non-EVM Symbols
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

    // 3. SEQUENTIAL VERIFICATION LOOP
    for (const node of sequence) {
      // STEP A: INITIALIZE SCAN
      onUpdate({ 
        status: 'checking',
        chain: node.label, 
        localValue: node.localAddr, 
        cloudValue: node.cloudAddr,
        progress: (completed / totalSteps) * 100
      });

      // Deliberate "Thinking" Beat
      await breathe(700);

      // STEP B: LOGICAL COMPARISON
      const isMismatch = node.localAddr && node.localAddr !== node.cloudAddr;

      if (isMismatch) {
        onUpdate({ status: 'mismatch' });
        await breathe(1200); // Visual alert dwell

        // STEP C: ATOMIC REGISTRY REPAIR
        onUpdate({ status: 'syncing' });
        
        try {
          // Perform bulk sync to ensure all related fields are updated
          await syncAddressesToCloud(userId, wallets, accountNumber);
          await breathe(800); // Confirmation dwell
        } catch (e) {
          console.error(`[REGISTRY_REPAIR_FAIL] ${node.label}:`, e);
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
    onUpdate({ status: 'completed', chain: 'VAULT', progress: 100 });
    
    // Final Dwell before dismissal
    await breathe(3500);
    onUpdate({ status: 'idle', progress: 0 });
  }
};
