
'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Zap, 
  HandCoins, 
  Loader2, 
  ShieldCheck, 
  ChevronDown, 
  ArrowRight, 
  CheckCircle2, 
  Copy, 
  Share2, 
  QrCode as QrIcon,
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useWallet } from '@/contexts/wallet-provider';
import { useUser } from '@/contexts/user-provider';
import { useCurrency } from '@/contexts/currency-provider';
import TokenLogoDynamic from '../shared/TokenLogoDynamic';
import GlobalTokenSelector from '../shared/global-token-selector';
import type { AssetRow, PaymentRequest, UserProfile } from '@/lib/types';
import { supabase } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import QRCode from "react-qr-code";
import TransactionStatusCard from './transaction-status-card';
import TransactionReceiptSheet from './transaction-receipt-sheet';
import { ethers } from 'ethers';
import * as xrpl from 'xrpl';
import { useToast } from '@/hooks/use-toast';

/**
 * TECHNICAL ERROR MAPPER
 */
const mapTechnicalError = (err: any): string => {
  const msg = (err.message || String(err)).toLowerCase();
  
  if (msg.includes('insufficient funds') || msg.includes('insufficient balance')) {
    return "Insufficient Funds: Your node balance is too low to authorize this dispatch.";
  }
  if (msg.includes('candidate function') || msg.includes('ambiguous')) {
    return "Registry Ambiguity: Multiple transfer protocols detected. Please use the whole-number (integer) unit standard.";
  }
  if (msg.includes('user rejected')) {
    return "Transaction Cancelled: You rejected the request in your terminal.";
  }
  
  if (err.message) return `System Advisory: ${err.message}`;
  return "Dispatch Error: The transaction was rejected by the network protocol.";
};

/**
 * INSTITUTIONAL REQUEST CREATION CARD
 */
