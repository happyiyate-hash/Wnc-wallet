
'use client';

import { motion } from 'framer-motion';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowRight, Loader2, ShieldCheck } from 'lucide-react';
import TokenLogoDynamic from '../shared/TokenLogoDynamic';
import { useCurrency } from '@/contexts/currency-provider';
import { cn } from '@/lib/utils';

interface TransactionConfirmationSheetProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isSubmitting: boolean;
  amount: string;
  token: any;
  recipientName: string;
  recipientAddress: string;
  recipientAvatar?: string;
}

export default function TransactionConfirmationSheet({
  isOpen,
  onOpenChange,
  onConfirm,
  isSubmitting,
  amount,
  token,
  recipientName,
  recipientAddress,
  recipientAvatar
}: TransactionConfirmationSheetProps) {
  const { formatFiat } = useCurrency();
  const amountUsd = (parseFloat(amount) || 0) * (token?.priceUsd || 0);

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="bg-[#0a0a0c] border-t border-primary/20 rounded-t-[3.5rem] p-8 h-auto overflow-hidden shadow-2xl">
        <SheetHeader className="sr-only">
          <SheetTitle>Confirm Broadcast</SheetTitle>
          <SheetDescription>Verify node dispatch summary</SheetDescription>
        </SheetHeader>

        <div className="w-12 h-1 bg-white/10 rounded-full mx-auto mb-8" />
        
        {/* REPEATED ANIMATION AREA */}
        <div className="flex items-center justify-center gap-6 mb-10">
          <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
            <TokenLogoDynamic logoUrl={token?.iconUrl} alt="S" size={32} chainId={token?.chainId} symbol={token?.symbol} />
          </div>
          <ArrowRight className="w-5 h-5 text-primary opacity-40" />
          <div className="relative">
            <Avatar className="w-16 h-16 rounded-2xl border border-white/10">
              <AvatarImage src={recipientAvatar} />
              <AvatarFallback className="bg-zinc-900 text-primary font-black">{recipientName[0]?.toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-lg bg-black border border-white/10 p-1">
              <TokenLogoDynamic logoUrl={token?.iconUrl} alt="T" size={14} chainId={token?.chainId} symbol={token?.symbol} />
            </div>
          </div>
        </div>

        <div className="space-y-4 mb-10">
          <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/5 flex flex-col items-center gap-1">
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Amount to Dispatch</p>
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
            <div className="flex items-center justify-between p-4 rounded-2xl bg-primary/5 border border-primary/10">
              <span className="text-[10px] font-black text-primary uppercase tracking-widest">Node Fee</span>
              <span className="text-sm font-bold text-primary">0.00 {token?.symbol}</span>
            </div>
          </div>
        </div>

        <div className="space-y-3">
            <Button 
                className="w-full h-16 rounded-[2rem] font-black text-lg bg-primary hover:bg-primary/90 shadow-2xl shadow-primary/20" 
                onClick={onConfirm}
                disabled={isSubmitting}
            >
                {isSubmitting ? <Loader2 className="w-6 h-6 animate-spin" /> : "Confirm & Broadcast"}
            </Button>
            <Button 
                variant="ghost" 
                className="w-full h-12 rounded-2xl font-bold text-muted-foreground" 
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
            >
                Cancel Dispatch
            </Button>
        </div>

        <div className="mt-6 flex items-center justify-center gap-2 opacity-20">
            <ShieldCheck className="w-3 h-3" />
            <span className="text-[8px] font-black uppercase tracking-widest">End-to-End Encrypted Handshake</span>
        </div>
      </SheetContent>
    </Sheet>
  );
}
