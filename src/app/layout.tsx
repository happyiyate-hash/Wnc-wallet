import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Suspense } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { WalletProvider } from '@/contexts/wallet-provider';
import { UserProvider } from '@/contexts/user-provider';
import { CurrencyProvider } from '@/contexts/currency-provider';
import { MarketProvider } from '@/contexts/market-provider';
import DesktopSidebar from '@/components/wallet/desktop-sidebar';
import { Web3Provider } from '@/components/providers/web3-provider';
import PWARegister from '@/components/pwa-register';
import { SidebarProvider } from '@/components/ui/sidebar';
import { NavGradient } from '@/components/shared/nav-gradient';
import GlobalOverlayManager from '@/components/global-overlay-manager';
import MobileNav from '@/components/wallet/mobile-nav';
import NotificationCenter from '@/components/notifications/notification-center';
import RealtimeNotificationListener from '@/components/notifications/realtime-listener';
import GlobalLoadingBarrier from '@/components/global-loading-barrier';
import { ErrorBoundary } from '@/components/error-boundary';
import { GlobalErrorListener } from '@/components/global-error-listener';
import CloudSyncCard from '@/components/wallet/cloud-sync-card';

export const metadata: Metadata = {
  title: 'Wevina Terminal - Institutional Multi-Chain Vault',
  description: 'Shared identity and multi-account session management for SmarterSeller ecosystem.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Wevina',
  },
};

export const viewport: Viewport = {
  themeColor: '#673AB7',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#673AB7" />
      </head>
      <body className="font-body antialiased min-h-screen bg-background flex flex-col relative">
        <Web3Provider>
          <UserProvider>
            <CurrencyProvider>
              <MarketProvider>
                <WalletProvider>
                  <SidebarProvider defaultOpen={true}>
                    <ErrorBoundary>
                      <div className="flex min-h-screen w-full bg-transparent relative z-10">
                        <NavGradient />
                        <DesktopSidebar />
                        <div className="flex flex-col flex-1 w-full min-w-0 relative">
                          <PWARegister />
                          <div className="flex-1 relative">
                            {children}
                          </div>
                          <MobileNav />
                        </div>
                      </div>
                    </ErrorBoundary>
                    
                    {/* CENTRAL SENTINELS, BARRIERS & OVERLAYS */}
                    <Suspense fallback={null}>
                      <GlobalLoadingBarrier />
                      <GlobalOverlayManager />
                      <NotificationCenter />
                      <RealtimeNotificationListener />
                      <GlobalErrorListener />
                      <CloudSyncCard />
                    </Suspense>
                  </SidebarProvider>
                </WalletProvider>
              </MarketProvider>
            </CurrencyProvider>
          </UserProvider>
        </Web3Provider>
        <Toaster />
      </body>
    </html>
  );
}