export function RequestCreateMoment({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const { allAssets, viewingNetwork, accountNumber } = useWallet();
  const { user } = useUser();
  const { formatFiat } = useCurrency();
  const { toast } = useToast();
  
  const [step, setStep] = useState<'edit' | 'ready'>('edit');
  const [selectedToken, setSelectedToken] = useState<AssetRow | null>(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => { if (!selectedToken && allAssets.length > 0) setSelectedToken(allAssets[0]); }, [allAssets, selectedToken]);

  const handleGenerate = async () => {
    if (!user || !selectedToken || !accountNumber || !supabase) return;
    setIsCreating(true);
    try {
      const { data, error } = await supabase.from('payment_requests').insert({
        requester_id: user.id,
        requester_account_number: accountNumber,
        chain_type: viewingNetwork.type || 'evm',
        token_symbol: selectedToken.symbol,
        token_address: selectedToken.isNative ? null : selectedToken.address,
        amount: parseFloat(amount),
        note: note.trim() || null
      }).select().single();

      if (error) throw error;
      
      setRequestId(data.id);
      setStep('ready');
      toast({ title: "Request Node Active" });
    } catch (e: any) { 
      toast({ variant: "destructive", title: "Protocol Error", description: e.message });
    } finally { 
      setIsCreating(false); 
    }
  };

  const shareUrl = useMemo(() => requestId ? `${window.location.origin}/request/${requestId}` : '', [requestId]);

  if (!isOpen) return null;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm flex items-end justify-center p-4 md:items-center">
      <motion.div initial={{ y: "100%", opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: "100%", opacity: 0 }} className="w-full max-w-lg bg-[#0a0a0c] border border-white/10 rounded-[3rem] p-6 shadow-2xl relative">
        <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-primary via-purple-500 to-primary animate-gradient-flow" />
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary"><HandCoins className="w-5 h-5" /></div><div><h3 className="text-xs font-black uppercase tracking-[0.2em] text-white">Request Node</h3><p className="text-[8px] font-black uppercase text-primary opacity-60">P2P Handshake</p></div></div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-white/5"><X className="w-5 h-5 text-muted-foreground" /></button>
        </div>

        <AnimatePresence mode="wait">
          {step === 'edit' ? (
            <motion.div key="edit" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-6">
              <button onClick={() => setIsSelectorOpen(true)} className="w-full flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5">
                <div className="flex items-center gap-3"><TokenLogoDynamic logoUrl={selectedToken?.iconUrl} alt="T" size={32} chainId={selectedToken?.chainId} symbol={selectedToken?.symbol} name={selectedToken?.name} /><div className="text-left"><p className="font-bold text-sm text-white">{selectedToken?.symbol}</p><p className="text-[9px] text-muted-foreground uppercase">{viewingNetwork.name}</p></div></div>
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              </button>
              <div className="p-6 rounded-[2rem] bg-secondary/20 border border-white/5 text-center">
                <Input type="number" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} className="text-4xl font-black bg-transparent border-none text-center focus-visible:ring-0 text-white" />
                <p className="mt-2 text-[10px] font-bold text-primary uppercase">≈ {formatFiat((parseFloat(amount) || 0) * (selectedToken?.priceUsd || 0))}</p>
              </div>
              <Textarea placeholder="Note (Optional)" value={note} onChange={(e) => setNote(e.target.value)} className="rounded-2xl bg-white/5 border-white/5 p-4 text-sm" />
              <Button className="w-full h-14 rounded-2xl font-black text-sm uppercase bg-primary" disabled={!amount || isCreating} onClick={handleGenerate}>{isCreating ? <Loader2 className="w-5 h-5 animate-spin" /> : "Authorize Request Node"}</Button>
            </motion.div>
          ) : (
            <motion.div key="ready" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center gap-8 py-4">
              <div className="bg-white p-6 rounded-[3rem] shadow-2xl relative"><QRCode value={shareUrl} size={180} /><div className="absolute inset-0 flex items-center justify-center"><div className="p-2 bg-white rounded-xl border"><TokenLogoDynamic logoUrl={selectedToken?.iconUrl} alt="T" size={32} symbol={selectedToken?.symbol} name={selectedToken?.name} /></div></div></div>
              <div className="w-full space-y-3">
                <button onClick={() => { navigator.clipboard.writeText(shareUrl); setIsCopied(true); setTimeout(() => setIsCopied(false), 2000); }} className="w-full p-4 rounded-2xl border flex items-center justify-between bg-white/5 border-white/10">
                  <div className="flex items-center gap-3 overflow-hidden"><div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", isCopied ? "bg-green-500/20 text-green-500" : "bg-primary/20 text-primary")}><Copy className="w-4 h-4" /></div><p className="text-[10px] text-white/60 truncate font-mono">{shareUrl}</p></div>
                  <span className="text-[10px] font-black uppercase text-primary shrink-0">{isCopied ? "Copied" : "Copy"}</span>
                </button>
                <Button onClick={() => navigator.share({ title: 'Payment Request', url: shareUrl })} className="w-full h-14 rounded-2xl font-black uppercase bg-primary">Share Node</Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
      <GlobalTokenSelector isOpen={isSelectorOpen} onOpenChange={setIsSelectorOpen} onSelect={(t) => setSelectedToken(t)} />
    </motion.div>
  );
}

/**
 * INSTITUTIONAL REQUEST REVIEW CARD
 */
export function RequestReviewMoment({ requestId, onClose }: { requestId: string, onClose: () => void }) {
  const { wallets, infuraApiKey, allChainsMap, allAssets, refresh } = useWallet();
  const { profile: currentUserProfile, refreshProfile } = useUser();
  const { formatFiat } = useCurrency();
  const { toast } = useToast();

  const [request, setRequest] = useState<PaymentRequest | null>(null);
  const [requester, setRequester] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [txStatus, setTxStatus] = useState<'pending' | 'success' | 'error'>('pending');
  const [isStatusVisible, setIsStatusVisible] = useState(false);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [txHash, setTxHash] = useState('');
  const [receiptError, setReceiptError] = useState('');

  useEffect(() => {
    async function fetchRequest() {
      if (!requestId || !supabase) return;
      try {
        const { data: requestData } = await supabase.from('payment_requests').select('*').eq('id', requestId).single();
        if (requestData) {
          setRequest(requestData);
          const { data: profileData } = await supabase.from('profiles').select('*').eq('id', requestData.requester_id).single();
          setRequester(profileData);
        }
      } catch (e) { console.error(e); } finally { setLoading(false); }
    }
    fetchRequest();
  }, [requestId]);

  const handlePay = async () => {
    if (!wallets || !request || !requester) return;
    setIsStatusVisible(true); setTxStatus('pending'); setIsSubmitting(true);

    try {
      const chainType = request.chain_type;
      const amountStr = request.amount.toString();
      
      if (request.token_symbol === 'WNC') {
        // FIX: Strict integer casting to resolve registry ambiguity
        const { data, error: rpcError } = await supabase!.rpc('transfer_wnc', {
            p_recipient_id: requester.id,
            p_amount: Math.floor(request.amount)
        });
        if (rpcError) throw new Error(rpcError.message);
        if (!data?.success) throw new Error(data?.message || "Atomic settlement failed.");
        setTxHash(`int_req_${Math.random().toString(36).substring(7)}`);
      } else if (chainType === 'xrp') {
        const xrpWallet = wallets.find(w => w.type === 'xrp');
        const network = Object.values(allChainsMap).find(c => c.type === 'xrp');
        const client = new xrpl.Client(network?.rpcUrl || 'wss://xrplcluster.com');
        await client.connect();
        const wallet = xrpl.Wallet.fromSeed(xrpWallet!.seed!);
        const prepared = await client.autofill({ TransactionType: "Payment", Account: wallet.address, Amount: xrpl.xrpToDrops(amountStr), Destination: requester.xrp_address! });
        const result = await client.submitAndWait(wallet.sign(prepared).tx_blob);
        await client.disconnect();
        if ((result.result.meta as any).TransactionResult === "tesSUCCESS") setTxHash(result.result.hash);
        else throw new Error("XRPL Fail");
      } else {
        const evmWallet = wallets.find(w => w.type === 'evm');
        const network = Object.values(allChainsMap).find(c => c.type === 'evm');
        const provider = new ethers.JsonRpcProvider(network!.rpcUrl.replace('{API_KEY}', infuraApiKey!), undefined, { staticNetwork: true });
        const wallet = new ethers.Wallet(evmWallet!.privateKey!, provider);
        let tx = !request.token_address ? await wallet.sendTransaction({ to: requester.evm_address!, value: ethers.parseEther(amountStr) }) : await (new ethers.Contract(request.token_address, ["function transfer(address to, uint256 amount) returns (bool)"], wallet)).transfer(requester.evm_address!, ethers.parseUnits(amountStr, 18));
        setTxHash(tx.hash);
      }

      await supabase?.from('payment_requests').update({ status: 'paid' }).eq('id', requestId);
      setTxStatus('success');
      await refreshProfile(); refresh();
    } catch (e: any) {
      setTxStatus('error');
      setReceiptError(mapTechnicalError(e));
    } finally {
      setIsSubmitting(false);
      setTimeout(() => { setIsStatusVisible(false); setIsReceiptOpen(true); }, 3000);
    }
  };

  if (loading || !request || !requester) return null;

  const activeToken = allAssets.find(a => a.symbol === request.token_symbol);
  const userBalance = parseFloat(activeToken?.balance || '0');
  const hasInsufficientFunds = request.amount > userBalance;

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
        <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }} className="w-full max-w-lg bg-[#0a0a0c] border border-white/10 rounded-[3rem] p-8 shadow-2xl relative overflow-hidden">
          <div className="flex items-center justify-between mb-10">
            <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary"><Zap className="w-5 h-5" /></div><div><h3 className="text-xs font-black uppercase text-white">Payment Request</h3><p className="text-[8px] font-black uppercase text-primary opacity-60">Verified Node</p></div></div>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-white/5"><X className="w-5 h-5 text-muted-foreground" /></button>
          </div>

          <div className="flex flex-col items-center text-center space-y-8 mb-10">
            <div className="flex items-center justify-between w-full px-4">
              <div className="flex flex-col items-center gap-2"><div className="relative"><Avatar className="w-16 h-16 rounded-2xl border-2 border-primary/20"><AvatarImage src={currentUserProfile?.photo_url} /><AvatarFallback className="bg-zinc-900">{currentUserProfile?.name?.[0]}</AvatarFallback></Avatar><div className="absolute -bottom-2 -right-2 bg-black rounded-lg p-1 border border-white/10"><TokenLogoDynamic logoUrl={activeToken?.iconUrl} size={24} symbol={activeToken?.symbol} /></div></div><span className="text-[8px] font-black text-white/40 uppercase">You</span></div>
              <div className="flex-1 px-6"><div className="w-full h-[1px] bg-primary/20 relative"><ArrowRight className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 text-primary" /></div></div>
              <div className="flex flex-col items-center gap-2"><div className="relative"><Avatar className="w-16 h-16 rounded-2xl border-2 border-primary/20"><AvatarImage src={requester.photo_url} /><AvatarFallback className="bg-zinc-900">{requester.name?.[0]}</AvatarFallback></Avatar><div className="absolute -bottom-2 -right-2 bg-black rounded-lg p-1 border border-white/10"><TokenLogoDynamic logoUrl={activeToken?.iconUrl} size={24} symbol={activeToken?.symbol} /></div></div><span className="text-[8px] font-black text-white/40 uppercase">To @{requester.name}</span></div>
            </div>
            <div className="space-y-1"><p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Amount</p><h2 className={cn("text-5xl font-black", hasInsufficientFunds ? "text-red-400" : "text-white")}>{request.amount} {request.token_symbol}</h2><p className="text-xs font-bold text-primary uppercase">≈ {formatFiat(request.amount * (activeToken?.priceUsd || 0))}</p></div>
          </div>

          <Button onClick={handlePay} disabled={isSubmitting || hasInsufficientFunds || request.status === 'paid'} className="w-full h-16 rounded-[2rem] font-black text-lg bg-primary hover:bg-primary/90">{isSubmitting ? <Loader2 className="w-6 h-6 animate-spin" /> : request.status === 'paid' ? "Paid" : "Authorize & Send"}</Button>
          <Button variant="ghost" className="w-full h-12 mt-2 rounded-2xl font-bold text-muted-foreground" onClick={onClose}>Dismiss</Button>
        </motion.div>
      </motion.div>

      <TransactionStatusCard isVisible={isStatusVisible} status={txStatus} senderName="You" senderAvatar={currentUserProfile?.photo_url} recipientName={requester.name} recipientAvatar={requester.photo_url} token={{ symbol: request.token_symbol, iconUrl: activeToken?.iconUrl, chainId: activeToken?.chainId || 1, name: activeToken?.name }} />
      <TransactionReceiptSheet isOpen={isReceiptOpen} onOpenChange={setIsReceiptOpen} status={txStatus === 'error' ? 'error' : 'success'} amount={request.amount.toString()} token={activeToken} recipientName={requester.name} recipientAddress={request.chain_type === 'evm' ? requester.evm_address! : requester.xrp_address!} txHash={txHash} errorReason={receiptError} fee="Standard" networkName={request.chain_type.toUpperCase()} />
    </>
  );
}
