
'use client';

import { useEffect } from 'react';
import { useUser } from '@/contexts/user-provider';
import { useWallet } from '@/contexts/wallet-provider';
import CloudSyncCard from '@/components/wallet/cloud-sync-card';
import { usePathname, useRouter } from 'next/navigation';

/**
 * GLOBAL IDENTITY SENTINEL (The Brain)
 * This component is the sole authority for routing authenticated and unauthenticated nodes.
 * It lives in the root layout and ensures users are always where they belong.
 * UPDATED: Removed the mandatory Complete Profile gate to allow immediate terminal access.
 */
export default function GlobalOverlayManager() {
  const { user, profile, loading: userLoading } = useUser();
  const { wallets, isInitialized, isWalletLoading } = useWallet();
  const pathname = usePathname();
  const router = useRouter();

  // Route Categories
  const isAuthRoute = pathname.startsWith('/auth');
  const isWalletSessionRoute = pathname === '/wallet-session';
  
  useEffect(() => {
    // Wait for auth and wallet initialization
    if (userLoading || !isInitialized || isWalletLoading) return;

    // 1. UNAUTHENTICATED STATE
    if (!user) {
      // If not on an auth page, redirect to login
      if (!isAuthRoute) {
        router.replace('/auth/login');
      }
      return;
    }

    // 2. AUTHENTICATED STATE - VALIDATE HANDSHAKE STATUS
    
    // A. Verify Email (Skip for Google Authority)
    const isOAuth = user.app_metadata?.provider && user.app_metadata.provider !== 'email';
    if (!user.email_confirmed_at && !isOAuth) {
      if (pathname !== '/auth/signup' || !pathname.includes('verify=true')) {
        // Trigger the verification slide-up inside the signup page
        router.replace(`/auth/signup?verify=true&email=${encodeURIComponent(user.email || '')}`);
      }
      return;
    }

    // B. Profile Identity Check (OPTIONAL GATE REMOVED)
    // Users are no longer blocked if they haven't set a username/photo.
    // They can do this later in Settings.

    // C. Wallet Registry Check (MANDATORY GATE)
    // The app requires a wallet node to function.
    const hasLocalWallet = wallets && wallets.length > 0;
    if (!profile?.onboarding_completed && !hasLocalWallet) {
      if (!isWalletSessionRoute) {
        router.replace('/wallet-session');
      }
      return;
    }

    // 3. AUTOMATIC REDIRECT TO DASHBOARD
    // If the user is on an auth or onboarding route but their wallet is ready.
    const isSetupComplete = hasLocalWallet;
    if ((isAuthRoute || isWalletSessionRoute) && isSetupComplete) {
      router.replace('/');
    }

  }, [userLoading, isInitialized, isWalletLoading, user, profile, wallets, pathname, router, isAuthRoute, isWalletSessionRoute]);

  return (
    <>
      <CloudSyncCard />
    </>
  );
}
