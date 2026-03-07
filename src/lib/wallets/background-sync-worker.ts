
'use client';

import { supabase } from '@/lib/supabase/client';
import type { WalletWithMetadata, ChainConfig } from '@/lib/types';
import evmNetworks from '@/lib/evmNetworks.json';

/**
 * INSTITUTIONAL REGISTRY AUDIT WORKER
 * Version: 5.0.0 (Sequential Narrative Protocol)
 * 
 * Orchestrates a chain-by-chain audit of the local hardware node vs the cloud registry.
 * Drives the UI heartbeat via a granular progress callback.
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
    
    console.log(`[AUDIT_ENGINE] Starting institutional audit for ${totalChains} nodes.`);

    for (let i = 0; i < totalChains; i++) {
      const chain = allChains[i];
      const walletType = chain.type || 'evm';
      const localWallet = wallets.find(w => w.type === walletType);
      
      const fieldName = `${walletType}_address`;
      const localAddr = localWallet?.address || null;
      const cloudAddr = profile?.[fieldName] || null;

      // 1. STAGE: Incoming (Set Node Context)
      onProgress({
        status: 'scanning',
        chain: chain.symbol,
        localValue: localAddr,
        cloudValue: cloudAddr,
        progress: 0
      });

      // 2. STAGE: Processing (Simulated Heartbeat for 1200ms)
      const steps = 10;
      for (let s = 1; s <= steps; s++) {
        await new Promise(r => setTimeout(r, 120));
        onProgress({
          status: 'scanning',
          chain: chain.symbol,
          localValue: localAddr,
          cloudValue: cloudAddr,
          progress: (s / steps) * 100
        });
      }

      // 3. STAGE: Verification Pause (Dopamine Hit)
      await new Promise(r => setTimeout(r, 400));

      // 4. OPTIONAL: Repair Mismatch
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
    }

    // 5. STAGE: Finalization
    onProgress({
      status: 'completed',
      chain: 'Sync',
      localValue: null,
      cloudValue: null,
      progress: 100
    });

    // Auto-idle after 3 seconds
    setTimeout(() => {
      onProgress({
        status: 'idle',
        chain: '',
        localValue: null,
        cloudValue: null,
        progress: 0
      });
    }, 3000);
  }
};
