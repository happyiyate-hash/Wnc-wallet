
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
 * Version: 8.0.0 (Sequential Audit Protocol)
 * 
 * Implements a weighted "Right-to-Center-to-Left" sliding protocol.
 * Features dopamine-hit verification pops and global double-tap dismissal.
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

  const cardVariants = {
    initial: { x: 150, opacity: 0 },
    animate: { x: 0, opacity: 1 },
    exit: { x: -150, opacity: 0 }
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
            
            {/* 1. TOP BAR: STATUS NODE */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20">
                  <Search className={cn("w-5 h-5 text-primary", progress < 100 && "animate-pulse")} />
                </div>
                <div>
                  <h3 className="text-[11px] font-black uppercase tracking-widest text-white">Registry Sentinel</h3>
                  <p className="text-[8px] text-muted-foreground uppercase font-bold tracking-tighter opacity-60">Double-tap to hide</p>
                </div>
              </div>
              <div className="bg-white/5 border border-white/10 px-4 py-1.5 rounded-full flex items-center gap-2">
                <Zap className="w-3 h-3 text-primary fill-primary" />
                <span className="text-[10px] font-black text-white tracking-tighter uppercase">{chain || 'BOOT'}</span>
              </div>
            </div>

            {/* 2. PROGRESS: THE HEARTBEAT */}
            <div className="space-y-2 mb-6">
              <div className="flex justify-between items-center px-1">
                <span className="text-[9px] font-black uppercase text-primary tracking-widest">
                  {progress >= 100 ? `${chain} Node Verified` : `Auditing ${chain} Node...`}
                </span>
                <span className="text-[10px] font-mono text-white/50">{Math.round(progress)}%</span>
              </div>
              <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                <motion.div 
                  className="h-full bg-primary shadow-[0_0_10px_rgba(139,92,246,0.5)]"
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </div>

            {/* 3. COMPARISON CARDS: SLIDING PROTOCOL */}
            <div className="grid grid-cols-2 gap-3 h-[84px]">
              <AnimatePresence mode="wait">
                <motion.div 
                  key={`${chain}-cloud`}
                  variants={cardVariants}
                  initial="initial" animate="animate" exit="exit"
                  transition={{ type: 'spring', damping: 20, stiffness: 150 }}
                  className="bg-white/[0.03] border border-white/5 rounded-2xl p-4 flex flex-col justify-center shadow-inner"
                >
                  <div className="flex items-center gap-2 mb-1 opacity-40">
                    <Database className="w-3 h-3" />
                    <span className="text-[7px] font-black uppercase tracking-tighter">Cloud Vault</span>
                  </div>
                  <p className="text-[10px] font-mono text-white/60 tracking-tight">{truncateAddress(cloudValue)}</p>
                </motion.div>
              </AnimatePresence>

              <AnimatePresence mode="wait">
                <motion.div 
                  key={`${chain}-local`}
                  variants={cardVariants}
                  initial="initial" animate="animate" exit="exit"
                  transition={{ type: 'spring', damping: 20, stiffness: 150 }}
                  className={cn(
                    "relative border rounded-2xl p-4 flex flex-col justify-center transition-all duration-500 shadow-inner",
                    progress >= 100 ? "bg-green-500/10 border-green-500/40" : "bg-primary/5 border-primary/20"
                  )}
                >
                  {/* SUCCESS GLOW */}
                  {progress >= 100 && (
                    <div className="absolute inset-0 bg-green-500/10 animate-pulse rounded-2xl pointer-events-none" />
                  )}

                  <div className="flex items-center gap-2 mb-1 relative z-10">
                    <Cpu className={cn("w-3 h-3", progress >= 100 ? "text-green-400" : "text-primary")} />
                    <span className={cn("text-[7px] font-black uppercase tracking-tighter", progress >= 100 ? "text-green-400" : "text-primary")}>Local Node</span>
                  </div>
                  <p className={cn("text-[10px] font-mono tracking-tight relative z-10", progress >= 100 ? "text-white" : "text-white/80")}>
                    {truncateAddress(localValue)}
                  </p>

                  {/* DOPAMINE POP: GREEN CHECKMARK */}
                  <AnimatePresence>
                    {progress >= 100 && (
                      <motion.div 
                        initial={{ scale: 0, rotate: -45 }} 
                        animate={{ scale: 1, rotate: 0 }}
                        className="absolute top-2 right-2 z-20"
                      >
                        <CheckCircle2 className="w-4 h-4 text-green-500 fill-black" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* 4. FINAL SETTLEMENT FOOTER */}
            <AnimatePresence>
              {status === 'completed' && (
                <motion.div 
                  initial={{ opacity: 0, y: 15 }} 
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-6 flex items-center justify-center gap-2 py-3 bg-green-500/10 border border-green-500/20 rounded-xl shadow-lg"
                >
                  <ShieldCheck className="w-4 h-4 text-green-500" />
                  <span className="text-[9px] font-black text-green-500 uppercase tracking-[0.25em]">Institutional Sync Complete</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
