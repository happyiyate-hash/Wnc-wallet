
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from "next/navigation";
import { useUser } from "@/contexts/user-provider";
import { useWallet } from "@/contexts/wallet-provider";
import { useCurrency } from "@/contexts/currency-provider";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  ShieldCheck, 
  Copy, 
  CheckCircle2, 
  RefreshCw, 
  Store, 
  Users, 
  ChevronRight, 
  ArrowUpRight,
  TrendingUp,
  Lock,
  QrCode,
  Fingerprint,
  Sparkles,
  Loader2,
  AlertCircle
} from "lucide-react";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from '@/lib/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

export default function ProfilePage() {
    const router = useRouter();
    const { user, profile, refreshProfile } = useUser();
    const { allAssets, viewingNetwork, wallets, getAddressForChain } = useWallet();
    const { formatFiat } = useCurrency();
    const { toast } = useToast();
    const [isCopied, copy] = useCopyToClipboard();
    const [isSyncing, setIsSyncing] = useState(false);

    // Identity State
    const [identity, setIdentity] = useState<string | null>(null);
    const [isIdentityLoading, setIsIdentityLoading] = useState(true);
    const [isClaimModalOpen, setIsClaimModalOpen] = useState(false);
    const [claimHandle, setClaimHandle] = useState('');
    const [isClaiming, setIsClaiming] = useState(false);

    useEffect(() => {
        if (profile?.username) {
            setIdentity(profile.username);
            setIsIdentityLoading(false);
        } else if (!user) {
            setIsIdentityLoading(false);
        }
    }, [profile, user]);

    const handleClaim = async () => {
        if (!claimHandle || !wallets || !supabase || !user) return;
        setIsClaiming(true);
        try {
            // Stage 1: Update wevina_profiles with the handle (Account ID)
            const { error: profileError } = await supabase
                .from('wevina_profiles')
                .upsert({
                    user_id: user.id,
                    account_number: claimHandle.trim().toLowerCase(),
                    display_name: profile?.name || user.email?.split('@')[0] || 'Institutional User'
                }, { onConflict: 'user_id' });

            if (profileError) throw profileError;

            // Stage 2: Register Identities for active wallets
            const identityPayload = wallets.map(w => ({
                user_id: user.id,
                blockchain_name: w.type,
                wallet_address: w.address
            }));

            const { error: identityError } = await supabase
                .from('user_identity')
                .upsert(identityPayload, { onConflict: 'user_id,blockchain_name' });

            if (identityError) throw identityError;

            await refreshProfile();
            setIsClaimModalOpen(false);
            toast({ title: "Identity Claimed!", description: `You are now searchable as @${claimHandle.toLowerCase()}` });
        } catch (e: any) {
            toast({ 
                title: "Claim Failed", 
                description: e.message || "This handle might be taken or identity sync failed.", 
                variant: "destructive" 
            });
        } finally {
            setIsClaiming(false);
        }
    };

    // Identity Resolution
    const displayName = profile?.name || profile?.username || user?.email?.split('@')[0] || 'Institutional User';
    const address = wallets ? getAddressForChain(viewingNetwork, wallets) : null;

    // Portfolio Value Calculation
    const totalPortfolioValue = useMemo(() => {
        return allAssets.reduce((sum, asset) => sum + (asset.fiatValueUsd ?? 0), 0);
    }, [allAssets]);

    const handleSync = () => {
        setIsSyncing(true);
        setTimeout(() => setIsSyncing(false), 2000);
    };

    const ProfileAction = ({ 
        icon: Icon, 
        label, 
        value, 
        onClick, 
        badge,
        accentColor = "text-primary"
    }: {
        icon: any;
        label: string;
        value?: string;
        onClick?: () => void;
        badge?: string;
        accentColor?: string;
    }) => (
        <button 
            onClick={onClick}
            className="w-full flex items-center justify-between p-5 rounded-[2rem] bg-white/[0.03] border border-white/5 hover:bg-white/[0.06] transition-all group active:scale-[0.98]"
        >
            <div className="flex items-center gap-4">
                <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center bg-black/40 border border-white/5 transition-transform group-hover:scale-110", accentColor)}>
                    <Icon className="w-6 h-6" />
                </div>
                <div className="text-left">
                    <p className="text-sm font-bold text-white/90">{label}</p>
                    {value && <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-black opacity-60 mt-0.5">{value}</p>}
                </div>
            </div>
            <div className="flex items-center gap-3">
                {badge && (
                    <span className="px-2 py-1 rounded-lg bg-primary/10 text-primary text-[8px] font-black uppercase tracking-tighter">
                        {badge}
                    </span>
                )}
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
            </div>
        </button>
    );

    return (
        <div className="flex flex-col h-screen bg-[#050505] text-foreground relative overflow-hidden">
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03] select-none">
                <div className="text-[40rem] font-black italic transform -rotate-12">W</div>
            </div>

            <header className="p-4 flex items-center justify-between border-b border-white/5 bg-black/50 backdrop-blur-2xl sticky top-0 z-50 px-6">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                    <h1 className="text-xs font-black uppercase tracking-[0.2em] text-white/90">Ecosystem Profile</h1>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={handleSync} className={cn("rounded-xl", isSyncing && "animate-spin")}>
                        <RefreshCw className="w-4 h-4 text-muted-foreground" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => router.push('/settings')} className="rounded-xl">
                        <Lock className="w-4 h-4 text-muted-foreground" />
                    </Button>
                </div>
            </header>

            <main className="flex-1 overflow-y-auto thin-scrollbar pb-32 relative z-10">
                <div className="max-w-2xl mx-auto p-6 space-y-8">
                    
                    <section className="flex flex-col items-center text-center space-y-4">
                        <div className="relative group">
                            <div className="absolute -inset-4 bg-primary/20 rounded-[3rem] blur-2xl opacity-50 group-hover:opacity-100 transition-opacity" />
                            <Avatar className="w-28 h-28 rounded-[2.5rem] border-2 border-primary/30 shadow-2xl relative z-10">
                                <AvatarImage src={profile?.photo_url} className="object-cover" />
                                <AvatarFallback className="bg-gradient-to-br from-primary to-purple-600 text-white text-4xl font-black rounded-[2.5rem]">
                                    {displayName.slice(0, 1)}
                                </AvatarFallback>
                            </Avatar>
                            <div className="absolute -bottom-2 -right-2 z-20 bg-primary p-2 rounded-2xl border-4 border-[#050505] shadow-xl">
                                <ShieldCheck className="w-5 h-5 text-white" />
                            </div>
                        </div>
                        
                        <div className="space-y-2 flex flex-col items-center w-full">
                            {isIdentityLoading ? (
                                <Skeleton className="h-6 w-24 bg-white/5 rounded-full" />
                            ) : identity ? (
                                <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 animate-in fade-in zoom-in duration-500">
                                    <span className="text-[11px] font-black text-primary uppercase tracking-[0.1em]">@{identity}</span> <button 
                                        onClick={() => copy(`@${identity}`)}
                                        className="p-1 hover:bg-primary/20 rounded-md transition-colors"
                                    >
                                        <Copy className="w-2.5 h-2.5 text-primary" />
                                    </button>
                                </div>
                            ) : (
                                <Button 
                                    onClick={() => setIsClaimModalOpen(true)}
                                    className="rounded-full bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 h-9 px-6 text-[10px] font-black uppercase tracking-widest gap-2 animate-pulse"
                                >
                                    <Sparkles className="w-3.5 h-3.5" /> Claim Webiv ID
                                </Button>
                            )}

                            <div className="pt-2">
                                <h2 className="text-3xl font-black text-white tracking-tight leading-none">{displayName}</h2>
                                <div className="flex items-center justify-center gap-1.5 mt-2">
                                    <ShieldCheck className="w-2.5 h-2.5 text-primary" />
                                    <span className="text-[8px] font-black text-primary uppercase tracking-tighter">Verified Institutional Node</span>
                                </div>
                            </div>
                        </div>
                    </section>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="p-6 rounded-[2.5rem] bg-white/[0.03] border border-white/5 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 blur-2xl rounded-full -mr-12 -mt-12" />
                            <TrendingUp className="w-5 h-5 text-primary mb-3" />
                            <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1">Portfolio Balance</p>
                            <p className="text-xl font-black text-white tabular-nums truncate">{formatFiat(totalPortfolioValue)}</p>
                        </div>
                        <div className="p-6 rounded-[2.5rem] bg-white/[0.03] border border-white/5 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 blur-2xl rounded-full -mr-12 -mt-12" />
                            <ArrowUpRight className="w-5 h-5 text-emerald-400 mb-3" />
                            <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1">Pending Earnings</p>
                            <p className="text-xl font-black text-white tabular-nums truncate">{formatFiat(profile?.wnc_earnings || 0)}</p>
                        </div>
                    </div>

                    <section className="space-y-3">
                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] px-2">Secure Vault Hub</p>
                        <div className="p-6 rounded-[2.5rem] bg-primary/5 border border-primary/20 space-y-4 shadow-2xl relative group">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <QrCode className="w-4 h-4 text-primary" />
                                    <span className="text-[10px] font-black uppercase tracking-widest text-white/80">Primary Vault Address</span>
                                </div>
                                <div className={cn(
                                    "flex items-center gap-1.5 text-[8px] font-black uppercase tracking-widest",
                                    isSyncing ? "text-primary animate-pulse" : "text-green-500"
                                )}>
                                    <div className={cn("w-1  h-1 rounded-full bg-current", !isSyncing && "animate-pulse")} />
                                    {isSyncing ? "Syncing..." : "Cloud Verified"}
                                </div>
                            </div>
                            
                            <div 
                                onClick={() => address && copy(address)}
                                className="bg-black/40 border border-white/10 rounded-2xl p-4 flex items-center justify-between cursor-pointer hover:border-primary/50 transition-all"
                            >
                                <p className="text-xs font-mono text-white/70 break-all leading-relaxed mr-4">
                                    {address || (wallets ? 'Resolving Ecosystem Address...' : 'Initializing Secure Node...')}
                                </p>
                                <div className={cn(
                                    "shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-all",
                                    isCopied ? "bg-green-500/20 text-green-500" : "bg-primary/20 text-primary"
                                )}>
                                    {isCopied ? <CheckCircle2 className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                                </div>
                            </div>
                        </div>
                    </section>

                    <section className="space-y-3">
                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] px-2">Institutional Actions</p>
                        <div className="space-y-2">
                            <ProfileAction 
                                icon={Store} 
                                label="View My Business" 
                                value="SmarterSeller Shop" 
                                accentColor="text-emerald-400" 
                                badge="Live"
                                onClick={() => router.push('/browse')} 
                            />
                            <ProfileAction 
                                icon={Users} 
                                label="Invite & Earn" 
                                value="Referral Program" 
                                accentColor="text-blue-400" 
                                onClick={() => router.push('/tokens/add')} 
                            />
                            <ProfileAction 
                                icon={Fingerprint} 
                                label="Webiv ID Status" 
                                value={identity ? `@${identity}` : 'Unclaimed Handle'} 
                                accentColor="text-purple-400" 
                                onClick={() => !identity && setIsClaimModalOpen(true)} 
                            />
                        </div>
                    </section>

                    <div className="pt-4 flex flex-col items-center gap-3">
                        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/5">
                            <RefreshCw className={cn("w-3 h-3 text-muted-foreground", isSyncing && "animate-spin")} />
                            <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">
                                Last Synced: {isSyncing ? "Just Now" : "2 mins ago"}
                            </span>
                        </div>
                        <p className="text-[8px] text-muted-foreground/40 uppercase font-black tracking-widest text-center max-w-[200px] leading-relaxed">
                            Secured by SmarterSeller Cloud Protocol v2.1.0
                        </p>
                    </div>
                </div>
            </main>

            <Dialog open={isClaimModalOpen} onOpenChange={setIsClaimModalOpen}>
                <DialogContent className="bg-[#0a0a0c] border-white/10 rounded-[2.5rem] p-8 max-w-[95vw] sm:max-w-[400px] shadow-2xl">
                    <DialogHeader className="space-y-4">
                        <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center text-primary mx-auto">
                            <Fingerprint className="w-8 h-8" />
                        </div>
                        <DialogTitle className="text-2xl font-black text-center text-white">Choose Your Webiv ID</DialogTitle>
                        <DialogDescription className="text-center text-zinc-400 leading-relaxed font-medium">
                            Set a human-readable identifier for your multi-chain vault. This handle will be used for peer-to-peer transfers.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="mt-6 space-y-4">
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-primary font-black text-lg">@</span>
                            <Input 
                                placeholder="username"
                                value={claimHandle}
                                onChange={(e) => setClaimHandle(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                                className="h-14 bg-white/5 border-white/10 pl-10 rounded-2xl focus-visible:ring-primary text-lg font-bold"
                            />
                        </div>

                        <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10 flex gap-3">
                            <AlertCircle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                            <p className="text-[10px] text-muted-foreground leading-relaxed">
                                Handles must be 3-15 characters. Once claimed, this handle will be linked to your EVM, XRP, and Polkadot addresses.
                            </p>
                        </div>

                        <Button 
                            className="w-full h-14 rounded-2xl font-black text-lg bg-primary hover:bg-primary/90 shadow-xl shadow-primary/20"
                            onClick={handleClaim}
                            disabled={isClaiming || claimHandle.length < 3}
                        >
                            {isClaiming ? <Loader2 className="w-6 h-6 animate-spin" /> : "Claim Handle"}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
