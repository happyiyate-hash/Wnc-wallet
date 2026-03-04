
'use client';

import { useEffect } from 'react';
import { useUser } from '@/contexts/user-provider';
import { useWallet } from '@/contexts/wallet-provider';
import CloudSyncCard from '@/components/wallet/cloud-sync-card';
import { usePathname, useRouter } from 'next/navigation';

/**
 * GLOBAL IDENTITY SENTINEL
 * Hardened authority node for routing authenticated sessions.
 * Enforces the Onboarding -> Identity -> Vault sequence.
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
    // Wait for all cryptographic and auth nodes to be primed
    if (userLoading || !isInitialized || isWalletLoading) return;

    // 1. ATOMIC SESSION GUARD: Redirect instantly if credentials missing
    if (!user) {
      if (!isAuthRoute) {
        router.replace('/auth/login');
      }
      return;
    }

    // 2. AUTHENTICATED VALIDATION NODES
    
    // Verify Email (Bypass for Google Authority)
    const isOAuth = user.app_metadata?.provider && user.app_metadata.provider !== 'email';
    if (!user.email_confirmed_at && !isOAuth) {
      if (pathname !== '/auth/signup' || !pathname.includes('verify=true')) {
        router.replace(`/auth/signup?verify=true&email=${encodeURIComponent(user.email || '')}`);
      }
      return;
    }

    // 3. IDENTITY COMPLETION GATE
    // If the profile node is unnamed, redirect to settings to complete registration
    if (!profile?.name && !isSettingsRoute && !isAuthRoute) {
      router.replace('/settings');
      return;
    }

    // 4. VAULT MANDATORY GATE
    // If no local wallets are derived, the user MUST be redirected to the setup screen.
    // This prevents empty dashboard states on new devices.
    const hasLocalWallet = wallets && wallets.length > 0;
    if (!hasLocalWallet && !isWalletSessionRoute && !isAuthRoute && !isSettingsRoute) {
      router.replace('/wallet-session');
      return;
    }

    // 5. DASHBOARD CONVERGENCE
    // Redirect home only if they are stuck on setup screens but already have a valid vault
    if ((isAuthRoute || isWalletSessionRoute) && hasLocalWallet && profile?.name && profile?.onboarding_completed) {
      router.replace('/');
    }

  }, [userLoading, isInitialized, isWalletLoading, user, profile, wallets, pathname, router, isAuthRoute, isWalletSessionRoute, isSettingsRoute]);

  // ZERO-FLICKER SENTINEL: If user just logged out, return null immediately
  if (!user && !isAuthRoute) return null;

  return (
    <>
      <CloudSyncCard />
    </>
  );
}
