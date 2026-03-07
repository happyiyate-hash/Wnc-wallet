'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Cloud, 
  Database, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Cpu, 
  Zap, 
  ShieldCheck,
  Search
} from 'lucide-react';
import { useWallet } from '@/contexts/wallet-provider';
import { cn } from '@/lib/utils';

/**
 * INSTITUTIONAL SYNC SENTINEL
 * Version: 6.0.0 (Stable Pop-Layout Protocol)
 * 
 * Implements a strictly sequenced "Slide-In -> Verify -> Slide-Out" animation.
 * Optimized to prevent flickering and reverse-animation glitches.
 */
export default function CloudSyncCard() {
  const { syncDiagnostic } = useWallet();
  const { status, chain, localValue, cloudValue, progress } = syncDiagnostic;
  
  const [isManuallyHidden, setIsManuallyHidden] = useState(false);
  const lastTapRef = useRef<number>(0);

  // RESET SENTINEL
  useEffect(() => {
    if (status === 'idle') setIsManuallyHidden(false);
  }, [status]);

  // DOUBLE-TAP DISMISSAL
  useEffect(() => {
    if (status === 'idle' || isManuallyHidden) return;
    const handleGlobalDoubleTap = () => {
      const now = Date.now();
      if (now - lastTapRef.current < 300) setIsManuallyHidden(true);
      lastTapRef.current = now;
    };
    window.addEventListener('click', handleGlobalDoubleTap);
    return () => window.removeEventListener('click', handleGlobalDoubleTap);
  }, [status, isManuallyHidden]);

  if (status === 'idle' || isManuallyHidden) return null;

  const truncateAddress = (addr: string | null) => {
    if (!addr) return 'None Detected';
    return `${addr.slice(0, 8)}...${addr.slice(-6)}`;
  };

  const isVerified = status === 'success' || status === 'completed';

  return (
    <AnimatePresence mode="wait">
      <motion.div 
        initial={{ y: -150, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -150, opacity: 0 }}
        className="fixed top-20 left-4 right-4 z-[150] max-w-lg mx-auto"
      >
        <div className="bg-[#0a0a0c]/95 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] p-6 shadow-[0_30px_100px_rgba(0,0,0,0.8)] overflow-hidden relative">
          
          {/* HARDWARE GLOW */}
          <div className="absolute inset-0 pointer-events-none opacity-20">
              <motion.div 
                  animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.4, 0.2] }}
                  transition={{ duration: 4, repeat: Infinity }}
                  className={cn(
                      "absolute -right-20 -top-20 w-64 h-64 blur-3xl rounded-full transition-colors duration-1000",
                      status === 'mismatch' ? "bg-red-500" : isVerified ? "bg-green-500" : "bg-primary"
                  )}
              />
          </div>

          <div className="relative z-10 space-y-5">
            {/* HEADER */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-10 h-10 rounded-2xl flex items-center justify-center transition-colors duration-500",
                  status === 'mismatch' ? "bg-red-500/20 text-red-400" : "bg-primary/10 text-primary"
                )}>
                  {status === 'checking' ? <Search className="w-5 h-5 animate-pulse" /> :
                   status === 'syncing' ? <RefreshCw className="w-5 h-5 animate-spin" /> :
                   isVerified ? <CheckCircle2 className="w-5 h-5" /> :
                   <Database className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white">Registry Sentinel</h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[8px] font-black uppercase text-primary tracking-widest animate-pulse">
                      {status === 'completed' ? 'Synchronization Nominal' : 'Hardware Audit Active'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-white/5 border border-white/10 px-3 py-1 rounded-full flex items-center gap-2">
                  <Zap className="w-2.5 h-2.5 text-primary fill-primary" />
                  <span className="text-[10px] font-black text-white">{chain || '---'}</span>
              </div>
            </div>

            {/* PROGRESS BAR */}
            <div className="space-y-2">
              <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                  <motion.div 
                      animate={{ width: `${progress}%` }}
                      transition={{ type: 'spring', damping: 20 }}
                      className={cn(
                          "h-full bg-primary transition-colors duration-500",
                          status === 'mismatch' ? "bg-red-500" : "bg-primary"
                      )}
                  />
              </div>
            </div>

            {/* SEQUENCED SLIDING NODES */}
            <div className="h-20 relative overflow-hidden flex items-center">
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.div 
                  key={chain || 'idle'}
                  initial={{ x: 300, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: -300, opacity: 0 }}
                  transition={{ type: 'spring', damping: 25, stiffness: 150 }}
                  className="w-full grid grid-cols-2 gap-3"
                >
                  {/* CLOUD SLOT */}
                  <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 flex flex-col justify-center space-y-1">
                    <div className="flex items-center gap-1.5 opacity-40">
                        <Database className="w-3 h-3" />
                        <span className="text-[8px] font-black uppercase tracking-tighter">Registry</span>
                    </div>
                    <p className="text-[10px] font-mono text-white/60 truncate">
                        {truncateAddress(cloudValue)}
                    </p>
                  </div>

                  {/* LOCAL SLOT */}
                  <div className={cn(
                      "p-4 rounded-2xl border transition-all duration-500 flex flex-col justify-center space-y-1 relative",
                      isVerified ? "bg-green-500/10 border-green-500/40" : "bg-primary/5 border-primary/20"
                  )}>
                    <div className="flex items-center gap-1.5">
                        <Cpu className="w-3 h-3 text-primary" />
                        <span className="text-[8px] font-black text-primary uppercase tracking-tighter">Hardware</span>
                    </div>
                    <p className="text-[10px] font-mono text-white/90 truncate">
                        {truncateAddress(localValue)}
                    </p>
                    
                    <AnimatePresence>
                      {isVerified && (
                          <motion.div 
                              initial={{ scale: 0, rotate: -45 }}
                              animate={{ scale: 1, rotate: 0 }}
                              className="absolute top-2 right-2"
                          >
                              <CheckCircle2 className="w-4 h-4 text-green-500" />
                          </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* STATUS FEEDBACK */}
            <div className="text-center pt-1">
                <p className={cn(
                    "text-[9px] font-black uppercase tracking-[0.25em]",
                    status === 'mismatch' ? "text-red-500" : isVerified ? "text-green-500" : "text-white/40"
                )}>
                    {status === 'checking' && `Auditing ${chain} Registry Node...`}
                    {status === 'mismatch' && 'Registry Mismatch Detected'}
                    {status === 'syncing' && 'Repairing Cloud Node...'}
                    {status === 'success' && `${chain} Handshake Verified`}
                    {status === 'completed' && 'Institutional Vault Secured'}
                </p>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
