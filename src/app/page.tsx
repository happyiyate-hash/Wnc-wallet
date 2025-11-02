import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Wallet, Coins, History, ShieldCheck } from 'lucide-react';
import WalletTab from '@/components/wallet-tab';
import TransactionsTab from '@/components/transactions-tab';
import ConverterTab from '@/components/converter-tab';
import SecurityTab from '@/components/security-tab';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center p-4 sm:p-8 md:p-12">
      <div className="w-full max-w-4xl mx-auto">
        <header className="flex flex-col sm:flex-row items-center justify-between mb-8">
          <div className="flex items-center gap-4">
             <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center shadow-md">
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-7 w-7 text-primary-foreground"
                >
                    <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
                    <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
                    <path d="M18 12a2 2 0 0 0 0 4h4v-4h-4z" />
                </svg>
            </div>
            <h1 className="text-4xl font-bold text-foreground tracking-tight">Wevina v2</h1>
          </div>
        </header>

        <Tabs defaultValue="wallet" className="w-full">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 h-auto sm:h-12">
            <TabsTrigger value="wallet" className="py-2.5 text-sm">
              <Wallet className="w-4 h-4 mr-2" />
              Wallet
            </TabsTrigger>
            <TabsTrigger value="transactions" className="py-2.5 text-sm">
              <History className="w-4 h-4 mr-2" />
              Transactions
            </TabsTrigger>
            <TabsTrigger value="convert" className="py-2.5 text-sm">
              <Coins className="w-4 h-4 mr-2" />
              Convert
            </TabsTrigger>
            <TabsTrigger value="security" className="py-2.5 text-sm">
              <ShieldCheck className="w-4 h-4 mr-2" />
              Security
            </TabsTrigger>
          </TabsList>
          <TabsContent value="wallet">
            <WalletTab />
          </TabsContent>
          <TabsContent value="transactions">
            <TransactionsTab />
          </TabsContent>
          <TabsContent value="convert">
            <ConverterTab />
          </TabsContent>
          <TabsContent value="security">
            <SecurityTab />
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}
