
'use client';

import { useEffect } from 'react';
import { useUser } from '@/contexts/user-provider';
import { useWallet } from '@/contexts/wallet-provider';
import CloudSyncCard from '@/components/wallet/cloud-sync-card';
import { usePathname, useRouter } from 'next/navigation';

/**
 * GLOBAL IDENTITY SENTINEL (Sync Node)
 * Hardened authority node for routing authenticated sessions.
 * Prioritizes Vault Setup over Profile settings if cryptographic keys are missing.
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

    // 1. ATOMIC SESSION GUARD
    if (!user) {
      if (!isAuthRoute) {
        router.replace('/auth/login');
      }
      return;
    }

    // 2. EMAIL VERIFICATION NODE
    const isOAuth = user.app_metadata?.provider && user.app_metadata.provider !== 'email';
    if (!user.email_confirmed_at && !isOAuth) {
      if (pathname !== '/auth/signup' || !pathname.includes('verify=true')) {
        router.replace(`/auth/signup?verify=true&email=${encodeURIComponent(user.email || '')}`);
      }
      return;
    }

    // 3. VAULT MANDATORY GATE (CRITICAL PRIORITY)
    const hasLocalWallet = wallets && wallets.length > 0;
    if (!hasLocalWallet && !isWalletSessionRoute && !isAuthRoute) {
      router.replace('/wallet-session');
      return;
    }

    // 4. IDENTITY COMPLETION GATE
    if (!profile?.name && !isSettingsRoute && !isAuthRoute && !isWalletSessionRoute) {
      router.replace('/settings');
      return;
    }

    // 5. DASHBOARD CONVERGENCE
    if ((isAuthRoute || isWalletSessionRoute || isSettingsRoute) && hasLocalWallet && profile?.name && profile?.onboarding_completed) {
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
