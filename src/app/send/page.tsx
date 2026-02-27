
'use client';

import { Suspense, useState, useEffect, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, 
  ChevronDown, 
  Search, 
  Loader2, 
  ShieldCheck, 
  AlertCircle,
  History,
  ClipboardPaste,
  ArrowRight,
  User,
  Zap,
  Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useWallet } from '@/contexts/wallet-provider';
import { useCurrency } from '@/contexts/currency-provider';
import { useUser } from '@/contexts/user-provider';
import { useToast } from '@/hooks/use-toast';
import { useDebounce } from '@/hooks/use-debounce';
import { supabase } from '@/lib/supabase/client';
import TokenLogoDynamic from '@/components/shared/TokenLogoDynamic';
import TransactionConfirmationSheet from '@/components/wallet/transaction-confirmation-sheet';
import type { AssetRow, ChainConfig, RecentRecipient } from '@/lib/types';

function SendClient() {
  const { viewingNetwork, wallets, infuraApiKey, allChains, allAssets, getAvailableAssetsForChain, allChainsMap, prices } = useWallet();
  const { formatFiat } = useCurrency();
  const { user, profile } = useUser();
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Transaction States
  const [selectedToken, setSelectedToken] = useState<AssetRow | null>(null);
  const [recipientInput, setRecipientInput] = useState('');
  const [amount, setAmount] = useState('');
  const [isConfirming, setIsConfirming] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [balanceError, setBalanceError] = useState<string | null>(null);

  // Identity Resolution
  const [resolvedAddress, setResolvedAddress] = useState('');
  const [recipientProfile, setRecipientProfile] = useState<{avatar: string, name: string} | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const debouncedRecipient = useDebounce(recipientInput, 600);

  // Token Selection UI
  const [isTokenSheetOpen, setIsTokenSideSheetOpen] = useState(false);
  const initializedRef = useRef(false);

  // 1. IDENTITY RESOLUTION ENGINE
  useEffect(() => {
    async function resolve() {
      if (!debouncedRecipient || debouncedRecipient.trim().length < 3) {
        setResolvedAddress('');
        setRecipientProfile(null);
        return;
      }

      const isRaw = debouncedRecipient.startsWith('0x') || debouncedRecipient.startsWith('r') || debouncedRecipient.length > 30;
      if (isRaw) {
        setResolvedAddress(debouncedRecipient);
        setRecipientProfile(null);
        return;
      }

      setIsResolving(true);
      const searchHandle = debouncedRecipient.replace('@', '').toLowerCase().trim();

      try {
        const { data } = await supabase!.rpc('fetch_recipient_details', {
          search_account_number: searchHandle,
          selected_chain: allChainsMap[selectedToken?.chainId || viewingNetwork.chainId]?.type || 'evm'
        });

        if (data && data[0]?.target_address) {
          setResolvedAddress(data[0].target_address);
          setRecipientProfile({
            avatar: data[0].profile_pic,
            name: searchHandle
          });
        } else {
          setResolvedAddress('');
          setRecipientProfile(null);
        }
      } catch (e) {
        setResolvedAddress('');
        setRecipientProfile(null);
      } finally {
        setIsResolving(false);
      }
    }
    resolve();
  }, [debouncedRecipient, selectedToken?.chainId, viewingNetwork.chainId, allChainsMap]);

  // 2. INITIALIZATION
  useEffect(() => {
    if (allAssets.length === 0 || initializedRef.current) return;
    const symbol = searchParams.get('symbol');
    const chainIdParam = parseInt(searchParams.get('chainId') || '');
    let targetToken = allAssets.find(a => a.symbol === symbol && a.chainId === chainIdParam) || allAssets[0];
    if (targetToken) {
      setSelectedToken({ ...targetToken });
      initializedRef.current = true;
    }
  }, [allAssets, searchParams]);

  const handleOpenConfirmation = () => {
    setBalanceError(null);
    if (!resolvedAddress || !amount) return;
    setIsConfirming(true);
  };

  const handleFinalConfirm = async () => {
    const currentBalance = parseFloat(selectedToken?.balance || '0');
    const amountNum = parseFloat(amount);

    if (amountNum > currentBalance) {
      setBalanceError("Please, you do not have available balance for this particular transaction. Please fund your wallet.");
      setIsConfirming(false);
      return;
    }

    setIsSubmitting(true);
    // ... Broadcast logic would go here
    setTimeout(() => {
        setIsSubmitting(false);
        setIsConfirming(false);
        toast({ title: "Transaction Broadcasted" });
        router.push('/');
    }, 2000);
  };

  const activeChain = allChainsMap[selectedToken?.chainId || viewingNetwork.chainId] || viewingNetwork;

  return (
    <div className="flex flex-col h-screen bg-[#050505] text-foreground overflow-hidden">
      {/* HEADER WITH CURRENCY DROPDOWN */}
      <header className="p-4 flex items-center justify-between border-b border-white/5 bg-black/50 backdrop-blur-2xl z-50">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-xl">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        
        <button 
          onClick={() => setIsTokenSideSheetOpen(true)}
          className="flex items-center gap-2.5 px-4 py-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-all active:scale-95"
        >
          <TokenLogoDynamic 
            logoUrl={selectedToken?.iconUrl} 
            alt={selectedToken?.symbol || ''} 
            size={20} 
            chainId={selectedToken?.chainId} 
            symbol={selectedToken?.symbol}
          />
          <div className="text-left leading-none">
            <p className="text-[10px] font-black uppercase text-white">{selectedToken?.symbol}</p>
            <p className="text-[8px] font-bold text-muted-foreground uppercase mt-0.5">{activeChain.name}</p>
          </div>
          <ChevronDown className="w-3 h-3 text-muted-foreground" />
        </button>

        <Button variant="ghost" size="icon"><Info className="w-5 h-5 text-muted-foreground" /></Button>
      </header>

      {/* TOP ERROR ALERT */}
      <AnimatePresence>
        {balanceError && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-red-500/10 border-b border-red-500/20 px-6 py-4 flex items-center gap-3"
          >
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
            <p className="text-xs font-bold text-red-400 leading-tight uppercase tracking-tight">
              {balanceError}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex-1 overflow-y-auto px-6 pt-10 pb-32 space-y-12 max-w-lg mx-auto w-full">
        
        {/* CENTRAL ANIMATION AREA */}
        <section className="flex items-center justify-center gap-8 py-4">
          {/* SENDER NODE */}
          <div className="relative group">
            <div className="absolute -inset-4 bg-primary/20 rounded-full blur-2xl opacity-20 group-hover:opacity-40 transition-opacity" />
            <div className="w-24 h-24 rounded-[2.5rem] bg-white/[0.03] border border-white/10 flex items-center justify-center shadow-2xl relative z-10">
              <TokenLogoDynamic 
                logoUrl={selectedToken?.iconUrl} 
                alt="Sender" 
                size={56} 
                chainId={selectedToken?.chainId} 
                symbol={selectedToken?.symbol}
              />
            </div>
          </div>

          {/* THE SPEAR (ANIMATED ARROW) */}
          <div className="relative flex items-center justify-center">
            <motion.div
              animate={{ 
                x: [0, 10, 0],
                opacity: [0.4, 1, 0.4]
              }}
              transition={{ duration: 2, repeat: Infinity }}
              className="text-primary"
            >
              <ArrowRight className="w-8 h-8 stroke-[3px]" />
            </motion.div>
          </div>

          {/* RECIPIENT NODE */}
          <div className="relative group">
            <div className={cn(
                "absolute -inset-4 bg-primary/20 rounded-full blur-2xl transition-opacity",
                recipientProfile ? "opacity-40" : "opacity-0"
            )} />
            <div className="w-24 h-24 rounded-[2.5rem] bg-white/[0.03] border border-white/10 flex items-center justify-center shadow-2xl relative z-10 overflow-hidden">
              {recipientProfile ? (
                <div className="relative w-full h-full">
                  <Avatar className="w-full h-full rounded-none">
                    <AvatarImage src={recipientProfile.avatar} className="object-cover" />
                    <AvatarFallback className="bg-zinc-900 text-primary text-2xl font-black">
                      {recipientProfile.name[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {/* MINI TOKEN BADGE */}
                  <div className="absolute bottom-2 right-2 w-8 h-8 rounded-xl bg-black border-2 border-[#050505] p-1.5 shadow-xl animate-in zoom-in duration-500">
                    <TokenLogoDynamic 
                        logoUrl={selectedToken?.iconUrl} 
                        alt="Receive" 
                        size={20} 
                        chainId={selectedToken?.chainId} 
                        symbol={selectedToken?.symbol}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1 opacity-20">
                  <User className="w-10 h-10" />
                  <span className="text-[8px] font-black uppercase">Recipient</span>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* SLIM RECIPIENT BAR */}
        <section className="space-y-3">
          <div className="flex justify-between items-center px-2">
            <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Recipient Details</Label>
            <span className="text-[9px] font-bold text-primary uppercase bg-primary/10 px-2 py-0.5 rounded">Verified Cloud</span>
          </div>
          <div className="relative bg-white/[0.02] border border-white/5 focus-within:border-primary/30 rounded-2xl transition-all">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/30" />
            <Input 
              placeholder="Account Number or Address" 
              value={recipientInput} 
              onChange={(e) => setRecipientInput(e.target.value)} 
              className="h-12 bg-transparent border-none pl-11 rounded-2xl focus-visible:ring-0 text-sm font-mono text-white placeholder:text-zinc-800"
            />
            {isResolving && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-primary" />}
          </div>
        </section>

        {/* AMOUNT SECTION */}
        <section className="space-y-3">
          <div className="flex justify-between items-center px-2">
            <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Transfer Amount</Label>
            <p className="text-[9px] font-bold text-muted-foreground uppercase">Bal: {parseFloat(selectedToken?.balance || '0').toFixed(4)}</p>
          </div>
          <div className="bg-white/[0.02] border border-white/5 focus-within:border-primary/30 rounded-[2.5rem] p-8 transition-all relative">
            <div className="flex items-baseline justify-between gap-4">
              <Input 
                type="number" 
                placeholder="0.00" 
                value={amount} 
                onChange={(e) => setAmount(e.target.value)} 
                className="bg-transparent border-none text-5xl font-black p-0 h-auto focus-visible:ring-0 tracking-tighter text-white placeholder:text-zinc-900"
              />
              <span className="text-xl font-black text-white/20 uppercase">{selectedToken?.symbol}</span>
            </div>
            <p className="mt-2 text-xs font-bold text-muted-foreground/40">≈ {formatFiat((parseFloat(amount) || 0) * (selectedToken?.priceUsd || 0))}</p>
          </div>
        </section>
      </main>

      {/* SEND BUTTON - ALWAYS ACTIVE */}
      <div className="fixed bottom-8 left-0 right-0 px-6 z-40">
        <Button 
          disabled={!resolvedAddress || !amount || isSubmitting}
          className="w-full h-16 rounded-[2.5rem] font-black text-lg bg-primary hover:bg-primary/90 text-white shadow-2xl shadow-primary/20 transition-all active:scale-95 border-b-4 border-primary/50"
          onClick={handleOpenConfirmation}
        >
          {isSubmitting ? <Loader2 className="w-6 h-6 animate-spin" /> : "Sign & Dispatch"}
        </Button>
      </div>

      {/* CONFIRMATION SHEET */}
      <TransactionConfirmationSheet 
        isOpen={isConfirming}
        onOpenChange={setIsConfirming}
        onConfirm={handleFinalConfirm}
        isSubmitting={isSubmitting}
        amount={amount}
        token={selectedToken}
        recipientName={recipientProfile?.name || resolvedAddress.slice(0, 8)}
        recipientAddress={resolvedAddress}
        recipientAvatar={recipientProfile?.avatar}
      />

      {/* TOKEN SELECTION SHEET */}
      <Sheet open={isTokenSheetOpen} onOpenChange={setIsTokenSideSheetOpen}>
        <SheetContent side="bottom" className="bg-[#0a0a0c]/95 border-t border-white/10 rounded-t-[3.5rem] p-0 h-[80vh] overflow-hidden">
          <div className="w-12 h-1.5 bg-white/10 rounded-full mx-auto my-4" />
          <SheetHeader className="px-6 mb-6">
            <SheetTitle className="text-xl font-black uppercase tracking-widest text-center">Select Asset</SheetTitle>
          </SheetHeader>
          <ScrollArea className="flex-1 px-6">
            <div className="space-y-2 pb-24">
              {allAssets.map((token) => (
                <button 
                  key={`${token.chainId}-${token.symbol}`} 
                  onClick={() => { setSelectedToken(token); setIsTokenSideSheetOpen(false); }}
                  className="w-full flex items-center justify-between p-4 rounded-3xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all text-left"
                >
                  <div className="flex items-center gap-4">
                    <TokenLogoDynamic logoUrl={token.iconUrl} alt={token.symbol} size={40} chainId={token.chainId} symbol={token.symbol} />
                    <div>
                      <p className="font-black text-white">{token.symbol}</p>
                      <p className="text-[10px] text-muted-foreground uppercase font-bold">{token.name}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-sm text-white">{parseFloat(token.balance).toFixed(4)}</p>
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </div>
  );
}

export default function SendPage() {
  return (
    <Suspense fallback={<div className="flex h-screen w-full items-center justify-center bg-[#050505]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
      <SendClient />
    </Suspense>
  );
}
