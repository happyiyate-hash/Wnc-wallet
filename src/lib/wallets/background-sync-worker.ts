'use client';

import { supabase } from '@/lib/supabase/client';
import type { WalletWithMetadata, ChainConfig } from '@/lib/types';
import evmNetworks from '@/lib/evmNetworks.json';

/**
 * INSTITUTIONAL REGISTRY AUDIT WORKER
 * Version: 7.0.0 (Persistent Loop Protocol)
 * 
 * Orchestrates a continuous background audit of the local hardware node vs the cloud registry.
 * This worker runs indefinitely, pausing for 10s between full registry cycles.
 */

export interface AuditState {
  status: 'idle' | 'scanning' | 'repairing' | 'completed';
  chain: string;
  localValue: string | null;
  cloudValue: string | null;
  progress: number;
}

export const backgroundSyncWorker = {
  async performCloudAudit(
    userId: string, 
    wallets: WalletWithMetadata[], 
    profile: any,
    onProgress: (state: AuditState) => void
  ) {
    if (!supabase || !wallets || wallets.length === 0) return;

    const allChains = Object.values(evmNetworks) as ChainConfig[];
    const totalChains = allChains.length;
    
    // START PERSISTENT LOOP
    while (true) {
      for (let i = 0; i < totalChains; i++) {
        const chain = allChains[i];
        const walletType = chain.type || 'evm';
        const localWallet = wallets.find(w => w.type === walletType);
        
        const fieldName = `${walletType}_address`;
        const localAddr = localWallet?.address || null;
        const cloudAddr = profile?.[fieldName] || null;

        // 1. INCOMING
        onProgress({
          status: 'scanning',
          chain: chain.symbol,
          localValue: localAddr,
          cloudValue: cloudAddr,
          progress: 0
        });

        // 2. SCANNING BEAT
        const scanSteps = 8;
        for (let s = 1; s <= scanSteps; s++) {
          await new Promise(r => setTimeout(r, 100));
          onProgress({
            status: 'scanning',
            chain: chain.symbol,
            localValue: localAddr,
            cloudValue: cloudAddr,
            progress: (s / scanSteps) * 100
          });
        }

        // 3. REPAIR (SILENT)
        if (localAddr && localAddr !== cloudAddr) {
          try {
            await supabase
              .from('profiles')
              .update({ [fieldName]: localAddr })
              .eq('id', userId);
          } catch (e) {
            console.warn(`[AUDIT_REPAIR_FAIL] ${chain.symbol}`);
          }
        }

        // Wait for slide exit
        await new Promise(r => setTimeout(r, 800));
      }

      // 4. CYCLE COMPLETE: Institutional Wait (Nominal)
      onProgress({
        status: 'completed',
        chain: 'Audit',
        localValue: null,
        cloudValue: null,
        progress: 100
      });

      // 10 Second Cooldown before next full registry check
      await new Promise(r => setTimeout(r, 10000));
    }
  }
};
