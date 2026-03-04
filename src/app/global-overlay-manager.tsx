
'use client';

import { useEffect } from 'react';
import { useUser } from '@/contexts/user-provider';
import { useWallet } from '@/contexts/wallet-provider';
import CloudSyncCard from '@/components/wallet/cloud-sync-card';
import { usePathname, useRouter } from 'next/navigation';

/**
 * GLOBAL IDENTITY SENTINEL
 * Hardened authority node for routing authenticated sessions.
 * Implements Stage-Aware Routing to prevent premature redirects during hydration.
 */
export default function GlobalOverlayManager() {
  const { user, profile, loading: userLoading } = useUser();
  const { wallets, isInitialized, isWalletLoading } = useWallet();
  const pathname = usePathname();
  const router = useRouter();

  const isAuthRoute = pathname.startsWith('/auth');
  const isWalletSessionRoute = pathname === '/wallet-session';
  const isSettingsRoute = pathname === '/settings';
  
  useEffect(() => {
    // STAGE 0: HYDRATION BARRIER
    // Wait for all cryptographic and auth nodes to be stable before evaluating guards
    if (userLoading || !isInitialized || isWalletLoading) return;

    // STAGE 1: ATOMIC SESSION GUARD
    if (!user) {
      if (!isAuthRoute) {
        router.replace('/auth/login');
      }
      return;
    }

    // STAGE 2: EMAIL VERIFICATION NODE
    const isOAuth = user.app_metadata?.provider && user.app_metadata.provider !== 'email';
    if (!user.email_confirmed_at && !isOAuth) {
      if (pathname !== '/auth/signup' || !pathname.includes('verify=true')) {
        router.replace(`/auth/signup?verify=true&email=${encodeURIComponent(user.email || '')}`);
      }
      return;
    }

    // STAGE 3: VAULT MANDATORY GATE (CRITICAL PRIORITY)
    const hasLocalWallet = wallets && wallets.length > 0;
    
    // REDIRECT TO SETUP: If we are not on setup and have no wallet
    if (!hasLocalWallet && !isWalletSessionRoute && !isAuthRoute) {
      router.replace('/wallet-session');
      return;
    }

    // REDIRECT FROM SETUP: If we HAVE a wallet but are still on the setup page
    if (hasLocalWallet && isWalletSessionRoute) {
      router.replace('/');
      return;
    }

    // STAGE 4: IDENTITY COMPLETION GATE
    if (!profile?.name && !isSettingsRoute && !isAuthRoute && !isWalletSessionRoute) {
      router.replace('/settings');
      return;
    }

    // STAGE 5: DASHBOARD CONVERGENCE
    const isSetupTerminal = isAuthRoute || isWalletSessionRoute;
    if (isSetupTerminal && hasLocalWallet && profile?.name && profile?.onboarding_completed) {
      if (pathname !== '/') router.replace('/');
    }

  }, [userLoading, isInitialized, isWalletLoading, user, profile, wallets, pathname, router, isAuthRoute, isWalletSessionRoute, isSettingsRoute]);

  // ZERO-FLICKER SENTINEL
  if (!user && !isAuthRoute) return null;

  return (
    <>
      <CloudSyncCard />
    </>
  );
}
