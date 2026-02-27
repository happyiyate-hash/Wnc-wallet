
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
  ChevronRight, 
  AlertCircle, 
  Loader2, 
  CheckCircle2, 
  Fuel,
  ClipboardPaste,
  ShieldCheck,
  Timer,
  User,
  Search,
  History
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
import TransactionStatusCard from '@/components/wallet/transaction-status-card';
import TransactionReceiptSheet from '@/components/wallet/transaction-receipt-sheet';

function SendClient() {
  const { viewingNetwork, wallets, balances, infuraApiKey, allChains, allAssets, getAvailableAssetsForChain, prices, allChainsMap } = useWallet();
  const { formatFiat } = useCurrency();
  const { user, profile } = useUser();
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();

  // TX Orchestration
  const [txStatus, setTxStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [txError, setTxError] = useState('');
  const [txHash, setTxHash] = useState('');

  const [selectedToken, setSelectedToken] = useState<AssetRow | null>(null);
  const [recentRecipients, setRecentRecipients] = useState<RecentRecipient[]>([]);
  const [isRecentLoading, setIsRecentLoading] = useState(false);

  // Identity Resolution
  const [recipientInput, setRecipientInput] = useState('');
  const [resolvedAddress, setResolvedAddress] = useState('');
  const [recipientProfile, setRecipientProfile] = useState<{avatar: string, verified: boolean, name: string} | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const debouncedRecipient = useDebounce(recipientInput, 600);

  const [amount, setAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const initializedRef = useRef(false);
  const [isNetworkSheetOpen, setIsNetworkSheetOpen] = useState(false);
  const [selectedNetworkForSelection, setSelectedNetworkForSelection] = useState<ChainConfig | null>(null);
  const [isTokenSideSheetOpen, setIsTokenSideSheetOpen] = useState(false);

  const gasData = useGasPrice(selectedToken?.chainId);

  const fetchRecent = useCallback(async () => {
    if (!user || !supabase) return;
    setIsRecentLoading(true);
    try {
      const { data, error } = await supabase
        .from('recent_recipients_live')
        .select('*')
        .eq('sender_id', user.id)
        .limit(10);
      
      if (!error && data) {
        setRecentRecipients(data as RecentRecipient[]);
      }
    } catch (e) {
      console.warn("Failed to fetch recent recipients:", e);
    } finally {
      setIsRecentLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchRecent();
  }, [fetchRecent]);

  useEffect(() => {
    if (allAssets.length === 0 || initializedRef.current) return;
    const symbol = searchParams.get('symbol');
    const chainIdParam = parseInt(searchParams.get('chainId') || '');
    let targetToken: AssetRow | null = null;
    if (symbol && !isNaN(chainIdParam)) {
        const available = getAvailableAssetsForChain(chainIdParam);
        targetToken = available.find(a => a.symbol === symbol) || null;
    }
    if (!targetToken) {
        targetToken = allAssets.find(a => a.chainId === viewingNetwork.chainId) || allAssets[0];
    }
    if (targetToken) {
        setSelectedToken({ ...targetToken });
        initializedRef.current = true;
    }
  }, [allAssets, searchParams, getAvailableAssetsForChain, viewingNetwork.chainId]);

  const activeNetwork = useMemo(() => {
    const chainId = selectedToken?.chainId || viewingNetwork.chainId;
    return allChainsMap[chainId] || viewingNetwork;
  }, [selectedToken, viewingNetwork, allChainsMap]);

  useEffect(() => {
    async function resolve() {
      if (!debouncedRecipient || debouncedRecipient.trim().length < 3) {
        setResolvedAddress('');
        setRecipientProfile(null);
        return;
      }
      const isRaw = debouncedRecipient.startsWith('0x') || debouncedRecipient.startsWith('r') || debouncedRecipient.length > 30;
      if (isRaw) {
        setResolvedAddress(debouncedRecipient);
        setRecipientProfile(null);
        return;
      }
      setIsResolving(true);
      const searchHandle = debouncedRecipient.startsWith('@') 
        ? debouncedRecipient.substring(1).toLowerCase().trim() 
        : debouncedRecipient.toLowerCase().trim();
      try {
        const { data } = await supabase!.rpc('fetch_recipient_details', {
          search_account_number: searchHandle,
          selected_chain: activeNetwork.type || 'evm'
        });
        if (data && data[0]?.target_address) {
          setResolvedAddress(data[0].target_address);
          setRecipientProfile({
            avatar: data[0].profile_pic,
            verified: data[0].verified,
            name: searchHandle
          });
        } else {
          setResolvedAddress('');
          setRecipientProfile(null);
        }
      } catch (e) {
        setResolvedAddress('');
        setRecipientProfile(null);
      } finally {
        setIsResolving(false);
      }
    }
    resolve();
  }, [debouncedRecipient, activeNetwork.type]);

  const saveToHistory = async (recipientData: { accountNumber: string, address: string, chain: string }) => {
    if (!user || !supabase) return;
    try {
      await supabase.rpc('update_transaction_history', {
        p_recipient_account: recipientData.accountNumber,
        p_blockchain: recipientData.chain,
        p_address: recipientData.address
      });
      fetchRecent();
    } catch (e) {}
  };

  const handleSendRequest = async () => {
    if (!wallets || !selectedToken || !resolvedAddress) return;
    setIsSubmitting(true);
    setTxStatus('pending');
    let polkadotApi: ApiPromise | null = null;
    try {
      if (activeNetwork.type === 'xrp') {
        const xrpWalletData = wallets.find(w => w.type === 'xrp');
        const client = new xrpl.Client(activeNetwork.rpcUrl);
        await client.connect();
        const wallet = xrpl.Wallet.fromSeed(xrpWalletData!.seed!);
        const prepared = await client.autofill({ TransactionType: "Payment", Account: wallet.address, Amount: xrpl.xrpToDrops(amount), Destination: resolvedAddress });
        const result = await client.submitAndWait(wallet.sign(prepared).tx_blob);
        if (result.result.meta && typeof result.result.meta !== 'string' && result.result.meta.TransactionResult === "tesSUCCESS") {
          setTxHash(result.result.hash);
          setTxStatus('success');
          saveToHistory({ accountNumber: recipientProfile?.name || recipientInput, address: resolvedAddress, chain: 'xrp' });
          setTimeout(() => setIsReceiptOpen(true), 1500);
        } else throw new Error("Transaction Failed");
        await client.disconnect();
      } else if (activeNetwork.type === 'polkadot') {
        await cryptoWaitReady();
        const provider = new WsProvider(activeNetwork.rpcUrl, 10000);
        polkadotApi = await ApiPromise.create({ provider });
        await polkadotApi.isReadyOrError;
        const keyring = new Keyring({ type: 'sr25519' });
        const userMnemonic = localStorage.getItem(`wallet_mnemonic_${user?.id}`);
        if (!userMnemonic) throw new Error("Keys missing.");
        const wallet = keyring.addFromMnemonic(userMnemonic);
        const hash = await polkadotApi.tx.balances.transferKeepAlive(resolvedAddress, BigInt(Math.floor(parseFloat(amount) * 10_000_000_000))).signAndSend(wallet);
        setTxHash(hash.toHex());
        setTxStatus('success');
        saveToHistory({ accountNumber: recipientProfile?.name || recipientInput, address: resolvedAddress, chain: 'polkadot' });
        setTimeout(() => setIsReceiptOpen(true), 1500);
      } else {
        const provider = new ethers.JsonRpcProvider(activeNetwork.rpcUrl.replace('{API_KEY}', infuraApiKey!), undefined, { staticNetwork: true });
        const wallet = new ethers.Wallet(wallets.find(w => w.type === 'evm')!.privateKey!, provider);
        const tx = selectedToken.isNative 
          ? await wallet.sendTransaction({ to: resolvedAddress, value: ethers.parseUnits(amount, selectedToken.decimals || 18) }) 
          : await (new ethers.Contract(selectedToken.address, ["function transfer(address to, uint256 amount) returns (bool)"], wallet)).transfer(resolvedAddress, ethers.parseUnits(amount, selectedToken.decimals || 18));
        setTxHash(tx.hash);
        setTxStatus('success');
        saveToHistory({ accountNumber: recipientProfile?.name || recipientInput, address: resolvedAddress, chain: 'evm' });
        setTimeout(() => setIsReceiptOpen(true), 1500);
      }
    } catch (e: any) {
      setTxStatus('error');
      setTxError(e.message);
      toast({ title: "Send Failed", description: e.message, variant: "destructive" });
      setTimeout(() => setIsReceiptOpen(true), 1500);
    } finally {
      if (polkadotApi) await polkadotApi.disconnect();
      setIsSubmitting(false);
    }
  };

  const handleRecentClick = (recent: RecentRecipient) => {
    setRecipientInput(`@${recent.recipient_account_number}`);
    toast({ title: "Recipient Auto-filled" });
  };

  const handleTokenSelect = (token: AssetRow) => {
    setSelectedToken({ ...token });
    setIsTokenSideSheetOpen(false);
    setIsNetworkSheetOpen(false);
  };

  const balance = parseFloat(selectedToken?.balance || '0');
  const amountUsdValue = (parseFloat(amount) || 0) * (selectedToken?.priceUsd || 0);
  const canSend = resolvedAddress.length > 0 && parseFloat(amount) > 0 && parseFloat(amount) <= balance && !isSubmitting;

  return (
    <div className="flex flex-col h-screen bg-[#050505] text-foreground relative overflow-hidden">
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.02] select-none">
          <div className="text-[40rem] font-black italic transform -rotate-12 text-white">W</div>
      </div>

      <TransactionStatusCard 
        isVisible={txStatus !== 'idle'} 
        status={txStatus === 'idle' ? 'pending' : txStatus} 
        senderAvatar={profile?.photo_url}
        senderName={profile?.username || 'You'}
        recipientAvatar={recipientProfile?.avatar}
        recipientName={recipientProfile?.name || resolvedAddress.slice(0, 6)}
        token={selectedToken ? { symbol: selectedToken.symbol, iconUrl: selectedToken.iconUrl, chainId: selectedToken.chainId } : undefined}
        isRawAddress={!recipientProfile}
      />

      <header className="p-4 flex items-center justify-between border-b border-white/5 sticky top-0 bg-black/50 backdrop-blur-2xl z-50">
        <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-xl">
                <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
                <h1 className="text-xs font-black uppercase tracking-[0.2em] leading-none text-white/90">Send Assets</h1>
                <div className="flex items-center gap-1.5 mt-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-[8px] text-muted-foreground uppercase font-black tracking-tighter">System Online</span>
                </div>
            </div>
        </div>
        
        <div className="flex items-center gap-2 bg-primary/10 border border-primary/20 px-3 py-1.5 rounded-full">
            <TokenLogoDynamic logoUrl={activeNetwork.iconUrl} alt={activeNetwork.name} size={18} chainId={activeNetwork.chainId} name={activeNetwork.name} symbol={activeNetwork.symbol}/>
            <span className="text-[9px] font-black text-primary uppercase tracking-widest">{activeNetwork.name}</span>
        </div>
      </header>

      <main className="flex-1 overflow-hidden relative z-10">
        <ScrollArea className="h-full">
          <div className="p-6 space-y-8 pb-48 max-w-lg mx-auto">
            {recentRecipients.length > 0 && (
                <div className="space-y-3">
                    <div className="flex items-center gap-2 px-2">
                        <History className="w-3 h-3 text-primary" />
                        <span className="text-[9px] font-black text-white/40 uppercase tracking-[0.2em]">Recent</span>
                    </div>
                    <div className="flex gap-4 overflow-x-auto pb-2 thin-scrollbar">
                        {recentRecipients.map((r) => (
                            <button key={r.id} onClick={() => handleRecentClick(r)} className="flex flex-col items-center gap-2 min-w-[64px]">
                                <Avatar className="w-12 h-12 border-2 border-white/5 bg-white/5"><AvatarImage src={r.current_pfp} /><AvatarFallback>{r.recipient_account_number[0].toUpperCase()}</AvatarFallback></Avatar>
                                <span className="text-[8px] font-black text-white/60 truncate w-16">@{r.recipient_account_number}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <div className="space-y-3">
                <Label className="text-[10px] font-black text-white/60 uppercase tracking-[0.2em] pl-2">Asset</Label>
                <button onClick={() => setIsNetworkSheetOpen(true)} className="w-full flex items-center justify-between p-5 rounded-[2.5rem] bg-white/[0.03] border border-white/10 group">
                    <div className="flex items-center gap-4"><TokenLogoDynamic logoUrl={selectedToken?.iconUrl} alt={selectedToken?.name || ''} size={44} chainId={selectedToken?.chainId} name={selectedToken?.name} symbol={selectedToken?.symbol}/>
                    <div className="text-left"><h2 className="text-lg font-black text-white uppercase">{selectedToken?.symbol || 'Select Asset'}</h2><p className="text-[10px] text-muted-foreground uppercase">{selectedToken?.name}</p></div></div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </button>
            </div>
            
            <div className="space-y-3">
                <Label className="text-[10px] font-black text-white/60 uppercase tracking-[0.2em] pl-2">Recipient</Label>
                <div className="bg-white/[0.03] border border-white/10 rounded-[2rem] p-2 space-y-2">
                  <div className="flex items-center gap-2 px-2">
                    <Search className="w-4 h-4 text-muted-foreground/40" />
                    <Input placeholder="Account Number or Address" value={recipientInput} onChange={(e) => setRecipientInput(e.target.value)} className="h-12 bg-transparent border-none text-sm font-mono focus-visible:ring-0 text-white flex-1" />
                    {isResolving && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
                  </div>
                  {recipientProfile && <div className="mx-2 mb-2 p-3 rounded-2xl bg-primary/10 border border-primary/20 flex items-center gap-3"><Avatar className="w-10 h-10 rounded-xl"><AvatarImage src={recipientProfile.avatar} /><AvatarFallback>{recipientProfile.name[0].toUpperCase()}</AvatarFallback></Avatar>
                  <div className="flex-1"><p className="text-[8px] font-black text-primary uppercase">Verified Identity</p><p className="text-sm font-black text-white">@{recipientProfile.name}</p></div><ShieldCheck className="w-5 h-5 text-primary" /></div>}
                </div>
            </div>
            
            <div className="space-y-3">
                <Label className="text-[10px] font-black text-white/60 uppercase tracking-[0.2em] pl-2">Amount</Label>
                <div className="bg-white/[0.03] border border-white/10 rounded-[2.5rem] p-6 transition-all relative group">
                  <div className="flex items-baseline justify-between gap-4">
                    <Input type="number" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} className="bg-transparent border-none text-[clamp(1.5rem,8vw,3rem)] font-black p-0 h-auto focus-visible:ring-0 text-white" />
                    <span className="text-xl font-black text-white/20 uppercase">{selectedToken?.symbol}</span>
                  </div>
                  <div className="mt-2 text-xs font-bold text-muted-foreground/40 italic">≈ {formatFiat(amountUsdValue)}</div>
                </div>
            </div>

            <div className="p-6 rounded-[2rem] bg-[#0a0a0c] border border-primary/20 space-y-4">
                <div className="flex justify-between items-center text-[11px]"><span className="text-white/40 font-bold uppercase">Native Fee</span><p className="font-bold text-white">{gasData.nativeFee} {activeNetwork.symbol}</p></div>
                <div className="flex justify-between items-center text-[11px]"><span className="text-white/40 font-bold uppercase">Arrival</span><span className="font-bold text-white">{gasData.estimatedTime}</span></div>
            </div>
          </div>
        </ScrollArea>
        
        <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black via-black/95 to-transparent z-40">
          <div className="max-w-md mx-auto">
            {amount && parseFloat(amount) > balance && <div className="flex items-center gap-2 p-3 rounded-2xl bg-destructive/10 text-destructive text-[10px] mb-4 font-black uppercase"><AlertCircle className="w-3.5 h-3.5" /> Insufficient balance</div>}
            <Button className={cn("w-full h-16 rounded-[2rem] text-lg font-black", canSend ? "bg-primary text-white shadow-primary/20 shadow-2xl" : "bg-zinc-900 text-zinc-600")} disabled={!canSend} onClick={handleSendRequest}>{isSubmitting ? <Loader2 className="w-6 h-6 animate-spin" /> : "Sign & Authorize"}</Button>
          </div>
        </div>
      </main>
      
      <Sheet open={isNetworkSheetOpen} onOpenChange={setIsNetworkSheetOpen}>
        <SheetContent side="bottom" className="bg-black/95 rounded-t-[3.5rem] p-0 h-[80vh] overflow-hidden"><ScrollArea className="h-full p-6"><div className="grid grid-cols-1 gap-2 pb-32">{allChains.map((chain) => (<button key={chain.chainId} onClick={() => { setSelectedNetworkForSelection(chain); setIsTokenSideSheetOpen(true); }} className="flex items-center justify-between p-4 rounded-3xl border border-white/10"><div className="flex items-center gap-4"><TokenLogoDynamic logoUrl={chain.iconUrl} alt={chain.name} size={36} chainId={chain.chainId} name={chain.name} symbol={chain.symbol} /><div className="text-left"><p className="font-black text-sm text-white">{chain.name}</p></div></div><ChevronRight className="w-4 h-4 text-muted-foreground" /></button>))}</div></ScrollArea></SheetContent>
      </Sheet>
      
      <Sheet open={isTokenSideSheetOpen} onOpenChange={setIsTokenSideSheetOpen}>
        <SheetContent side="right" className="bg-black/95 w-full sm:max-w-[450px] p-0 flex flex-col h-full shadow-2xl"><ScrollArea className="flex-1 p-4"><div className="space-y-2 pb-24">{selectedNetworkForSelection && getAvailableAssetsForChain(selectedNetworkForSelection.chainId).map((token) => (<button key={token.symbol} onClick={() => handleTokenSelect(token)} className="w-full flex items-center justify-between p-4 rounded-[2rem] bg-white/5"><div className="flex items-center gap-4"><TokenLogoDynamic logoUrl={token.iconUrl} alt={token.symbol} size={44} chainId={token.chainId} symbol={token.symbol} name={token.name} /><div><p className="font-black text-base text-white">{token.symbol}</p><p className="text-[10px] text-muted-foreground">{token.name}</p></div></div></button>))}</div></ScrollArea></SheetContent>
      </Sheet>

      <TransactionReceiptSheet 
        isOpen={isReceiptOpen}
        onOpenChange={(open) => { setIsReceiptOpen(open); if(!open) setTxStatus('idle'); }}
        status={txStatus === 'error' ? 'error' : 'success'}
        amount={amount}
        token={selectedToken}
        recipientName={recipientProfile?.name || resolvedAddress.slice(0, 8)}
        recipientAddress={resolvedAddress}
        txHash={txHash}
        errorReason={txError}
        fee={`${gasData.nativeFee} ${activeNetwork.symbol}`}
        networkName={activeNetwork.name}
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
