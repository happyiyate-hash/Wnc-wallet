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
  ArrowRight,
  QrCode,
  Fuel,
  Copy,
  Wallet as WalletIcon
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import TokenLogoDynamic from '@/components/shared/TokenLogoDynamic';
import { ethers } from 'ethers';
import { useToast } from '@/hooks/use-toast';
import { useDebounce } from '@/hooks/use-debounce';
import { useUser } from '@/contexts/user-provider';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { getInitialAssets } from '@/lib/wallets/balances';
import type { AssetRow, ChainConfig } from '@/lib/types';
import { getAddressForChain } from '@/lib/wallets/utils';

export default function SendPage() {
  const { viewingNetwork, wallets, balances, infuraApiKey, allChains, allAssets } = useWallet();
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Workflow State
  const [step, setStep] = useState<'details' | 'success'>('details');
  const [selectedToken, setSelectedToken] = useState<AssetRow | null>(null);
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [txHash, setTxHash] = useState('');

  // Sheet State
  const [isNetworkSheetOpen, setIsNetworkSheetOpen] = useState(false);
  const [selectedNetworkForSelection, setSelectedNetworkForSelection] = useState<ChainConfig | null>(null);
  const [isTokenSideSheetOpen, setIsTokenSideSheetOpen] = useState(false);

  // Fee Estimation State
  const [networkFee, setNetworkFee] = useState<string | null>(null);
  const [isFeeLoading, setIsFeeLoading] = useState(false);
  const debouncedAmount = useDebounce(amount, 500);
  const debouncedRecipient = useDebounce(recipient, 500);

  const balance = parseFloat(selectedToken?.balance || '0');
  const isValidAmount = parseFloat(amount) > 0 && parseFloat(amount) <= balance;

  // Auto-select token based on query params or defaults
  useEffect(() => {
    if (!selectedToken && allAssets.length > 0) {
        const symbol = searchParams.get('symbol');
        const chainId = parseInt(searchParams.get('chainId') || '');
        
        const found = allAssets.find(a => a.symbol === symbol && a.chainId === chainId) || allAssets[0];
        if (found) {
            setSelectedToken({ ...found });
        }
    }
  }, [allAssets, selectedToken, searchParams]);

  // Estimate Fee
  useEffect(() => {
    const estimateFee = async () => {
      if (!infuraApiKey || !selectedToken || !viewingNetwork.rpcUrl) {
        setNetworkFee(null);
        return;
      }

      setIsFeeLoading(true);
      try {
        const rpcUrl = viewingNetwork.rpcUrl.replace('{API_KEY}', infuraApiKey);
        const provider = new ethers.JsonRpcProvider(rpcUrl, undefined, { staticNetwork: true });
        const feeData = await provider.getFeeData();
        const gasPrice = feeData.gasPrice || 0n;

        let gasLimit = 21000n;
        if (!selectedToken.isNative && selectedToken.address) {
          const abi = ["function transfer(address to, uint256 amount) returns (bool)"];
          const contract = new ethers.Contract(selectedToken.address, abi, provider);
          if (ethers.isAddress(debouncedRecipient) && parseFloat(debouncedAmount) > 0) {
            try {
              gasLimit = await contract.transfer.estimateGas(
                debouncedRecipient, 
                ethers.parseUnits(debouncedAmount, 18)
              );
            } catch (e) {
              gasLimit = 65000n;
            }
          } else {
            gasLimit = 65000n;
          }
        }

        const feeWei = gasPrice * gasLimit;
        setNetworkFee(ethers.formatEther(feeWei));
      } catch (e) {
        console.error("Gas estimation failed:", e);
        setNetworkFee(null);
      } finally {
        setIsFeeLoading(false);
      }
    };

    if (step === 'details' && selectedToken) estimateFee();
  }, [debouncedAmount, debouncedRecipient, selectedToken, viewingNetwork, step, infuraApiKey]);

  const handleSendRequest = async () => {
    if (!wallets || !wallets[0].privateKey || !selectedToken || !isValidAmount || !infuraApiKey) {
      toast({ title: "Configuration Error", description: "Wallet data or API key missing.", variant: "destructive" });
      return;
    }
    
    setIsSubmitting(true);
    try {
      const rpcUrl = viewingNetwork.rpcUrl.replace('{API_KEY}', infuraApiKey);
      const provider = new ethers.JsonRpcProvider(rpcUrl, undefined, { staticNetwork: true });
      const wallet = new ethers.Wallet(wallets[0].privateKey, provider);
      
      let tx;
      if (selectedToken.isNative) {
        tx = await wallet.sendTransaction({
          to: recipient,
          value: ethers.parseEther(amount)
        });
      } else {
        const abi = ["function transfer(address to, uint256 amount) returns (bool)"];
        const contract = new ethers.Contract(selectedToken.address, abi, wallet);
        tx = await contract.transfer(recipient, ethers.parseUnits(amount, 18));
      }

      setTxHash(tx.hash);
      setStep('success');
      toast({ title: "Transaction Sent", description: "Successfully signed and broadcasted." });
    } catch (e: any) {
      toast({ title: "Signing Failed", description: e.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalDisplayAmount = useMemo(() => {
    const val = parseFloat(amount || '0');
    const fee = parseFloat(networkFee || '0');
    return selectedToken?.isNative ? (val + fee).toFixed(6) : val.toFixed(6);
  }, [amount, networkFee, selectedToken]);

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
            className="flex items-center gap-3 p-3 rounded-2xl bg-secondary/30 border border-white/5 hover:bg-secondary/50 transition-all group"
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
                <h2 className="text-lg font-bold leading-none">{selectedToken?.symbol || 'Select Asset'}</h2>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">Change Token</p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
        </button>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label className="text-xs font-bold text-muted-foreground uppercase tracking-widest pl-1">Recipient Address</Label>
          <div className="p-[1px] bg-gradient-to-r from-blue-500/30 via-purple-500/30 to-green-500/30 rounded-2xl">
            <div className="relative bg-zinc-950 rounded-2xl overflow-hidden">
                <Input 
                    placeholder="0x..." 
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                    className="h-14 bg-transparent border-none text-base font-mono focus-visible:ring-0 pr-24"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-9 w-9 text-primary">
                        <QrCode className="w-5 h-5" />
                    </Button>
                </div>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-end px-1">
            <Label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Amount</Label>
            <span className="text-xs text-muted-foreground">Balance: {selectedToken?.balance}</span>
          </div>
          <div className="p-[1px] bg-gradient-to-r from-blue-500/30 via-purple-500/30 to-green-500/30 rounded-2xl">
            <div className="relative bg-zinc-950 rounded-2xl overflow-hidden">
                <Input 
                    type="number"
                    placeholder="0.00" 
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="h-20 bg-transparent border-none text-3xl font-bold pr-20 focus-visible:ring-0"
                />
                <Button 
                    size="sm" 
                    variant="ghost" 
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-primary font-bold"
                    onClick={() => setAmount(selectedToken?.balance || '0')}
                >
                    MAX
                </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="p-5 rounded-[1.5rem] bg-white/5 border border-white/10 space-y-4">
          <div className="flex justify-between items-center text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
                <Fuel className="w-4 h-4" />
                Network Fee
            </div>
            {isFeeLoading ? (
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <span className="text-xs italic opacity-50">Estimating...</span>
              </div>
            ) : (
              <span className="font-bold">
                {networkFee ? `~${parseFloat(networkFee).toFixed(6)}` : '0.000'} {viewingNetwork.symbol}
              </span>
            )}
          </div>
          <div className="h-px bg-white/5" />
          <div className="flex justify-between items-center">
            <span className="text-base font-bold">Total</span>
            <span className="text-xl font-bold text-primary">{totalDisplayAmount} {selectedToken?.symbol}</span>
          </div>
      </div>

      <div className="mt-auto pb-4">
        {amount && parseFloat(amount) > balance && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-destructive/10 text-destructive text-sm border border-destructive/20 mb-4">
            <AlertCircle className="w-4 h-4" /> Insufficient balance
          </div>
        )}
        <Button 
          className="w-full h-16 rounded-2xl text-lg font-bold shadow-2xl shadow-primary/20"
          disabled={!recipient || !isValidAmount || isSubmitting || !infuraApiKey}
          onClick={handleSendRequest}
        >
          {isSubmitting ? (
            <div className="flex items-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Broadcasting...</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
                <span>Send Funds</span>
                <ArrowRight className="w-5 h-5" />
            </div>
          )}
        </Button>
      </div>
    </div>
  );

  const renderSuccess = () => (
    <div className="p-10 text-center space-y-8 flex flex-col items-center justify-center h-full">
      <div className="w-24 h-24 bg-green-500/20 rounded-full flex items-center justify-center border border-green-500/30">
        <CheckCircle2 className="w-12 h-12 text-green-500" />
      </div>
      <div className="space-y-2">
        <h2 className="text-3xl font-bold">Funds Sent!</h2>
        <p className="text-muted-foreground max-w-[240px] mx-auto text-sm">Your transaction has been broadcasted to the network.</p>
      </div>
      <div className="p-4 rounded-xl bg-secondary/20 border border-white/5 w-full">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1 text-left">Transaction Hash</p>
        <p className="text-xs font-mono break-all text-foreground/80 text-left">{txHash}</p>
      </div>
      <Button className="w-full h-14 rounded-2xl font-bold text-lg" onClick={() => router.push('/')}>
        Done
      </Button>
    </div>
  );

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="p-4 flex items-center gap-2 border-b border-white/5 sticky top-0 bg-background/80 backdrop-blur-xl z-50">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-lg font-bold">{step === 'details' ? 'Send' : 'Success'}</h1>
      </header>
      
      <main className="flex-1 overflow-hidden">
        {step === 'details' ? renderDetails() : renderSuccess()}
      </main>

      {/* STEP 1: BOTTOM SHEET (NETWORKS) */}
      <Sheet open={isNetworkSheetOpen} onOpenChange={setIsNetworkSheetOpen}>
        <SheetContent side="bottom" className="bg-zinc-950 border-white/10 rounded-t-[2.5rem] p-6 max-h-[80vh] overflow-y-auto thin-scrollbar">
            <SheetHeader className="mb-6">
                <SheetTitle className="text-xl font-bold text-center">Select Network</SheetTitle>
            </SheetHeader>
            <div className="grid grid-cols-1 gap-3">
                {allChains.map((chain) => (
                    <button 
                        key={chain.chainId}
                        onClick={() => {
                            setSelectedNetworkForSelection(chain);
                            setIsTokenSideSheetOpen(true);
                        }}
                        className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors group text-left"
                    >
                        <div className="flex items-center gap-3">
                            <TokenLogoDynamic 
                                logoUrl={chain.iconUrl} 
                                alt={chain.name} 
                                size={40} 
                                chainId={chain.chainId} 
                                name={chain.name}
                                symbol={chain.symbol}
                            />
                            <span className="font-bold">{chain.name}</span>
                        </div>
                        <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                    </button>
                ))}
            </div>
        </SheetContent>
      </Sheet>

      {/* STEP 2: SIDE SHEET (TOKENS ON NETWORK) */}
      <Sheet open={isTokenSideSheetOpen} onOpenChange={setIsTokenSideSheetOpen}>
        <SheetContent side="right" className="bg-zinc-950 border-white/10 w-full sm:max-w-[400px] p-0 flex flex-col">
            <SheetHeader className="p-6 border-b border-white/5">
                <SheetTitle className="flex items-center gap-2">
                    <TokenLogoDynamic 
                        logoUrl={selectedNetworkForSelection?.iconUrl} 
                        alt={selectedNetworkForSelection?.name || ''} 
                        size={24} 
                        chainId={selectedNetworkForSelection?.chainId} 
                        name={selectedNetworkForSelection?.name}
                        symbol={selectedNetworkForSelection?.symbol}
                    />
                    {selectedNetworkForSelection?.name} Assets
                </SheetTitle>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto thin-scrollbar p-4 space-y-6">
                {/* ADDRESS HEADER */}
                <div className="p-5 rounded-2xl bg-primary/10 border border-primary/20 space-y-2">
                    <div className="flex items-center gap-2 text-[10px] font-bold text-primary uppercase tracking-widest">
                        <WalletIcon className="w-3 h-3" /> Your Address
                    </div>
                    <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-mono break-all text-foreground/80">
                            {wallets && selectedNetworkForSelection ? getAddressForChain(selectedNetworkForSelection, wallets) : '...'}
                        </p>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-primary shrink-0" onClick={() => {
                            const addr = wallets && selectedNetworkForSelection ? getAddressForChain(selectedNetworkForSelection, wallets) : '';
                            if (addr) {
                                navigator.clipboard.writeText(addr);
                                toast({ title: "Address Copied" });
                            }
                        }}>
                            <Copy className="w-4 h-4" />
                        </Button>
                    </div>
                </div>

                <div className="space-y-2">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pl-1">Available Tokens</p>
                    <div className="space-y-2">
                        {selectedNetworkForSelection && getInitialAssets(selectedNetworkForSelection.chainId).map((token) => {
                            const asset = (balances[selectedNetworkForSelection.chainId]?.find(b => b.symbol === token.symbol) || { ...token, balance: '0' }) as AssetRow;
                            return (
                                <button 
                                    key={asset.symbol}
                                    onClick={() => handleTokenSelect(asset)}
                                    className="w-full flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors text-left"
                                >
                                    <div className="flex items-center gap-3">
                                        <TokenLogoDynamic 
                                            logoUrl={asset.iconUrl} 
                                            alt={asset.symbol} 
                                            size={36} 
                                            chainId={asset.chainId} 
                                            symbol={asset.symbol} 
                                            name={asset.name}
                                        />
                                        <div className="text-left">
                                            <p className="font-bold text-sm">{asset.symbol}</p>
                                            <p className="text-xs text-muted-foreground">{asset.name}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold text-sm">{asset.balance}</p>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}