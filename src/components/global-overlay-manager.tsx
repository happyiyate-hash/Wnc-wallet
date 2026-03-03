'use client';

import { useEffect } from 'react';
import { useUser } from '@/contexts/user-provider';
import { useWallet } from '@/contexts/wallet-provider';
import CloudSyncCard from '@/components/wallet/cloud-sync-card';
import { usePathname, useRouter } from 'next/navigation';

/**
 * GLOBAL IDENTITY SENTINEL
 * Authority for routing authenticated nodes.
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

    // 1. UNAUTHENTICATED REDIRECT
    if (!user) {
      if (!isAuthRoute) {
        router.replace('/auth/login');
      }
      return;
    }

    // 2. AUTHENTICATED VALIDATION
    
    // Verify Email (Skip for OAuth)
    const isOAuth = user.app_metadata?.provider && user.app_metadata.provider !== 'email';
    if (!user.email_confirmed_at && !isOAuth) {
      if (pathname !== '/auth/signup' || !pathname.includes('verify=true')) {
        router.replace(`/auth/signup?verify=true&email=${encodeURIComponent(user.email || '')}`);
      }
      return;
    }

    // Wallet Mandatory Gate
    const hasLocalWallet = wallets && wallets.length > 0;
    if (!profile?.onboarding_completed && !hasLocalWallet) {
      if (!isWalletSessionRoute) {
        router.replace('/wallet-session');
      }
      return;
    }

    // 3. DASHBOARD REDIRECT
    if ((isAuthRoute || isWalletSessionRoute) && hasLocalWallet) {
      router.replace('/');
    }

  }, [userLoading, isInitialized, isWalletLoading, user, profile, wallets, pathname, router, isAuthRoute, isWalletSessionRoute]);

  if (!user) return null;

  return (
    <>
      <CloudSyncCard />
    </>
  );
}
