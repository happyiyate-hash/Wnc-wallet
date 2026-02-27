
'use client';

import { Suspense, useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useWallet } from '@/contexts/wallet-provider';
import { useCurrency } from '@/contexts/currency-provider';
import { useGasPrice } from '@/hooks/useGasPrice';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  ArrowLeft, 
  ChevronDown, 
  AlertCircle, 
  Loader2, 
  CheckCircle2, 
  Fuel,
  ClipboardPaste,
  ShieldCheck,
  Timer,
  Search,
  History,
  ArrowRight,
  ShieldAlert,
  XCircle
} from 'lucide-react';
import TokenLogoDynamic from '@/components/shared/TokenLogoDynamic';
import { ethers } from 'ethers';
import * as xrpl from 'xrpl';
import { ApiPromise, WsProvider } from '@polkadot/api';
import { Keyring } from '@polkadot/keyring';
import { cryptoWaitReady } from '@polkadot/util-crypto';
import { useToast } from '@/hooks/use-toast';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import type { AssetRow, ChainConfig, RecentRecipient } from '@/lib/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase/client';
import { useDebounce } from '@/hooks/use-debounce';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useUser } from '@/contexts/user-provider';
import TransactionConfirmationSheet from '@/components/wallet/transaction-confirmation-sheet';

// --- UTILS FOR ADDRESS DETECTION ---
const detectAddressType = (input: string) => {
  if (!input) return 'invalid';
  if (input.startsWith('0x') && input.length === 42) return 'evm';
  if (input.startsWith('r') && input.length >= 25 && input.length <= 35) return 'xrp';
  if (input.length >= 47 && !input.includes('0x')) return 'polkadot';
  if (input.length >= 3 && (input.startsWith('@') || /^\d+$/.test(input))) return 'internal';
  return 'invalid';
};

const getDetectedNetworkMeta = (type: string) => {
    if (type === 'xrp') return { name: 'XRP Ledger', symbol: 'XRP' };
    if (type === 'polkadot') return { name: 'Polkadot', symbol: 'DOT' };
    if (type === 'evm') return { name: 'EVM Network', symbol: 'ETH' };
    return null;
};

