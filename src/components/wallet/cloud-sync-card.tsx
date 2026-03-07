
'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Database, 
  CheckCircle2, 
  Cpu, 
  Zap, 
  ShieldCheck,
  Search
} from 'lucide-react';
import { useWallet } from '@/contexts/wallet-provider';
import { cn } from '@/lib/utils';

/**
 * INSTITUTIONAL CLOUD SYNC CARD
 * Version: 9.0.0 (Sequential Narrative Protocol - SLIM)
 * 
 * Implements a weighted "Single Unit" sliding protocol.
 * Features a slim profile and synchronized row transitions.
 */
export default function CloudSyncCard() {
  const { syncDiagnostic } = useWallet();
  const { status, chain, localValue, cloudValue, progress } = syncDiagnostic;

  const [isManuallyHidden, setIsManuallyHidden] = useState(false);
  const lastTapRef = useRef<number>(0);

  useEffect(() => {
    if (status === 'idle') setIsManuallyHidden(false);
  }, [status]);

  useEffect(() => {
    if (status === 'idle' || isManuallyHidden) return;
    
    const handleGlobalDoubleTap = () => {
      const now = Date.now();
      if (now - lastTapRef.current < 300) {
        setIsManuallyHidden(true);
      }
      lastTapRef.current = now;
    };
    
    window.addEventListener('touchstart', handleGlobalDoubleTap);
    return () => window.removeEventListener('touchstart', handleGlobalDoubleTap);
  }, [status, isManuallyHidden]);

  if (status === 'idle') return null;

  const truncateAddress = (addr: string | null) => {
    if (!addr) return 'None';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  return (
    <AnimatePresence>
      {!isManuallyHidden && (
        <motion.div 
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          className="fixed top-12 left-4 right-4 z-[100] max-w-lg mx-auto"
        >
          <div className="bg-[#0a0a0c]/95 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] p-6 shadow-2xl overflow-hidden relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-3xl -mr-16 -mt-16 pointer-events-none" />
            
            {/* 1. TOP BAR: STATUS NODE (SLIM) */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
                  <Search className={cn("w-4 h-4 text-primary", progress < 100 && "animate-pulse")} />
                </div>
                <div>
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-white">Registry Sentinel</h3>
                  <p className="text-[7px] text-muted-foreground uppercase font-bold tracking-tighter opacity-40">Double-tap to hide</p>
                </div>
              </div>
              <div className="bg-white/5 border border-white/10 px-3 py-1 rounded-full flex items-center gap-2">
                <Zap className="w-2.5 h-2.5 text-primary fill-primary" />
                <span className="text-[9px] font-black text-white tracking-tighter uppercase">{chain || 'WAIT'}</span>
              </div>
            </div>

            {/* 2. PROGRESS: THE HEARTBEAT */}
            <div className="space-y-1.5 mb-5">
              <div className="flex justify-between items-center px-1">
                <span className="text-[8px] font-black uppercase text-primary tracking-widest">
                  {progress >= 100 ? `${chain} Node Verified` : `Auditing ${chain} Node...`}
                </span>
                <span className="text-[9px] font-mono text-white/50">{Math.round(progress)}%</span>
              </div>
              <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                <motion.div 
                  className="h-full bg-primary shadow-[0_0_10px_rgba(139,92,246,0.5)]"
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.15 }}
                />
              </div>
            </div>

            {/* 3. UNIFIED ROW ANIMATION: Cloud + Local slide as ONE UNIT */}
            <div className="h-[74px] relative overflow-hidden">
              <AnimatePresence mode="wait">
                <motion.div 
                  key={chain}
                  initial={{ x: 150, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: -150, opacity: 0 }}
                  transition={{ type: 'spring', damping: 22, stiffness: 180 }}
                  className="grid grid-cols-2 gap-2 h-full"
                >
                  {/* Cloud Node */}
                  <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-3 flex flex-col justify-center shadow-inner">
                    <div className="flex items-center gap-2 mb-1 opacity-30">
                      <Database className="w-2.5 h-2.5" />
                      <span className="text-[6px] font-black uppercase tracking-tighter">Cloud Vault</span>
                    </div>
                    <p className="text-[9px] font-mono text-white/50 tracking-tight">{truncateAddress(cloudValue)}</p>
                  </div>

                  {/* Local Node */}
                  <div className={cn(
                    "relative border rounded-2xl p-3 flex flex-col justify-center transition-all duration-500 shadow-inner",
                    progress >= 100 ? "bg-green-500/10 border-green-500/40" : "bg-primary/5 border-primary/20"
                  )}>
                    <div className="flex items-center gap-2 mb-1 relative z-10">
                      <Cpu className={cn("w-2.5 h-2.5", progress >= 100 ? "text-green-400" : "text-primary")} />
                      <span className={cn("text-[6px] font-black uppercase tracking-tighter", progress >= 100 ? "text-green-400" : "text-primary")}>Local Node</span>
                    </div>
                    <p className={cn("text-[9px] font-mono tracking-tight relative z-10", progress >= 100 ? "text-white" : "text-white/70")}>
                      {truncateAddress(localValue)}
                    </p>

                    {/* SUCCESS POP */}
                    <AnimatePresence>
                      {progress >= 100 && (
                        <motion.div 
                          initial={{ scale: 0, rotate: -45 }} 
                          animate={{ scale: 1, rotate: 0 }}
                          className="absolute top-1.5 right-1.5 z-20"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-green-500 fill-black" />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* 4. FINAL SETTLEMENT FOOTER */}
            <AnimatePresence>
              {status === 'completed' && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }} 
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-5 flex items-center justify-center gap-2 py-2.5 bg-green-500/10 border border-green-500/20 rounded-xl shadow-lg"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-green-500" />
                  <span className="text-[8px] font-black text-green-500 uppercase tracking-[0.2em]">Institutional Sync Complete</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
