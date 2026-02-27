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
  
  // RECENT RECIPIENTS STATE (Using Live View)
  const [recentRecipients, setRecentRecipients] = useState<RecentRecipient[]>([]);
  const [isRecentLoading, setIsRecentLoading] = useState(false);

  // IDENTITY RESOLUTION STATES
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

  // Live Gas Data Integration
  const gasData = useGasPrice(selectedToken?.chainId);

  // 1. FETCH RECENT RECIPIENTS FROM LIVE VIEW
  const fetchRecent = useCallback(async () => {
    if (!user || !supabase) return;
    setIsRecentLoading(true);
    try {
      const { data, error } = await supabase
        .from('recent_recipients_live') // Use the production-ready view
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

  // SECURE INITIALIZATION
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
    async function resolve() {
      if (!debouncedRecipient || debouncedRecipient.trim().length < 3) {
        setResolvedAddress('');
        setRecipientProfile(null);
        return;
      }

      // 1. Detect Raw Addresses
      const isRaw = debouncedRecipient.startsWith('0x') || 
                    debouncedRecipient.startsWith('r') || 
                    debouncedRecipient.length > 30;

      if (isRaw) {
        setResolvedAddress(debouncedRecipient);
        setRecipientProfile(null);
        return;
      }

      // 2. Resolve Human-Readable Handle (@handle or handle)
      setIsResolving(true);
      
      // NORMALIZATION: Strip '@' and lowercase for DB lookup
      const searchHandle = debouncedRecipient.startsWith('@') 
        ? debouncedRecipient.substring(1).toLowerCase().trim() 
        : debouncedRecipient.toLowerCase().trim();

      try {
        const { data, error } = await supabase!.rpc('fetch_recipient_details', {
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
        console.warn("Identity lookup failed:", e);
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
      // Use atomic RPC for history update (Production-ready Section 5)
      await supabase.rpc('update_transaction_history', {
        p_recipient_account: recipientData.accountNumber,
        p_blockchain: recipientData.chain,
        p_address: recipientData.address
      });
      fetchRecent(); // Refresh the bar immediately
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

  return null; // Awaiting UI Parts...
}

export default function SendPage() {
  return (
    <Suspense fallback={<div className="flex h-screen w-full items-center justify-center bg-[#050505]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
      <SendClient />
    </Suspense>
  );
}
