'use client';

import { useWallet } from '@/contexts/wallet-provider';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Copy, Share2, Info, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { Card } from '@/components/ui/card';
import TokenLogoDynamic from '@/components/shared/TokenLogoDynamic';
import { cn } from '@/lib/utils';

export default function ReceivePage() {
  const { wallets, viewingNetwork, isInitialized } = useWallet();
  const router = useRouter();
  const [isCopied, copy] = useCopyToClipboard();

  const custodialAddress = wallets ? wallets[viewingNetwork.chainId] : null;

  const handleCopy = () => {
    if (custodialAddress) copy(custodialAddress);
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="p-4 flex items-center justify-between border-b border-white/5">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-lg font-bold">Deposit {viewingNetwork.symbol}</h1>
        <Button variant="ghost" size="icon">
          <Info className="w-5 h-5" />
        </Button>
      </header>

      <main className="flex-1 p-6 flex flex-col items-center gap-8 overflow-y-auto">
        <div className="text-center space-y-2">
          <p className="text-sm text-muted-foreground px-4">
            Send only <span className="text-foreground font-bold">{viewingNetwork.name} ({viewingNetwork.symbol})</span> to this unique custodial address.
          </p>
          <p className="text-[10px] bg-primary/10 text-primary px-3 py-1 rounded-full font-bold uppercase tracking-widest inline-block">
            Network: {viewingNetwork.name}
          </p>
        </div>

        <Card className="p-6 bg-white rounded-[2.5rem] shadow-2xl shadow-primary/10">
          <div className="w-64 h-64 bg-black flex items-center justify-center rounded-3xl relative overflow-hidden">
             <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle,white_1px,transparent_1px)] bg-[length:12px_12px]" />
             <div className="w-56 h-56 bg-white p-3 rounded-2xl">
                <div className="w-full h-full bg-black flex items-center justify-center p-4">
                    {custodialAddress && custodialAddress !== 'PROVISIONING' ? (
                        <div className="w-full h-full bg-white flex items-center justify-center rounded-lg">
                           <TokenLogoDynamic 
                                logoUrl={viewingNetwork.iconUrl} 
                                alt={viewingNetwork.name} 
                                size={64} 
                                chainId={viewingNetwork.chainId} 
                                className="bg-white p-1"
                            />
                        </div>
                    ) : (
                        <Loader2 className="w-10 h-10 animate-spin text-white/50" />
                    )}
                </div>
             </div>
          </div>
        </Card>

        <div className="w-full space-y-4">
          <div 
            onClick={handleCopy}
            className="w-full p-5 rounded-2xl bg-secondary/40 border border-white/5 flex items-center justify-between cursor-pointer active:scale-[0.98] transition-all group"
          >
            <div className="flex-1 min-w-0 pr-4">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1">Your Personal Deposit Address</p>
              <p className="text-sm font-mono break-all leading-relaxed text-foreground/90">
                {custodialAddress === 'PROVISIONING' ? 'Provisioning address...' : (custodialAddress || 'Fetching address...')}
              </p>
            </div>
            <div className="w-12 h-12 bg-primary/20 group-hover:bg-primary/30 rounded-xl flex items-center justify-center text-primary transition-colors">
              <Copy className="w-5 h-5" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
             <Button variant="outline" className="h-14 rounded-2xl gap-2 font-bold text-base" onClick={handleCopy}>
                <Copy className="w-5 h-5" /> Copy
             </Button>
             <Button variant="outline" className="h-14 rounded-2xl gap-2 font-bold text-base">
                <Share2 className="w-5 h-5" /> Share
             </Button>
          </div>
        </div>

        <div className="mt-auto p-5 rounded-2xl bg-primary/5 border border-primary/10 text-muted-foreground text-[11px] leading-relaxed italic text-center">
           This is a <span className="text-primary font-bold not-italic">Custodial Address</span>. Deposits are automatically detected and credited to your internal ledger balance after network confirmation.
        </div>
      </main>
    </div>
  );
}
