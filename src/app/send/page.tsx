
'use client';

import { Suspense, useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useWallet } from '@/contexts/wallet-provider';
import { useCurrency } from '@/contexts/currency-provider';
import { useGasPrice } from '@/hooks/useGasPrice';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  ArrowLeft, 
  ChevronRight, 
  Loader2, 
  Fuel,
  ShieldCheck,
  Timer,
  Search,
  XCircle,
  ArrowRight,
  ShieldAlert,
  AlertCircle
} from 'lucide-react';
import TokenLogoDynamic from '@/components/shared/TokenLogoDynamic';
import { ethers } from 'ethers';
import * as xrpl from 'xrpl';
import { checkAddress } from '@polkadot/util-crypto';
import { useToast } from '@/hooks/use-toast';
import type { AssetRow } from '@/lib/types';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase/client';
import { useDebounce } from '@/hooks/use-debounce';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useUser } from '@/contexts/user-provider';
import TransactionConfirmationSheet from '@/components/wallet/transaction-confirmation-sheet';
import TransactionStatusCard from '@/components/wallet/transaction-status-card';
import TransactionReceiptSheet from '@/components/wallet/transaction-receipt-sheet';
import GlobalTokenSelector from '@/components/shared/global-token-selector';

/**
 * INSTITUTIONAL MULTI-CHAIN ADDRESS DETECTOR
 */
const detectAddressType = (input: string) => {
  if (!input) return 'invalid';
  const clean = input.trim();
  
  if (clean.startsWith('0x')) {
    const formatRegex = /^0x[a-fA-F0-9]{40}$/;
    if (!formatRegex.test(clean)) return 'invalid-evm-format';
    if (!ethers.isAddress(clean)) return 'invalid-evm-checksum';
    return 'evm';
  }
  
  if (clean.startsWith('r')) {
    if (xrpl.isValidClassicAddress(clean)) return 'xrp';
    return 'invalid-xrp';
  }
  
  if (clean.length >= 47 && !clean.includes('0x')) {
    try {
        const [isValid] = checkAddress(clean, 42);
        if (isValid) return 'polkadot';
    } catch (e) {}
    return 'invalid-polkadot';
  }
  
  return 'invalid';
};

const getDetectedNetworkMeta = (type: string) => {
    if (type === 'xrp' || type === 'invalid-xrp') return { name: 'XRP Ledger', symbol: 'XRP' };
    if (type === 'polkadot' || type === 'invalid-polkadot') return { name: 'Polkadot', symbol: 'DOT' };
    if (type === 'evm' || type === 'invalid-evm-checksum' || type === 'invalid-evm-format') return { name: 'EVM Network', symbol: 'ETH' };
    return null;
};

/**
 * TECHNICAL ERROR MAPPING ENGINE
 * Translates raw blockchain JSON into friendly institutional alerts.
 */
const mapTechnicalError = (err: any): string => {
  const msg = (err.message || String(err)).toLowerCase();
  
  if (msg.includes('insufficient funds') || msg.includes('insufficient_funds')) {
    if (msg.includes('gas') || msg.includes('fee')) {
      return "Insufficient Gas Fee: You need more native tokens (e.g. ETH, MATIC, BNB) to pay for the network transfer.";
    }
    return "Insufficient Balance: You do not have enough funds to complete this transfer.";
  }
  
  if (msg.includes('user rejected') || msg.includes('action rejected')) {
    return "Transaction Cancelled: You rejected the request in your wallet.";
  }
  
  if (msg.includes('nonce too low') || msg.includes('already known')) {
    return "Sync Mismatch: Your wallet is currently processing another transaction. Please wait a moment and try again.";
  }

  if (msg.includes('replacement transaction underpriced')) {
    return "Gas Error: The network gas price has increased. Please try again with updated fees.";
  }

  return "Dispatch Error: The blockchain rejected the transaction. Please check your balance and try again.";
};

