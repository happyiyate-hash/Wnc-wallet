
'use client';

import { useState, useEffect } from 'react';
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
  QrCode,
  Fuel,
  Search
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

  const [networkFee, setNetworkFee] = useState<string | null>(null);
  const [isFeeLoading, setIsFeeLoading] = useState(false);

  const balance = parseFloat(selectedToken?.balance || '0');
  const isValidAmount = parseFloat(amount) > 0 && parseFloat(amount) <= balance;

  useEffect(() => {
    if (!selectedToken && allAssets.length > 0) {
        const symbol = searchParams.get('symbol');
        const chainId = parseInt(searchParams.get('chainId') || '');
        const found = allAssets.find(a => a.symbol === symbol && a.chainId === chainId) || allAssets[0];
        if (found) setSelectedToken({ ...found });
    }
  }, [allAssets, selectedToken, searchParams]);

  const handleSendRequest = async () => {
    if (!wallets || !wallets[0].privateKey || !selectedToken || !isValidAmount || !infuraApiKey) {
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

  const renderDetails = () => (
    <div className="p-6 flex flex-col h-full space-y-6">
      <div className="flex flex-col items-center gap-4 mb-4">
        <button 
            onClick={() => setIsNetworkSheetOpen(true)}
            className="flex items-center gap-4 p-3.5 rounded-2xl bg-secondary/30 border border-white/5 hover:bg-secondary/50 transition-all group shadow-xl"
        >
            <TokenLogoDynamic 
                logoUrl={selectedToken?.iconUrl} 
                alt={selectedToken?.name || ''} 
                size={44} 
                chainId={selectedToken?.chainId}
                name={selectedToken?.name}
                symbol={selectedToken?.symbol}
            />
            <div className="text-left">
                <h2 className="text-xl font-black leading-none">{selectedToken?.symbol || 'Select Asset'}</h2>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1.5 font-bold">Change Token</p>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:translate-x-1 transition-transform ml-2" />
        </button>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label className="text-xs font-black text-muted-foreground uppercase tracking-widest pl-1">Recipient Address</Label>
          <div className="p-[1px] bg-gradient-to-r from-blue-500/30 via-purple-500/30 to-green-500/30 rounded-2xl shadow-inner">
            <div className="relative bg-zinc-950 rounded-2xl overflow-hidden">
                <Input 
                    placeholder="0x... or ENS name" 
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                    className="h-16 bg-transparent border-none text-base font-mono focus-visible:ring-0 pr-24"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-10 w-10 text-primary">
                        <QrCode className="w-6 h-6" />
                    </Button>
                </div>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-end px-1">
            <Label className="text-xs font-black text-muted-foreground uppercase tracking-widest">Amount</Label>
            <span className="text-[10px] text-muted-foreground font-mono bg-white/5 px-2 py-0.5 rounded-full">Balance: {selectedToken?.balance}</span>
          </div>
          <div className="p-[1px] bg-gradient-to-r from-blue-500/30 via-purple-500/30 to-green-500/30 rounded-2xl shadow-inner">
            <div className="relative bg-zinc-950 rounded-2xl overflow-hidden">
                <Input 
                    type="number"
                    placeholder="0.00" 
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="h-20 bg-transparent border-none text-4xl font-black pr-20 focus-visible:ring-0"
                />
                <Button 
                    size="sm" 
                    variant="ghost" 
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-primary font-black hover:bg-primary/10 rounded-xl"
                    onClick={() => setAmount(selectedToken?.balance || '0')}
                >
                    MAX
                </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 rounded-[2rem] bg-white/5 border border-white/10 space-y-4 shadow-2xl">
          <div className="flex justify-between items-center text-sm">
            <div className="flex items-center gap-2 text-muted-foreground font-black text-[10px] uppercase tracking-widest">
                <Fuel className="w-4 h-4 text-primary" />
                Network Fee
            </div>
            <span className="font-bold font-mono text-white">
                ~0.000 {viewingNetwork.symbol}
            </span>
          </div>
          <div className="h-px bg-white/5" />
          <div className="flex justify-between items-center">
            <span className="text-base font-black uppercase tracking-widest text-[10px] text-muted-foreground">Total to Send</span>
            <span className="text-2xl font-black text-primary">{amount || '0.00'} {selectedToken?.symbol}</span>
          </div>
      </div>

      <div className="mt-auto pb-4">
        {amount && parseFloat(amount) > balance && (
          <div className="flex items-center gap-2 p-4 rounded-2xl bg-destructive/10 text-destructive text-sm border border-destructive/20 mb-4 font-black shadow-xl">
            <AlertCircle className="w-5 h-5" /> Insufficient balance
          </div>
        )}
        <Button 
          className="w-full h-16 rounded-[1.5rem] text-lg font-black shadow-2xl shadow-primary/30 border-b-4 border-primary/50"
          disabled={!recipient || !isValidAmount || isSubmitting || !infuraApiKey}
          onClick={handleSendRequest}
        >
          {isSubmitting ? <Loader2 className="w-6 h-6 animate-spin" /> : "Sign & Send Funds"}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="p-4 flex items-center gap-2 border-b border-white/5 sticky top-0 bg-background/80 backdrop-blur-xl z-50">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-xl">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-lg font-black uppercase tracking-widest">Send Assets</h1>
      </header>
      
      <main className="flex-1 overflow-hidden">
        {step === 'details' ? renderDetails() : (
            <div className="p-10 text-center space-y-8 flex flex-col items-center justify-center h-full">
                <CheckCircle2 className="w-16 h-16 text-green-500" />
                <h2 className="text-2xl font-black">Transaction Sent!</h2>
                <Button className="w-full h-14 rounded-xl" onClick={() => router.push('/')}>Return Home</Button>
            </div>
        )}
      </main>

      <Sheet open={isNetworkSheetOpen} onOpenChange={setIsNetworkSheetOpen}>
        <SheetContent side="bottom" className="bg-transparent border-t border-primary/20 rounded-t-[3.5rem] p-0 h-[80vh] overflow-hidden shadow-2xl flex flex-col">
            <div className="absolute inset-0 bg-[#0a0a0c]/80 backdrop-blur-3xl -z-10" />
            <div className="absolute inset-0 bg-gradient-to-b from-primary/30 via-transparent to-black/80 -z-10" />
            
            <div className="flex flex-col flex-1 relative z-10 overflow-hidden">
                <div className="w-12 h-1.5 bg-white/10 rounded-full mx-auto my-4 shrink-0" />
                <SheetHeader className="mb-6 px-6 shrink-0 pt-4">
                    <SheetTitle className="text-2xl font-black text-center uppercase tracking-widest">Select Network</SheetTitle>
                </SheetHeader>
                <ScrollArea className="flex-1 px-6">
                    <div className="grid grid-cols-2 gap-3 pb-24 pt-2">
                        {allChains.map((chain) => (
                            <button 
                                key={chain.chainId}
                                onClick={() => {
                                    setSelectedNetworkForSelection(chain);
                                    setIsTokenSideSheetOpen(true);
                                }}
                                style={{
                                    borderColor: chain.themeColor || '#818cf8',
                                    borderWidth: '2px',
                                    background: `linear-gradient(135deg, ${chain.themeColor || '#818cf8'}25 0%, rgba(0,0,0,0) 100%)`,
                                }}
                                className="flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all shadow-lg text-center"
                            >
                                <TokenLogoDynamic logoUrl={chain.iconUrl} alt={chain.name} size={40} chainId={chain.chainId} name={chain.name} symbol={chain.symbol} />
                                <p className="font-black text-[11px] uppercase tracking-tight text-white line-clamp-1">{chain.name}</p>
                            </button>
                        ))}
                    </div>
                </ScrollArea>
            </div>
        </SheetContent>
      </Sheet>

      <Sheet open={isTokenSideSheetOpen} onOpenChange={setIsTokenSideSheetOpen}>
        <SheetContent side="right" className="bg-[#0a0a0c]/95 backdrop-blur-2xl border-l border-primary/20 w-full sm:max-w-[450px] p-0 flex flex-col h-full">
            <SheetHeader className="p-6 border-b border-white/5 bg-gradient-to-b from-primary/10 to-transparent shrink-0 flex flex-row items-center gap-4 space-y-0">
                <Button variant="ghost" size="icon" onClick={() => setIsTokenSideSheetOpen(false)}><ArrowLeft className="w-5 h-5"/></Button>
                <SheetTitle className="text-lg font-black uppercase tracking-tight">{selectedNetworkForSelection?.name}</SheetTitle>
            </SheetHeader>
            <ScrollArea className="flex-1 p-4">
                <div className="space-y-3 pb-20">
                    {selectedNetworkForSelection && getInitialAssets(selectedNetworkForSelection.chainId).map((token) => {
                        const asset = (balances[selectedNetworkForSelection.chainId]?.find(b => b.symbol === token.symbol) || { ...token, balance: '0' }) as AssetRow;
                        return (
                            <button 
                                key={asset.symbol}
                                onClick={() => handleTokenSelect(asset)}
                                className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all group text-left"
                            >
                                <div className="flex items-center gap-4">
                                    <TokenLogoDynamic logoUrl={asset.iconUrl} alt={asset.symbol} size={44} chainId={asset.chainId} symbol={asset.symbol} name={asset.name} />
                                    <div>
                                        <p className="font-black text-base text-white">{asset.symbol}</p>
                                        <p className="text-xs text-muted-foreground">{asset.name}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="font-mono text-sm font-black text-white">{parseFloat(asset.balance).toFixed(4)}</p>
                                </div>
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
