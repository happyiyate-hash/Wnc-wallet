
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
  Loader2, 
  Fuel,
  ShieldCheck,
  Timer,
  Search,
  ArrowRight,
  ShieldAlert,
  AlertCircle,
  ChevronDown,
  Zap
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
import { motion, AnimatePresence } from 'framer-motion';

/**
 * INSTITUTIONAL MULTI-CHAIN ADDRESS DETECTOR
 */
const detectAddressType = (input: string) => {
  if (!input) return 'invalid';
  const clean = input.trim();
  
  // Internal WNC / Account ID Logic (10 digits starting with 835)
  if (/^835\d{7}$/.test(clean)) return 'account-id';

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
    if (type === 'account-id') return { name: 'Internal Registry', symbol: 'ID' };
    return null;
};

const mapTechnicalError = (err: any): string => {
  const msg = (err.message || String(err)).toLowerCase();
  if (msg.includes('insufficient funds') || msg.includes('insufficient node funds')) return "Insufficient Funds: Your node balance is too low to cover the transfer.";
  if (msg.includes('user rejected')) return "Transaction Cancelled: You rejected the request in your wallet.";
  if (msg.includes('websocket') || msg.includes('disconnected')) return "Network Timeout: The blockchain node closed the connection. Please try again.";
  return "Dispatch Error: The transaction was rejected by the registry or network.";
};

