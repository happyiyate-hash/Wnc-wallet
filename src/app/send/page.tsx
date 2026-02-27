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

function SendClient() {
  const { viewingNetwork, wallets, balances, infuraApiKey, allChains, allAssets, getAvailableAssetsForChain, prices, allChainsMap } = useWallet();
  const { formatFiat } = useCurrency();
  const { user } = useUser();
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();

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

    if (targetToken && (!selectedToken || selectedToken.symbol !== targetToken.symbol || selectedToken.chainId !== targetToken.chainId)) {
        setSelectedToken({ ...targetToken });
        initializedRef.current = true;
    }
  }, [allAssets, searchParams, getAvailableAssetsForChain, viewingNetwork.chainId, selectedToken]);

  const activeNetwork = useMemo(() => {
    const chainId = selectedToken?.chainId || viewingNetwork.chainId;
    return allChainsMap[chainId] || viewingNetwork;
  }, [selectedToken, viewingNetwork, allChainsMap]);

  // RECIPIENT IDENTITY RESOLUTION ENGINE
  useEffect(() => {
    let isMounted = true;

    async function resolve() {
      const input = debouncedRecipient?.trim();
      
      if (!input || input.length < 3) {
        if (isMounted) {
          setResolvedAddress('');
          setRecipientProfile(null);
          setIsResolving(false);
        }
        return;
      }

      // 1. Detect Raw Addresses
      const isRaw = input.startsWith('0x') || input.startsWith('r') || input.length > 30;

      if (isRaw) {
        if (isMounted) {
          setResolvedAddress(input);
          setRecipientProfile(null);
          setIsResolving(false);
        }
        return;
      }

      // 2. Resolve via Account ID Routing
      if (isMounted) setIsResolving(true);
      
      const searchHandle = input.startsWith('@') 
        ? input.substring(1).toLowerCase().trim() 
        : input.toLowerCase().trim();

      try {
        const { data, error } = await supabase!.rpc('fetch_recipient_details', {
          search_account_number: searchHandle,
          selected_chain: activeNetwork.type || 'evm'
        });

        if (!isMounted) return;

        if (!error && data && data[0]) {
          const result = data[0];
          
          // Set profile data (always present if user exists)
          setRecipientProfile({
            avatar: result.profile_pic,
            verified: result.verified,
            name: result.name || searchHandle
          });

          // Set address (only present if wallet connected to this network)
          if (result.target_address) {
            setResolvedAddress(result.target_address);
          } else {
            setResolvedAddress('');
            toast({
              title: "Network Not Ready",
              description: `Recipient found, but they haven't connected their wallet to ${activeNetwork.name} yet.`,
              variant: "destructive"
            });
          }
        } else {
          setResolvedAddress('');
          setRecipientProfile(null);
        }
      } catch (e) {
        console.warn("Identity lookup failed:", e);
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
  }, [debouncedRecipient, activeNetwork.type, activeNetwork.name, toast]);

  const saveToHistory = async (recipientData: { accountNumber: string, address: string, chain: string }) => {
    if (!user || !supabase) return;
    try {
      await supabase.rpc('update_transaction_history', {
        p_recipient_account: recipientData.accountNumber,
        p_blockchain: recipientData.chain,
        p_address: recipientData.address
      });
      fetchRecent();
    } catch (e) {
      console.warn("Failed to save transaction history:", e);
    }
  };

  const handleSendRequest = async () => {
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
        if (result.result.meta && typeof result.result.meta !== 'string' && result.result.meta.TransactionResult === "tesSUCCESS") {
          setTxHash(result.result.hash);
          setStep('success');
          saveToHistory({ accountNumber: recipientProfile?.name || recipientInput, address: resolvedAddress, chain: 'xrp' });
        }
        await client.disconnect();
      } else if (activeNetwork.type === 'polkadot') {
        await cryptoWaitReady();
        const provider = new WsProvider(activeNetwork.rpcUrl, 10000);
        polkadotApi = await ApiPromise.create({ provider });
        await polkadotApi.isReadyOrError;
        const keyring = new Keyring({ type: 'sr25519' });
        const userMnemonic = localStorage.getItem(`wallet_mnemonic_${user?.id}`);
        if (!userMnemonic) throw new Error("Local keys missing.");
        const wallet = keyring.addFromMnemonic(userMnemonic);
        const planckAmount = BigInt(Math.floor(parseFloat(amount) * 10_000_000_000));
        const hash = await polkadotApi.tx.balances.transferKeepAlive(resolvedAddress, planckAmount).signAndSend(wallet);
        setTxHash(hash.toHex());
        setStep('success');
        saveToHistory({ accountNumber: recipientProfile?.name || recipientInput, address: resolvedAddress, chain: 'polkadot' });
      } else {
        const evmWalletData = wallets.find(w => w.type === 'evm');
        const provider = new ethers.JsonRpcProvider(activeNetwork.rpcUrl.replace('{API_KEY}', infuraApiKey!), undefined, { staticNetwork: true });
        const wallet = new ethers.Wallet(evmWalletData!.privateKey!, provider);
        const decimals = selectedToken.decimals || 18;
        let tx = selectedToken.isNative 
          ? await wallet.sendTransaction({ to: resolvedAddress, value: ethers.parseUnits(amount, decimals) }) 
          : await (new ethers.Contract(selectedToken.address, ["function transfer(address to, uint256 amount) returns (bool)"], wallet)).transfer(resolvedAddress, ethers.parseUnits(amount, decimals));
        setTxHash(tx.hash);
        setStep('success');
        saveToHistory({ accountNumber: recipientProfile?.name || recipientInput, address: resolvedAddress, chain: 'evm' });
      }
    } catch (e: any) {
      toast({ title: "Send Failed", description: e.message, variant: "destructive" });
    } finally {
      if (polkadotApi) await polkadotApi.disconnect();
      setIsSubmitting(false);
    }
  };

  const handleRecentClick = (recent: RecentRecipient) => {
    setRecipientInput(`@${recent.recipient_account_number}`);
    const targetChainType = recent.last_blockchain_used as any;
    const matchingChain = allChains.find(c => c.type === targetChainType);
    if (matchingChain) {
        const available = getAvailableAssetsForChain(matchingChain.chainId);
        const nativeToken = available.find(a => a.isNative) || available[0];
        if (nativeToken) {
            setSelectedToken({ ...nativeToken });
        }
    }
    toast({ title: "Recipient Auto-filled" });
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setRecipientInput(text);
    } catch (err) {
      toast({ title: "Clipboard Error", description: "Could not access clipboard." });
    }
  };

  const handleTokenSelect = (token: AssetRow) => {
    setSelectedToken({ ...token });
    setIsTokenSideSheetOpen(false);
    setIsNetworkSheetOpen(false);
  };

  const balance = parseFloat(selectedToken?.balance || '0');
  const amountUsdValue = (parseFloat(amount) || 0) * (selectedToken?.priceUsd || 0);
  const canSend = resolvedAddress.length > 0 && parseFloat(amount) > 0 && parseFloat(amount) <= balance && !isSubmitting;

  const gasFiatValue = useMemo(() => {
    if (!selectedToken) return 0;
    const nativeAssetId = allChainsMap[selectedToken.chainId]?.coingeckoId?.toLowerCase();
    const nativePrice = nativeAssetId ? (prices[nativeAssetId]?.price || 0) : 0;
    let price = nativePrice;
    if (price === 0 && selectedToken.isNative) price = selectedToken.priceUsd || 0;
    return parseFloat(gasData.nativeFee) * price;
  }, [gasData.nativeFee, selectedToken, prices, allChainsMap]);

  if (step === 'success') {
    return (
        <div className="p-10 text-center space-y-8 flex flex-col items-center justify-center h-screen bg-[#050505]">
            <div className="w-24 h-24 rounded-[2.5rem] bg-green-500/10 border border-green-500/20 flex items-center justify-center mb-4 relative">
                <div className="absolute inset-0 bg-green-500/20 blur-2xl rounded-full animate-pulse" />
                <CheckCircle2 className="w-12 h-12 text-green-500 relative z-10" />
            </div>
            <div className="space-y-3">
                <h2 className="text-3xl font-black tracking-tight text-white">Transaction Sent!</h2>
                <p className="text-sm text-muted-foreground font-medium max-w-xs mx-auto">Your assets are being broadcasted to the <span className="text-primary font-bold">{activeNetwork.name}</span> network.</p>
                {txHash && (
                    <div className="mt-6 p-4 rounded-2xl bg-white/5 border border-white/10 flex flex-col gap-2">
                        <p className="text-[10px] uppercase font-black tracking-widest text-white/40">Transaction Hash</p>
                        <p className="text-[10px] font-mono text-primary break-all">{txHash}</p>
                    </div>
                )}
            </div>
            <Button className="w-full h-16 rounded-[2rem] font-black text-lg mt-8 shadow-2xl shadow-primary/20" onClick={() => router.push('/')}>Return to Dashboard</Button>
        </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-[#050505] text-foreground relative overflow-hidden">
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.02] select-none">
          <div className="text-[40rem] font-black italic transform -rotate-12 text-white">W</div>
      </div>

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
            <div className="p-0.5 bg-black/40 rounded-full border border-white/5">
                <TokenLogoDynamic logoUrl={activeNetwork.iconUrl} alt={activeNetwork.name} size={18} chainId={activeNetwork.chainId} name={activeNetwork.name} symbol={activeNetwork.symbol}/>
            </div>
            <span className="text-[9px] font-black text-primary uppercase tracking-widest">{activeNetwork.name}</span>
        </div>
      </header>

      <main className="flex-1 overflow-hidden relative z-10">
        <ScrollArea className="h-full">
          <div className="p-6 space-y-8 pb-48 max-w-lg mx-auto">
            
            {recentRecipients.length > 0 && (
                <div className="space-y-3 animate-in fade-in slide-in-from-top-4 duration-700">
                    <div className="flex items-center gap-2 px-2">
                        <History className="w-3 h-3 text-primary" />
                        <span className="text-[9px] font-black text-white/40 uppercase tracking-[0.2em]">Recent Contacts</span>
                    </div>
                    <div className="flex gap-4 overflow-x-auto pb-2 thin-scrollbar">
                        {recentRecipients.map((recent) => (
                            <button 
                                key={recent.id}
                                onClick={() => handleRecentClick(recent)}
                                className="flex flex-col items-center gap-2 group min-w-[64px]"
                            >
                                <div className="relative">
                                    <div className="absolute -inset-1 bg-primary/20 rounded-full blur opacity-0 group-hover:opacity-100 transition-opacity" />
                                    <Avatar className="w-12 h-12 rounded-full border-2 border-white/5 bg-white/5 transition-transform group-active:scale-90 relative z-10">
                                        <AvatarImage src={recent.current_pfp} />
                                        <AvatarFallback className="bg-gradient-to-br from-primary/40 to-purple-600/40 text-primary text-xs font-black">
                                            {recent.recipient_account_number[0].toUpperCase()}
                                        </AvatarFallback>
                                    </Avatar>
                                </div>
                                <span className="text-[8px] font-black text-white/60 uppercase tracking-tighter truncate w-16 text-center">
                                    @{recent.recipient_account_number}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <div className="space-y-3">
                <Label className="text-[10px] font-black text-white/60 uppercase tracking-[0.2em] pl-2">Asset to Transfer</Label>
                <button 
                    onClick={() => setIsNetworkSheetOpen(true)} 
                    className="w-full flex items-center justify-between p-5 rounded-[2.5rem] bg-white/[0.03] border border-white/10 hover:bg-white/[0.06] hover:border-primary/30 transition-all group relative overflow-hidden"
                >
                    <div className="flex items-center gap-4 relative z-10">
                        <div className="p-1 rounded-full bg-black/40 border border-white/5">
                            <TokenLogoDynamic logoUrl={selectedToken?.iconUrl} alt={selectedToken?.name || ''} size={44} chainId={selectedToken?.chainId} name={selectedToken?.name} symbol={selectedToken?.symbol}/>
                        </div>
                        <div className="text-left">
                            <h2 className="text-lg font-black text-white uppercase tracking-tight">{selectedToken?.symbol || 'Select Asset'}</h2>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold opacity-60">{selectedToken?.name || 'Institutional Registry'}</p>
                        </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:translate-x-1 transition-transform relative z-10" />
                    <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-[40px] -mr-16 -mt-16 pointer-events-none" />
                </button>
            </div>
            
            <div className="space-y-3">
                <div className="flex justify-between items-center px-2">
                    <Label className="text-[10px] font-black text-white/60 uppercase tracking-[0.2em]">Recipient Details</Label>
                    <button onClick={handlePaste} className="flex items-center gap-1.5 text-[9px] font-black text-primary uppercase tracking-widest bg-primary/10 px-2.5 py-1 rounded-lg border border-primary/10 hover:bg-primary/20 transition-all">
                        <ClipboardPaste className="w-3 h-3" /> Paste
                    </button>
                </div>
                <div className="bg-white/[0.03] border border-white/10 focus-within:border-primary/50 focus-within:ring-4 focus-within:ring-primary/5 rounded-[2rem] p-2 transition-all space-y-2">
                  <div className="flex items-center gap-2 px-2">
                    <Search className="w-4 h-4 text-muted-foreground/40" />
                    <Input 
                        placeholder="Account Number or Address" 
                        value={recipientInput} 
                        onChange={(e) => setRecipientInput(e.target.value)} 
                        className="h-12 bg-transparent border-none text-sm font-mono focus-visible:ring-0 placeholder:text-zinc-700 text-white flex-1"
                    />
                    {isResolving && <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />}
                  </div>

                  {recipientProfile && (
                    <div className="mx-2 mb-2 p-3 rounded-2xl bg-primary/10 border border-primary/20 flex items-center gap-3 animate-in fade-in zoom-in duration-300">
                        <Avatar className="w-10 h-10 rounded-xl border border-primary/20">
                            <AvatarImage src={recipientProfile.avatar} />
                            <AvatarFallback className="bg-black text-primary text-xs font-black">
                                {recipientProfile.name[0].toUpperCase()}
                            </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                            <p className="text-[8px] font-black text-primary uppercase tracking-[0.2em]">Verified Identity Found</p>
                            <p className="text-sm font-black text-white tracking-tight">@{recipientProfile.name}</p>
                        </div>
                        <ShieldCheck className="w-5 h-5 text-primary" />
                    </div>
                  )}
                </div>
            </div>
            
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
                    <Input 
                      type="number" 
                      placeholder="0.00" 
                      value={amount} 
                      onChange={(e) => setAmount(e.target.value)} 
                      className="bg-transparent border-none text-[clamp(1.5rem,8vw,3rem)] font-black p-0 h-auto focus-visible:ring-0 tracking-tighter placeholder:text-zinc-800 text-white"
                    />
                    <span className="text-xl font-black text-white/20 uppercase">{selectedToken?.symbol}</span>
                  </div>
                  <div className="mt-2 text-xs font-bold text-muted-foreground/40 italic flex items-center gap-1.5">
                    ≈ {formatFiat(amountUsdValue)} <span className="opacity-50">Estimated</span>
                  </div>
                </div>
            </div>

            <div className="p-6 rounded-[2rem] bg-[#0a0a0c] border border-primary/20 space-y-4 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-primary/10 blur-3xl rounded-full -mr-12 -mt-12" />
                <div className="flex items-center gap-2 mb-2 relative z-10">
                    <ShieldCheck className="w-4 h-4 text-primary" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-white/80">Institutional Summary</span>
                </div>
                
                <div className="space-y-3 relative z-10">
                    <div className="flex justify-between items-center text-[11px]">
                        <span className="text-white/40 font-bold uppercase tracking-tighter">Network Gas</span>
                        <div className="flex items-center gap-1.5 font-bold text-white">
                            <Fuel className="w-3 h-3 text-primary" />
                            <span className={cn(gasData.status === 'loading' && "animate-pulse")}>
                                {gasData.priceGwei} Gwei
                            </span>
                        </div>
                    </div>
                    <div className="flex justify-between items-center text-[11px]">
                        <span className="text-white/40 font-bold uppercase tracking-tighter">Native Fee</span>
                        <div className="text-right">
                            <p className="font-bold text-white">{gasData.nativeFee} {activeNetwork.symbol}</p>
                            <p className="text-[9px] text-primary font-black uppercase">≈ {formatFiat(gasFiatValue)}</p>
                        </div>
                    </div>
                    <div className="flex justify-between items-center text-[11px]">
                        <span className="text-white/40 font-bold uppercase tracking-tighter">Estimated Arrival</span>
                        <div className="flex items-center gap-1.5 font-bold text-white">
                            <Timer className="w-3 h-3 text-primary" />
                            <span>{gasData.estimatedTime}</span>
                        </div>
                    </div>
                    <div className="pt-3 border-t border-white/5 flex justify-between items-center">
                        <span className="text-xs font-black uppercase text-white/40">Total Impact</span>
                        <div className="text-right">
                            <p className="text-sm font-black text-white">{amount || '0'} {selectedToken?.symbol}</p>
                            <p className="text-[10px] font-bold text-muted-foreground">≈ {formatFiat(amountUsdValue)}</p>
                        </div>
                    </div>
                </div>
            </div>
          </div>
        </ScrollArea>
        
        <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black via-black/95 to-transparent backdrop-blur-md z-40">
          <div className="max-w-md mx-auto">
            {amount && parseFloat(amount) > balance && (
              <div className="flex items-center gap-2 p-3 rounded-2xl bg-destructive/10 text-destructive text-[10px] border border-destructive/20 mb-4 font-black uppercase tracking-widest justify-center animate-in fade-in slide-in-from-bottom-2">
                <AlertCircle className="w-3.5 h-3.5" /> Insufficient {selectedToken?.symbol} balance
              </div>
            )}
            <Button 
              className={cn(
                "w-full h-16 rounded-[2rem] text-lg font-black shadow-2xl transition-all duration-300 border-b-4", 
                canSend 
                    ? "bg-primary hover:bg-primary/90 border-primary/50 shadow-primary/30 text-white" 
                    : "bg-zinc-900 border-zinc-950 opacity-50 grayscale cursor-not-allowed text-zinc-600 shadow-none"
              )} 
              disabled={!canSend} 
              onClick={handleSendRequest}
            >
              {isSubmitting ? (
                <div className="flex items-center gap-3">
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span className="animate-pulse">Broadcasting Node...</span>
                </div>
              ) : "Sign & Authorize"}
            </Button>
          </div>
        </div>
      </main>
      
      <Sheet open={isNetworkSheetOpen} onOpenChange={setIsNetworkSheetOpen}>
        <SheetContent side="bottom" className="bg-transparent border-t border-primary/20 rounded-t-[3.5rem] p-0 h-[80vh] overflow-hidden">
          <div className="absolute inset-0 bg-[#0a0a0c]/95 backdrop-blur-3xl -z-10" />
          <div className="flex flex-col h-full relative z-10">
            <div className="w-12 h-1.5 bg-white/10 rounded-full mx-auto my-4 shrink-0" />
            <SheetHeader className="mb-6 px-6 pt-4 text-center">
              <SheetTitle className="text-2xl font-black uppercase tracking-widest text-white">Switch Network</SheetTitle>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Select destination ecosystem</p>
            </SheetHeader>
            <ScrollArea className="flex-1 px-6">
              <div className="grid grid-cols-1 gap-2 pb-32">
                {allChains.map((chain) => (
                  <button 
                    key={chain.chainId} 
                    onClick={() => { setSelectedNetworkForSelection(chain); setIsTokenSideSheetOpen(true); }} 
                    style={{ borderColor: `${chain.themeColor || '#818cf8'}40`, background: `linear-gradient(135deg, ${chain.themeColor || '#818cf8'}15 0%, rgba(0,0,0,0) 100%)` }} 
                    className="flex items-center justify-between p-4 rounded-3xl border transition-all hover:bg-white/5 active:scale-[0.98]"
                  >
                    <div className="flex items-center gap-4">
                        <div className="p-1 rounded-full bg-black/40 border border-white/5">
                            <TokenLogoDynamic logoUrl={chain.iconUrl} alt={chain.name} size={36} chainId={chain.chainId} name={chain.name} symbol={chain.symbol} />
                        </div>
                        <div className="text-left">
                            <p className="font-black text-sm text-white">{chain.name}</p>
                            <p className="text-[9px] text-muted-foreground uppercase font-mono opacity-60">ID: {chain.chainId}</p>
                        </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>
        </SheetContent>
      </Sheet>
      
      <Sheet open={isTokenSideSheetOpen} onOpenChange={setIsTokenSideSheetOpen}>
        <SheetContent side="right" className="bg-[#050505]/95 backdrop-blur-2xl border-l border-white/5 w-full sm:max-w-[450px] p-0 flex flex-col h-full shadow-2xl">
          <SheetHeader className="p-6 border-b border-white/5 bg-gradient-to-b from-primary/10 to-transparent shrink-0">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => setIsTokenSideSheetOpen(false)} className="rounded-xl bg-white/5">
                    <ArrowLeft className="w-5 h-5"/>
                </Button>
                <div>
                    <SheetTitle className="text-lg font-black uppercase tracking-tight text-white">{selectedNetworkForSelection?.name}</SheetTitle>
                    <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Select Asset to Send</p>
                </div>
            </div>
          </SheetHeader>
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-2 pb-24">
              {selectedNetworkForSelection && getAvailableAssetsForChain(selectedNetworkForSelection.chainId).map((token) => { 
                const asset = (balances[selectedNetworkForSelection.chainId]?.find(b => b.symbol === token.symbol) || { ...token, balance: '0' }) as AssetRow; 
                return (
                  <button 
                    key={asset.symbol} 
                    onClick={() => handleTokenSelect(asset)} 
                    className="w-full flex items-center justify-between p-4 rounded-[2rem] bg-white/5 border border-white/5 hover:bg-white/10 hover:border-primary/20 transition-all text-left group"
                  >
                    <div className="flex items-center gap-4">
                      <TokenLogoDynamic logoUrl={asset.iconUrl} alt={asset.symbol} size={44} chainId={asset.chainId} symbol={asset.symbol} name={asset.name} />
                      <div>
                        <p className="font-black text-base text-white group-hover:text-primary transition-colors">{asset.symbol}</p>
                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">{asset.name}</p>
                      </div>
                    </div>
                    <div className="text-right">
                        <p className="font-mono text-sm font-black text-white">{parseFloat(asset.balance).toFixed(4)}</p>
                        <p className="text-[9px] text-muted-foreground uppercase font-black tracking-tighter">Available</p>
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

export default function SendPage() {
  return (
    <Suspense fallback={<div className="flex h-screen w-full items-center justify-center bg-[#050505]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
      <SendClient />
    </Suspense>
  );
}