
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
  Zap,
  QrCode,
  X,
  Image as ImageIcon,
  CheckCircle2,
  Copy,
  ChevronDown
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
import { Html5Qrcode } from 'html5-qrcode';

/**
 * INSTITUTIONAL MULTI-CHAIN ADDRESS SNIFFER
 */
const detectAddressType = (input: string) => {
  if (!input) return 'invalid';
  const clean = input.trim();
  
  if (/^835\d{7}$/.test(clean)) return 'account-id';
  if (/^\d+\.\d+\.\d+$/.test(clean)) return 'hedera';
  if (/^tz[123][a-km-zA-HJ-NP-Z1-9]{33}$/.test(clean)) return 'tezos';

  if (clean.startsWith('0x')) {
    const formatRegex = /^0x[a-fA-F0-9]{40}$/;
    const moveChainRegex = /^0x[a-fA-F0-9]{64}$/;
    if (moveChainRegex.test(clean)) return 'move-chain'; 
    if (!formatRegex.test(clean)) return 'invalid-evm-format';
    try {
        if (ethers.isAddress(clean)) return 'evm';
        return 'invalid-evm-checksum';
    } catch(e) { return 'invalid-evm-format'; }
  }
  
  if (clean.startsWith('r')) {
    if (xrpl.isValidClassicAddress(clean)) return 'xrp';
    return 'invalid-xrp';
  }

  if (clean.length === 58 && /^[A-Z2-7]{58}$/.test(clean)) return 'algorand';
  if (clean.startsWith('T') && clean.length === 34) return 'tron';
  if (clean.startsWith('D') && clean.length === 34) return 'doge';
  if (clean.startsWith('bc1') || clean.startsWith('1') || clean.startsWith('3')) return 'btc';
  if (clean.startsWith('ltc1') || clean.startsWith('L') || clean.startsWith('M')) return 'ltc';
  if (clean.startsWith('cosmos1')) return 'cosmos';
  if (clean.startsWith('osmo1')) return 'osmosis';
  if (clean.startsWith('secret1')) return 'secret';
  if (clean.startsWith('inj1')) return 'injective';
  if (clean.startsWith('celestia1')) return 'celestia';
  if (clean.startsWith('addr1')) return 'cardano';
  
  if (clean.length >= 47 && !clean.includes('0x')) {
    try {
        if (clean.startsWith('K')) return 'kusama';
        const [isValid] = checkAddress(clean, 42); 
        const [isValidPolkadot] = checkAddress(clean, 0);
        if (isValid || isValidPolkadot) return 'polkadot';
    } catch (e) {}
  }

  if (clean.endsWith('.near') || clean.endsWith('.testnet') || /^[a-f0-9]{64}$/.test(clean)) {
    return 'near';
  }

  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(clean)) {
    return 'solana';
  }
  
  return 'invalid';
};

const getDetectedNetworkMeta = (type: string) => {
    if (type === 'xrp' || type === 'invalid-xrp') return { name: 'XRP Ledger', symbol: 'XRP' };
    if (type === 'polkadot') return { name: 'Polkadot', symbol: 'DOT' };
    if (type === 'kusama') return { name: 'Kusama', symbol: 'KSM' };
    if (type === 'evm' || type === 'invalid-evm-checksum' || type === 'invalid-evm-format') return { name: 'Ethereum', symbol: 'ETH' };
    if (type === 'near') return { name: 'NEAR Protocol', symbol: 'NEAR' };
    if (type === 'btc') return { name: 'Bitcoin', symbol: 'BTC' };
    if (type === 'ltc') return { name: 'Litecoin', symbol: 'LTC' };
    if (type === 'doge') return { name: 'Dogecoin', symbol: 'DOGE' };
    if (type === 'solana') return { name: 'Solana', symbol: 'SOL' };
    if (type === 'cosmos') return { name: 'Cosmos Hub', symbol: 'ATOM' };
    if (type === 'osmosis') return { name: 'Osmosis', symbol: 'OSMO' };
    if (type === 'secret') return { name: 'Secret Network', symbol: 'SCRT' };
    if (type === 'injective') return { name: 'Injective', symbol: 'INJ' };
    if (type === 'celestia') return { name: 'Celestia', symbol: 'TIA' };
    if (type === 'cardano') return { name: 'Cardano', symbol: 'ADA' };
    if (type === 'tron') return { name: 'TRON', symbol: 'TRX' };
    if (type === 'algorand') return { name: 'Algorand', symbol: 'ALGO' };
    if (type === 'hedera') return { name: 'Hedera', symbol: 'HBAR' };
    if (type === 'tezos') return { name: 'Tezos', symbol: 'XTZ' };
    if (type === 'move-chain') return { name: 'Move Chain', symbol: 'MOVE' };
    if (type === 'account-id') return { name: 'Internal Registry', symbol: 'ID' };
    return null;
};

