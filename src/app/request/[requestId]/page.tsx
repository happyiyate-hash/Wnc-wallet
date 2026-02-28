
'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useWallet } from '@/contexts/wallet-provider';
import { useUser } from '@/contexts/user-provider';
import { useCurrency } from '@/contexts/currency-provider';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  ArrowLeft, 
  Loader2, 
  ShieldCheck, 
  AlertCircle, 
  CheckCircle2, 
  ArrowRight,
  HandCoins,
  ShieldAlert,
  Search
} from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import TokenLogoDynamic from '@/components/shared/TokenLogoDynamic';
import type { PaymentRequest, UserProfile, AssetRow } from '@/lib/types';
import { cn } from '@/lib/utils';
import { ethers } from 'ethers';
import * as xrpl from 'xrpl';
import TransactionStatusCard from '@/components/wallet/transaction-status-card';
import TransactionReceiptSheet from '@/components/wallet/transaction-receipt-sheet';

export default function RequestFulfillmentPage() {
  const params = useParams();
  const router = useRouter();
  const { wallets, infuraApiKey, allChainsMap, allAssets, refresh } = useWallet();
  const { profile: currentUserProfile, user: currentUser } = useUser();
  const { formatFiat } = useCurrency();

  const [request, setRequest] = useState<PaymentRequest | null>(null);
  const [requester, setRequester] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [txStatus, setTxStatus] = useState<'pending' | 'success' | 'error'>('pending');
  const [isStatusVisible, setIsStatusVisible] = useState(false);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [txHash, setTxHash] = useState('');
  const [receiptError, setReceiptError] = useState('');

  const requestId = params.requestId as string;

  useEffect(() => {
    async function fetchRequestDetails() {
      if (!requestId || !supabase) return;
      
      try {
        const { data: requestData, error: requestError } = await supabase
          .from('payment_requests')
          .select('*')
          .eq('id', requestId)
          .single();

        if (requestError) throw new Error("Request node not found or expired.");
        setRequest(requestData);

        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', requestData.requester_id)
          .single();

        if (profileError) throw new Error("Requester identity node is unavailable.");
        setRequester(profileData);

      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }

    fetchRequestDetails();
  }, [requestId]);

  const activeToken = useMemo(() => {
    if (!request || !allAssets.length) return null;
    return allAssets.find(a => a.symbol === request.token_symbol) || null;
  }, [request, allAssets]);

  const handlePay = async () => {
    if (!wallets || !request || !requester || !infuraApiKey) return;

    setIsStatusVisible(true);
    setTxStatus('pending');
    setIsSubmitting(true);

    try {
      const chainType = request.chain_type;
      const amountStr = request.amount.toString();
      
      // Get Recipient Address based on requested chain
      const recipientAddress = chainType === 'evm' ? requester.evm_address :
                               chainType === 'xrp' ? requester.xrp_address :
                               requester.polkadot_address;

      if (!recipientAddress) throw new Error("Requester has no address linked for this network.");

      if (chainType === 'xrp') {
        const xrpWallet = wallets.find(w => w.type === 'xrp');
        const network = Object.values(allChainsMap).find(c => c.type === 'xrp');
        const client = new xrpl.Client(network?.rpcUrl || 'wss://xrplcluster.com');
        await client.connect();
        const wallet = xrpl.Wallet.fromSeed(xrpWallet!.seed!);
        const prepared = await client.autofill({ 
            TransactionType: "Payment", 
            Account: wallet.address, 
            Amount: xrpl.xrpToDrops(amountStr), 
            Destination: recipientAddress 
        });
        const result = await client.submitAndWait(wallet.sign(prepared).tx_blob);
        if (result.result.meta && typeof result.result.meta !== 'string' && (result.result.meta as any).TransactionResult === "tesSUCCESS") {
          setTxHash(result.result.hash);
        } else { throw new Error("XRPL Transaction Failed"); }
        await client.disconnect();
      } else {
        const evmWallet = wallets.find(w => w.type === 'evm');
        const network = Object.values(allChainsMap).find(c => c.type === 'evm');
        const provider = new ethers.JsonRpcProvider(network!.rpcUrl.replace('{API_KEY}', infuraApiKey), undefined, { staticNetwork: true });
        const wallet = new ethers.Wallet(evmWallet!.privateKey!, provider);
        
        let tx;
        if (request.token_address === null) {
            tx = await wallet.sendTransaction({ to: recipientAddress, value: ethers.parseEther(amountStr) });
        } else {
            const contract = new ethers.Contract(request.token_address, ["function transfer(address to, uint256 amount) returns (bool)"], wallet);
            tx = await contract.transfer(recipientAddress, ethers.parseUnits(amountStr, 18));
        }
        setTxHash(tx.hash);
      }

      // Mark request as paid
      await supabase?.from('payment_requests').update({ status: 'paid' }).eq('id', requestId);
      setTxStatus('success');
      refresh(); // Update local balances
    } catch (e: any) {
      setTxStatus('error');
      setReceiptError(e.message || "Broadcast failed.");
    } finally {
      setIsSubmitting(false);
      setTimeout(() => { setIsStatusVisible(false); setIsReceiptOpen(true); }, 3000);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-[#050505]">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="mt-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-40">Verifying Request Node...</p>
      </div>
    );
  }

  if (error || !request || !requester) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-[#050505] p-6 text-center">
        <div className="w-20 h-20 bg-red-500/10 rounded-[2.5rem] flex items-center justify-center text-red-500 mb-6 border border-red-500/20">
          <ShieldAlert className="w-10 h-10" />
        </div>
        <h2 className="text-xl font-black text-white uppercase tracking-tight">Security Alert</h2>
        <p className="mt-2 text-sm text-muted-foreground max-w-xs">{error || "This request has expired or is invalid."}</p>
        <Button variant="ghost" onClick={() => router.push('/')} className="mt-8 text-primary font-black uppercase tracking-widest">Return to Terminal</Button>
      </div>
    );
  }

  const isAlreadyPaid = request.status === 'paid';
  const amountUsd = request.amount * (activeToken?.priceUsd || 0);

  return (
    <div className="flex flex-col h-screen bg-[#050505] text-foreground relative overflow-hidden">
      <header className="p-4 flex items-center justify-between border-b border-white/5 bg-black/50 backdrop-blur-2xl sticky top-0 z-50">
        <Button variant="ghost" size="icon" onClick={() => router.push('/')} className="rounded-xl"><ArrowLeft className="w-5 h-5" /></Button>
        <div className="flex flex-col items-center">
            <h1 className="text-xs font-black uppercase tracking-[0.2em]">Institutional Request</h1>
            <div className="flex items-center gap-1.5 mt-1">
                <ShieldCheck className="w-2.5 h-2.5 text-primary" />
                <span className="text-[8px] text-primary font-black uppercase tracking-tighter">Verified P2P Node</span>
            </div>
        </div>
        <div className="w-10" />
      </header>

      <main className="flex-1 p-6 space-y-10 max-w-lg mx-auto w-full overflow-y-auto pb-48">
        <section className="flex flex-col items-center text-center space-y-6 pt-4">
            <div className="relative group">
                <div className="absolute -inset-4 bg-primary/20 rounded-[3rem] blur-2xl opacity-50" />
                <Avatar className="w-24 h-24 rounded-[2.5rem] border-2 border-primary/30 shadow-2xl relative z-10">
                    <AvatarImage src={requester.photo_url} />
                    <AvatarFallback className="bg-primary/20 text-primary font-black text-3xl">{requester.name[0]}</AvatarFallback>
                </Avatar>
                <div className="absolute -bottom-2 -right-2 z-20 bg-primary p-2 rounded-2xl border-4 border-[#050505] shadow-xl">
                    <TokenLogoDynamic logoUrl={null} alt="Token" size={24} symbol={request.token_symbol} name={request.token_symbol} />
                </div>
            </div>
            <div className="space-y-1">
                <h2 className="text-2xl font-black text-white tracking-tight leading-none">@{requester.name}</h2>
                <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest opacity-60">ID: {requester.account_number}</p>
            </div>
        </section>

        <section className="p-8 rounded-[3rem] bg-white/[0.02] border border-white/5 text-center space-y-4 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 blur-3xl -mr-16 -mt-16" />
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest relative z-10">Amount Requested</p>
            <h3 className="text-5xl font-black text-white tracking-tighter relative z-10">{request.amount} {request.token_symbol}</h3>
            <p className="text-sm font-bold text-primary relative z-10">≈ {formatFiat(amountUsd)}</p>
            {request.note && (
                <div className="mt-6 p-4 rounded-2xl bg-black/40 border border-white/5 text-xs text-muted-foreground italic relative z-10">
                    "{request.note}"
                </div>
            )}
        </section>

        <section className="space-y-3">
            <div className="flex justify-between items-center px-2">
                <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Network Route</span>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary">
                    <HandCoins className="w-3 h-3" />
                    <span className="text-[9px] font-black uppercase">{request.chain_type} Handshake</span>
                </div>
            </div>
            <div className="p-5 rounded-[2rem] bg-white/[0.02] border border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-black/40 flex items-center justify-center text-primary">
                        <ArrowRight className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                        <p className="text-xs font-bold text-white">Direct Dispatch</p>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-black opacity-40">Single Transaction Settlement</p>
                    </div>
                </div>
                <ShieldCheck className="w-5 h-5 text-green-500 opacity-40" />
            </div>
        </section>

        {isAlreadyPaid && (
            <div className="p-5 rounded-[2.5rem] bg-green-500/10 border border-green-500/20 flex gap-4 animate-in slide-in-from-top-4">
                <CheckCircle2 className="w-6 h-6 text-green-500 shrink-0" />
                <div className="space-y-1">
                    <p className="text-xs font-black text-green-500 uppercase tracking-widest">Payment Fulfilled</p>
                    <p className="text-[11px] text-green-400/80 font-bold leading-relaxed">This request has already been authorized and broadcasted to the network.</p>
                </div>
            </div>
        )}
      </main>

      {!isAlreadyPaid && (
        <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black via-black/95 to-transparent backdrop-blur-md z-40">
          <div className="max-w-md mx-auto">
            {!currentUser ? (
                <Button className="w-full h-16 rounded-[2rem] text-lg font-black bg-primary" onClick={() => router.push('/')}>Sign In to Fulfill</Button>
            ) : (
                <Button 
                    className={cn(
                        "w-full h-16 rounded-[2rem] text-lg font-black transition-all border-b-4",
                        isSubmitting ? "bg-zinc-900 border-zinc-950 opacity-50" : "bg-primary border-primary/50 shadow-2xl shadow-primary/20"
                    )}
                    disabled={isSubmitting}
                    onClick={handlePay}
                >
                    {isSubmitting ? <Loader2 className="w-6 h-6 animate-spin" /> : "Sign & Authorize Payment"}
                </Button>
            )}
          </div>
        </div>
      )}

      <TransactionStatusCard 
        isVisible={isStatusVisible} 
        status={txStatus} 
        senderName="You" 
        senderAvatar={currentUserProfile?.photo_url}
        recipientName={requester.name}
        recipientAvatar={requester.photo_url}
        token={{ symbol: request.token_symbol, chainId: 1 }}
      />

      <TransactionReceiptSheet 
        isOpen={isReceiptOpen} 
        onOpenChange={setIsReceiptOpen} 
        status={txStatus === 'error' ? 'error' : 'success'} 
        amount={request.amount.toString()} 
        token={activeToken}
        recipientName={requester.name}
        recipientAddress={request.chain_type === 'evm' ? requester.evm_address! : request.chain_type === 'xrp' ? requester.xrp_address! : requester.polkadot_address!}
        txHash={txHash}
        errorReason={receiptError}
        fee="Standard"
        networkName={request.chain_type.toUpperCase()}
      />
    </div>
  );
}
