'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft, 
  Search, 
  Globe, 
  LayoutGrid, 
  Sparkles, 
  ChevronRight,
  ShieldCheck,
  TrendingUp,
  Zap,
  Building2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

/**
 * INSTITUTIONAL ECOSYSTEM BROWSER
 * A high-fidelity discovery node for dApps, tokens, and registry members.
 */
export default function BrowsePage() {
    const router = useRouter();
    const [search, setSearch] = useState('');

    const categories = [
        { name: "DeFi Protocols", icon: TrendingUp, color: "text-blue-400" },
        { name: "NFT Registries", icon: LayoutGrid, color: "text-purple-400" },
        { name: "Institutional dApps", icon: Building2, color: "text-emerald-400" },
        { name: "Cloud Tools", icon: Zap, color: "text-amber-400" }
    ];

    return (
        <div className="flex flex-col min-h-screen bg-[#050505] text-foreground overflow-hidden">
            <header className="p-4 flex items-center justify-between border-b border-white/5 bg-black/50 backdrop-blur-2xl sticky top-0 z-50">
                <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-xl">
                    <ArrowLeft className="w-5 h-5" />
                </Button>
                <div className="flex flex-col items-center text-center">
                    <h1 className="text-xs font-black uppercase tracking-[0.2em] leading-none text-white/90">Ecosystem Browser</h1>
                    <div className="flex items-center gap-1.5 mt-1.5">
                        <Globe className="w-2.5 h-2.5 text-primary" />
                        <span className="text-[8px] text-primary font-black uppercase tracking-tighter">Market Discovery</span>
                    </div>
                </div>
                <div className="w-10" />
            </header>

            <main className="flex-1 p-6 space-y-8 max-w-lg mx-auto w-full pb-32">
                {/* SEARCH NODE */}
                <div className="relative group">
                    <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-purple-500/20 rounded-[2rem] blur opacity-25 group-focus-within:opacity-100 transition-opacity" />
                    <div className="relative bg-zinc-950 border border-white/10 rounded-[2rem] p-2">
                        <div className="flex items-center gap-3 px-4">
                            <Search className="w-5 h-5 text-zinc-600" />
                            <Input 
                                placeholder="Search ecosystem..." 
                                className="bg-transparent border-none focus-visible:ring-0 text-white placeholder:text-zinc-700 h-12"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                {/* FEATURED DISCOVERY */}
                <section className="space-y-4">
                    <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] px-2">Institutional Spotlight</p>
                    <div className="relative h-48 rounded-[2.5rem] bg-gradient-to-br from-primary/20 via-primary/5 to-transparent border border-primary/20 overflow-hidden group">
                        <div className="absolute inset-0 bg-[url('https://picsum.photos/seed/browse/800/400')] bg-cover bg-center opacity-20 grayscale group-hover:grayscale-0 transition-all duration-700 scale-110 group-hover:scale-100" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
                        
                        <div className="absolute bottom-6 left-6 right-6 space-y-2">
                            <div className="flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-primary" />
                                <span className="text-[10px] font-black text-primary uppercase">New Protocol</span>
                            </div>
                            <h3 className="text-xl font-black text-white tracking-tight">SmarterSeller V2 Marketplace</h3>
                            <p className="text-[10px] text-white/60 font-medium leading-relaxed">Integrated P2P registry for institutional merchants.</p>
                        </div>
                    </div>
                </section>

                {/* CATEGORY GRID */}
                <section className="space-y-4">
                    <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] px-2">Registry Categories</p>
                    <div className="grid grid-cols-2 gap-3">
                        {categories.map((cat, i) => (
                            <button 
                                key={i}
                                className="p-5 rounded-[2rem] bg-white/[0.03] border border-white/5 hover:bg-white/[0.06] transition-all group text-left space-y-3"
                            >
                                <div className={cn("w-10 h-10 rounded-xl bg-black/40 border border-white/5 flex items-center justify-center group-hover:scale-110 transition-transform", cat.color)}>
                                    <cat.icon className="w-5 h-5" />
                                </div>
                                <p className="text-xs font-black uppercase tracking-widest text-white/80">{cat.name}</p>
                            </button>
                        ))}
                    </div>
                </section>

                {/* PLACEHOLDER LIST */}
                <section className="space-y-4 pt-4">
                    <div className="flex items-center justify-between px-2">
                        <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Live Nodes</p>
                        <span className="text-[8px] font-black text-green-500 uppercase">Synchronized</span>
                    </div>
                    
                    <div className="space-y-2">
                        {[1, 2, 3].map((_, i) => (
                            <div key={i} className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/5 group opacity-40 grayscale">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-white/5" />
                                    <div className="space-y-1">
                                        <div className="h-3 w-24 bg-white/10 rounded" />
                                        <div className="h-2 w-16 bg-white/5 rounded" />
                                    </div>
                                </div>
                                <ChevronRight className="w-4 h-4 text-white/10" />
                            </div>
                        ))}
                    </div>
                    <p className="text-[8px] text-center text-white/20 uppercase font-black tracking-widest pt-4">
                        Discovery protocol v3.1 initializing...
                    </p>
                </section>
            </main>
        </div>
    );
}
