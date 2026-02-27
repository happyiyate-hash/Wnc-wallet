import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { WalletProvider } from '@/contexts/wallet-provider';
import { UserProvider } from '@/contexts/user-provider';
import { CurrencyProvider } from '@/contexts/currency-provider';
import MobileNav from '@/components/wallet/mobile-nav';
import DesktopSidebar from '@/components/wallet/desktop-sidebar';
import { Web3Provider } from '@/components/providers/web3-provider';
import PWARegister from '@/components/pwa-register';
import { SidebarProvider } from '@/components/ui/sidebar';
import { NavGradient } from '@/components/shared/nav-gradient';

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
      <body className="font-body antialiased min-h-screen bg-background flex flex-col relative overflow-hidden">
        {/* GLOBAL BRAND WATERMARK */}
        <div className="fixed inset-0 flex items-center justify-center pointer-events-none opacity-[0.03] select-none z-0">
          <div className="text-[40rem] font-black italic transform -rotate-12">W</div>
        </div>
        
        {/* GLOBAL GRADIENT DEPTH */}
        <div className="fixed inset-0 bg-gradient-to-b from-primary/5 via-transparent to-black/40 pointer-events-none z-0" />

        <Web3Provider>
          <UserProvider>
            <CurrencyProvider>
              <WalletProvider>
                <SidebarProvider defaultOpen={true}>
                  <div className="flex min-h-screen w-full bg-transparent overflow-hidden relative z-10">
                    <NavGradient />
                    <DesktopSidebar />
                    <div className="flex flex-col flex-1 w-full min-w-0 h-[100dvh] overflow-hidden">
                      <PWARegister />
                      <div className="flex-1 overflow-y-auto thin-scrollbar relative">
                        {children}
                      </div>
                      <MobileNav />
                    </div>
                  </div>
                </SidebarProvider>
              </WalletProvider>
            </CurrencyProvider>
          </UserProvider>
        </Web3Provider>
        <Toaster />
      </body>
    </html>
  );
}
