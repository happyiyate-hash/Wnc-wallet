'use client';

import { useState } from 'react';
import { useWallet } from '@/contexts/wallet-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Search, ChevronRight, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import TokenLogoDynamic from '@/components/shared/TokenLogoDynamic';
import { ethers } from 'ethers';
import { useToast } from '@/hooks/use-toast';

export default function SendPage() {
  const { allAssets, viewingNetwork, wallets, infuraApiKey } = useWallet();
  const { toast } = useToast();
  const router = useRouter();

  const [step, setStep] = useState<'select' | 'details' | 'success'>('select');
  const [selectedToken, setSelectedToken] = useState(allAssets[0] || null);
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [txHash, setTxHash] = useState('');

  const balance = parseFloat(selectedToken?.balance || '0');
  const isValidAmount = parseFloat(amount) > 0 && parseFloat(amount) <= balance;

  const handleSendRequest = async () => {
    if (!wallets || !wallets[0].privateKey || !selectedToken || !isValidAmount || !infuraApiKey) return;
    setIsSubmitting(true);

    try {
      const provider = new ethers.JsonRpcProvider(`${viewingNetwork.rpcBase}${infuraApiKey}`);
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
        tx = await contract.transfer(recipient, ethers.parseUnits(amount, 18)); // Mocked 18 decimals
      }

      setTxHash(tx.hash);
      setStep('success');
      toast({ title: "Transaction Sent", description: tx.hash });
    } catch (e: any) {
      console.error("Failed to send transaction", e);
      toast({ title: "Transaction Failed", description: e.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderTokenSelect = () => (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-white/5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search tokens" className="pl-9 bg-secondary/40 border-none rounded-xl h-12" />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {allAssets.map((asset) => (
          <div 
            key={`${asset.chainId}-${asset.symbol}`}
            onClick={() => {
              setSelectedToken(asset);
              setStep('details');
            }}
            className="flex items-center justify-between p-4 hover:bg-secondary/20 cursor-pointer border-b border-white/5 transition-colors"
          >
            <div className="flex items-center gap-3">
              <TokenLogoDynamic logoUrl={asset.iconUrl} alt={asset.name} size={40} chainId={asset.chainId} />
              <div>
                <p className="font-bold">{asset.name}</p>
                <p className="text-xs text-muted-foreground">{asset.balance} {asset.symbol}</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </div>
        ))}
      </div>
    </div>
  );

  const renderDetails = () => (
    <div className="p-6 space-y-8 flex flex-col h-full">
      <div className="flex items-center justify-center gap-3">
         <TokenLogoDynamic logoUrl={selectedToken?.iconUrl} alt={selectedToken?.name || ''} size={48} chainId={selectedToken?.chainId} />
         <div className="text-center">
            <h2 className="text-2xl font-bold">{selectedToken?.symbol}</h2>
            <p className="text-sm text-muted-foreground">on {viewingNetwork.name}</p>
         </div>
      </div>

      <div className="space-y-6">
        <div className="space-y-2">
          <Label className="text-muted-foreground font-bold text-xs uppercase">Recipient Address</Label>
          <Input 
            placeholder="0x..." 
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            className="h-14 bg-secondary/40 border-none rounded-2xl text-lg font-mono"
          />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-end">
            <Label className="text-muted-foreground font-bold text-xs uppercase">Amount</Label>
            <span className="text-xs text-muted-foreground">Balance: {selectedToken?.balance} {selectedToken?.symbol}</span>
          </div>
          <div className="relative">
            <Input 
              type="number"
              placeholder="0.00" 
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="h-20 bg-secondary/40 border-none rounded-2xl text-3xl font-bold pr-20"
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

      <div className="mt-auto space-y-4">
        {amount && parseFloat(amount) > balance && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-destructive/10 text-destructive text-sm">
            <AlertCircle className="w-4 h-4" /> Insufficient balance
          </div>
        )}
        <Button 
          className="w-full h-16 rounded-2xl text-xl font-bold"
          disabled={!recipient || !isValidAmount || isSubmitting}
          onClick={handleSendRequest}
        >
          {isSubmitting ? <Loader2 className="w-6 h-6 animate-spin" /> : "Review & Sign"}
        </Button>
      </div>
    </div>
  );

  const renderSuccess = () => (
    <div className="p-10 text-center space-y-8 flex flex-col items-center justify-center h-full">
      <div className="w-24 h-24 bg-green-500/20 rounded-full flex items-center justify-center">
        <CheckCircle2 className="w-12 h-12 text-green-500" />
      </div>
      <div>
        <h2 className="text-2xl font-bold">Transaction Sent!</h2>
        <p className="text-muted-foreground mt-2 font-mono text-xs break-all px-4">{txHash}</p>
      </div>
      <Button className="w-full h-14 rounded-xl" onClick={() => router.push('/')}>
        Done
      </Button>
    </div>
  );

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="p-4 flex items-center gap-2 border-b border-white/5">
        <Button variant="ghost" size="icon" onClick={() => step === 'details' ? setStep('select') : router.back()}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-lg font-bold">
          {step === 'select' ? 'Select Token' : step === 'details' ? `Send ${selectedToken?.symbol}` : 'Success'}
        </h1>
      </header>
      
      <main className="flex-1 overflow-hidden">
        {step === 'select' ? renderTokenSelect() : step === 'details' ? renderDetails() : renderSuccess()}
      </main>
    </div>
  );
}
