
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useWallet } from '@/contexts/wallet-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  ArrowLeft, 
  ChevronRight, 
  AlertCircle, 
  Loader2, 
  CheckCircle2, 
  Fuel
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import TokenLogoDynamic from '@/components/shared/TokenLogoDynamic';
import { ethers } from 'ethers';
import { useToast } from '@/hooks/use-toast';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { getInitialAssets } from '@/lib/wallets/balances';
import type { AssetRow, ChainConfig } from '@/lib/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

export default function SendPage() {
  const { viewingNetwork, wallets, balances, infuraApiKey, allChains, allAssets } = useWallet();
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [step, setStep] = useState<'details' | 'success'>('details');
  const [selectedToken, setSelectedToken] = useState<AssetRow | null>(null);
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [txHash, setTxHash] = useState('');

  const [isNetworkSheetOpen, setIsNetworkSheetOpen] = useState(false);
  const [selectedNetworkForSelection, setSelectedNetworkForSelection] = useState<ChainConfig | null>(null);
  const [isTokenSideSheetOpen, setIsTokenSideSheetOpen] = useState(false);

  useEffect(() => {
    if (!selectedToken && allAssets.length > 0) {
        const symbol = searchParams.get('symbol');
        const chainId = parseInt(searchParams.get('chainId') || '');
        const found = allAssets.find(a => a.symbol === symbol && a.chainId === chainId) || allAssets[0];
        if (found) setSelectedToken({ ...found });
    }
  }, [allAssets, selectedToken, searchParams]);

  const handleSendRequest = async () => {
    if (!wallets || !wallets[0].privateKey || !selectedToken || !infuraApiKey) {
      toast({ title: "Configuration Error", description: "Missing wallet or key.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      const rpcUrl = viewingNetwork.rpcUrl.replace('{API_KEY}', infuraApiKey);
      const provider = new ethers.JsonRpcProvider(rpcUrl, undefined, { staticNetwork: true });
      const wallet = new ethers.Wallet(wallets[0].privateKey, provider);
      let tx;
      if (selectedToken.isNative) {
        tx = await wallet.sendTransaction({ to: recipient, value: ethers.parseEther(amount) });
      } else {
        const abi = ["function transfer(address to, uint256 amount) returns (bool)"];
        const contract = new ethers.Contract(selectedToken.address, abi, wallet);
        tx = await contract.transfer(recipient, ethers.parseUnits(amount, 18));
      }
      setTxHash(tx.hash);
      setStep('success');
    } catch (e: any) {
      toast({ title: "Send Failed", description: e.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTokenSelect = (token: AssetRow) => {
    setSelectedToken(token);
    setIsTokenSideSheetOpen(false);
    setIsNetworkSheetOpen(false);
  };

  const balance = parseFloat(selectedToken?.balance || '0');
  const isValidAmount = parseFloat(amount) > 0 && parseFloat(amount) <= balance;
  const amountUsdValue = (parseFloat(amount) || 0) * (selectedToken?.priceUsd || 0);

  const canSend = recipient.length > 0 && isValidAmount && !isSubmitting && !!infuraApiKey;

  const renderDetails = () => (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1">
        <div className="p-6 space-y-8 pb-40">
          {/* Token Selector Pill */}
          <div className="flex flex-col items-center">
            <button 
                onClick={() => setIsNetworkSheetOpen(true)}
                className="flex items-center gap-3 p-2 rounded-[2rem] bg-primary/10 border border-primary/20 hover:bg-primary/20 transition-all group shadow-[0_0_30px_rgba(129,140,248,0.1)] active:scale-95"
            >
                <div className="p-1">
                    <TokenLogoDynamic 
                        logoUrl={selectedToken?.iconUrl} 
                        alt={selectedToken?.name || ''} 
                        size={36} 
                        chainId={selectedToken?.chainId}
                        name={selectedToken?.name}
                        symbol={selectedToken?.symbol}
                    />
                </div>
                <div className="text-left pr-4">
                    <h2 className="text-sm font-black leading-none text-white uppercase tracking-tight">{selectedToken?.symbol || 'Select Asset'}</h2>
                    <p className="text-[8px] text-muted-foreground uppercase tracking-widest mt-1 font-bold opacity-60">Change</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-1 transition-transform mr-2" />
            </button>
          </div>

          {/* Form Fields */}
          <div className="space-y-6">
            {/* Recipient Card */}
            <div className="space-y-3">
              <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] pl-4 opacity-60">Recipient</Label>
              <div className="bg-primary/5 border border-primary/10 rounded-[2rem] p-2 backdrop-blur-xl">
                    <Input 
                        placeholder="0x... or ENS" 
                        value={recipient}
                        onChange={(e) => setRecipient(e.target.value)}
                        className="h-14 bg-transparent border-none text-sm font-mono focus-visible:ring-0 placeholder:text-zinc-700"
                    />
              </div>
            </div>

            {/* Amount Card */}
            <div className="space-y-3">
              <div className="flex justify-between items-center px-4">
                <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] opacity-60">Amount</Label>
                <span className="text-[9px] text-primary font-black uppercase tracking-widest bg-primary/10 px-3 py-1 rounded-full border border-primary/10">
                    Balance: {balance.toFixed(4)}
                </span>
              </div>
              <div className="bg-primary/5 border border-primary/10 rounded-[2.5rem] p-6 backdrop-blur-xl relative group">
                    <div className="flex items-baseline justify-between gap-4">
                        <Input 
                            type="number"
                            placeholder="0.00" 
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className="bg-transparent border-none text-[clamp(1.5rem,8vw,2.5rem)] font-black p-0 h-auto focus-visible:ring-0 tracking-tighter placeholder:text-zinc-800"
                        />
                        <Button 
                            size="sm" 
                            variant="ghost" 
                            className="text-primary font-black hover:bg-primary/10 rounded-xl text-[10px] uppercase tracking-widest h-10 px-4"
                            onClick={() => setAmount(balance.toString())}
                        >
                            MAX
                        </Button>
                    </div>
                    <div className="mt-2 text-xs font-bold text-muted-foreground/40 italic">
                        ≈ ${amountUsdValue.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD
                    </div>
              </div>
            </div>
          </div>

          {/* Fee Breakdown Card */}
          <div className="p-6 rounded-[2rem] bg-white/[0.02] border border-white/5 space-y-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2 text-muted-foreground font-black text-[9px] uppercase tracking-[0.2em] opacity-60">
                    <Fuel className="w-3.5 h-3.5 text-primary" />
                    Network Fee
                </div>
                <span className="font-bold font-mono text-xs text-white">~0.000 {viewingNetwork.symbol}</span>
              </div>
              <div className="h-px bg-white/5" />
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground opacity-60">Total to pay</span>
                <span className="text-2xl font-black text-primary tracking-tighter">{amount || '0.00'} {selectedToken?.symbol}</span>
              </div>
          </div>
        </div>
      </ScrollArea>

      {/* Sticky Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-background via-background/95 to-transparent backdrop-blur-md z-40">
        <div className="max-w-md mx-auto">
            {amount && parseFloat(amount) > balance && (
              <div className="flex items-center gap-2 p-3 rounded-2xl bg-destructive/10 text-destructive text-[10px] border border-destructive/20 mb-4 font-black uppercase tracking-widest justify-center animate-in fade-in slide-in-from-bottom-2">
                <AlertCircle className="w-3.5 h-3.5" /> Insufficient {selectedToken?.symbol} balance
              </div>
            )}
            <Button 
              className={cn(
                "w-full h-16 rounded-[2rem] text-lg font-black shadow-2xl transition-all duration-300 border-b-4",
                canSend 
                    ? "bg-primary hover:bg-primary/90 border-primary/50 shadow-primary/30" 
                    : "bg-zinc-800 border-zinc-900 opacity-50 grayscale cursor-not-allowed text-zinc-500 shadow-none"
              )}
              disabled={!canSend}
              onClick={handleSendRequest}
            >
              {isSubmitting ? (
                <div className="flex items-center gap-3">
                    <Loader2 className="w-6 h-6 animate-spin" />
                    <span className="animate-pulse">Signing Transaction...</span>
                </div>
              ) : "Sign & Send"}
            </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="p-4 flex items-center gap-2 border-b border-white/5 sticky top-0 bg-background/80 backdrop-blur-xl z-50">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-xl">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">Send Assets</h1>
      </header>
      
      <main className="flex-1 overflow-hidden">
        {step === 'details' ? renderDetails() : (
            <div className="p-10 text-center space-y-8 flex flex-col items-center justify-center h-full">
                <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center mb-4">
                    <CheckCircle2 className="w-12 h-12 text-green-500" />
                </div>
                <div className="space-y-2">
                    <h2 className="text-3xl font-black tracking-tight">Transaction Sent!</h2>
                    <p className="text-sm text-muted-foreground font-medium">Your assets are being broadcasted to the network.</p>
                </div>
                <Button className="w-full h-14 rounded-2xl font-black text-base mt-8" onClick={() => router.push('/')}>Return Home</Button>
            </div>
        )}
      </main>

      {/* Shared Network & Token Sheets */}
      <Sheet open={isNetworkSheetOpen} onOpenChange={setIsNetworkSheetOpen}>
        <SheetContent side="bottom" className="bg-transparent border-t border-primary/20 rounded-t-[3.5rem] p-0 h-[80vh] overflow-hidden">
            <div className="absolute inset-0 bg-[#0a0a0c]/80 backdrop-blur-3xl -z-10" />
            <div className="absolute inset-0 bg-gradient-to-b from-primary/30 via-transparent to-black/80 -z-10" />
            <div className="flex flex-col h-full relative z-10">
                <div className="w-12 h-1.5 bg-white/10 rounded-full mx-auto my-4 shrink-0" />
                <SheetHeader className="mb-6 px-6 pt-4">
                    <SheetTitle className="text-2xl font-black text-center uppercase tracking-widest">Select Network</SheetTitle>
                </SheetHeader>
                <ScrollArea className="flex-1 px-6">
                    <div className="grid grid-cols-2 gap-3 pb-24">
                        {allChains.map((chain) => (
                            <button 
                                key={chain.chainId}
                                onClick={() => {
                                    setSelectedNetworkForSelection(chain);
                                    setIsTokenSideSheetOpen(true);
                                }}
                                style={{
                                    borderColor: `${chain.themeColor || '#818cf8'}40`,
                                    background: `linear-gradient(135deg, ${chain.themeColor || '#818cf8'}15 0%, rgba(0,0,0,0) 100%)`,
                                }}
                                className="flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all text-center"
                            >
                                <TokenLogoDynamic logoUrl={chain.iconUrl} alt={chain.name} size={40} chainId={chain.chainId} name={chain.name} symbol={chain.symbol} />
                                <p className="font-black text-[11px] uppercase tracking-tight text-white">{chain.name}</p>
                            </button>
                        ))}
                    </div>
                </ScrollArea>
            </div>
        </SheetContent>
      </Sheet>

      <Sheet open={isTokenSideSheetOpen} onOpenChange={setIsTokenSideSheetOpen}>
        <SheetContent side="right" className="bg-[#0a0a0c]/95 backdrop-blur-2xl border-l border-white/5 w-full sm:max-w-[450px] p-0 flex flex-col h-full">
            <SheetHeader className="p-6 border-b border-white/5 shrink-0">
                <Button variant="ghost" size="icon" onClick={() => setIsTokenSideSheetOpen(false)} className="mb-4"><ArrowLeft className="w-5 h-5"/></Button>
                <SheetTitle className="text-lg font-black uppercase tracking-tight">{selectedNetworkForSelection?.name}</SheetTitle>
            </SheetHeader>
            <ScrollArea className="flex-1 p-4">
                <div className="space-y-2 pb-20">
                    {selectedNetworkForSelection && getInitialAssets(selectedNetworkForSelection.chainId).map((token) => {
                        const asset = (balances[selectedNetworkForSelection.chainId]?.find(b => b.symbol === token.symbol) || { ...token, balance: '0' }) as AssetRow;
                        return (
                            <button 
                                key={asset.symbol}
                                onClick={() => handleTokenSelect(asset)}
                                className="w-full flex items-center justify-between p-4 rounded-3xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all text-left"
                            >
                                <div className="flex items-center gap-4">
                                    <TokenLogoDynamic logoUrl={asset.iconUrl} alt={asset.symbol} size={44} chainId={asset.chainId} symbol={asset.symbol} name={asset.name} />
                                    <div>
                                        <p className="font-black text-base text-white">{asset.symbol}</p>
                                        <p className="text-xs text-muted-foreground">{asset.name}</p>
                                    </div>
                                </div>
                                <p className="font-mono text-sm font-black text-white">{parseFloat(asset.balance).toFixed(4)}</p>
                            </button>
                        );
                    })}
                </div>
            </ScrollArea>
        </SheetContent>
      </Sheet>
    </div>
  );
}
