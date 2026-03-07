
'use client';

import { supabase } from '@/lib/supabase/client';
import type { WalletWithMetadata, ChainConfig } from '@/lib/types';
import evmNetworks from '@/lib/evmNetworks.json';

/**
 * INSTITUTIONAL REGISTRY AUDIT WORKER
 * Version: 6.0.0 (Sequential Heartbeat Protocol)
 * 
 * Orchestrates a chain-by-chain audit of the local hardware node vs the cloud registry.
 * Each chain follows a strict 0-100% "Scanning" lifecycle for visual logical flow.
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
    if (!supabase || !wallets || wallets.length === 0) {
        console.log("[AUDIT_ENGINE] Deferred: Hardware nodes not yet derived.");
        return;
    }

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

      // 1. PHASE: INCOMING (Prepare Data Node)
      onProgress({
        status: 'scanning',
        chain: chain.symbol,
        localValue: localAddr,
        cloudValue: cloudAddr,
        progress: 0
      });

      // Give the slide animation a moment to settle
      await new Promise(r => setTimeout(r, 200));

      // 2. PHASE: SCANNING (Heartbeat Progress 0 -> 100)
      const scanSteps = 10;
      for (let s = 1; s <= scanSteps; s++) {
        // Human-readable scan pace
        await new Promise(r => setTimeout(r, 120));
        
        onProgress({
          status: 'scanning',
          chain: chain.symbol,
          localValue: localAddr,
          cloudValue: cloudAddr,
          progress: (s / scanSteps) * 100
        });
      }

      // 3. PHASE: VERIFICATION PAUSE (Visual Validation)
      // This is the "Dopamine Pause" where the checkmark appears
      await new Promise(r => setTimeout(r, 450));

      // 4. OPTIONAL: REPAIR
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

      // Final wait before sliding to next chain
      await new Promise(r => setTimeout(r, 200));
    }

    // 5. PHASE: FINALIZATION
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
