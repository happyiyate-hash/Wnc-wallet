
'use client';

import type { WalletWithMetadata, UserProfile, ChainConfig } from '@/lib/types';
import { syncAddressesToCloud } from './services/wallet-actions';

/**
 * INSTITUTIONAL BACKGROUND SYNC WORKER
 * Optimized for "Snap-Dwell-Snap" rhythm.
 * ensures logical verification stays visible while animations execute at full speed.
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
   * Forces the system to stop and verify each node one-by-one.
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
    // GROUP EVM: All EVM-compatible chains use the same address, so we check them as one "EVM" node.
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
      // PHASE 1: APPEAR (Snappy Transition)
      onUpdate({ 
        status: 'checking',
        chain: node.label, 
        localValue: node.localAddr, 
        cloudValue: node.cloudAddr,
        progress: (completed / totalSteps) * 100
      });

      // DWELL: Logic breathing time for comparison icon
      await breathe(800);

      // PHASE 2: LOGICAL COMPARISON
      const isMismatch = node.localAddr && node.localAddr !== node.cloudAddr;

      if (isMismatch) {
        // TRIGGER MISMATCH: Visual Alert (Red Progress + Spinner)
        onUpdate({ status: 'mismatch' });
        await breathe(800); 

        // REPAIR: Syncing phase (Wait for database confirmation)
        onUpdate({ status: 'syncing' });
        
        try {
          await syncAddressesToCloud(userId, wallets, accountNumber);
          // UI REFLECTION: Physically update the displayed cloud value to match local
          onUpdate({ cloudValue: node.localAddr });
          await breathe(500); 
        } catch (e) {
          console.error(`[REGISTRY_REPAIR_FAIL] ${node.label}:`, e);
          onUpdate({ status: 'idle' });
          return;
        }
      }

      // PHASE 3: VERIFIED (Stay for checkmark dwell)
      onUpdate({ status: 'success' });
      await breathe(1000); 
      
      completed++;
      onUpdate({ progress: (completed / totalSteps) * 100 });
      
      // FINAL SNAP: Wait briefly for snappy exit transition before next node
      await breathe(200);
    }

    // FINAL SUMMARY
    onUpdate({ status: 'completed', chain: 'VAULT', progress: 100 });
    await breathe(1500);
    onUpdate({ status: 'idle', progress: 0 });
  }
};
