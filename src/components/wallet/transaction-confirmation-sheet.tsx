
'use client';

import { motion } from 'framer-motion';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowRight, Loader2, ShieldCheck } from 'lucide-react';
import TokenLogoDynamic from '../shared/TokenLogoDynamic';
import { useCurrency } from '@/contexts/currency-provider';
import { useUser } from '@/contexts/user-provider';

interface TransactionConfirmationSheetProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
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
  const { profile } = useUser();
  const amountUsd = (parseFloat(amount) || 0) * (token?.priceUsd || 0);

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="bg-[#0a0a0c] border-t border-primary/20 rounded-t-[3.5rem] p-8 h-auto overflow-hidden shadow-2xl">
        <SheetHeader className="sr-only">
          <SheetTitle>Confirm Broadcast</SheetTitle>
          <SheetDescription>Verify node dispatch summary</SheetDescription>
        </SheetHeader>

        <div className="w-12 h-1 bg-white/10 rounded-full mx-auto mb-8" />
        
        {/* SENDER -> RECIPIENT VISUALS */}
        <div className="flex items-center justify-between mb-10 px-4">
          <div className="flex flex-col items-center gap-2">
            <div className="relative">
                <Avatar className="w-16 h-16 rounded-2xl border border-white/10">
                    <AvatarImage src={profile?.photo_url} />
                    <AvatarFallback className="bg-primary/20 text-primary font-black">{profile?.name?.[0]}</AvatarFallback>
                </Avatar>
                <div className="absolute -bottom-1 -right-1 bg-black rounded-lg p-1 border border-white/10 shadow-xl">
                    <TokenLogoDynamic logoUrl={token?.iconUrl} alt={token?.symbol || 'T'} size={20} chainId={token?.chainId} symbol={token?.symbol} name={token?.name} />
                </div>
            </div>
            <span className="text-[8px] font-black text-white/40 uppercase">You</span>
          </div>

          <div className="flex-1 px-4">
            <div className="w-full h-[1px] bg-primary/20 relative">
                <ArrowRight className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 text-primary opacity-40" />
            </div>
          </div>

          <div className="flex flex-col items-center gap-2">
            <div className="relative">
                {recipientAvatar ? (
                    <Avatar className="w-16 h-16 rounded-2xl border border-white/10">
                        <AvatarImage src={recipientAvatar} />
                        <AvatarFallback className="bg-primary/20 text-primary font-black">{recipientName[0]?.toUpperCase()}</AvatarFallback>
                    </Avatar>
                ) : (
                    <div className="w-16 h-16 rounded-2xl border border-white/10 bg-white/5 flex items-center justify-center">
                        <TokenLogoDynamic logoUrl={token?.iconUrl} alt={token?.symbol || 'T'} size={32} chainId={token?.chainId} symbol={token?.symbol} name={token?.name} />
                    </div>
                )}
                <div className="absolute -bottom-1 -right-1 bg-black rounded-lg p-1 border border-white/10 shadow-xl">
                    <TokenLogoDynamic logoUrl={token?.iconUrl} alt={token?.symbol || 'T'} size={20} chainId={token?.chainId} symbol={token?.symbol} name={token?.name} />
                </div>
            </div>
            <span className="text-[8px] font-black text-white/40 uppercase truncate w-16 text-center">{recipientName}</span>
          </div>
        </div>

        <div className="space-y-4 mb-10">
          <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/5 flex flex-col items-center gap-1">
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Amount to Dispatch</p>
            <h3 className="text-3xl font-black text-white">{amount} {token?.symbol}</h3>
            <p className="text-xs font-bold text-primary">≈ {formatFiat(amountUsd)}</p>
          </div>

          <div className="grid grid-cols-1 gap-2">
            <div className="flex flex-col gap-2 p-4 rounded-2xl bg-white/[0.02] border border-white/5">
              <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Target Address</span>
              <p className="text-[10px] font-mono break-all text-white/60 leading-relaxed">{recipientAddress}</p>
            </div>
            <div className="flex items-center justify-between p-4 rounded-2xl bg-primary/5 border border-primary/10">
              <span className="text-[10px] font-black text-primary uppercase tracking-widest">Network Speed</span>
              <span className="text-sm font-bold text-primary">Standard (~15s)</span>
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
                Cancel
            </Button>
        </div>

        <div className="mt-6 flex items-center justify-center gap-2 opacity-20">
            <ShieldCheck className="w-3 h-3" />
            <span className="text-[8px] font-black uppercase tracking-widest">Secured by Master Wevina Node</span>
        </div>
      </SheetContent>
    </Sheet>
  );
}
