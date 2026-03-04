
'use client';

import { useEffect } from 'react';
import { useUser } from '@/contexts/user-provider';
import { useWallet } from '@/contexts/wallet-provider';
import CloudSyncCard from '@/components/wallet/cloud-sync-card';
import { usePathname, useRouter } from 'next/navigation';

/**
 * GLOBAL IDENTITY SENTINEL (Duplicate/Fallback Node)
 * Synchronized with src/components/global-overlay-manager.tsx
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
    if (userLoading || !isInitialized || isWalletLoading) return;

    if (!user) {
      if (!isAuthRoute) {
        router.replace('/auth/login');
      }
      return;
    }

    const isOAuth = user.app_metadata?.provider && user.app_metadata.provider !== 'email';
    if (!user.email_confirmed_at && !isOAuth) {
      if (pathname !== '/auth/signup' || !pathname.includes('verify=true')) {
        router.replace(`/auth/signup?verify=true&email=${encodeURIComponent(user.email || '')}`);
      }
      return;
    }

    if (!profile?.name && !isSettingsRoute && !isAuthRoute) {
      router.replace('/settings');
      return;
    }

    const hasLocalWallet = wallets && wallets.length > 0;
    if (!hasLocalWallet && !isWalletSessionRoute && !isAuthRoute && !isSettingsRoute) {
      router.replace('/wallet-session');
      return;
    }

    if ((isAuthRoute || isWalletSessionRoute) && hasLocalWallet && profile?.name && profile?.onboarding_completed) {
      router.replace('/');
    }

  }, [userLoading, isInitialized, isWalletLoading, user, profile, wallets, pathname, router, isAuthRoute, isWalletSessionRoute, isSettingsRoute]);

  if (!user && !isAuthRoute) return null;

  return (
    <>
      <CloudSyncCard />
    </>
  );
}
