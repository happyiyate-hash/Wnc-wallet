
'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@/contexts/user-provider';
import { useWallet } from '@/contexts/wallet-provider';
import CloudSyncCard from '@/components/wallet/cloud-sync-card';
import { usePathname, useRouter } from 'next/navigation';

/**
 * GLOBAL IDENTITY SENTINEL
 * Enforces route protection and onboarding state management.
 */
export default function GlobalOverlayManager() {
  const { user, profile, loading: userLoading } = useUser();
  const { wallets, isInitialized, isWalletLoading } = useWallet();
  const pathname = usePathname();
  const router = useRouter();

  // Define route groups
  const isAuthRoute = pathname.startsWith('/auth');
  const isOnboardingRoute = ['/complete-profile', '/wallet-session'].includes(pathname);
  const isProtectedRoute = !isAuthRoute && !isOnboardingRoute && pathname !== '/';

  useEffect(() => {
    if (userLoading || !isInitialized || isWalletLoading) return;

    // 1. ROUTE PROTECTION: Redirect to login if session missing
    if (!user) {
      if (!isAuthRoute) {
        router.replace('/auth/login');
      }
      return;
    }

    // 2. ONBOARDING SEQUENCE: Verify Email
    if (!user.email_confirmed_at) {
      if (pathname !== '/auth/verify-email') {
        router.replace(`/auth/verify-email?email=${encodeURIComponent(user.email || '')}`);
      }
      return;
    }

    // 3. ONBOARDING SEQUENCE: Complete Profile
    if (!profile?.name && pathname !== '/complete-profile') {
      router.replace('/complete-profile');
      return;
    }

    // 4. ONBOARDING SEQUENCE: Establish Wallet
    if (profile?.name && (!wallets || wallets.length === 0) && pathname !== '/wallet-session' && !profile?.onboarding_completed) {
      router.replace('/wallet-session');
      return;
    }

    // 5. REDIRECT: If on auth/onboarding but everything is ready, go home
    if ((isAuthRoute || isOnboardingRoute) && profile?.onboarding_completed && wallets && wallets.length > 0) {
      router.replace('/');
    }

  }, [userLoading, isInitialized, isWalletLoading, user, profile, wallets, pathname, router, isAuthRoute, isOnboardingRoute]);

  return (
    <>
      <CloudSyncCard />
    </>
  );
}
