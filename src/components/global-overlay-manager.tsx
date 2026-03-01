
'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@/contexts/user-provider';
import { useWallet } from '@/contexts/wallet-provider';
import AuthSheet from '@/components/auth/auth-sheet';
import WalletManagementSheet from '@/components/wallet/wallet-management-sheet';
import CloudSyncCard from '@/components/wallet/cloud-sync-card';
import { usePathname, useRouter } from 'next/navigation';

/**
 * GLOBAL OVERLAY MANAGER
 * Centralized sentinel that enforces identity and onboarding flow.
 */
export default function GlobalOverlayManager() {
  const { user, profile, loading: userLoading } = useUser();
  const { wallets, isInitialized, isWalletLoading } = useWallet();
  const pathname = usePathname();
  const router = useRouter();

  const [isAuthOpen, setIsAuthOpen] = useState(false);

  // Define onboarding pages to avoid redirect loops
  const onboardingPages = ['/verify-email', '/complete-profile', '/wallet-session'];
  const isOnboardingPage = onboardingPages.includes(pathname);

  useEffect(() => {
    if (userLoading || !isInitialized || isWalletLoading) return;

    // 1. If no user, show Auth Sheet
    if (!user) {
      setIsAuthOpen(true);
      return;
    } else {
      setIsAuthOpen(false);
    }

    // 2. Email Verification Check
    if (!user.email_confirmed_at && pathname !== '/verify-email') {
      router.push(`/verify-email?email=${encodeURIComponent(user.email || '')}`);
      return;
    }

    // 3. Profile Completion Check (Need Username)
    if (user.email_confirmed_at && !profile?.name && pathname !== '/complete-profile') {
      router.push('/complete-profile');
      return;
    }

    // 4. Wallet Session Check
    if (profile?.name && (!wallets || wallets.length === 0) && pathname !== '/wallet-session' && !profile?.onboarding_completed) {
      router.push('/wallet-session');
      return;
    }

  }, [userLoading, isInitialized, isWalletLoading, user, profile, wallets, pathname, router]);

  return (
    <>
      <CloudSyncCard />
      <AuthSheet isOpen={isAuthOpen} onOpenChange={setIsAuthOpen} />
      {/* WalletManagementSheet kept for manual editing later, but flow now uses /wallet-session */}
    </>
  );
}
