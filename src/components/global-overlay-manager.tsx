
'use client';

import { useEffect } from 'react';
import { useUser } from '@/contexts/user-provider';
import { useWallet } from '@/contexts/wallet-provider';
import CloudSyncCard from '@/components/wallet/cloud-sync-card';
import { usePathname, useRouter } from 'next/navigation';

/**
 * GLOBAL IDENTITY SENTINEL
 * Hardened authority node for routing authenticated sessions.
 * Implements strict zero-flicker policy by returning null immediately on sign-out.
 */
export default function GlobalOverlayManager() {
  const { user, profile, loading: userLoading } = useUser();
  const { wallets, isInitialized, isWalletLoading } = useWallet();
  const pathname = usePathname();
  const router = useRouter();

  const isAuthRoute = pathname.startsWith('/auth');
  const isWalletSessionRoute = pathname === '/wallet-session';
  
  useEffect(() => {
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

    // Vault Mandatory Gate
    const hasLocalWallet = wallets && wallets.length > 0;
    if (!profile?.onboarding_completed && !hasLocalWallet) {
      if (!isWalletSessionRoute) {
        router.replace('/wallet-session');
      }
      return;
    }

    // 3. DASHBOARD CONVERGENCE
    if ((isAuthRoute || isWalletSessionRoute) && hasLocalWallet) {
      router.replace('/');
    }

  }, [userLoading, isInitialized, isWalletLoading, user, profile, wallets, pathname, router, isAuthRoute, isWalletSessionRoute]);

  // ZERO-FLICKER SENTINEL: If user just logged out, return null immediately
  if (!user && !isAuthRoute) return null;

  return (
    <>
      <CloudSyncCard />
    </>
  );
}
