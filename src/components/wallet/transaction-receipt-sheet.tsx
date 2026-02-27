
'use client';

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertCircle, Copy, Share2 } from 'lucide-react';
import { useCurrency } from '@/contexts/currency-provider';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import TokenLogoDynamic from '../shared/TokenLogoDynamic';

interface TransactionReceiptSheetProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  status: 'success' | 'error';
  amount: string;
  token: any;
  recipientName: string;
  recipientAddress: string;
  txHash?: string;
  errorReason?: string;
  fee: string;
  networkName: string;
}

export default function TransactionReceiptSheet({
  isOpen,
  onOpenChange,
  status,
  amount,
  token,
  recipientName,
  recipientAddress,
  txHash,
  errorReason,
  fee,
  networkName
}: TransactionReceiptSheetProps) {
  const { formatFiat } = useCurrency();
  const { toast } = useToast();
  
  const price = token?.priceUsd || 0;
  const amountUsd = (parseFloat(amount) || 0) * price;

  const handleCopyHash = () => {
    if (txHash) {
      navigator.clipboard.writeText(txHash);
      toast({ title: "Hash Copied" });
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="bg-[#0a0a0c] border-t border-white/10 rounded-t-[3.5rem] p-8 h-auto overflow-hidden">
        <SheetHeader className="sr-only">
          <SheetTitle>{status === 'success' ? 'Transfer Successful' : 'Transfer Failed'}</SheetTitle>
          <SheetDescription>Institutional Node Broadcast Summary</SheetDescription>
        </SheetHeader>

        <div className="w-12 h-1 bg-white/10 rounded-full mx-auto mb-8" />
        
        <div className="flex flex-col items-center text-center space-y-6 mb-8">
          <div className={cn(
            "w-20 h-20 rounded-[2.5rem] flex items-center justify-center shadow-2xl relative",
            status === 'success' ? "bg-green-500/10 text-green-500 border border-green-500/20" : "bg-red-500/10 text-red-500 border border-red-500/20"
          )}>
            {status === 'success' ? <CheckCircle2 className="w-10 h-10" /> : <AlertCircle className="w-10 h-10" />}
            <div className="absolute -bottom-2 -right-2 bg-black rounded-xl p-1.5 border border-white/10 shadow-2xl">
                <TokenLogoDynamic logoUrl={token?.iconUrl} alt={token?.symbol || 'T'} size={24} chainId={token?.chainId} symbol={token?.symbol} name={token?.name} />
            </div>
          </div>
          
          <div className="space-y-1">
            <h2 className="text-2xl font-black uppercase tracking-tight text-white">
              {status === 'success' ? 'Transfer Complete' : 'Transfer Failed'}
            </h2>
            <p className="text-[10px] text-muted-foreground uppercase font-black tracking-[0.2em]">
              Node Broadcast Summary
            </p>
          </div>
        </div>

        <div className="space-y-4 mb-10">
          <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 flex flex-col items-center gap-1">
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Amount Dispatched</p>
            <h3 className="text-3xl font-black text-white">{amount} {token?.symbol}</h3>
            <p className="text-xs font-bold text-primary">≈ {formatFiat(amountUsd)}</p>
          </div>

          <div className="grid grid-cols-1 gap-2">
            <div className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/5">
              <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Recipient</span>
              <span className="text-sm font-bold text-white">@{recipientName}</span>
            </div>
            
            <div className="flex flex-col gap-2 p-4 rounded-2xl bg-white/[0.02] border border-white/5">
              <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Target Address</span>
              <p className="text-[10px] font-mono break-all text-white/60 leading-relaxed">{recipientAddress}</p>
            </div>

            <div className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/5">
              <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Network</span>
              <span className="text-sm font-bold text-white">{networkName}</span>
            </div>

            {status === 'error' && (
              <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 space-y-1">
                <span className="text-[10px] font-black text-red-400 uppercase tracking-widest">Error Logs</span>
                <p className="text-xs font-medium text-red-400 leading-relaxed">{errorReason}</p>
              </div>
            )}

            {txHash && (
              <button 
                onClick={handleCopyHash}
                className="flex items-center justify-between p-4 rounded-2xl bg-primary/5 border border-primary/10 hover:bg-primary/10 transition-all group"
              >
                <div className="text-left">
                  <span className="text-[10px] font-black text-primary uppercase tracking-widest">Broadcast Hash</span>
                  <p className="text-[10px] font-mono text-white/40 truncate w-[200px] mt-0.5">{txHash}</p>
                </div>
                <Copy className="w-4 h-4 text-primary group-hover:scale-110 transition-transform" />
              </button>
            )}
          </div>
        </div>

        <div className="flex gap-3">
          <Button 
            className="flex-1 h-16 rounded-[2rem] font-black text-lg shadow-2xl shadow-primary/20" 
            onClick={() => onOpenChange(false)}
          >
            Done
          </Button>
          {status === 'success' && (
            <Button variant="outline" className="w-16 h-16 rounded-[2rem] bg-white/5 border-white/10 shrink-0">
              <Share2 className="w-6 h-6" />
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
