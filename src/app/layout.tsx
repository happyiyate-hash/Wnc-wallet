import type {Metadata} from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { WalletProvider } from '@/contexts/wallet-provider';
import { UserProvider } from '@/contexts/user-provider';

export const metadata: Metadata = {
  title: 'Wevina v2 - Your Secure Crypto Wallet',
  description: 'Generate a new crypto wallet, manage transactions, and convert currencies securely.',
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
        <link href="https://fonts.googleapis.com/css2?family=PT+Sans:wght@400;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased min-h-screen bg-background">
        <UserProvider>
          <WalletProvider>
            {children}
          </WalletProvider>
        </UserProvider>
        <Toaster />
      </body>
    </html>
  );
}
