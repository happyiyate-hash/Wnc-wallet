
'use client';

import type { WalletWithMetadata, UserProfile, ChainConfig } from '@/lib/types';
import { syncAddressesToCloud } from './services/wallet-actions';

/**
 * INSTITUTIONAL BACKGROUND SYNC WORKER
 * Optimized for logic-gated "Snap-Dwell-Snap" rhythm.
 * Force-terminates if wallet state becomes null.
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
   * Performs a strict sequential audit of the vault registry.
   */
  async performCloudAudit(
    userId: string,
    wallets: WalletWithMetadata[] | null,
    profile: UserProfile | null,
    accountNumber: string | null,
    allChains: ChainConfig[],
    onUpdate: (update: Partial<SyncDiagnostic>) => void
  ) {
    // 1. PRE-FLIGHT GUARD: Terminate if wallet state is missing
    if (!userId || !wallets || wallets.length === 0 || !accountNumber || allChains.length === 0) {
        onUpdate({ status: 'idle', progress: 0 });
        return;
    }

    const breathe = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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

    // Nodes B-Z: Ecosystem-Specific Symbols (BTC, XRP, SOL, etc.)
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

    // 3. STRICT SEQUENTIAL HANDSHAKE LOOP
    for (const node of sequence) {
      // MID-FLIGHT GUARD: Check if wallet was deleted during the loop
      if (!wallets || wallets.length === 0) {
          onUpdate({ status: 'idle', progress: 0 });
          return;
      }

      onUpdate({ 
        status: 'checking',
        chain: node.label, 
        localValue: node.localAddr, 
        cloudValue: node.cloudAddr,
        progress: (completed / totalSteps) * 100
      });

      await breathe(800);

      const isMismatch = node.localAddr && node.localAddr !== node.cloudAddr;

      if (isMismatch) {
        onUpdate({ status: 'mismatch' });
        await breathe(800); 

        onUpdate({ status: 'syncing' });
        
        try {
          // Trigger atomic repair
          await syncAddressesToCloud(userId, wallets, accountNumber!);
          // UI REFLECTION: Physically update displayed cloud value to match local
          onUpdate({ cloudValue: node.localAddr });
          await breathe(500); 
        } catch (e) {
          console.error(`[REGISTRY_REPAIR_FAIL] ${node.label}:`, e);
          onUpdate({ status: 'idle' });
          return;
        }
      }

      // PHASE 3: VERIFIED
      onUpdate({ status: 'success' });
      await breathe(1000); 
      
      completed++;
      onUpdate({ progress: (completed / totalSteps) * 100 });
      await breathe(200);
    }

    onUpdate({ status: 'completed', chain: 'VAULT', progress: 100 });
    await breathe(1500);
    onUpdate({ status: 'idle', progress: 0 });
  }
};