function SendClient() {
  const { viewingNetwork, wallets, infuraApiKey, allAssets, prices, allChainsMap } = useWallet();
  const { formatFiat } = useCurrency();
  const { profile } = useUser();
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isStatusVisible, setIsStatusVisible] = useState(false);
  const [txStatus, setTxStatus] = useState<'pending' | 'success' | 'error'>('pending');
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [receiptError, setReceiptError] = useState('');

  const [selectedToken, setSelectedToken] = useState<AssetRow | null>(null);
  const [recipientInput, setRecipientInput] = useState('');
  const [resolvedAddress, setResolvedAddress] = useState('');
  const [recipientProfile, setRecipientProfile] = useState<{avatar: string, verified: boolean, name: string} | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const debouncedRecipient = useDebounce(recipientInput, 600);

  const [amount, setAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [txHash, setTxHash] = useState('');
  
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const hasInitialized = useRef(false);

  const gasData = useGasPrice(selectedToken?.chainId);

  useEffect(() => {
    if (allAssets.length === 0 || hasInitialized.current) return;
    
    const symbol = searchParams.get('symbol');
    const chainIdParam = parseInt(searchParams.get('chainId') || '');
    
    let target = allAssets.find(a => a.symbol === symbol && a.chainId === chainIdParam);
    if (!target) {
        target = allAssets.find(a => a.chainId === viewingNetwork.chainId && a.isNative) || 
                 allAssets.find(a => a.chainId === viewingNetwork.chainId) || 
                 allAssets[0];
    }
    
    if (target) {
        setSelectedToken({ ...target });
        hasInitialized.current = true;
    }
  }, [allAssets, searchParams, viewingNetwork.chainId]);

  const activeNetwork = useMemo(() => {
    const chainId = selectedToken?.chainId || viewingNetwork.chainId;
    return allChainsMap[chainId] || viewingNetwork;
  }, [selectedToken, viewingNetwork, allChainsMap]);

  const addrType = useMemo(() => detectAddressType(debouncedRecipient), [debouncedRecipient]);
  const detectedMeta = useMemo(() => getDetectedNetworkMeta(addrType), [addrType]);
  
  const validationError = useMemo(() => {
    if (addrType === 'invalid-evm-format') {
        return { title: "Invalid Address Format", message: "This doesn’t look like a valid EVM address. Please check and try again." };
    }
    if (addrType === 'invalid-evm-checksum') {
        return { title: "Invalid Address Checksum", message: "This address failed cryptographic checksum validation. Please double-check for typos." };
    }
    if (addrType === 'invalid-xrp') {
        return { title: "Invalid XRP Address", message: "This address failed Base58 validation. Please check for typos." };
    }
    if (addrType === 'invalid-polkadot') {
        return { title: "Invalid Polkadot Address", message: "This address failed SS58 checksum validation. Please check for typos." };
    }
    return null;
  }, [addrType]);

  const isNetworkMismatch = useMemo(() => {
    if (addrType === 'invalid' || addrType.includes('invalid-')) return false;
    const activeType = activeNetwork.type || 'evm';
    return activeType !== addrType;
  }, [addrType, activeNetwork.type]);

  useEffect(() => {
    let isMounted = true;
    async function resolve() {
      const input = debouncedRecipient.trim();
      const isValidBase = addrType !== 'invalid' && !addrType.includes('invalid-');
      
      if (!input || input.length < 3 || isValidBase) {
        if (isMounted) {
          setResolvedAddress(isValidBase ? input : '');
          setRecipientProfile(null);
          setIsResolving(false);
        }
        return;
      }

      if (isMounted) setIsResolving(true);
      const searchHandle = input.startsWith('@') ? input.substring(1).toLowerCase().trim() : input.toLowerCase().trim();

      try {
        const { data } = await supabase!.rpc('fetch_recipient_details', {
          search_account_number: searchHandle,
          selected_chain: activeNetwork.type || 'evm'
        });
        
        if (!isMounted) return;

        if (data && data.length > 0) {
          const result = data[0];
          setRecipientProfile({ avatar: result.profile_pic, verified: result.verified, name: result.name || searchHandle });
          setResolvedAddress(result.target_address || '');
        } else {
          setResolvedAddress('');
          setRecipientProfile(null);
        }
      } catch (e) {
        if (isMounted) {
          setResolvedAddress('');
          setRecipientProfile(null);
        }
      } finally {
        if (isMounted) setIsResolving(false);
      }
    }
    
    resolve();
    return () => { isMounted = false; };
  }, [debouncedRecipient, addrType, activeNetwork.type]);

  const handleSendRequest = async () => {
    if (!wallets || !selectedToken || !resolvedAddress) return;
    setIsConfirmOpen(false);
    setIsStatusVisible(true);
    setTxStatus('pending');
    setIsSubmitting(true);

    try {
      if (activeNetwork.type === 'xrp') {
        const xrpWalletData = wallets.find(w => w.type === 'xrp');
        const client = new xrpl.Client(activeNetwork.rpcUrl);
        await client.connect();
        const wallet = xrpl.Wallet.fromSeed(xrpWalletData!.seed!);
        const prepared = await client.autofill({ TransactionType: "Payment", Account: wallet.address, Amount: xrpl.xrpToDrops(amount), Destination: resolvedAddress });
        const result = await client.submitAndWait(wallet.sign(prepared).tx_blob);
        if (result.result.meta && typeof result.result.meta !== 'string' && (result.result.meta as any).TransactionResult === "tesSUCCESS") {
          setTxHash(result.result.hash);
        } else { throw new Error((result.result.meta as any)?.TransactionResult || "XRPL Broadcast Error"); }
        await client.disconnect();
      } else {
        const evmWalletData = wallets.find(w => w.type === 'evm');
        const provider = new ethers.JsonRpcProvider(activeNetwork.rpcUrl.replace('{API_KEY}', infuraApiKey!), undefined, { staticNetwork: true });
        const wallet = new ethers.Wallet(evmWalletData!.privateKey!, provider);
        const decimals = selectedToken.decimals || 18;
        let tx = selectedToken.isNative 
          ? await wallet.sendTransaction({ to: resolvedAddress, value: ethers.parseUnits(amount, decimals) }) 
          : await (new ethers.Contract(selectedToken.address, ["function transfer(address to, uint256 amount) returns (bool)"], wallet)).transfer(resolvedAddress, ethers.parseUnits(amount, decimals));
        setTxHash(tx.hash);
      }
      setTxStatus('success');
    } catch (e: any) {
      setTxStatus('error');
      setReceiptError(mapTechnicalError(e));
    } finally {
      setIsSubmitting(false);
      setTimeout(() => { setIsStatusVisible(false); setIsReceiptOpen(true); }, 3000);
    }
  };

  const balance = parseFloat(selectedToken?.balance || '0');
  const amountUsdValue = (parseFloat(amount) || 0) * (selectedToken?.priceUsd || 0);
  const isActuallyValid = resolvedAddress.length > 0 && !isNetworkMismatch && !validationError;
  const canSend = isActuallyValid && parseFloat(amount) > 0 && !isSubmitting;

  const gasFiatValue = useMemo(() => {
    if (!selectedToken) return 0;
    const nativeAssetId = allChainsMap[selectedToken.chainId]?.coingeckoId?.toLowerCase();
    const nativePrice = nativeAssetId ? (prices[nativeAssetId]?.price || 0) : 0;
    return parseFloat(gasData.nativeFee) * nativePrice;
  }, [gasData.nativeFee, selectedToken, prices, allChainsMap]);

  return (
    <div className="flex flex-col min-h-full bg-[#050505] text-foreground relative">
      <header className="p-4 flex items-center justify-between border-b border-white/5 sticky top-0 bg-black/50 backdrop-blur-2xl z-50">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-xl"><ArrowLeft className="w-5 h-5" /></Button>
        <button 
            onClick={() => setIsSelectorOpen(true)}
            className="flex items-center gap-2 bg-primary/10 border border-primary/20 px-4 py-2 rounded-full hover:bg-primary/20 transition-all"
        >
            <TokenLogoDynamic logoUrl={selectedToken?.iconUrl} alt={selectedToken?.symbol || 'token'} size={20} chainId={selectedToken?.chainId} symbol={selectedToken?.symbol} name={selectedToken?.name} />
            <div className="flex flex-col items-start leading-none">
                <span className="text-[10px] font-black uppercase text-white">{selectedToken?.symbol || 'Select Asset'}</span>
                <span className="text-[7px] font-bold text-primary uppercase opacity-60">{activeNetwork.name}</span>
            </div>
            <ChevronRight className="w-3 h-3 text-primary rotate-90" />
        </button>
        <div className="w-10" />
      </header>

      <main className="flex-1 p-6 max-w-lg mx-auto w-full relative z-10 pb-48">
          <div className="space-y-10 pt-2 px-1">
            <section className="flex items-center justify-between px-2">
                <div className="flex flex-col items-center gap-3">
                    <div className="relative group">
                        <Avatar className="w-20 h-20 rounded-[2.5rem] border-2 border-primary/30 shadow-2xl bg-black overflow-visible">
                            <AvatarImage src={profile?.photo_url} className="rounded-[2.5rem] object-cover" alt="Sender" />
                            <AvatarFallback className="bg-primary/20 text-primary font-black text-xl rounded-[2.5rem]">{profile?.name?.[0]}</AvatarFallback>
                            {/* Corrected Layering for Sender Badge */}
                            <div className="absolute -bottom-1 -right-1 bg-black rounded-lg p-1 border border-white/10 shadow-xl z-50">
                                <TokenLogoDynamic logoUrl={selectedToken?.iconUrl} alt="Network" size={20} chainId={selectedToken?.chainId} symbol={selectedToken?.symbol} name={selectedToken?.name} />
                            </div>
                        </Avatar>
                    </div>
                    <span className="text-[8px] font-black text-white/40 uppercase tracking-widest truncate w-20 text-center">FROM YOU</span>
                </div>

                <div className="flex-1 px-4 relative">
                    <div className="w-full h-[1px] bg-gradient-to-r from-primary/20 via-primary to-primary/20 relative">
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#050505] p-2 border border-white/5 rounded-full">
                            <ArrowRight className="w-4 h-4 text-primary animate-pulse" />
                        </div>
                    </div>
                </div>

                <div className="flex flex-col items-center gap-3">
                    <div className="relative">
                        <div className={cn(
                            "w-20 h-20 rounded-[2.5rem] border-2 flex items-center justify-center transition-all duration-500 relative",
                            !isActuallyValid ? "border-dashed border-white/10" : (isNetworkMismatch || validationError) ? "border-red-500 bg-red-500/10 border-dashed" : "border-primary/50 bg-primary/5"
                        )}>
                            {isResolving ? <Loader2 className="w-8 h-8 animate-spin text-primary opacity-40" /> : 
                             recipientProfile ? (
                                <div className="relative w-full h-full">
                                    <Avatar className="w-full h-full rounded-[2.5rem] bg-black overflow-visible">
                                        <AvatarImage src={recipientProfile.avatar} className="rounded-[2.5rem] object-cover" alt="Recipient" />
                                        <AvatarFallback className="bg-primary/20 text-primary font-black text-xl rounded-[2.5rem]">{recipientProfile.name[0]?.toUpperCase()}</AvatarFallback>
                                        <div className="absolute -bottom-1 -right-1 bg-black rounded-lg p-1 border border-white/10 shadow-xl z-50">
                                            <TokenLogoDynamic logoUrl={selectedToken?.iconUrl} alt="Asset" size={20} chainId={selectedToken?.chainId} symbol={selectedToken?.symbol} name={selectedToken?.name} />
                                        </div>
                                    </Avatar>
                                </div>
                             ) : (isActuallyValid && !isNetworkMismatch && !validationError) ? (
                                <div className="relative">
                                    <TokenLogoDynamic logoUrl={selectedToken?.iconUrl} alt="Token" size={44} chainId={selectedToken?.chainId} symbol={selectedToken?.symbol} name={selectedToken?.name} />
                                    <div className="absolute -bottom-1 -right-1 bg-black rounded-lg p-1 border border-white/10 shadow-xl z-50">
                                        <TokenLogoDynamic logoUrl={activeNetwork.iconUrl} alt="Network" size={20} chainId={activeNetwork.chainId} symbol={activeNetwork.symbol} name={activeNetwork.name} />
                                    </div>
                                </div>
                             ) : (
                                <Search className="w-8 h-8 text-white/10" />
                             )}
                        </div>
                    </div>
                    <span className={cn(
                        "text-[8px] font-black uppercase tracking-widest truncate w-20 text-center flex flex-col items-center gap-1",
                        (isNetworkMismatch || validationError) ? "text-red-500" : "text-white/40"
                    )}>
                        {recipientProfile ? `TO ${recipientProfile.name.toUpperCase()}` : (isNetworkMismatch || validationError) ? 'ROUTE BLOCKED' : resolvedAddress ? 'NETWORK NODE' : 'TO RECIPIENT'}
                    </span>
                </div>
            </section>

            <section className="space-y-3">
                <div className="flex justify-between items-center px-2">
                    <Label className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Recipient Target</Label>
                    <button onClick={async () => setRecipientInput(await navigator.clipboard.readText())} className="text-[9px] font-black text-primary uppercase tracking-widest bg-primary/10 px-2.5 py-1 rounded-lg">PASTE</button>
                </div>
                <div className={cn("bg-white/[0.03] border border-white/10 rounded-[2rem] p-2 transition-all", (isNetworkMismatch || validationError) && "border-red-500/50 bg-red-500/5 ring-4 ring-red-500/10")}>
                    <div className="flex items-center gap-2 px-2">
                        <Input placeholder="Account ID or Address" value={recipientInput} onChange={(e) => setRecipientInput(e.target.value)} className="h-12 bg-transparent border-none text-sm font-mono focus-visible:ring-0 placeholder:text-zinc-700 text-white flex-1" />
                        {isResolving && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
                    </div>
                </div>

                {validationError && (
                    <div className="p-5 rounded-[2rem] bg-red-500/10 border border-red-500/20 flex gap-4 animate-in slide-in-from-top-2 shadow-2xl">
                        <div className="w-12 h-12 rounded-2xl bg-red-500/20 flex items-center justify-center shrink-0"><AlertCircle className="w-6 h-6 text-red-500" /></div>
                        <div className="space-y-1.5">
                            <p className="text-[10px] font-black text-red-500 uppercase tracking-[0.2em]">{validationError.title}</p>
                            <p className="text-xs font-bold text-red-400 leading-relaxed">{validationError.message}</p>
                        </div>
                    </div>
                )}

                {isNetworkMismatch && (
                    <div className="p-5 rounded-[2rem] bg-red-500/10 border border-red-500/20 flex gap-4 animate-in slide-in-from-top-2 shadow-2xl">
                        <div className="w-12 h-12 rounded-2xl bg-red-500/20 flex items-center justify-center shrink-0"><ShieldAlert className="w-6 h-6 text-red-500" /></div>
                        <div className="space-y-1.5">
                            <p className="text-[10px] font-black text-red-500 uppercase tracking-[0.2em]">Security Alert</p>
                            <p className="text-xs font-bold text-red-400 leading-relaxed">This address belongs to <span className="text-white font-black underline decoration-red-500/50">{detectedMeta?.name}</span>, but you're currently sending from <span className="text-white font-black">{activeNetwork.name}</span>.</p>
                            <p className="text-[10px] text-red-400/60 font-medium leading-relaxed italic">To avoid permanent loss of funds, please switch to the {detectedMeta?.name} network or enter a valid {activeNetwork.name} address.</p>
                        </div>
                    </div>
                )}
            </section>

            <div className="space-y-3">
                <div className="flex justify-between items-center px-2">
                    <Label className="text-[10px] font-black text-white/60 uppercase tracking-[0.2em]">Transfer Amount</Label>
                    <div className="flex items-center gap-2">
                        <span className="text-[9px] text-white/40 font-bold uppercase">Bal: {balance.toFixed(4)} {selectedToken?.symbol}</span>
                        <Button size="sm" variant="ghost" className="h-6 px-2 text-[9px] font-black text-primary uppercase bg-primary/10 hover:bg-primary/20 rounded-md" onClick={() => setAmount(balance.toString())}>MAX</Button>
                    </div>
                </div>
                <div className="bg-white/[0.03] border border-white/10 focus-within:border-primary/50 focus-within:ring-4 focus-within:ring-primary/5 rounded-[2.5rem] p-6 transition-all relative group">
                  <div className="flex items-baseline justify-between gap-4">
                    <Input type="number" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} className="bg-transparent border-none text-[clamp(1.5rem,8vw,3rem)] font-black p-0 h-auto focus-visible:ring-0 tracking-tighter placeholder:text-zinc-800 text-white" />
                    <span className="text-xl font-black text-white/20 uppercase">{selectedToken?.symbol}</span>
                  </div>
                  <div className="mt-2 text-xs font-bold text-muted-foreground/40 italic flex items-center gap-1.5">≈ {formatFiat(amountUsdValue)} <span className="opacity-50">Estimated Value</span></div>
                </div>
            </div>

            <div className="p-6 rounded-[2rem] bg-[#0a0a0c] border border-primary/20 space-y-4 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-primary/10 blur-3xl rounded-full -mr-12 -mt-12" />
                <div className="flex items-center gap-2 mb-2 relative z-10"><ShieldCheck className="w-4 h-4 text-primary" /><span className="text-[10px] font-black uppercase tracking-widest text-white/80">Institutional Summary</span></div>
                <div className="space-y-3 relative z-10">
                    <div className="flex justify-between items-center text-[11px]"><span className="text-white/40 font-bold uppercase tracking-tighter">Network Gas</span><div className="flex items-center gap-1.5 font-bold text-white"><Fuel className="w-3 h-3 text-primary" /><span>{gasData.priceGwei} Gwei</span></div></div>
                    <div className="flex justify-between items-center text-[11px]"><span className="text-white/40 font-bold uppercase tracking-tighter">Native Fee</span><div className="text-right"><p className="font-bold text-white">{gasData.nativeFee} {activeNetwork.symbol}</p><p className="text-[9px] text-primary font-black uppercase">≈ {formatFiat(gasFiatValue)}</p></div></div>
                    <div className="flex justify-between items-center text-[11px]"><span className="text-white/40 font-bold uppercase tracking-tighter">Estimated Arrival</span><div className="flex items-center gap-1.5 font-bold text-white"><Timer className="w-3 h-3 text-primary" /><span>{gasData.estimatedTime}</span></div></div>
                </div>
            </div>
          </div>

        <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black via-black/95 to-transparent backdrop-blur-md z-40">
          <div className="max-w-md mx-auto">
            <Button className={cn("w-full h-16 rounded-[2rem] text-lg font-black shadow-2xl transition-all duration-300 border-b-4", canSend ? "bg-primary hover:bg-primary/90 border-primary/50 shadow-primary/30 text-white" : "bg-zinc-900 border-zinc-950 opacity-50 grayscale cursor-not-allowed text-zinc-600 shadow-none")} disabled={!canSend} onClick={() => setIsConfirmOpen(true)}>
              {isSubmitting ? <Loader2 className="w-6 h-6 animate-spin" /> : "Sign & Authorize"}
            </Button>
          </div>
        </div>
      </main>

      <GlobalTokenSelector isOpen={isSelectorOpen} onOpenChange={setIsSelectorOpen} onSelect={(token) => { setSelectedToken({ ...token }); hasInitialized.current = true; }} title="Select Network" />
      <TransactionConfirmationSheet isOpen={isConfirmOpen} onOpenChange={setIsConfirmOpen} onConfirm={handleSendRequest} isSubmitting={isSubmitting} amount={amount} token={selectedToken} recipientName={recipientProfile?.name || (resolvedAddress ? `${resolvedAddress.slice(0,6)}...${resolvedAddress.slice(-4)}` : 'Unknown')} recipientAddress={resolvedAddress} recipientAvatar={recipientProfile?.avatar} />
      <TransactionStatusCard isVisible={isStatusVisible} status={txStatus} senderName="You" senderAvatar={profile?.photo_url} recipientName={recipientProfile?.name || 'Network Node'} recipientAvatar={recipientProfile?.avatar} token={{ symbol: selectedToken?.symbol || '', iconUrl: selectedToken?.iconUrl, chainId: selectedToken?.chainId || 1, name: selectedToken?.name }} isRawAddress={!recipientProfile} />
      <TransactionReceiptSheet isOpen={isReceiptOpen} onOpenChange={setIsReceiptOpen} status={txStatus === 'error' ? 'error' : 'success'} amount={amount} token={selectedToken} recipientName={recipientProfile?.name || 'Network Node'} recipientAddress={resolvedAddress} txHash={txHash} errorReason={receiptError} fee={`${gasData.nativeFee} ${activeNetwork.symbol}`} networkName={activeNetwork.name} />
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
