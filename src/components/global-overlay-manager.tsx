
'use client';

import { useEffect, useRef } from 'react';
import { useUser } from '@/contexts/user-provider';
import { useWallet } from '@/contexts/wallet-provider';
import { usePathname, useRouter } from 'next/navigation';

/**
 * GLOBAL IDENTITY SENTINEL
 * Version: 8.0.0 (Persistent Handshake Sentinel)
 */
export default function GlobalOverlayManager() {
  const { user, profile, loading: userLoading, isSettled: authSettled } = useUser();
  const { wallets, isInitialized, isWalletLoading } = useWallet();
  const pathname = usePathname();
  const router = useRouter();
  
  const isRecoveringRef = useRef(false);
  const settledCountRef = useRef(0);

  const isAuthRoute = pathname.startsWith('/auth');
  const isWalletSessionRoute = pathname === '/wallet-session';
  const isSettingsRoute = pathname === '/settings';
  
  useEffect(() => {
    // 1. DWELL TIME: Wait for session and wallet nodes to fully synchronize
    if (!authSettled || userLoading || !isInitialized || isWalletLoading) {
      if (isWalletLoading) isRecoveringRef.current = true;
      return;
    }

    // 2. AUTH GUARD: Ensure identity is present
    if (!user) {
      if (!isAuthRoute) {
        console.log("[SENTINEL] Unauthenticated session detected. Redirecting...");
        router.replace('/auth/login');
      }
      return;
    }

    // 3. VERIFICATION GUARD: Direct email users to verification panel if unconfirmed
    const isOAuth = user.app_metadata?.provider && user.app_metadata.provider !== 'email';
    if (!user.email_confirmed_at && !isOAuth) {
      if (pathname !== '/auth/signup' || !pathname.includes('verify=true')) {
        router.replace(`/auth/signup?verify=true&email=${encodeURIComponent(user.email || '')}`);
      }
      return;
    }

    // 4. VAULT GUARD: Force wallet establishment if missing
    const hasLocalWallet = wallets && wallets.length > 0;
    if (!hasLocalWallet && !isWalletSessionRoute && !isAuthRoute) {
      router.replace('/wallet-session');
      return;
    }

    if (hasLocalWallet && isWalletSessionRoute) {
      router.replace('/');
      return;
    }

    // 5. PROFILE GUARD: Ensure institutional metadata is complete
    if (!profile?.name && !isSettingsRoute && !isAuthRoute && !isWalletSessionRoute) {
      router.replace('/settings');
      return;
    }

    // 6. DASHBOARD RESOLUTION: Return to root once nodes are locked
    const isSetupTerminal = isAuthRoute || isWalletSessionRoute;
    if (isSetupTerminal && hasLocalWallet && profile?.name && profile?.onboarding_completed) {
      if (pathname !== '/') router.replace('/');
    }

    isRecoveringRef.current = false;

  }, [userLoading, authSettled, isInitialized, isWalletLoading, user, profile, wallets, pathname, router, isAuthRoute, isWalletSessionRoute, isSettingsRoute]);

  if (!user && !isAuthRoute) return null;

  return null;
}
