
'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@/contexts/wallet-provider';
import { useUser } from '@/contexts/user-provider';
import { useCurrency } from '@/contexts/currency-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { 
  ArrowLeft, 
  ChevronRight, 
  HandCoins, 
  Share2, 
  Copy, 
  CheckCircle2, 
  Loader2, 
  QrCode,
  ShieldCheck,
  Info
} from 'lucide-react';
import TokenLogoDynamic from '@/components/shared/TokenLogoDynamic';
import GlobalTokenSelector from '@/components/shared/global-token-selector';
import type { AssetRow } from '@/lib/types';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase/client';
import QRCode from "react-qr-code";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';

export default function RequestPage() {
  const router = useRouter();
  const { allAssets, viewingNetwork, accountNumber } = useWallet();
  const { user, profile } = useUser();
  const { formatFiat } = useCurrency();

  const [selectedToken, setSelectedToken] = useState<AssetRow | null>(allAssets[0] || null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  
  const [isCreating, setIsCreating] = useState(false);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  const handleCreateRequest = async () => {
    if (!user || !selectedToken || !accountNumber || !supabase) return;
    
    setIsCreating(true);
    try {
      const activeType = viewingNetwork.type || 'evm';
      const address = activeType === 'evm' ? profile?.evm_address : 
                      activeType === 'xrp' ? profile?.xrp_address : 
                      profile?.polkadot_address;

      const { data, error } = await supabase
        .from('payment_requests')
        .insert({
          requester_id: user.id,
          requester_account_number: accountNumber,
          chain_type: activeType,
          token_symbol: selectedToken.symbol,
          token_address: selectedToken.isNative ? null : selectedToken.address,
          amount: parseFloat(amount),
          note: note.trim() || null,
          status: 'pending'
        })
        .select()
        .single();

      if (error) throw error;
      setRequestId(data.id);
    } catch (e) {
      console.error("Failed to create request", e);
    } finally {
      setIsCreating(false);
    }
  };

  const shareUrl = useMemo(() => {
    if (typeof window === 'undefined' || !requestId) return '';
    return `${window.location.origin}/request/${requestId}`;
  }, [requestId]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const amountUsd = (parseFloat(amount) || 0) * (selectedToken?.priceUsd || 0);

  if (requestId) {
    return (
      <div className="flex flex-col h-screen bg-background">
        <header className="p-4 flex items-center justify-between border-b border-white/5">
          <Button variant="ghost" size="icon" onClick={() => router.push('/')} className="rounded-xl"><ArrowLeft className="w-5 h-5"/></Button>
          <h1 className="text-xs font-black uppercase tracking-[0.2em]">Request Ready</h1>
          <div className="w-10" />
        </header>

        <main className="flex-1 p-6 flex flex-col items-center gap-8 overflow-y-auto">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 bg-green-500/10 rounded-[2rem] flex items-center justify-center text-green-500 mx-auto mb-4 border border-green-500/20 animate-in zoom-in duration-500">
              <HandCoins className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-black text-white tracking-tight">Payment Link Generated</h2>
            <p className="text-sm text-muted-foreground">Share this link or QR code to receive payment.</p>
          </div>

          <div className="bg-white p-6 rounded-[3.5rem] shadow-2xl relative group">
            <QRCode value={shareUrl} size={200} level="H" />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="p-2 bg-white rounded-2xl shadow-xl border border-zinc-100">
                    <TokenLogoDynamic logoUrl={selectedToken?.iconUrl} alt="Token" size={40} symbol={selectedToken?.symbol} name={selectedToken?.name} />
                </div>
            </div>
          </div>

          <div className="w-full space-y-3">
            <button 
                onClick={handleCopyLink}
                className={cn(
                    "w-full p-5 rounded-[2rem] border flex items-center justify-between transition-all group",
                    isCopied ? "bg-green-500/10 border-green-500/30" : "bg-white/5 border-white/10 hover:bg-white/10"
                )}
            >
                <div className="flex items-center gap-4">
                    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center transition-all", isCopied ? "bg-green-500/20 text-green-500" : "bg-primary/20 text-primary")}>
                        {isCopied ? <CheckCircle2 className="w-5 h-5"/> : <Copy className="w-5 h-5"/>}
                    </div>
                    <div className="text-left">
                        <p className="text-xs font-bold text-white">Copy Request Link</p>
                        <p className="text-[10px] text-muted-foreground truncate w-[180px]">{shareUrl}</p>
                    </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-1 transition-transform"/>
            </button>

            <Button 
                onClick={() => navigator.share({ title: 'Payment Request', url: shareUrl })}
                className="w-full h-16 rounded-[2rem] gap-3 font-black text-lg bg-primary hover:bg-primary/90"
            >
                <Share2 className="w-5 h-5" /> Share Request
            </Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-[#050505] text-foreground">
      <header className="p-4 flex items-center justify-between border-b border-white/5 bg-black/50 backdrop-blur-2xl sticky top-0 z-50">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-xl"><ArrowLeft className="w-5 h-5" /></Button>
        <div className="flex flex-col items-center">
            <h1 className="text-xs font-black uppercase tracking-[0.2em]">Request Crypto</h1>
            <div className="flex items-center gap-1.5 mt-1">
                <HandCoins className="w-2.5 h-2.5 text-primary" />
                <span className="text-[8px] text-primary font-black uppercase tracking-tighter">P2P Handshake Protocol</span>
            </div>
        </div>
        <Button variant="ghost" size="icon"><Info className="w-5 h-5 text-muted-foreground" /></Button>
      </header>

      <main className="flex-1 p-6 space-y-8 max-w-lg mx-auto w-full overflow-y-auto pb-32">
        <section className="space-y-4">
            <div className="flex justify-between items-center px-2">
                <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Select Asset</Label>
                <span className="text-[8px] font-black text-primary uppercase tracking-widest">{viewingNetwork.name} Node</span>
            </div>
            <button 
                onClick={() => setIsSelectorOpen(true)}
                className="w-full flex items-center justify-between p-5 rounded-[2.5rem] bg-white/5 border border-white/5 hover:bg-white/10 transition-all group"
            >
                <div className="flex items-center gap-4">
                    <TokenLogoDynamic logoUrl={selectedToken?.iconUrl} alt={selectedToken?.symbol || ''} size={44} chainId={selectedToken?.chainId} symbol={selectedToken?.symbol} name={selectedToken?.name} />
                    <div className="text-left leading-tight">
                        <p className="font-black text-lg text-white">{selectedToken?.symbol || 'Select Token'}</p>
                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">{selectedToken?.name}</p>
                    </div>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
            </button>
        </section>

        <section className="space-y-4">
            <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-2">Request Amount</Label>
            <div className="p-8 rounded-[2.5rem] bg-secondary/20 border border-white/5 text-center space-y-4">
                <div className="flex items-baseline justify-center gap-3">
                    <Input 
                        type="number" 
                        placeholder="0.00" 
                        value={amount} 
                        onChange={(e) => setAmount(e.target.value)}
                        className="text-5xl font-black bg-transparent border-none p-0 h-auto text-center focus-visible:ring-0 tracking-tighter w-full max-w-[200px] text-white"
                    />
                    <span className="text-xl font-black text-white/20 uppercase">{selectedToken?.symbol}</span>
                </div>
                <div className="text-xs font-bold text-muted-foreground/40 italic">≈ {formatFiat(amountUsd)} <span className="opacity-50">Market Value</span></div>
            </div>
        </section>

        <section className="space-y-4">
            <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-2">Memo / Reference</Label>
            <Textarea 
                placeholder="Dinner refund, service payment, etc..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="min-h-[100px] rounded-[2rem] bg-white/5 border-white/10 p-5 focus-visible:ring-primary/50 text-sm"
            />
        </section>

        <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10 flex items-start gap-3">
            <ShieldCheck className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <p className="text-[10px] text-muted-foreground leading-relaxed">
                Your <span className="text-primary font-bold">{viewingNetwork.name}</span> vault address will be shared within the secure request node.
            </p>
        </div>
      </main>

      <div className="fixed bottom-8 left-0 right-0 px-6 z-40">
        <Button 
            className="w-full h-16 rounded-full font-black text-lg shadow-2xl transition-all active:scale-95 border-b-4 border-primary/50"
            disabled={!amount || parseFloat(amount) <= 0 || isCreating}
            onClick={handleCreateRequest}
        >
            {isCreating ? <Loader2 className="w-6 h-6 animate-spin" /> : "Authorize Request Node"}
        </Button>
      </div>

      <GlobalTokenSelector 
        isOpen={isSelectorOpen}
        onOpenChange={setIsSelectorOpen}
        onSelect={(token) => setSelectedToken({ ...token })}
        title="Select Target Node"
      />
    </div>
  );
}
