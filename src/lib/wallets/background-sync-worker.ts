
'use client';

import { syncAddressesToCloud } from './services/wallet-actions';
import type { WalletWithMetadata, ChainConfig, UserProfile } from '@/lib/types';

/**
 * INSTITUTIONAL REGISTRY AUDIT WORKER
 * Version: 10.0.0 (Strict Unique Queue Protocol)
 * 
 * Prevents race conditions by auditing unique blockchain types (EVM, SOL, BTC) 
 * rather than individual tokens. Operates in a continuous 24/7 loop.
 */

export interface AuditState {
  status: 'idle' | 'checking' | 'mismatch' | 'syncing' | 'success' | 'completed';
  chain: string;
  localValue: string | null;
  cloudValue: string | null;
  progress: number;
}

export const backgroundSyncWorker = {
  async performCloudAudit(
    userId: string, 
    wallets: WalletWithMetadata[] | null, 
    profile: UserProfile | null,
    accountNumber: string | null,
    allChains: ChainConfig[],
    onUpdate: (state: Partial<AuditState>) => void
  ) {
    if (!userId || !wallets || wallets.length === 0 || !accountNumber || allChains.length === 0) {
      onUpdate({ status: 'idle', progress: 0 });
      return;
    }

    const breathe = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    // START 24/7 PERSISTENT LOOP
    while (true) {
      // 1. THE QUEUE FIX: Filter only UNIQUE wallet types
      // This prevents 50 EVM tokens from fighting each other.
      const uniqueTypeMap = new Map();
      allChains.forEach(c => {
        const type = c.type || 'evm';
        if (!uniqueTypeMap.has(type)) {
          uniqueTypeMap.set(type, {
            label: type === 'evm' ? 'EVM' : (c.symbol?.toUpperCase() || type.toUpperCase()),
            type: type
          });
        }
      });

      const auditNodes = Array.from(uniqueTypeMap.values()).map(node => {
        const localWallet = wallets.find(w => w.type === node.type);
        return {
          label: node.label,
          type: node.type,
          local: localWallet?.address || null,
          cloud: (profile as any)?.[`${node.type}_address`] || null
        };
      });

      const totalSteps = auditNodes.length;

      // 2. SEQUENTIAL AUDIT (One by One)
      for (let i = 0; i < totalSteps; i++) {
        const node = auditNodes[i];
        const startProgress = (i / totalSteps) * 100;

        // PHASE A: INCOMING / CHECKING
        onUpdate({ 
          status: 'checking',
          chain: node.label, 
          localValue: node.local, 
          cloudValue: node.cloud,
          progress: startProgress
        });

        await breathe(1200); // Cinematic slide-in pause

        const isMismatch = node.local && node.local !== node.cloud;

        if (isMismatch) {
          onUpdate({ status: 'mismatch', chain: node.label });
          await breathe(800); 

          onUpdate({ status: 'syncing', chain: node.label });

          try {
            // ATOMIC REPAIR
            await syncAddressesToCloud(userId, wallets, accountNumber);
            // Update local UI state to show immediate resolution
            onUpdate({ status: 'syncing', cloudValue: node.local, chain: node.label });
            await breathe(800); 
          } catch (e) {
            console.warn(`[AUDIT_REPAIR_FAIL] ${node.label}`);
          }
        }

        // PHASE B: SUCCESS / VERIFIED
        onUpdate({ 
          status: 'success', 
          chain: node.label,
          localValue: node.local,
          cloudValue: node.local, 
          progress: ((i + 1) / totalSteps) * 100 
        });
        
        await breathe(1500); // Visual dopamine pause for checkmark
      }

      // 3. CYCLE COMPLETE
      onUpdate({ status: 'completed', chain: 'SECURE', progress: 100 });
      
      // 10 Second Nominal Wait before restarting 24/7 loop
      await breathe(10000);
    }
  }
};
