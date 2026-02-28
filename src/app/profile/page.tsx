
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
  Lock,
  QrCode,
  Fingerprint,
  TrendingUp,
  Coins,
  User,
  ExternalLink,
  Cpu,
  Loader2,
  AlertCircle
} from "lucide-react";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { cn } from "@/lib/utils";

export default function ProfilePage() {
    const router = useRouter();
    const { user, profile, refreshProfile } = useUser();
    const { allAssets, viewingNetwork, wallets, getAddressForChain, accountNumber, isRefreshing, syncAllAddresses } = useWallet();
    const { formatFiat, rates } = useCurrency();
    const [isAddressCopied, copyAddress] = useCopyToClipboard();
    const [isIdCopied, copyId] = useCopyToClipboard();
    const [isSyncing, setIsSyncing] = useState(false);

    const displayName = profile?.name || 'Institutional User';
    const address = wallets ? getAddressForChain(viewingNetwork, wallets) : null;

    const totalPortfolioValue = useMemo(() => {
        return allAssets.reduce((sum, asset) => sum + (asset.fiatValueUsd ?? 0), 0);
    }, [allAssets]);

    const convertedEarnings = useMemo(() => {
        const wncCount = profile?.wnc_earnings || 0;
        const ngnRate = rates['NGN'] || 1650;
        const usdValue = wncCount / ngnRate;
        return formatFiat(usdValue);
    }, [profile?.wnc_earnings, rates, formatFiat]);

    const handleSync = async () => {
        setIsSyncing(true);
        try {
            await refreshProfile();
            if (wallets) await syncAllAddresses();
        } finally {
            setTimeout(() => setIsSyncing(false), 1000);
        }
    };

    const ProfileAction = ({ 
        icon: Icon, 
        label, 
        value, 
        onClick, 
        accentColor = "text-primary"
    }: {
        icon: any;
        label: string;
        value?: string;
        onClick?: () => void;
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
                    {value !== undefined && <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-black opacity-60 mt-0.5">{value}</p>}
                </div>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
        </button>
    );

    return (
        <div className="flex flex-col min-h-full bg-transparent text-foreground relative">
            <header className="p-4 flex items-center justify-between border-b border-white/5 bg-black/20 backdrop-blur-2xl sticky top-0 z-50 px-6">
                <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-primary animate-pulse" /><h1 className="text-xs font-black uppercase tracking-[0.2em] text-white/90">Identity Vault</h1></div>
                <div className="flex items-center gap-2"><Button variant="ghost" size="icon" onClick={handleSync} className={cn("rounded-xl", isSyncing && "animate-spin")}><RefreshCw className="w-4 h-4 text-muted-foreground" /></Button><Button variant="ghost" size="icon" onClick={() => router.push('/settings')} className="rounded-xl"><Lock className="w-4 h-4 text-muted-foreground" /></Button></div>
            </header>

            <main className="flex-1 p-6 space-y-10 max-w-2xl mx-auto w-full pb-32">
                    <section className="flex flex-col items-center text-center space-y-6">
                        <div className="relative group">
                            <div className="absolute -inset-4 bg-primary/20 rounded-[3rem] blur-2xl opacity-50 transition-opacity" />
                            <Avatar className="w-28 h-28 rounded-[2.5rem] border-2 border-primary/30 shadow-2xl relative z-10"><AvatarImage src={profile?.photo_url} className="object-cover" /><AvatarFallback className="bg-gradient-to-br from-primary to-purple-600 text-white text-4xl font-black rounded-[2.5rem]">{displayName.slice(0, 1)}</AvatarFallback></Avatar>
                            <div className="absolute -bottom-2 -right-2 z-20 bg-primary p-2 rounded-2xl border-4 border-[#050505] shadow-xl"><ShieldCheck className="w-5 h-5 text-white" /></div>
                        </div>
                        <div className="space-y-3 flex flex-col items-center w-full">
                            <h2 className="text-3xl font-black text-white tracking-tight leading-none">{displayName}</h2>
                            
                            {!accountNumber ? (
                                <div className="flex flex-col items-center gap-4">
                                    <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-white/5 border border-white/10 animate-pulse">
                                        <Loader2 className="w-4 h-4 animate-spin text-primary" />
                                        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Waiting for Sync...</span>
                                    </div>
                                    <Button onClick={handleSync} className="h-10 rounded-xl px-6 gap-2 bg-primary/20 border border-primary/30 text-primary hover:bg-primary/30 transition-all">
                                        <RefreshCw className="w-4 h-4" /> Initialize Registry
                                    </Button>
                                </div>
                            ) : (
                                <div 
                                    onClick={() => copyId(accountNumber)} 
                                    className="flex flex-col items-center gap-1.5 p-1 px-4 rounded-2xl bg-primary/10 border border-primary/20 cursor-pointer active:scale-95 transition-all group"
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">Account ID</span>
                                        <div className={cn("transition-colors", isIdCopied ? "text-green-500" : "text-primary opacity-40")}>
                                            {isIdCopied ? <CheckCircle2 className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                        </div>
                                    </div>
                                    <p className="text-lg font-mono font-black text-white tracking-[0.1em]">
                                        {accountNumber}
                                    </p>
                                </div>
                            )}
                            
                            <div className="flex items-center justify-center gap-1.5 pt-1"><ShieldCheck className="w-2.5 h-2.5 text-primary" /><span className="text-[8px] font-black text-primary uppercase tracking-tighter">Verified Institutional Node</span></div>
                        </div>
                    </section>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="p-6 rounded-[2.5rem] bg-gradient-to-br from-emerald-500/20 via-emerald-500/5 to-transparent border border-emerald-500/30 relative overflow-hidden shadow-2xl"><Coins className="w-5 h-5 text-emerald-400 mb-3" /><p className="text-[9px] font-black text-emerald-400/60 uppercase tracking-widest mb-1">Cloud Earnings</p><p className="text-xl font-black text-white tabular-nums truncate">{convertedEarnings}</p></div>
                        <div className="p-6 rounded-[2.5rem] bg-white/[0.03] border border-white/5 relative overflow-hidden shadow-2xl"><TrendingUp className="w-5 h-5 text-primary mb-3" /><p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1">Portfolio Balance</p><p className="text-xl font-black text-white tabular-nums truncate">{formatFiat(totalPortfolioValue)}</p></div>
                    </div>

                    <section className="space-y-3">
                        <div className="flex justify-between items-center px-2"><p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Network Hub</p><div className="flex items-center gap-1 text-[8px] font-black uppercase text-green-500"><Cpu className="w-2.5 h-2.5 animate-pulse" />Watchdog Sync: Active</div></div>
                        <div className="p-6 rounded-[2.5rem] bg-primary/5 border border-primary/20 space-y-4 shadow-2xl relative">
                            <div className="flex items-center gap-2"><QrCode className="w-4 h-4 text-primary" /><span className="text-[10px] font-black uppercase tracking-widest text-white/80">{viewingNetwork.name} Address</span></div>
                            <div onClick={() => address && copyAddress(address)} className="bg-black/40 border border-white/10 rounded-2xl p-4 flex items-center justify-between cursor-pointer hover:border-primary/50 transition-all"><p className="text-xs font-mono text-white/70 break-all leading-relaxed mr-4">{address || 'Initializing...'}</p><div className={cn("shrink-0 w-10 h-10 rounded-xl flex items-center justify-center", isAddressCopied ? "bg-green-500/20 text-green-500" : "bg-primary/20 text-primary")}>{isAddressCopied ? <CheckCircle2 className="w-5 h-5" /> : <Copy className="w-5 h-5" />}</div></div>
                        </div>
                    </section>

                    <section className="space-y-3">
                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] px-2">Terminal Config</p>
                        <div className="space-y-2">
                            <ProfileAction icon={Fingerprint} label="Node Alias" value={displayName} accentColor="text-purple-400" onClick={() => router.push('/settings')} />
                            <ProfileAction icon={Store} label="Marketplace" value="Business Mode" accentColor="text-emerald-400" onClick={() => router.push('/settings')} />
                            <ProfileAction icon={Users} label="Affiliate" value="Invite Nodes" accentColor="text-blue-400" onClick={() => router.push('/browse')} />
                        </div>
                    </section>

                    <div className="pt-4 flex flex-col items-center gap-3">
                        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/5"><RefreshCw className={cn("w-3 h-3 text-muted-foreground", isSyncing && "animate-spin")} /><span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Global Watchdog Sync: Active</span></div>
                        <p className="text-[8px] text-muted-foreground/40 uppercase font-black tracking-widest text-center max-w-[200px] leading-relaxed">Secured by Master Wevina Cloud Protocol v3.0</p>
                    </div>
            </main>
        </div>
    );
}
