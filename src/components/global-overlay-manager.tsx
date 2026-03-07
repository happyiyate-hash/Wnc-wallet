'use client';

import { useEffect, useRef } from 'react';
import { useUser } from '@/contexts/user-provider';
import { useWallet } from '@/contexts/wallet-provider';
import { usePathname, useRouter } from 'next/navigation';

/**
 * GLOBAL IDENTITY SENTINEL
 * Hardened authority node for routing authenticated sessions.
 * Note: CloudSyncCard pop-up removed. Audit is now inline on /profile.
 */
export default function GlobalOverlayManager() {
  const { user, profile, loading: userLoading } = useUser();
  const { wallets, isInitialized, isWalletLoading } = useWallet();
  const pathname = usePathname();
  const router = useRouter();
  
  const isRecoveringRef = useRef(false);

  const isAuthRoute = pathname.startsWith('/auth');
  const isWalletSessionRoute = pathname === '/wallet-session';
  const isSettingsRoute = pathname === '/settings';
  
  useEffect(() => {
    if (userLoading || !isInitialized || isWalletLoading) {
      if (isWalletLoading) isRecoveringRef.current = true;
      return;
    }

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

    const hasLocalWallet = wallets && wallets.length > 0;
    
    if (!hasLocalWallet && !isWalletSessionRoute && !isAuthRoute) {
      router.replace('/wallet-session');
      return;
    }

    if (hasLocalWallet && isWalletSessionRoute) {
      router.replace('/');
      return;
    }

    if (!profile?.name && !isSettingsRoute && !isAuthRoute && !isWalletSessionRoute) {
      router.replace('/settings');
      return;
    }

    const isSetupTerminal = isAuthRoute || isWalletSessionRoute;
    if (isSetupTerminal && hasLocalWallet && profile?.name && profile?.onboarding_completed) {
      if (pathname !== '/') router.replace('/');
    }

    isRecoveringRef.current = false;

  }, [userLoading, isInitialized, isWalletLoading, user, profile, wallets, pathname, router, isAuthRoute, isWalletSessionRoute, isSettingsRoute]);

  if (!user && !isAuthRoute) return null;

  return null;
}