function SendClient() {
  const { viewingNetwork, wallets, balances, infuraApiKey, allChains, allAssets, getAvailableAssetsForChain, prices, allChainsMap } = useWallet();
  const { formatFiat } = useCurrency();
  const { user, profile } = useUser();
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [step, setStep] = useState<'details' | 'success'>('details');
  const [selectedToken, setSelectedToken] = useState<AssetRow | null>(null);
  
  const [recentRecipients, setRecentRecipients] = useState<RecentRecipient[]>([]);
  const [isRecentLoading, setIsRecentLoading] = useState(false);

  const [recipientInput, setRecipientInput] = useState('');
  const [resolvedAddress, setResolvedAddress] = useState('');
  const [recipientProfile, setRecipientProfile] = useState<{avatar: string, verified: boolean, name: string} | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const debouncedRecipient = useDebounce(recipientInput, 600);

  const [amount, setAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [txHash, setTxHash] = useState('');
  
  const [isTokenSheetOpen, setIsTokenSideSheetOpen] = useState(false);

  const gasData = useGasPrice(selectedToken?.chainId);

  // 1. FETCH RECENT
  const fetchRecent = useCallback(async () => {
    if (!user || !supabase) return;
    setIsRecentLoading(true);
    try {
      const { data, error } = await supabase
        .from('recent_recipients_live')
        .select('*')
        .eq('sender_id', user.id)
        .limit(10);
      if (!error && data) setRecentRecipients(data as RecentRecipient[]);
    } catch (e) { console.warn(e); } finally { setIsRecentLoading(false); }
  }, [user]);

  useEffect(() => { fetchRecent(); }, [fetchRecent]);

  // 2. INITIALIZE TOKEN
  useEffect(() => {
    if (allAssets.length === 0) return;
    const symbol = searchParams.get('symbol');
    const chainIdParam = parseInt(searchParams.get('chainId') || '');
    let target = allAssets.find(a => a.symbol === symbol && a.chainId === (chainIdParam || viewingNetwork.chainId)) || allAssets[0];
    if (target && !selectedToken) setSelectedToken({ ...target });
  }, [allAssets, searchParams, viewingNetwork.chainId, selectedToken]);

  const activeNetwork = useMemo(() => {
    const chainId = selectedToken?.chainId || viewingNetwork.chainId;
    return allChainsMap[chainId] || viewingNetwork;
  }, [selectedToken, viewingNetwork, allChainsMap]);

  // 3. IDENTITY & VALIDATION ENGINE
  const addrType = useMemo(() => detectAddressType(debouncedRecipient), [debouncedRecipient]);
  const detectedMeta = useMemo(() => getDetectedNetworkMeta(addrType), [addrType]);
  
  const isNetworkMismatch = useMemo(() => {
    if (addrType === 'invalid' || addrType === 'internal') return false;
    const activeType = activeNetwork.type || 'evm';
    if (activeType === 'evm' && addrType !== 'evm') return true;
    if (activeType === 'xrp' && addrType !== 'xrp') return true;
    if (activeType === 'polkadot' && addrType !== 'polkadot') return true;
    return false;
  }, [addrType, activeNetwork.type]);

  useEffect(() => {
    let isMounted = true;
    async function resolve() {
      const input = debouncedRecipient.trim();
      if (!input || input.length < 3) {
        if (isMounted) { setResolvedAddress(''); setRecipientProfile(null); }
        return;
      }

      if (addrType !== 'internal') {
        if (isMounted) { setResolvedAddress(input); setRecipientProfile(null); }
        return;
      }

      setIsResolving(true);
      const searchHandle = input.startsWith('@') ? input.substring(1).toLowerCase().trim() : input.toLowerCase().trim();

      try {
        const { data, error } = await supabase!.rpc('fetch_recipient_details', {
          search_account_number: searchHandle,
          selected_chain: activeNetwork.type || 'evm'
        });
        if (!isMounted) return;
        if (data && data[0]) {
          setResolvedAddress(data[0].target_address || '');
          setRecipientProfile({ avatar: data[0].profile_pic, verified: data[0].verified, name: searchHandle });
        } else {
          setResolvedAddress(''); setRecipientProfile(null);
        }
      } catch (e) {
        if (isMounted) { setResolvedAddress(''); setRecipientProfile(null); }
      } finally { if (isMounted) setIsResolving(false); }
    }
    resolve();
    return () => { isMounted = false; };
  }, [debouncedRecipient, addrType, activeNetwork.type]);

  const handleSend = async () => {
    if (!wallets || !selectedToken || !resolvedAddress) return;
    setIsSubmitting(true);
    let polkadotApi: ApiPromise | null = null;
    try {
      if (activeNetwork.type === 'xrp') {
        const xrpWalletData = wallets.find(w => w.type === 'xrp');
        const client = new xrpl.Client(activeNetwork.rpcUrl);
        await client.connect();
        const wallet = xrpl.Wallet.fromSeed(xrpWalletData!.seed!);
        const prepared = await client.autofill({ TransactionType: "Payment", Account: wallet.address, Amount: xrpl.xrpToDrops(amount), Destination: resolvedAddress });
        const result = await client.submitAndWait(wallet.sign(prepared).tx_blob);
        if (result.result.meta && typeof result.result.meta !== 'string' && (result.result.meta as any).TransactionResult === "tesSUCCESS") {
          setTxHash(result.result.hash); setStep('success');
        }
        await client.disconnect();
      } else if (activeNetwork.type === 'polkadot') {
        await cryptoWaitReady();
        const provider = new WsProvider(activeNetwork.rpcUrl, 10000);
        polkadotApi = await ApiPromise.create({ provider });
        await polkadotApi.isReadyOrError;
        const keyring = new Keyring({ type: 'sr25519' });
        const userMnemonic = localStorage.getItem(`wallet_mnemonic_${user?.id}`);
        const wallet = keyring.addFromMnemonic(userMnemonic!);
        const planckAmount = BigInt(Math.floor(parseFloat(amount) * 10_000_000_000));
        const hash = await polkadotApi.tx.balances.transferKeepAlive(resolvedAddress, planckAmount).signAndSend(wallet);
        setTxHash(hash.toHex()); setStep('success');
      } else {
        const evmWalletData = wallets.find(w => w.type === 'evm');
        const provider = new ethers.JsonRpcProvider(activeNetwork.rpcUrl.replace('{API_KEY}', infuraApiKey!), undefined, { staticNetwork: true });
        const wallet = new ethers.Wallet(evmWalletData!.privateKey!, provider);
        const decimals = selectedToken.decimals || 18;
        let tx = selectedToken.isNative 
          ? await wallet.sendTransaction({ to: resolvedAddress, value: ethers.parseUnits(amount, decimals) }) 
          : await (new ethers.Contract(selectedToken.address, ["function transfer(address to, uint256 amount) returns (bool)"], wallet)).transfer(resolvedAddress, ethers.parseUnits(amount, decimals));
        setTxHash(tx.hash); setStep('success');
      }
      setIsConfirmOpen(false);
    } catch (e: any) {
      toast({ title: "Send Failed", description: e.message, variant: "destructive" });
    } finally {
      if (polkadotApi) await polkadotApi.disconnect();
      setIsSubmitting(false);
    }
  };

  const balance = parseFloat(selectedToken?.balance || '0');
  const amountUsdValue = (parseFloat(amount) || 0) * (selectedToken?.priceUsd || 0);
  const isValidAddress = resolvedAddress.length > 0 && !isNetworkMismatch;
  const canSend = isValidAddress && parseFloat(amount) > 0 && parseFloat(amount) <= balance && !isSubmitting;

  if (step === 'success') {
    return (
        <div className="flex flex-col items-center justify-center min-h-[80vh] p-10 text-center space-y-8 bg-[#050505]">
            <div className="w-24 h-24 rounded-[2.5rem] bg-green-500/10 border border-green-500/20 flex items-center justify-center relative">
                <div className="absolute inset-0 bg-green-500/20 blur-2xl rounded-full animate-pulse" />
                <CheckCircle2 className="w-12 h-12 text-green-500 relative z-10" />
            </div>
            <div className="space-y-3">
                <h2 className="text-3xl font-black text-white">Transaction Sent!</h2>
                <p className="text-sm text-muted-foreground">Broadcasting to <span className="text-primary font-bold">{activeNetwork.name}</span>.</p>
                {txHash && (
                    <div className="mt-6 p-4 rounded-2xl bg-white/5 border border-white/10 flex flex-col gap-2">
                        <p className="text-[10px] uppercase font-black text-white/40">Hash</p>
                        <p className="text-[10px] font-mono text-primary break-all">{txHash}</p>
                    </div>
                )}
            </div>
            <Button className="w-full h-16 rounded-[2rem] font-black text-lg shadow-2xl" onClick={() => router.push('/')}>Done</Button>
        </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full bg-[#050505] text-foreground relative pb-40">
      <header className="p-4 flex items-center justify-between border-b border-white/5 sticky top-0 bg-black/50 backdrop-blur-2xl z-50">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-xl">
            <ArrowLeft className="w-5 h-5" />
        </Button>
        
        <button 
            onClick={() => setIsTokenSideSheetOpen(true)}
            className="flex items-center gap-2 bg-primary/10 border border-primary/20 px-4 py-2 rounded-full hover:bg-primary/20 transition-all active:scale-95"
        >
            <TokenLogoDynamic logoUrl={selectedToken?.iconUrl} alt="S" size={20} chainId={selectedToken?.chainId} name={selectedToken?.name} symbol={selectedToken?.symbol} />
            <span className="text-[10px] font-black uppercase text-white">{selectedToken?.symbol || 'Select'}</span>
            <ChevronDown className="w-3 h-3 text-primary" />
        </button>

        <div className="w-10" />
      </header>

      <main className="flex-1 p-6 space-y-10 max-w-lg mx-auto w-full">
        <section className="flex items-center justify-between px-2">
            <div className="flex flex-col items-center gap-3">
                <div className="relative">
                    <Avatar className="w-20 h-20 rounded-[2rem] border-2 border-primary/30 shadow-2xl">
                        <AvatarImage src={profile?.photo_url} className="object-cover"/>
                        <AvatarFallback className="bg-primary/20 text-primary font-black text-xl">{profile?.name?.[0]}</AvatarFallback>
                    </Avatar>
                    <div className="absolute -bottom-1 -right-1 bg-black rounded-lg p-1 border border-white/10 shadow-xl">
                        <TokenLogoDynamic logoUrl={selectedToken?.iconUrl} alt="T" size={20} chainId={selectedToken?.chainId} symbol={selectedToken?.symbol} name={selectedToken?.name} />
                    </div>
                </div>
                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">You</span>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center px-4 relative">
                <div className="w-full h-[1px] bg-gradient-to-r from-primary/20 via-primary to-primary/20 relative">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#050505] p-2 border border-white/5 rounded-full">
                        <ArrowRight className="w-4 h-4 text-primary animate-pulse" />
                    </div>
                </div>
            </div>

            <div className="flex flex-col items-center gap-3">
                <div className="relative">
                    {recipientProfile ? (
                        <div className="relative group">
                            <Avatar className="w-20 h-20 rounded-[2rem] border-2 border-primary/30 shadow-2xl animate-in zoom-in duration-500">
                                <AvatarImage src={recipientProfile.avatar} className="object-cover"/>
                                <AvatarFallback className="bg-primary/20 text-primary font-black text-xl">{recipientProfile.name[0]?.toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <div className="absolute -bottom-1 -right-1 bg-black rounded-lg p-1 border border-white/10 shadow-xl">
                                <TokenLogoDynamic logoUrl={selectedToken?.iconUrl} alt="T" size={20} chainId={selectedToken?.chainId} symbol={selectedToken?.symbol} name={selectedToken?.name} />
                            </div>
                        </div>
                    ) : (
                        <div className={cn(
                            "w-20 h-20 rounded-[2rem] border-2 border-dashed flex items-center justify-center transition-all duration-500 relative",
                            addrType === 'invalid' ? "border-white/10" : isNetworkMismatch ? "border-red-500 bg-red-500/10 scale-105" : "border-primary/50 bg-primary/5 shadow-[0_0_30px_rgba(139,92,246,0.1)]"
                        )}>
                            {isResolving ? <Loader2 className="w-8 h-8 animate-spin text-primary opacity-40" /> : 
                             isNetworkMismatch ? (
                                <div className="flex flex-col items-center justify-center p-2">
                                    <TokenLogoDynamic 
                                        symbol={detectedMeta?.symbol} 
                                        name={detectedMeta?.name} 
                                        size={44} 
                                    />
                                </div>
                             ) : addrType !== 'invalid' ? (
                                <div className="relative">
                                    <TokenLogoDynamic logoUrl={selectedToken?.iconUrl} alt="Token" size={44} chainId={selectedToken?.chainId} symbol={selectedToken?.symbol} name={selectedToken?.name} />
                                    <div className="absolute -bottom-1 -right-1 bg-black rounded-lg p-1 border border-white/10 shadow-xl">
                                        <TokenLogoDynamic logoUrl={activeNetwork.iconUrl} alt="Network" size={16} chainId={activeNetwork.chainId} symbol={activeNetwork.symbol} name={activeNetwork.name} />
                                    </div>
                                </div>
                             ) : (
                                <Search className="w-8 h-8 text-white/10" />
                             )}
                        </div>
                    )}
                </div>
                <span className={cn(
                    "text-[8px] font-black uppercase tracking-widest truncate w-20 text-center flex flex-col items-center gap-1",
                    isNetworkMismatch ? "text-red-500 animate-pulse" : "text-muted-foreground"
                )}>
                    {isNetworkMismatch && <XCircle className="w-3.5 h-3.5" />}
                    {recipientProfile ? `@${recipientProfile.name}` : isNetworkMismatch ? 'Route Blocked' : addrType !== 'invalid' ? 'Network Node' : 'Recipient'}
                </span>
            </div>
        </section>

        <section className="space-y-3">
            <div className="flex justify-between items-center px-2">
                <Label className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Recipient Target</Label>
                <button onClick={async () => setRecipientInput(await navigator.clipboard.readText())} className="text-[9px] font-black text-primary uppercase tracking-widest bg-primary/10 px-2.5 py-1 rounded-lg">PASTE</button>
            </div>
            <div className={cn(
                "bg-white/[0.03] border border-white/10 focus-within:border-primary/50 rounded-[2rem] p-2 transition-all",
                isNetworkMismatch && "border-red-500/50 bg-red-500/5 ring-4 ring-red-500/10"
            )}>
                <div className="flex items-center gap-2 px-2">
                    <Input 
                        placeholder="Account ID or Address" 
                        value={recipientInput} 
                        onChange={(e) => setRecipientInput(e.target.value)} 
                        className="h-12 bg-transparent border-none text-sm font-mono focus-visible:ring-0 placeholder:text-zinc-700 text-white flex-1"
                    />
                    {isResolving && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
                </div>
            </div>
            {isNetworkMismatch && (
                <div className="px-2 flex items-center gap-2 text-red-400 text-[9px] font-black uppercase tracking-tight animate-in slide-in-from-top-1">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>Incompatible network detected: Found {detectedMeta?.name} address</span>
                </div>
            )}
        </section>

        <section className="space-y-3">
            <div className="flex justify-between items-center px-2">
                <Label className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Transfer Amount</Label>
                <span className="text-[9px] text-white/20 font-bold uppercase">Bal: {balance.toFixed(4)} {selectedToken?.symbol}</span>
            </div>
            <div className="bg-white/[0.03] border border-white/10 focus-within:border-primary/50 rounded-[2.5rem] p-6 transition-all relative">
                <div className="flex items-baseline justify-between gap-4">
                    <Input 
                        type="number" 
                        placeholder="0.00" 
                        value={amount} 
                        onChange={(e) => setAmount(e.target.value)} 
                        className="bg-transparent border-none text-4xl font-black p-0 h-auto focus-visible:ring-0 tracking-tighter placeholder:text-zinc-800 text-white"
                    />
                    <span className="text-xl font-black text-white/20 uppercase">{selectedToken?.symbol}</span>
                </div>
                <div className="mt-2 text-xs font-bold text-muted-foreground/40 italic flex items-center gap-1.5">
                    ≈ {formatFiat(amountUsdValue)}
                </div>
            </div>
        </section>

        <div className="p-6 rounded-[2rem] bg-[#0a0a0c] border border-primary/20 space-y-4 shadow-2xl relative overflow-hidden">
            <div className="flex items-center gap-2 mb-2 relative z-10">
                <ShieldCheck className="w-4 h-4 text-primary" />
                <span className="text-[10px] font-black uppercase tracking-widest text-white/80">Network Summary</span>
            </div>
            <div className="space-y-3 text-[11px] font-bold">
                <div className="flex justify-between items-center"><span className="text-white/40 uppercase">Ecosystem</span><span className="text-white">{activeNetwork.name}</span></div>
                <div className="flex justify-between items-center"><span className="text-white/40 uppercase">Arrival Time</span><span className="text-white">{gasData.estimatedTime}</span></div>
                <div className="pt-3 border-t border-white/5 flex justify-between items-center"><span className="text-xs font-black uppercase text-white/40">Total Impact</span><span className="text-sm font-black text-white">{amount || '0'} {selectedToken?.symbol}</span></div>
            </div>
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black via-black/95 to-transparent backdrop-blur-md z-40">
        <div className="max-w-md mx-auto">
          {amount && parseFloat(amount) > balance && (
            <div className="flex items-center gap-2 p-3 rounded-2xl bg-destructive/10 text-destructive text-[10px] border border-destructive/20 mb-4 font-black uppercase tracking-widest justify-center">
              <AlertCircle className="w-3.5 h-3.5" /> Insufficient {selectedToken?.symbol} balance
            </div>
          )}
          {isNetworkMismatch && (
            <div className="flex items-center gap-2 p-3 rounded-2xl bg-red-500/10 text-red-500 text-[10px] border border-red-500/20 mb-4 font-black uppercase tracking-widest justify-center">
              <ShieldAlert className="w-3.5 h-3.5" /> Cross-Chain Error: Unauthorized Route
            </div>
          )}
          <Button 
            className={cn(
                "w-full h-16 rounded-[2rem] text-lg font-black shadow-2xl transition-all duration-300 border-b-4", 
                canSend ? "bg-primary hover:bg-primary/90 border-primary/50 text-white" : "bg-zinc-900 border-zinc-950 opacity-50 grayscale text-zinc-600 shadow-none"
            )} 
            disabled={!canSend} 
            onClick={() => setIsConfirmOpen(true)}
          >
            {isSubmitting ? <Loader2 className="w-6 h-6 animate-spin" /> : "Sign & Authorize"}
          </Button>
        </div>
      </div>

      <Sheet open={isTokenSheetOpen} onOpenChange={setIsTokenSideSheetOpen}>
        <SheetContent side="bottom" className="bg-[#0a0a0c]/95 backdrop-blur-2xl border-t border-white/10 rounded-t-[3.5rem] p-0 h-[70vh] overflow-hidden">
          <div className="w-12 h-1 bg-white/10 rounded-full mx-auto my-4 shrink-0" />
          <SheetHeader className="px-6 mb-4"><SheetTitle className="text-xl font-black uppercase tracking-widest text-center">Select Asset</SheetTitle></SheetHeader>
          <ScrollArea className="flex-1 p-4"><div className="space-y-2 pb-24">
            {allAssets.map((token) => (
              <button 
                key={`${token.chainId}-${token.symbol}`}
                onClick={() => { setSelectedToken({ ...token }); setIsTokenSideSheetOpen(false); }}
                className="w-full flex items-center justify-between p-4 rounded-3xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all text-left"
              >
                <div className="flex items-center gap-4">
                  <TokenLogoDynamic logoUrl={token.iconUrl} alt={token.symbol} size={40} chainId={token.chainId} symbol={token.symbol} name={token.name} />
                  <div>
                    <p className="font-bold text-base text-white">{token.symbol}</p>
                    <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest opacity-60">{allChainsMap[token.chainId]?.name}</p>
                  </div>
                </div>
                <div className="text-right">
                    <p className="font-mono text-sm font-black text-white">{parseFloat(token.balance).toFixed(4)}</p>
                    <p className="text-[10px] text-primary uppercase font-black">Available</p>
                </div>
              </button>
            ))}
          </div></ScrollArea>
        </SheetContent>
      </Sheet>

      <TransactionConfirmationSheet 
        isOpen={isConfirmOpen}
        onOpenChange={setIsConfirmOpen}
        onConfirm={handleSend}
        isSubmitting={isSubmitting}
        amount={amount}
        token={selectedToken}
        recipientName={recipientProfile?.name || (isValidAddress ? `${resolvedAddress.slice(0,6)}...${resolvedAddress.slice(-4)}` : 'Unknown')}
        recipientAddress={resolvedAddress}
        recipientAvatar={recipientProfile?.avatar}
      />
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
