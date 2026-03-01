
'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@/contexts/user-provider';
import { useWallet } from '@/contexts/wallet-provider';
import AuthSheet from '@/components/auth/auth-sheet';
import WalletManagementSheet from '@/components/wallet/wallet-management-sheet';
import CloudSyncCard from '@/components/wallet/cloud-sync-card';

/**
 * GLOBAL OVERLAY MANAGER
 * Centralized sentinel that enforces identity and wallet requirements app-wide.
 * Optimized to prevent flickering during omni-chain identity handshake.
 */
export default function GlobalOverlayManager() {
  const { user, loading: userLoading } = useUser();
  const { wallets, isInitialized, isWalletLoading } = useWallet();

  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isWalletSetupOpen, setIsWalletSetupOpen] = useState(false);

  // APP SETTLED CHECK: Ensure core identity, wallet context, and key derivation are ALL established.
  const isSettled = !userLoading && isInitialized && !isWalletLoading;

  useEffect(() => {
    // If the system is still establishing nodes, do nothing to prevent layout flickering.
    if (!isSettled) {
      setIsAuthOpen(false);
      setIsWalletSetupOpen(false);
      return;
    }

    // RULE 1: If not logged in, show Auth Sheet
    if (!user) {
      setIsAuthOpen(true);
      setIsWalletSetupOpen(false);
    } 
    // RULE 2: If logged in but no wallet derived (and derivation is finished), show Setup Sheet
    else if (!wallets || wallets.length === 0) {
      setIsAuthOpen(false);
      setIsWalletSetupOpen(true);
    } 
    // ALL GOOD: Close overlays
    else {
      setIsAuthOpen(false);
      setIsWalletSetupOpen(false);
    }
  }, [isSettled, user, wallets]);

  return (
    <>
      <CloudSyncCard />
      <AuthSheet isOpen={isAuthOpen} onOpenChange={setIsAuthOpen} />
      <WalletManagementSheet isOpen={isWalletSetupOpen} onOpenChange={setIsWalletSetupOpen} />
    </>
  );
}
