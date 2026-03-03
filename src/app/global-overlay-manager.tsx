
'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@/contexts/user-provider';
import { useWallet } from '@/contexts/wallet-provider';
import CloudSyncCard from '@/components/wallet/cloud-sync-card';
import { usePathname, useRouter } from 'next/navigation';

/**
 * GLOBAL IDENTITY SENTINEL
 * Hardened route protection and onboarding state management.
 * Decouples user session from wallet state.
 */
export default function GlobalOverlayManager() {
  const { user, profile, loading: userLoading } = useUser();
  const { wallets, isInitialized, isWalletLoading } = useWallet();
  const pathname = usePathname();
  const router = useRouter();

  // Define route groups
  const isAuthRoute = pathname.startsWith('/auth');
  const isWalletSessionRoute = pathname === '/wallet-session';
  const isCompleteProfileRoute = pathname === '/complete-profile';
  
  useEffect(() => {
    if (userLoading || !isInitialized || isWalletLoading) return;

    // 1. SESSION PROTECTION: Redirect to login if unauthenticated
    if (!user) {
      if (!isAuthRoute) {
        router.replace('/auth/login');
      }
      return;
    }

    // 2. ONBOARDING SEQUENCE: Verify Email (Skip for Google)
    const isOAuth = user.app_metadata?.provider && user.app_metadata.provider !== 'email';
    if (!user.email_confirmed_at && !isOAuth) {
      if (pathname !== '/auth/signup' || !pathname.includes('verify=true')) {
        router.replace(`/auth/signup?verify=true&email=${encodeURIComponent(user.email || '')}`);
      }
      return;
    }

    // 3. ONBOARDING SEQUENCE: Complete Profile
    if (!profile?.name && !isCompleteProfileRoute) {
      router.replace('/complete-profile');
      return;
    }

    // 4. ONBOARDING SEQUENCE: Establish Wallet
    // Only redirect if profile is ready but wallet is missing and user isn't on setup screen
    const hasWallet = wallets && wallets.length > 0;
    if (profile?.name && !hasWallet && !isWalletSessionRoute) {
      router.replace('/wallet-session');
      return;
    }

    // 5. REDIRECT: If on onboarding/auth but everything is established, go home
    if ((isAuthRoute || isWalletSessionRoute || isCompleteProfileRoute) && hasWallet && profile?.onboarding_completed) {
      router.replace('/');
    }

  }, [userLoading, isInitialized, isWalletLoading, user, profile, wallets, pathname, router, isAuthRoute, isWalletSessionRoute, isCompleteProfileRoute]);

  // If user purged wallet but session exists, the card will return null via its internal check
  return (
    <>
      <CloudSyncCard />
    </>
  );
}
