'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft, 
  Users, 
  Zap, 
  ShieldCheck, 
  Copy, 
  CheckCircle2, 
  Share2, 
  Clock, 
  Fingerprint,
  Cpu
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUser } from '@/contexts/user-provider';
import { useWallet } from '@/contexts/wallet-provider';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { cn } from '@/lib/utils';

/**
 * INSTITUTIONAL GROWTH NODE (AFFILIATE)
 * A cinematic card experience visualizing the 400 WNC Referral Protocol.
 */
export default function InvitesPage() {
    const router = useRouter();
    const { profile } = useUser();
    const { accountNumber } = useWallet();
    const [isCopied, copy] = useCopyToClipboard();
    const [currentStep, setCurrentStep] = useState(0);

    const referralCode = useMemo(() => {
        if (!accountNumber) return null;
        return accountNumber.slice(-6);
    }, [accountNumber]);

    const shareUrl = useMemo(() => {
        if (typeof window === 'undefined' || !referralCode) return '';
        return `${window.location.origin}/signup?ref=${referralCode}`;
    }, [referralCode]);

    // CINEMATIC AUTOMATION: Rotate through scenes
    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentStep((prev) => (prev + 1) % 4);
        }, 4000);
        return () => clearInterval(interval);
    }, []);

    const scenes = [
        {
            title: "Broadcast Identity",
            desc: "Share your unique Node Invitation with prospective registry members.",
            icon: Share2,
            color: "text-blue-400",
            bg: "bg-blue-500/10",
            border: "border-blue-500/20"
        },
        {
            title: "Registry Handshake",
            desc: "New nodes join the Wevina Cloud using your cryptographic signature.",
            icon: Fingerprint,
            color: "text-purple-400",
            bg: "bg-purple-500/10",
            border: "border-purple-500/20"
        },
        {
            title: "Vitality Protocol",
            desc: "Nodes remain active for 48 cycles to verify registry integrity.",
            icon: Clock,
            color: "text-amber-400",
            bg: "bg-amber-500/10",
            border: "border-amber-500/20"
        },
        {
            title: "Reward Settlement",
            desc: "Institutional 400 WNC is credited directly to your Vault.",
            icon: Zap,
            color: "text-green-400",
            bg: "bg-green-500/10",
            border: "border-green-500/20"
        }
    ];

    return (
        <div className="flex flex-col min-h-screen bg-[#050505] text-foreground overflow-hidden">
            <header className="p-4 flex items-center justify-between border-b border-white/5 bg-black/50 backdrop-blur-2xl sticky top-0 z-50">
                <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-xl">
                    <ArrowLeft className="w-5 h-5" />
                </Button>
                <div className="flex flex-col items-center text-center">
                    <h1 className="text-xs font-black uppercase tracking-[0.2em] leading-none text-white/90">Affiliate Hub</h1>
                    <div className="flex items-center gap-1.5 mt-1.5">
                        <Users className="w-2.5 h-2.5 text-primary" />
                        <span className="text-[8px] text-primary font-black uppercase tracking-tighter">Growth Registry</span>
                    </div>
                </div>
                <div className="w-10" />
            </header>

            <main className="flex-1 p-6 flex flex-col gap-8 max-w-lg mx-auto w-full pb-32">
                {/* CINEMATIC MOVIE CARD */}
                <section className="relative h-[320px] w-full rounded-[3rem] bg-[#0a0a0c] border border-white/10 overflow-hidden shadow-2xl">
                    <div className="absolute inset-0 bg-gradient-to-b from-primary/10 via-transparent to-black/80 z-0" />
                    
                    {/* Animated Scene Content */}
                    <div className="relative z-10 h-full flex flex-col items-center justify-center p-8 text-center">
                        <AnimatePresence mode="wait">
                            <motion.div 
                                key={currentStep}
                                initial={{ y: 20, opacity: 0, scale: 0.9 }}
                                animate={{ y: 0, opacity: 1, scale: 1 }}
                                exit={{ y: -20, opacity: 0, scale: 0.9 }}
                                transition={{ type: 'spring', damping: 20 }}
                                className="space-y-6"
                            >
                                <div className={cn(
                                    "w-20 h-20 rounded-[2.5rem] flex items-center justify-center mx-auto shadow-2xl transition-all duration-1000",
                                    scenes[currentStep].bg,
                                    scenes[currentStep].border,
                                    scenes[currentStep].color
                                )}>
                                    {(() => {
                                        const Icon = scenes[currentStep].icon;
                                        return <Icon className="w-10 h-10" />;
                                    })()}
                                </div>
                                <div className="space-y-2 px-4">
                                    <h2 className="text-xl font-black uppercase tracking-tight text-white">{scenes[currentStep].title}</h2>
                                    <p className="text-xs text-muted-foreground leading-relaxed font-medium">{scenes[currentStep].desc}</p>
                                </div>
                            </motion.div>
                        </AnimatePresence>

                        {/* Progress Pips */}
                        <div className="absolute bottom-8 left-0 right-0 flex justify-center gap-2">
                            {scenes.map((_, i) => (
                                <div 
                                    key={i} 
                                    className={cn(
                                        "h-1 transition-all duration-500 rounded-full",
                                        currentStep === i ? "w-8 bg-primary" : "w-2 bg-white/10"
                                    )}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Background Animation Nodes */}
                    <div className="absolute inset-0 pointer-events-none opacity-30">
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-primary/20 blur-[100px] rounded-full animate-pulse" />
                    </div>
                </section>

                {/* EARNINGS SUMMARY */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="p-6 rounded-[2.5rem] bg-white/[0.03] border border-white/5 space-y-1">
                        <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Active Nodes</p>
                        <p className="text-2xl font-black text-white">0</p>
                    </div>
                    <div className="p-6 rounded-[2.5rem] bg-primary/5 border border-primary/20 space-y-1">
                        <p className="text-[9px] font-black text-primary uppercase tracking-widest">WNC Rewards</p>
                        <p className="text-2xl font-black text-white">0.00</p>
                    </div>
                </div>

                {/* SHARE CONTROL NODE */}
                <section className="space-y-4">
                    <div className="flex justify-between items-center px-2">
                        <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Node ID & Invitation</p>
                        <div className="flex items-center gap-1.5 text-[8px] font-black text-green-500 uppercase">
                            <Cpu className="w-2.5 h-2.5 animate-pulse" /> Protocol: Verified
                        </div>
                    </div>

                    <div className="p-6 rounded-[2.5rem] bg-zinc-950 border border-white/10 space-y-6 shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 blur-3xl -mr-16 -mt-16" />
                        
                        <div className="space-y-2">
                            <p className="text-[10px] font-black text-white/60 uppercase tracking-widest px-1">Your Registry Code</p>
                            <div className="bg-black/40 border border-white/5 rounded-2xl p-4 flex items-center justify-between">
                                <p className="text-2xl font-mono font-black text-primary tracking-[0.2em]">{referralCode || '------'}</p>
                                <button 
                                    onClick={() => referralCode && copy(referralCode)}
                                    className={cn(
                                        "w-10 h-10 rounded-xl flex items-center justify-center transition-all",
                                        isCopied ? "bg-green-500 text-white" : "bg-white/5 text-muted-foreground hover:text-white"
                                    )}
                                >
                                    {isCopied ? <CheckCircle2 className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>

                        <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10 flex items-start gap-3">
                            <Zap className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                            <p className="text-[10px] text-zinc-400 leading-relaxed font-medium">
                                Invite members to the <span className="text-white font-bold">Wevina Terminal</span>. For every member active for 48 cycles, you receive a settlement of <span className="text-primary font-bold">400 WNC</span>.
                            </p>
                        </div>

                        <Button 
                            onClick={() => navigator.share({ title: 'Join Wevina Registry', url: shareUrl })}
                            className="w-full h-14 rounded-2xl font-black text-sm uppercase tracking-widest bg-primary hover:bg-primary/90 shadow-xl shadow-primary/20"
                        >
                            Broadcast Invitation
                        </Button>
                    </div>
                </section>

                <div className="flex flex-col items-center gap-3 pt-4">
                    <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/5">
                        <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                        <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Registry Integrity: SECURE</span>
                    </div>
                    <p className="text-[8px] text-white/20 uppercase font-black tracking-widest text-center max-w-[240px] leading-relaxed">
                        Referral settlement subject to institutional activity verification protocol v2.1
                    </p>
                </div>
            </main>
        </div>
    );
}