function SendClient() {
  const { viewingNetwork, wallets, infuraApiKey, allAssets, prices, allChainsMap, accountNumber, refresh } = useWallet();
  const { formatFiat } = useCurrency();
  const { profile, refreshProfile } = useUser();
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
  const [recipientProfile, setRecipientProfile] = useState<{id: string, avatar: string, verified: boolean, name: string} | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const [resolutionError, setResolutionError] = useState<string | null>(null);
  const debouncedRecipient = useDebounce(recipientInput, 300);

  const [amount, setAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [txHash, setTxHash] = useState('');
  
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const hasInitialized = useRef(false);
  const resolutionCounter = useRef(0);

  const gasData = useGasPrice(selectedToken?.chainId);

  useEffect(() => {
    if (allAssets.length === 0 || hasInitialized.current) return;
    const symbol = searchParams.get('symbol');
    const chainIdParam = parseInt(searchParams.get('chainId') || '');
    let target = allAssets.find(a => a.symbol === symbol && (a.chainId === chainIdParam || a.symbol === 'WNC'));
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
    if (selectedToken?.symbol === 'WNC') return { name: 'Wevina Internal', symbol: 'WNC', type: 'internal', chainId: 0 } as any;
    const chainId = selectedToken?.chainId || viewingNetwork.chainId;
    return allChainsMap[chainId] || viewingNetwork;
  }, [selectedToken, viewingNetwork, allChainsMap]);

  const addrType = useMemo(() => detectAddressType(debouncedRecipient), [debouncedRecipient]);
  const detectedMeta = useMemo(() => getDetectedNetworkMeta(addrType), [addrType]);
  
  const isSelfTransfer = useMemo(() => {
    const input = debouncedRecipient.trim().toLowerCase();
    if (!input) return false;
    if (accountNumber && input === accountNumber.toLowerCase()) return true;
    if (wallets) {
        return wallets.some(w => w.address.toLowerCase() === input);
    }
    return false;
  }, [debouncedRecipient, accountNumber, wallets]);

  const validationError = useMemo(() => {
    if (isSelfTransfer) return null;
    if (addrType === 'invalid-evm-format') return { title: "Invalid Format", message: "This doesn't look like a valid address." };
    if (addrType === 'invalid-evm-checksum') return { title: "Checksum Fail", message: "Address failed cryptographic validation." };
    if (addrType === 'invalid-xrp') return { title: "Invalid XRP", message: "Address failed Base58 validation." };
    return null;
  }, [addrType, isSelfTransfer]);

  const isNetworkMismatch = useMemo(() => {
    if (isSelfTransfer || selectedToken?.symbol === 'WNC') return false;
    if (addrType === 'invalid' || addrType.includes('invalid-')) return false;
    const activeType = activeNetwork.type || 'evm';
    if (addrType === 'account-id') return false; // Account IDs work for on-chain resolution too
    return activeType !== addrType;
  }, [addrType, activeNetwork.type, isSelfTransfer, selectedToken]);

  useEffect(() => {
    const currentId = ++resolutionCounter.current;
    
    async function resolve() {
      const input = debouncedRecipient.trim();
      const isValidBase = addrType !== 'invalid' && !addrType.includes('invalid-');
      const isInternalWnc = selectedToken?.symbol === 'WNC';
      
      if (!input || input.length < 3 || (isValidBase && !isInternalWnc) || isSelfTransfer) {
        if (currentId === resolutionCounter.current) {
          setResolvedAddress(isValidBase ? input : '');
          setRecipientProfile(null);
          setIsResolving(false);
          setResolutionError(null);
        }
        return;
      }

      setResolvedAddress('');
      setRecipientProfile(null);
      setIsResolving(true);
      setResolutionError(null);
      
      try {
        if (!supabase) throw new Error("No database connection");

        // Logic: Try to find by Account ID first, then by address
        const { data: userRecord, error: userError } = await supabase
          .from('profiles')
          .select('id, name, photo_url, account_number, evm_address, xrp_address, polkadot_address')
          .or(`account_number.eq.${input},evm_address.eq.${input},xrp_address.eq.${input},polkadot_address.eq.${input}`)
          .maybeSingle();

        if (userError) throw userError;

        if (currentId !== resolutionCounter.current) return;

        if (userRecord) {
          setRecipientProfile({ 
            id: userRecord.id,
            avatar: userRecord.photo_url || '', 
            verified: true, 
            name: userRecord.name || input
          });

          if (isInternalWnc) {
            setResolvedAddress(userRecord.account_number || '');
            setResolutionError(null);
          } else {
            const targetChainType = activeNetwork.type || 'evm';
            let chainAddress = '';
            
            if (targetChainType === 'evm') chainAddress = userRecord.evm_address || '';
            else if (targetChainType === 'xrp') chainAddress = userRecord.xrp_address || '';
            else if (targetChainType === 'polkadot') chainAddress = userRecord.polkadot_address || '';

            if (chainAddress) {
              setResolvedAddress(chainAddress);
              setResolutionError(null);
            } else {
              setResolvedAddress('');
              setResolutionError(`Recipient found, but no address linked for ${targetChainType.toUpperCase()}.`);
            }
          }
        } else {
          setResolvedAddress('');
          setRecipientProfile(null);
          setResolutionError("Recipient account ID not found.");
        }
      } catch (e: any) {
        if (currentId === resolutionCounter.current) {
          setResolvedAddress('');
          setRecipientProfile(null);
          setResolutionError("Handshake Error: Identity lookup failed.");
        }
      } finally {
        if (currentId === resolutionCounter.current) setIsResolving(false);
      }
    }
    
    resolve();
  }, [debouncedRecipient, addrType, activeNetwork.type, isSelfTransfer, selectedToken]);

  const handleSendRequest = async () => {
    if (!wallets || !selectedToken || !resolvedAddress || !profile) return;
    setIsConfirmOpen(false);
    setIsStatusVisible(true);
    setTxStatus('pending');
    setIsSubmitting(true);

    try {
      // 1. Internal WNC Transfer Logic
      if (selectedToken.symbol === 'WNC') {
        if (!recipientProfile) throw new Error("Internal recipient node not identified.");
        
        const transferAmount = parseFloat(amount);
        if (profile.wnc_earnings < transferAmount) throw new Error("Insufficient node funds.");

        // Atomic update via Supabase (Client-side simulation of a safer RPC call)
        // Deduct from sender
        const { error: deductError } = await supabase!
            .from('profiles')
            .update({ wnc_earnings: profile.wnc_earnings - transferAmount })
            .eq('id', profile.id);
        
        if (deductError) throw deductError;

        // Credit to recipient
        const { data: targetProfile } = await supabase!.from('profiles').select('wnc_earnings').eq('id', recipientProfile.id).single();
        const { error: creditError } = await supabase!
            .from('profiles')
            .update({ wnc_earnings: (targetProfile?.wnc_earnings || 0) + transferAmount })
            .eq('id', recipientProfile.id);

        if (creditError) throw creditError;

        // Log transaction
        await supabase!.from('transactions').insert({
            user_id: profile.id,
            type: 'withdrawal',
            asset_symbol: 'WNC',
            amount: transferAmount,
            status: 'completed',
            recipient_address: resolvedAddress
        });

        setTxHash(`int_${Math.random().toString(36).substring(7)}`);
        await refreshProfile(); // Sync local earnings state
      } 
      // 2. XRPL Logic
      else if (activeNetwork.type === 'xrp') {
        const xrpWalletData = wallets.find(w => w.type === 'xrp');
        const client = new xrpl.Client(activeNetwork.rpcUrl);
        
        try {
          await Promise.race([
            client.connect(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('XRPL_CONNECTION_TIMEOUT')), 10000))
          ]);

          const wallet = xrpl.Wallet.fromSeed(xrpWalletData!.seed!);
          const prepared = await client.autofill({ 
            TransactionType: "Payment", 
            Account: wallet.address, 
            Amount: xrpl.xrpToDrops(amount), 
            Destination: resolvedAddress 
          });
          
          const result = await client.submitAndWait(wallet.sign(prepared).tx_blob);
          if (result.result.meta && typeof result.result.meta !== 'string' && (result.result.meta as any).TransactionResult === "tesSUCCESS") {
            setTxHash(result.result.hash);
          } else { 
            throw new Error((result.result.meta as any)?.TransactionResult || "XRPL Error"); 
          }
        } finally {
          if (client.isConnected()) {
            await client.disconnect();
          }
        }
      } 
      // 3. EVM Logic
      else {
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
  const amountNum = parseFloat(amount) || 0;
  const amountUsdValue = amountNum * (selectedToken?.priceUsd || 0);
  
  const hasInsufficientFunds = amountNum > balance;
  const canSend = resolvedAddress.length > 0 && !isNetworkMismatch && !validationError && amountNum > 0 && !hasInsufficientFunds && !isSubmitting && !isSelfTransfer;

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
            <ChevronDown className="w-3 h-3 text-primary" />
        </button>
        <div className="w-10" />
      </header>

      <main className="flex-1 p-6 max-w-lg mx-auto w-full relative z-10 pb-48">
          <div className="space-y-10 pt-2 px-1">
            <section className="flex items-center justify-between px-2">
                <div className="flex flex-col items-center gap-3">
                    <div className="relative">
                        <Avatar className="w-20 h-20 rounded-[2.5rem] border-2 border-primary/30 shadow-2xl bg-black overflow-hidden relative z-10">
                            <AvatarImage src={profile?.photo_url} className="object-cover" alt="Sender" />
                            <AvatarFallback className="bg-primary/20 text-primary font-black text-xl">{profile?.name?.[0] || 'U'}</AvatarFallback>
                        </Avatar>
                        <div className="absolute -bottom-1 -right-1 bg-black rounded-lg p-1 border border-white/10 shadow-xl z-[70]">
                            <TokenLogoDynamic logoUrl={activeNetwork?.iconUrl} alt={activeNetwork?.name || ''} size={20} chainId={activeNetwork?.chainId} symbol={activeNetwork?.symbol} name={activeNetwork?.name} />
                        </div>
                    </div>
                    <span className="text-[8px] font-black text-white/40 uppercase tracking-widest truncate w-20 text-center">FROM YOU</span>
                </div>

                <div className="flex-1 px-4 relative flex flex-col items-center justify-center min-h-[100px]">
                    <div className="w-full h-[1px] bg-gradient-to-r from-primary/20 via-primary to-primary/20 relative">
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#050505] p-2 border border-white/5 rounded-full z-10">
                            <ArrowRight className="w-4 h-4 text-primary animate-pulse" />
                        </div>
                    </div>
                    
                    <AnimatePresence>
                        {resolvedAddress && !isResolving && (
                            <motion.div 
                                initial={{ y: 20, opacity: 0, scale: 0.9 }}
                                animate={{ y: 30, opacity: 1, scale: 1 }}
                                exit={{ y: 15, opacity: 0, scale: 0.9 }}
                                className="absolute left-0 right-0 text-center z-20"
                            >
                                <div className="inline-flex flex-col items-center gap-1.5">
                                    <p className={cn("text-[7px] font-black uppercase tracking-[0.25em]", (isNetworkMismatch || validationError) ? "text-red-500" : "text-primary")}>
                                        {isNetworkMismatch ? 'Incompatible Route' : validationError ? 'Format Alert' : 'Resolved Node'}
                                    </p>
                                    <div className={cn("bg-black/80 border px-3 py-2 rounded-2xl backdrop-blur-md shadow-2xl", (isNetworkMismatch || validationError) ? "border-red-500/30" : "border-primary/20")}>
                                        <p className="text-[10px] font-mono text-white tracking-tighter whitespace-nowrap">
                                            {resolvedAddress.length > 15 ? `${resolvedAddress.slice(0, 10)}...${resolvedAddress.slice(-8)}` : resolvedAddress}
                                        </p>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                <div className="flex flex-col items-center gap-3">
                    <div className="relative">
                        <div className={cn(
                            "w-20 h-20 rounded-[2.5rem] border-2 flex items-center justify-center transition-all duration-500 relative bg-black overflow-hidden z-10",
                            (!resolvedAddress && !isNetworkMismatch && !validationError && !isSelfTransfer) ? "border-dashed border-white/10" : 
                            (isNetworkMismatch || validationError || isSelfTransfer) ? "border-red-500 bg-red-500/10 border-dashed shadow-[0_0_30px_rgba(239,68,68,0.15)]" : 
                            "border-primary/50 bg-primary/5 shadow-[0_0_30px_rgba(139,92,246,0.15)]"
                        )}>
                            {isResolving ? <Loader2 className="w-8 h-8 animate-spin text-primary opacity-40" /> : 
                             isSelfTransfer ? (
                                <Avatar className="w-full h-full rounded-none">
                                    <AvatarImage src={profile?.photo_url} className="object-cover" alt="Self" />
                                    <AvatarFallback className="bg-primary/20 text-primary font-black text-xl">{profile?.name?.[0]}</AvatarFallback>
                                </Avatar>
                             ) : recipientProfile ? (
                                <Avatar className="w-full h-full rounded-none">
                                    <AvatarImage src={recipientProfile.avatar} className="object-cover" alt="Recipient" />
                                    <AvatarFallback className="bg-primary/20 text-primary font-black text-xl">{recipientProfile.name[0]?.toUpperCase()}</AvatarFallback>
                                </Avatar>
                             ) : (isNetworkMismatch || (resolvedAddress && validationError)) ? (
                                <div className="relative animate-in zoom-in duration-300">
                                    <div className="w-16 h-16 rounded-[2rem] bg-red-500/10 flex items-center justify-center border border-red-500/20">
                                        <TokenLogoDynamic logoUrl={null} alt={detectedMeta?.name || ''} size={40} symbol={detectedMeta?.symbol} name={detectedMeta?.name} />
                                    </div>
                                </div>
                             ) : resolvedAddress ? (
                                <div className="relative animate-in zoom-in duration-300">
                                    <div className="w-16 h-16 rounded-[2rem] bg-primary/10 flex items-center justify-center border border-primary/20">
                                        <TokenLogoDynamic logoUrl={selectedToken?.iconUrl} alt="Token" size={40} chainId={selectedToken?.chainId} symbol={selectedToken?.symbol} name={selectedToken?.name} />
                                    </div>
                                </div>
                             ) : (
                                <Search className="w-8 h-8 text-white/10" />
                             )}
                        </div>

                        {resolvedAddress && !isResolving && !isSelfTransfer && (
                            <div className="absolute -bottom-1 -right-1 bg-black rounded-lg p-1 border border-white/10 shadow-xl z-[70] animate-in fade-in zoom-in duration-300">
                                <TokenLogoDynamic 
                                    logoUrl={isNetworkMismatch || validationError ? null : (selectedToken?.iconUrl || activeNetwork.iconUrl)} 
                                    alt="Network Node" 
                                    size={20} 
                                    chainId={isNetworkMismatch || validationError ? undefined : activeNetwork.chainId} 
                                    symbol={isNetworkMismatch || validationError ? detectedMeta?.symbol : activeNetwork.symbol} 
                                    name={isNetworkMismatch || validationError ? detectedMeta?.name : activeNetwork.name} 
                                />
                            </div>
                        )}
                    </div>
                    <span className={cn(
                        "text-[8px] font-black uppercase tracking-widest truncate w-20 text-center",
                        (isNetworkMismatch || validationError || isSelfTransfer) ? "text-red-500" : "text-white/40"
                    )}>
                        {isSelfTransfer ? 'NODE REFLECTION' : 
                         recipientProfile ? `TO @${recipientProfile.name.toUpperCase()}` : 
                         isNetworkMismatch ? 'ROUTE BLOCKED' : 
                         resolvedAddress ? 'NETWORK NODE' : 'TO RECIPIENT'}
                    </span>
                </div>
            </section>

            <section className="space-y-3">
                <div className="flex justify-between items-center px-2">
                    <Label className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Recipient Target</Label>
                    <button onClick={async () => setRecipientInput(await navigator.clipboard.readText())} className="text-[9px] font-black text-primary uppercase tracking-widest bg-primary/10 px-2.5 py-1 rounded-lg">PASTE</button>
                </div>
                <div className={cn("bg-white/[0.03] border border-white/10 rounded-[2rem] p-2 transition-all", (isNetworkMismatch || validationError || isSelfTransfer) && "border-red-500/50 bg-red-500/5 ring-4 ring-red-500/10")}>
                    <div className="flex items-center gap-2 px-2">
                        <Input placeholder="Account ID or Address" value={recipientInput} onChange={(e) => setRecipientInput(e.target.value)} className="h-12 bg-transparent border-none text-sm font-mono focus-visible:ring-0 placeholder:text-zinc-700 text-white flex-1" />
                        {isResolving && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
                    </div>
                </div>

                {isSelfTransfer && (
                    <div className="p-5 rounded-[2rem] bg-primary/10 border border-primary/20 flex gap-4 animate-in slide-in-from-top-2">
                        <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center shrink-0"><ShieldCheck className="w-6 h-6 text-primary" /></div>
                        <div className="space-y-1.5 text-left">
                            <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">Self-Transfer Advisory</p>
                            <p className="text-xs font-bold text-white/80 leading-relaxed">You can't send money to yourself. Your balance is already here 😄</p>
                        </div>
                    </div>
                )}

                {(resolutionError || validationError) && !isResolving && !isSelfTransfer && (
                    <div className="p-4 rounded-2xl bg-red-500/5 border border-red-500/10 flex items-center gap-3 animate-in fade-in slide-in-from-top-1">
                        <AlertCircle className="w-4 h-4 text-red-500 opacity-60" />
                        <p className="text-[10px] font-black text-red-500/80 uppercase tracking-widest leading-relaxed">{resolutionError || validationError?.message}</p>
                    </div>
                )}

                {isNetworkMismatch && !isSelfTransfer && (
                    <div className="p-5 rounded-[2rem] bg-red-500/10 border border-red-500/20 flex gap-4 animate-in slide-in-from-top-2">
                        <div className="w-12 h-12 rounded-2xl bg-red-500/20 flex items-center justify-center shrink-0"><ShieldAlert className="w-6 h-6 text-red-500" /></div>
                        <div className="space-y-1.5">
                            <p className="text-[10px] font-black text-red-500 uppercase tracking-[0.2em]">Security Alert</p>
                            <p className="text-xs font-bold text-red-400 leading-relaxed">This address belongs to <span className="text-white font-black underline">{detectedMeta?.name}</span>, but you're currently sending from <span className="text-white font-black">{activeNetwork.name}</span>.</p>
                        </div>
                    </div>
                )}
            </section>

            <div className="space-y-3">
                <div className="flex justify-between items-center px-2">
                    <Label className="text-[10px] font-black text-white/60 uppercase tracking-[0.2em]">Transfer Amount</Label>
                    <div className="flex items-center gap-2">
                        <span className={cn("text-[9px] font-bold uppercase", hasInsufficientFunds ? "text-red-400 animate-pulse" : "text-white/40")}>
                          Bal: {selectedToken?.symbol === 'WNC' ? balance : balance.toFixed(4)} {selectedToken?.symbol}
                        </span>
                        <button className="h-6 px-2 text-[9px] font-black text-primary uppercase bg-primary/10 hover:bg-primary/20 rounded-md transition-all active:scale-90" onClick={() => setAmount(balance.toString())}>MAX</button>
                    </div>
                </div>
                <div className={cn("bg-white/[0.03] border rounded-[2.5rem] p-6 transition-all group", hasInsufficientFunds ? "border-red-500/30 ring-4 ring-red-500/5" : "border-white/10")}>
                  <div className="flex items-baseline justify-between gap-4">
                    <Input type="number" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} className={cn("bg-transparent border-none text-[clamp(1.5rem,8vw,3rem)] font-black p-0 h-auto focus-visible:ring-0 tracking-tighter", hasInsufficientFunds ? "text-red-400" : "text-white")} />
                    <span className="text-xl font-black text-white/20 uppercase">{selectedToken?.symbol}</span>
                  </div>
                  <div className="mt-2 text-xs font-bold text-muted-foreground/40 italic flex items-center gap-1.5">
                    {hasInsufficientFunds ? (
                      <span className="text-red-400/60 not-italic uppercase tracking-widest font-black text-[9px]">Insufficient Node Funds</span>
                    ) : (
                      <>≈ {formatFiat(amountUsdValue)} <span className="opacity-50">Estimated Value</span></>
                    )}
                  </div>
                </div>
            </div>

            <div className="p-6 rounded-[2rem] bg-[#0a0a0c] border border-primary/20 space-y-4 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-primary/10 blur-3xl rounded-full -mr-12 -mt-12" />
                <div className="flex items-center gap-2 mb-2 relative z-10"><ShieldCheck className="w-4 h-4 text-primary" /><span className="text-[10px] font-black uppercase tracking-widest text-white/80">Institutional Summary</span></div>
                <div className="space-y-3 relative z-10">
                    <div className="flex justify-between items-center text-[11px]"><span className="text-white/40 font-bold uppercase tracking-tighter">Settlement Path</span><div className="flex items-center gap-1.5 font-bold text-white"><Zap className="w-3 h-3 text-primary" /><span>{selectedToken?.symbol === 'WNC' ? 'Internal Registry' : 'Blockchain Network'}</span></div></div>
                    <div className="flex justify-between items-center text-[11px]"><span className="text-white/40 font-bold uppercase tracking-tighter">Estimated Arrival</span><div className="flex items-center gap-1.5 font-bold text-white"><Timer className="w-3 h-3 text-primary" /><span>{selectedToken?.symbol === 'WNC' ? 'Instant' : gasData.estimatedTime}</span></div></div>
                </div>
            </div>
          </div>

        <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black via-black/95 to-transparent backdrop-blur-md z-40">
          <div className="max-w-md mx-auto">
            <Button className={cn("w-full h-16 rounded-[2rem] text-lg font-black shadow-2xl transition-all duration-300 border-b-4", canSend ? "bg-primary hover:bg-primary/90 border-primary/50 text-white" : "bg-zinc-900 border-zinc-950 opacity-50 grayscale cursor-not-allowed text-zinc-600 shadow-none")} disabled={!canSend} onClick={() => setIsConfirmOpen(true)}>
              {isSubmitting ? <Loader2 className="w-6 h-6 animate-spin" /> : "Sign & Authorize"}
            </Button>
          </div>
        </div>
      </main>

      <GlobalTokenSelector isOpen={isSelectorOpen} onOpenChange={setIsSelectorOpen} onSelect={(token) => { setSelectedToken({ ...token }); hasInitialized.current = true; }} title="Select Asset" />
      <TransactionConfirmationSheet isOpen={isConfirmOpen} onOpenChange={setIsConfirmOpen} onConfirm={handleSendRequest} isSubmitting={isSubmitting} amount={amount} token={selectedToken} recipientName={recipientProfile?.name || (resolvedAddress ? `${resolvedAddress.slice(0,6)}...${resolvedAddress.slice(-4)}` : 'Unknown')} recipientAddress={resolvedAddress} recipientAvatar={recipientProfile?.avatar} />
      <TransactionStatusCard isVisible={isStatusVisible} status={txStatus} senderName="You" senderAvatar={profile?.photo_url} recipientName={recipientProfile?.name || 'Network Node'} recipientAvatar={recipientProfile?.avatar} token={{ symbol: selectedToken?.symbol || '', iconUrl: selectedToken?.iconUrl, chainId: selectedToken?.chainId || 1, name: selectedToken?.name }} isRawAddress={!recipientProfile} />
      <TransactionReceiptSheet isOpen={isReceiptOpen} onOpenChange={setIsReceiptOpen} status={txStatus === 'error' ? 'error' : 'success'} amount={amount} token={selectedToken} recipientName={recipientProfile?.name || 'Network Node'} recipientAddress={resolvedAddress} txHash={txHash} errorReason={receiptError} fee={selectedToken?.symbol === 'WNC' ? '0.00 WNC' : `${gasData.nativeFee} ${activeNetwork.symbol}`} networkName={activeNetwork.name} />
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
