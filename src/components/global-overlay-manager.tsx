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
 */
export default function GlobalOverlayManager() {
  const { user, profile, loading: userLoading } = useUser();
  const { wallets, isInitialized, isWalletLoading } = useWallet();
  const pathname = usePathname();
  const router = useRouter();

  // Route Categories
  const isAuthRoute = pathname.startsWith('/auth');
  const isOnboardingRoute = ['/complete-profile', '/wallet-session'].includes(pathname);
  
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

    // B. Profile Identity Check
    // If the user is logged in but has no profile name, they must complete their identity.
    if (!profile?.name) {
      if (pathname !== '/complete-profile') {
        router.replace('/complete-profile');
      }
      return;
    }

    // C. Wallet Registry Check
    // If identity exists but no wallet is derived locally or onboarding isn't marked as complete.
    const hasLocalWallet = wallets && wallets.length > 0;
    if (profile?.name && !profile?.onboarding_completed && !hasLocalWallet) {
      if (pathname !== '/wallet-session') {
        router.replace('/wallet-session');
      }
      return;
    }

    // 3. AUTOMATIC REDIRECT TO DASHBOARD
    // If the user is on an auth or onboarding route but their status is 100% complete.
    const isSetupComplete = profile?.name && profile?.onboarding_completed && hasLocalWallet;
    if ((isAuthRoute || isOnboardingRoute) && isSetupComplete) {
      router.replace('/');
    }

  }, [userLoading, isInitialized, isWalletLoading, user, profile, wallets, pathname, router, isAuthRoute, isOnboardingRoute]);

  return (
    <>
      <CloudSyncCard />
    </>
  );
}
