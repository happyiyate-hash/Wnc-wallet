'use client';

import { useWallet } from '@/contexts/wallet-provider';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Copy, Share2, Info } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { Card } from '@/components/ui/card';
import TokenLogoDynamic from '@/components/shared/TokenLogoDynamic';
import { cn } from '@/lib/utils';

export default function ReceivePage() {
  const { custodialAddress, viewingNetwork } = useWallet();
  const router = useRouter();
  const [isCopied, copy] = useCopyToClipboard();

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
          <p className="text-sm text-muted-foreground">
            Only send <span className="text-foreground font-bold">{viewingNetwork.name} ({viewingNetwork.symbol})</span> to this address.
          </p>
          <p className="text-[10px] bg-primary/10 text-primary px-3 py-1 rounded-full inline-block">
            Network: {viewingNetwork.name}
          </p>
        </div>

        <Card className="p-6 bg-white rounded-[2rem] shadow-2xl shadow-primary/10">
          {/* Mock QR Code Implementation */}
          <div className="w-56 h-56 bg-black flex items-center justify-center rounded-2xl relative overflow-hidden">
             <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle,white_1px,transparent_1px)] bg-[length:10px_10px]" />
             <div className="w-48 h-48 bg-white p-2 rounded-xl">
                <div className="w-full h-full bg-black flex items-center justify-center">
                    <TokenLogoDynamic 
                        logoUrl={viewingNetwork.iconUrl} 
                        alt={viewingNetwork.name} 
                        size={48} 
                        chainId={viewingNetwork.chainId} 
                        className="bg-white p-1"
                    />
                </div>
             </div>
          </div>
        </Card>

        <div className="w-full space-y-4">
          <div 
            onClick={handleCopy}
            className="w-full p-4 rounded-2xl bg-secondary/40 border border-white/5 flex items-center justify-between cursor-pointer active:scale-[0.98] transition-all"
          >
            <div className="flex-1 min-w-0 pr-4">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-1">Your Deposit Address</p>
              <p className="text-sm font-mono break-all leading-relaxed">
                {custodialAddress || 'Provisioning...'}
              </p>
            </div>
            <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center text-primary">
              <Copy className="w-5 h-5" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
             <Button variant="outline" className="h-12 rounded-xl gap-2 font-semibold" onClick={handleCopy}>
                <Copy className="w-4 h-4" /> Copy
             </Button>
             <Button variant="outline" className="h-12 rounded-xl gap-2 font-semibold">
                <Share2 className="w-4 h-4" /> Share
             </Button>
          </div>
        </div>

        <div className="mt-auto p-4 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs">
           Deposits are typically credited within 2-5 minutes after 12 confirmations on the {viewingNetwork.name} network.
        </div>
      </main>
    </div>
  );
}