const mapTechnicalError = (err: any): string => {
  const msg = (err.message || String(err)).toLowerCase();
  if (msg.includes('insufficient funds') || msg.includes('insufficient balance')) return "Insufficient Funds: Your node balance is too low to authorize this dispatch.";
  if (msg.includes('candidate function') || msg.includes('ambiguous')) return "Registry Ambiguity: Multiple transfer protocols detected. Please use the whole-number (integer) unit standard.";
  if (msg.includes('user rejected')) return "Transaction Cancelled: You rejected the request in your terminal.";
  if (err.message) return `System Advisory: ${err.message}`;
  return "Dispatch Error: The transaction was rejected by the network protocol.";
};

function SendClient() {
  const { viewingNetwork, wallets, infuraApiKey, allAssets, prices, allChainsMap, accountNumber, refresh, setActiveFulfillmentId } = useWallet();
  const { formatFiat } = useCurrency();
  const { profile, refreshProfile } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

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
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const hasInitialized = useRef(false);
  const resolutionCounter = useRef(0);
  
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    if (target) { setSelectedToken({ ...target }); hasInitialized.current = true; }
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
    if (wallets) return wallets.some(w => w.address.toLowerCase() === input);
    return false;
  }, [debouncedRecipient, accountNumber, wallets]);

  const validationError = useMemo(() => {
    if (isSelfTransfer) return null;
    if (addrType === 'invalid-evm-format') return { title: "Invalid Format", message: "This doesn't look like a valid address." };
    if (addrType === 'invalid-evm-checksum') return { title: "Checksum Fail", message: "Address failed cryptographic validation." };
    if (addrType === 'invalid-xrp') return { title: "Invalid XRP", message: "Address failed Base58 validation." };
    if (debouncedRecipient.length > 0 && addrType === 'invalid') return { title: "Unknown Format", message: "I could not find any account or blockchain related to this symbol." };
    return null;
  }, [addrType, isSelfTransfer, debouncedRecipient]);

  const isNetworkMismatch = useMemo(() => {
    if (isSelfTransfer || selectedToken?.symbol === 'WNC' || !debouncedRecipient) return false;
    if (addrType === 'invalid' || addrType.includes('invalid-')) return false;
    if (addrType === 'account-id') return false; 
    const activeType = activeNetwork.type || 'evm';
    if (activeType === 'aptos' || activeType === 'sui') return addrType !== 'move-chain';
    const cosmosVariants = ['cosmos', 'osmosis', 'secret', 'injective', 'celestia'];
    if (cosmosVariants.includes(activeType)) return !cosmosVariants.includes(addrType);
    if (activeType === 'polkadot' || activeType === 'kusama') return !['polkadot', 'kusama'].includes(addrType);
    return activeType !== addrType;
  }, [addrType, activeNetwork.type, isSelfTransfer, selectedToken, debouncedRecipient]);

  const handleRecipientInputChange = (val: string) => {
    setRecipientInput(val);
    const type = detectAddressType(val);
    // INSTANT STOP: Spinner only activates if we need to resolve a database Identity (835...)
    if (type === 'account-id') {
        setIsResolving(true);
    } else {
        setIsResolving(false);
    }
  };

  useEffect(() => {
    const currentId = ++resolutionCounter.current;
    async function resolve() {
      const input = debouncedRecipient.trim();
      const isInternalWnc = selectedToken?.symbol === 'WNC';
      const isRawChainAddress = ['evm', 'xrp', 'polkadot', 'kusama', 'near', 'btc', 'ltc', 'doge', 'solana', 'cosmos', 'osmosis', 'secret', 'injective', 'celestia', 'cardano', 'tron', 'algorand', 'hedera', 'tezos', 'move-chain'].includes(addrType);
      
      if (!input || input.length < 3 || isSelfTransfer || isNetworkMismatch || validationError) {
        if (currentId === resolutionCounter.current) { 
          setResolvedAddress(''); 
          setRecipientProfile(null); 
          setIsResolving(false); 
          setResolutionError(null); 
        }
        return;
      }

      if (isRawChainAddress) {
        if (currentId === resolutionCounter.current) { 
          setResolvedAddress(input); 
          setRecipientProfile(null); 
          setIsResolving(false); 
          setResolutionError(null); 
        }
        return;
      }

      if (addrType === 'account-id') {
        setRecipientProfile(null); 
        setIsResolving(true); 
        setResolutionError(null);
        try {
          if (!supabase) throw new Error("No connection");
          const { data: userRecord } = await supabase.from('profiles').select('id, name, photo_url, account_number').eq('account_number', input).maybeSingle();
          if (currentId !== resolutionCounter.current) return;
          if (userRecord) {
            setRecipientProfile({ id: userRecord.id, avatar: userRecord.photo_url || '', verified: true, name: userRecord.name || input });
            if (isInternalWnc) setResolvedAddress(userRecord.account_number || '');
            else {
              const targetChainType = activeNetwork.type || 'evm';
              const { data: chainWallet } = await supabase.from('wallets').select('address').eq('user_id', userRecord.id).eq('blockchain_id', targetChainType).maybeSingle();
              if (chainWallet?.address) setResolvedAddress(chainWallet.address);
              else { setResolvedAddress(''); setResolutionError(`Recipient found, but no node configured for ${activeNetwork.name}.`); }
            }
          } else { setResolvedAddress(''); setResolutionError("Identity Node not found in registry."); }
        } catch (e: any) { if (currentId === resolutionCounter.current) { setResolvedAddress(''); setResolutionError("Handshake failed."); } }
        finally { if (currentId === resolutionCounter.current) setIsResolving(false); }
        return;
      }

      if (currentId === resolutionCounter.current) { 
        setResolvedAddress(''); 
        setRecipientProfile(null); 
        setIsResolving(false); 
        setResolutionError("I could not find any account or blockchain related to this symbol."); 
      }
    }
    resolve();
  }, [debouncedRecipient, addrType, activeNetwork.type, isSelfTransfer, selectedToken, isNetworkMismatch, validationError, activeNetwork.name]);

  const startCamera = async (scanner: Html5Qrcode) => {
    try {
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => handleScanSuccess(decodedText),
        () => {}
      );
    } catch (e) { console.warn("Camera Init Fail:", e); }
  };

  useEffect(() => {
    if (isScannerOpen) {
      const html5QrCode = new Html5Qrcode("reader");
      scannerRef.current = html5QrCode;
      startCamera(html5QrCode);
      return () => { if (html5QrCode.isScanning) html5QrCode.stop().catch(e => console.warn("Stop Fail:", e)); };
    }
  }, [isScannerOpen]);

  const handleScanSuccess = (decodedText: string) => {
    setIsScannerOpen(false);
    if (decodedText.includes('/request/')) {
      const parts = decodedText.split('/request/');
      const id = parts[parts.length - 1].split(/[?#]/)[0]; 
      if (id && id.length > 10) {
        setActiveFulfillmentId(id);
        router.push('/');
        toast({ title: "Request Detected", description: "Entering fulfillment handshake..." });
        return;
      }
    }
    if (decodedText.startsWith('wnc://')) {
      try {
        const url = new URL(decodedText);
        const account = url.searchParams.get('account');
        const symbol = url.searchParams.get('symbol');
        if (account) {
          handleRecipientInputChange(account);
          if (symbol) {
            const token = allAssets.find(a => a.symbol === symbol);
            if (token) setSelectedToken(token);
          }
          toast({ title: "Node Resolved" });
        }
      } catch (e) { toast({ variant: "destructive", title: "Invalid QR Protocol" }); }
      return;
    }
    let cleanAddress = decodedText;
    if (decodedText.includes(':')) {
        const parts = decodedText.split(':');
        if (parts[1]) cleanAddress = parts[1].split(/[?#]/)[0];
    }
    handleRecipientInputChange(cleanAddress);
    toast({ title: "Handshake Authorized" });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !scannerRef.current) return;
    
    // THREAD-SAFE SCANNING: Pause camera to prevent resource collision
    if (scannerRef.current.isScanning) {
        await scannerRef.current.stop().catch(() => {});
    }

    try {
      const decodedText = await scannerRef.current.scanFile(file, false);
      handleScanSuccess(decodedText);
    } catch (err) {
      toast({ variant: "destructive", title: "Scan Failed", description: "No valid QR code detected in this image." });
      if (isScannerOpen && scannerRef.current) startCamera(scannerRef.current);
    }
  };

  const handleSendRequest = async () => {
    if (!wallets || !selectedToken || !resolvedAddress || !profile) return;
    setIsConfirmOpen(false); setIsStatusVisible(true); setTxStatus('pending'); setIsSubmitting(true);
    try {
      if (selectedToken.symbol === 'WNC') {
        // Universal Ledger Migration: Use transfer_wnc_universal protocol
        const transferAmount = Math.floor(parseFloat(amount));
        const { data, error: rpcError } = await supabase!.rpc('transfer_wnc_universal', { 
          p_receiver_id: recipientProfile!.id, 
          p_destination_type: 'user',
          p_amount: transferAmount,
          p_reference: `Institutional P2P Transfer: ${transferAmount} WNC`
        });
        if (rpcError) throw new Error(rpcError.message);
        if (!data?.success) throw new Error(data?.message || "Atomic settlement failed.");
        setTxHash(`int_${Math.random().toString(36).substring(7)}`);
        await refreshProfile(); 
      } else if (activeNetwork.type === 'xrp') {
        const xrpWalletData = wallets.find(w => w.type === 'xrp');
        const client = new xrpl.Client(activeNetwork.rpcUrl);
        await client.connect();
        const wallet = xrpl.Wallet.fromSeed(xrpWalletData!.seed!);
        const prepared = await client.autofill({ TransactionType: "Payment", Account: wallet.address, Amount: xrpl.xrpToDrops(amount), Destination: resolvedAddress });
        const result = await client.submitAndWait(wallet.sign(prepared).tx_blob);
        await client.disconnect();
        if ((result.result.meta as any).TransactionResult === "tesSUCCESS") setTxHash(result.result.hash);
        else throw new Error("XRPL Error");
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
    } catch (e: any) { setTxStatus('error'); setReceiptError(mapTechnicalError(e)); }
    finally { setIsSubmitting(false); setTimeout(() => { setIsStatusVisible(false); setIsReceiptOpen(true); }, 3000); }
  };

  const balance = parseFloat(selectedToken?.balance || '0');
  const amountNum = parseFloat(amount) || 0;
  const hasInsufficientFunds = amountNum > balance;
  const canSend = resolvedAddress.length > 0 && !isNetworkMismatch && !validationError && amountNum > 0 && !hasInsufficientFunds && !isSubmitting && !isSelfTransfer;

  return (
    <div className="flex flex-col min-h-full bg-[#050505] text-foreground relative">
      <header className="p-4 flex items-center justify-between border-b border-white/5 sticky top-0 bg-black/50 backdrop-blur-2xl z-50">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-xl"><ArrowLeft className="w-5 h-5" /></Button>
        <button onClick={() => setIsSelectorOpen(true)} className="flex items-center gap-2 bg-primary/10 border border-primary/20 px-4 py-2 rounded-full hover:bg-primary/20 transition-all">
            <TokenLogoDynamic logoUrl={selectedToken?.iconUrl} alt="token" size={20} chainId={selectedToken?.chainId} symbol={selectedToken?.symbol} name={selectedToken?.name} />
            <div className="flex items-start leading-none"><span className="text-[10px] font-black uppercase text-white">{selectedToken?.symbol || 'Select Asset'}</span><span className="text-[7px] font-bold text-primary uppercase opacity-60 ml-1">{activeNetwork.name}</span></div>
            <ChevronDown className="w-3 h-3 text-primary" />
        </button>
        <Button variant="ghost" size="icon" onClick={() => setIsScannerOpen(true)} className="rounded-xl"><QrCode className="w-5 h-5 text-primary" /></Button>
      </header>

      <main className="flex-1 p-6 max-w-lg mx-auto w-full pb-48">
          <div className="space-y-10 pt-2 px-1">
            <section className="flex items-center justify-between px-2">
                <div className="flex flex-col items-center gap-3">
                    <div className="relative">
                        <Avatar className="w-20 h-20 rounded-[2.5rem] border-2 border-primary/30 shadow-2xl bg-black relative z-10">
                            <AvatarImage src={profile?.photo_url} />
                            <AvatarFallback className="bg-primary/20 text-primary font-black text-xl">{profile?.name?.[0] || 'U'}</AvatarFallback>
                        </Avatar>
                        <div className="absolute -bottom-2 -right-2 bg-black rounded-xl p-1 border border-white/10 shadow-xl z-20">
                            <TokenLogoDynamic logoUrl={selectedToken?.iconUrl} size={24} chainId={selectedToken?.chainId} symbol={selectedToken?.symbol} name={selectedToken?.name} alt="token badge" />
                        </div>
                    </div>
                    <span className="text-[8px] font-black text-white/40 uppercase tracking-widest">FROM YOU</span>
                </div>
                <div className="flex-1 px-4 relative flex flex-col items-center justify-center min-h-[100px]">
                    <div className="w-full h-[1px] bg-gradient-to-r from-primary/20 via-primary to-primary/20 relative"><div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#050505] p-2 border border-white/5 rounded-full z-10"><ArrowRight className="w-4 h-4 text-primary animate-pulse" /></div></div>
                    <AnimatePresence>{resolvedAddress && !isResolving && (
                        <motion.div initial={{ y: 20, opacity: 0, scale: 0.9 }} animate={{ y: 30, opacity: 1, scale: 1 }} exit={{ y: 15, opacity: 0 }} className="absolute left-0 right-0 text-center z-20">
                            <div className="inline-flex flex-col items-center gap-1.5"><p className={cn("text-[7px] font-black uppercase tracking-[0.25em]", (isNetworkMismatch || validationError) ? "text-red-500" : "text-primary")}>{isNetworkMismatch ? 'Incompatible Route' : validationError ? 'Format Alert' : 'Resolved Node'}</p><div className={cn("bg-black/80 border px-3 py-2 rounded-2xl backdrop-blur-md shadow-2xl", (isNetworkMismatch || validationError) ? "border-red-500/30" : "border-primary/20")}><p className="text-[10px] font-mono text-white tracking-tighter whitespace-nowrap">{resolvedAddress.length > 15 ? `${resolvedAddress.slice(0, 10)}...${resolvedAddress.slice(-8)}` : resolvedAddress}</p></div></div>
                        </motion.div>
                    )}</AnimatePresence>
                </div>
                <div className="flex flex-col items-center gap-3">
                    <div className="relative">
                        <div className={cn("w-20 h-20 rounded-[2.5rem] border-2 flex items-center justify-center transition-all duration-500 bg-black relative overflow-hidden z-10", (!resolvedAddress && !isNetworkMismatch && !validationError && !isSelfTransfer) ? "border-dashed border-white/10" : (isNetworkMismatch || (resolvedAddress && validationError) || isSelfTransfer) ? "border-red-500 bg-red-500/10 border-dashed" : "border-primary/50 shadow-[0_0_30px_rgba(139,92,246,0.15)]")}>
                            {isResolving ? <Loader2 className="w-8 h-8 animate-spin text-primary opacity-40" /> : isSelfTransfer ? <Avatar className="w-full h-full rounded-none"><AvatarImage src={profile?.photo_url} /><AvatarFallback>{profile?.name?.[0]}</AvatarFallback></Avatar> : recipientProfile ? <Avatar className="w-full h-full rounded-none"><AvatarImage src={recipientProfile.avatar} /><AvatarFallback>{recipientProfile.name[0]?.toUpperCase()}</AvatarFallback></Avatar> : (isNetworkMismatch || validationError) ? <TokenLogoDynamic logoUrl={null} alt="Err" size={40} symbol={detectedMeta?.symbol} name={detectedMeta?.name} /> : resolvedAddress ? <TokenLogoDynamic logoUrl={selectedToken?.iconUrl} alt="Token" size={40} chainId={selectedToken?.chainId} symbol={selectedToken?.symbol} name={selectedToken?.name} /> : <Search className="w-8 h-8 text-white/10" />}
                        </div>
                        {resolvedAddress && !isResolving && (
                            <div className="absolute -bottom-2 -right-2 bg-black rounded-xl p-1 border border-white/10 shadow-xl z-20">
                                <TokenLogoDynamic logoUrl={selectedToken?.iconUrl} size={24} chainId={selectedToken?.chainId} symbol={selectedToken?.symbol} name={selectedToken?.name} alt="token badge" />
                            </div>
                        )}
                    </div>
                    <span className={cn("text-[8px] font-black uppercase tracking-widest truncate w-20 text-center", (isNetworkMismatch || validationError || isSelfTransfer) ? "text-red-500" : "text-white/40")}>{isSelfTransfer ? 'NODE REFLECTION' : recipientProfile ? `TO @${recipientProfile.name.toUpperCase()}` : isNetworkMismatch ? `${detectedMeta?.name || 'UNKNOWN'} DETECTED` : (validationError || (debouncedRecipient && addrType === 'invalid')) ? 'NODE INVALID' : resolvedAddress ? 'NETWORK NODE' : 'TO RECIPIENT'}</span>
                </div>
            </section>

            <section className="space-y-3">
                <div className="flex justify-between items-center px-2"><Label className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Recipient Target</Label><button onClick={async () => handleRecipientInputChange(await navigator.clipboard.readText())} className="text-[9px] font-black text-primary uppercase tracking-widest bg-primary/10 px-2.5 py-1 rounded-lg">PASTE</button></div>
                <div className={cn("bg-white/[0.03] border border-white/10 rounded-[2rem] p-2 transition-all", (isNetworkMismatch || validationError || isSelfTransfer) && "border-red-500/50 bg-red-500/5")}>
                    <div className="flex items-center gap-2 px-2"><Input placeholder="Account ID or Address" value={recipientInput} onChange={(e) => handleRecipientInputChange(e.target.value)} className="h-12 bg-transparent border-none text-sm font-mono focus-visible:ring-0 text-white flex-1" />{isResolving && <Loader2 className="w-4 h-4 animate-spin text-primary" />}</div>
                </div>
                {(resolutionError || validationError) && !isResolving && !isSelfTransfer && !isNetworkMismatch && <div className="p-4 rounded-2xl bg-red-500/5 border border-red-500/10 flex items-center gap-3"><AlertCircle className="w-4 h-4 text-red-500 opacity-60" /><p className="text-[10px] font-black text-red-500/80 uppercase leading-relaxed">{resolutionError || validationError?.message}</p></div>}
                {isNetworkMismatch && !isSelfTransfer && <div className="p-5 rounded-[2rem] bg-red-500/10 border border-red-500/20 flex gap-4"><div className="w-12 h-12 rounded-2xl bg-red-500/20 flex items-center justify-center shrink-0"><ShieldAlert className="w-6 h-6 text-red-500" /></div><div className="space-y-1.5"><p className="text-[10px] font-black text-red-500 uppercase tracking-[0.2em]">Security Alert: {detectedMeta?.name} Address Detected</p><p className="text-xs font-bold text-red-400 leading-relaxed">You are currently trying to send <span className="text-white font-black underline">{activeNetwork.name}</span>. Sending to a different network will result in permanent loss of funds.</p></div></div>}
            </section>

            <div className="space-y-3">
                <div className="flex justify-between items-center px-2"><Label className="text-[10px] font-black text-white/60 uppercase tracking-[0.2em]">Transfer Amount</Label><div className="flex items-center gap-2"><span className={cn("text-[9px] font-bold uppercase", hasInsufficientFunds ? "text-red-400 animate-pulse" : "text-white/40")}>Bal: {balance.toFixed(4)} {selectedToken?.symbol}</span><button className="h-6 px-2 text-[9px] font-black text-primary uppercase bg-primary/10 rounded-md transition-all active:scale-90" onClick={() => setAmount(balance.toString())}>MAX</button></div></div>
                <div className={cn("bg-white/[0.03] border rounded-[2.5rem] p-6 transition-all", hasInsufficientFunds ? "border-red-500/30 ring-4 ring-red-500/5" : "border-white/10")}><div className="flex items-baseline justify-between gap-4"><Input type="number" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} className={cn("bg-transparent border-none text-[clamp(1.5rem,8vw,3rem)] font-black p-0 h-auto focus-visible:ring-0 tracking-tighter", hasInsufficientFunds ? "text-red-400" : "text-white")} /><span className="text-xl font-black text-white/20 uppercase">{selectedToken?.symbol}</span></div><div className="mt-2 text-xs font-bold text-muted-foreground/40 italic flex items-center gap-1.5">{hasInsufficientFunds ? <span className="text-red-400/60 font-black text-[9px] uppercase">Insufficient Funds</span> : <>≈ {formatFiat(amountNum * (selectedToken?.priceUsd || 0))} <span className="opacity-50">Estimated Value</span></>}</div></div>
            </div>
          </div>

        <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black via-black/95 to-transparent backdrop-blur-md z-40">
          <div className="max-md mx-auto"><Button className={cn("w-full h-16 rounded-[2rem] text-lg font-black shadow-2xl transition-all border-b-4", canSend ? "bg-primary hover:bg-primary/90 border-primary/50 text-white" : "bg-zinc-900 border-zinc-950 opacity-50 grayscale cursor-not-allowed")} disabled={!canSend} onClick={() => setIsConfirmOpen(true)}>{isSubmitting ? <Loader2 className="w-6 h-6 animate-spin" /> : "Sign & Authorize"}</Button></div>
        </div>
      </main>

      <AnimatePresence>{isScannerOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-3xl flex flex-col items-center justify-center p-6">
            <div className="w-full max-w-sm space-y-8">
              <div className="flex items-center justify-between"><div className="space-y-1"><h3 className="text-xl font-black text-white uppercase tracking-tight">Identity Scanner</h3><p className="text-[10px] font-black text-primary uppercase tracking-widest">WNC Structured Handshake</p></div><Button variant="ghost" size="icon" onClick={() => setIsScannerOpen(false)} className="rounded-full bg-white/5"><X className="w-5 h-5 text-white" /></Button></div>
              <div className="relative aspect-square w-full rounded-[3rem] overflow-hidden border-4 border-primary/20 shadow-2xl bg-zinc-900"><div id="reader" className="w-full h-full" /><motion.div animate={{ y: [0, 250, 0] }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }} className="absolute left-0 right-0 h-1 bg-primary/60 blur-md z-10" /></div>
              <div className="space-y-4 px-4">
                <Button onClick={() => fileInputRef.current?.click()} variant="outline" className="w-full h-14 rounded-2xl bg-white/5 border-white/10 gap-3 font-bold uppercase tracking-widest text-[10px] text-white hover:bg-white/10"><ImageIcon className="w-4 h-4 text-primary" /> Get from Gallery</Button>
                <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
                <div className="flex items-center justify-center gap-2 opacity-40"><ShieldCheck className="w-3.5 h-3.5 text-white" /><span className="text-[8px] font-black uppercase text-white">Registry Protocol v3.1</span></div>
              </div>
            </div>
          </motion.div>
      )}</AnimatePresence>

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
