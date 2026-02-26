import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { WalletProvider } from '@/contexts/wallet-provider';
import { UserProvider } from '@/contexts/user-provider';
import MobileNav from '@/components/wallet/mobile-nav';
import { Web3Provider } from '@/components/providers/web3-provider';
import PWARegister from '@/components/pwa-register';

export const metadata: Metadata = {
  title: 'Wevina v2 - Your Secure Custodial Wallet',
  description: 'A programmable custodial wallet platform.',
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
      <body className="font-body antialiased min-h-screen bg-background flex flex-col">
        <Web3Provider>
          <UserProvider>
            <WalletProvider>
              <PWARegister />
              {children}
              <MobileNav />
            </WalletProvider>
          </UserProvider>
        </Web3Provider>
        <Toaster />
      </body>
    </html>
  );
}