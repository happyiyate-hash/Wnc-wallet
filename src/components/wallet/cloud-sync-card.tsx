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
 * Version: 5.0.0 (Pop-Layout Stabilization)
 * 
 * Features a strictly sequenced "One-Card-Per-Node" animation lifecycle.
 * Nodes slide in from the right, verify, and slide out to the left.
 */
export default function CloudSyncCard() {
  const { syncDiagnostic } = useWallet();
  const { status, chain, localValue, cloudValue, progress } = syncDiagnostic;
  
  const [isManuallyHidden, setIsManuallyHidden] = useState(false);
  const lastTapRef = useRef<number>(0);

  // 1. RESET SENTINEL
  useEffect(() => {
    if (status === 'idle') {
      setIsManuallyHidden(false);
    }
  }, [status]);

  // 2. GESTURE HANDSHAKE: Global double-tap detection
  useEffect(() => {
    if (status === 'idle' || isManuallyHidden) return;

    const handleGlobalDoubleTap = () => {
      const now = Date.now();
      if (now - lastTapRef.current < 300) {
        setIsManuallyHidden(true);
      }
      lastTapRef.current = now;
    };

    window.addEventListener('click', handleGlobalDoubleTap);
    return () => window.removeEventListener('click', handleGlobalDoubleTap);
  }, [status, isManuallyHidden]);

  if (status === 'idle' || isManuallyHidden) return null;

  const getStatusColor = () => {
    switch (status) {
      case 'mismatch': return 'text-red-400';
      case 'syncing': return 'text-primary';
      case 'success':
      case 'completed': return 'text-green-400';
      default: return 'text-blue-400';
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'checking': return <Search className="w-4 h-4 animate-pulse" />;
      case 'mismatch': return <AlertCircle className="w-4 h-4" />;
      case 'syncing': return <RefreshCw className="w-4 h-4 animate-spin" />;
      case 'success':
      case 'completed': return <CheckCircle2 className="w-4 h-4" />;
      default: return <Cloud className="w-4 h-4" />;
    }
  };

  const truncateAddress = (addr: string | null) => {
    if (!addr) return 'None';
    if (addr.length < 15) return addr;
    return `${addr.slice(0, 8)}...${addr.slice(-6)}`;
  };

  // POP-LAYOUT ANIMATION DEFINITION
  const slideVariants = {
    initial: { x: '100%', opacity: 0 },
    animate: { x: 0, opacity: 1, transition: { type: 'spring', damping: 25, stiffness: 120 } },
    exit: { x: '-100%', opacity: 0, transition: { duration: 0.4, ease: "easeInOut" } }
  };

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ y: -150, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -150, opacity: 0 }}
        className="fixed top-20 left-4 right-4 z-[100] max-w-lg mx-auto"
      >
        <div className="bg-[#0a0a0c]/90 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] p-5 shadow-2xl overflow-hidden relative">
          {/* HARDWARE GLOW */}
          <div className="absolute inset-0 pointer-events-none opacity-20">
              <motion.div 
                  animate={{ scale: [1, 1.4, 1], opacity: [0.2, 0.4, 0.2] }}
                  transition={{ duration: 3, repeat: Infinity }}
                  className={cn(
                      "absolute -right-20 -top-20 w-64 h-64 blur-3xl rounded-full transition-colors duration-1000",
                      status === 'mismatch' ? "bg-red-500" : status === 'success' || status === 'completed' ? "bg-green-500" : "bg-primary"
                  )}
              />
          </div>

          <div className="relative z-10 space-y-4">
            {/* HEADER */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-10 h-10 rounded-2xl flex items-center justify-center transition-colors duration-500",
                  status === 'mismatch' ? "bg-red-500/20" : "bg-primary/10"
                )}>
                  {getStatusIcon()}
                </div>
                <div>
                  <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-white">Registry Sentinel</h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <div className="w-1 h-1 rounded-full bg-primary animate-pulse" />
                    <span className="text-[7px] font-black uppercase text-muted-foreground tracking-widest">
                      Hardware Synchronization
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-white/5 border border-white/10 px-3 py-1 rounded-full flex items-center gap-2">
                  <Zap className="w-2.5 h-2.5 text-primary fill-primary" />
                  <span className="text-[9px] font-black text-white">{chain || 'BOOT'}</span>
              </div>
            </div>

            {/* PROGRESS */}
            <div className="space-y-2">
              <div className="flex justify-between items-center px-1">
                  <span className={cn("text-[8px] font-black uppercase tracking-[0.2em]", getStatusColor())}>
                      {status === 'checking' && `Auditing ${chain} Node...`}
                      {status === 'mismatch' && 'Node Out of Sync'}
                      {status === 'syncing' && 'Repairing Registry...'}
                      {status === 'success' && `${chain} Handshake Verified`}
                      {status === 'completed' && 'Vault Fully Synchronized'}
                  </span>
                  <span className="text-[9px] font-mono text-muted-foreground/60">{Math.round(progress)}%</span>
              </div>
              <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                  <motion.div 
                      animate={{ width: `${progress}%` }}
                      className={cn(
                          "h-full bg-primary transition-colors duration-500",
                          status === 'mismatch' ? "bg-red-500" : "bg-primary"
                      )}
                  />
              </div>
            </div>

            {/* SEQUENCED REGISTRY NODES */}
            <div className="grid grid-cols-2 gap-2 h-16 relative">
              <AnimatePresence mode="popLayout">
                {/* CLOUD SLOT */}
                <motion.div 
                  key={`${chain}-cloud`}
                  variants={slideVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  className="p-3 rounded-2xl bg-white/[0.02] border border-white/5 flex flex-col justify-center space-y-0.5"
                >
                  <div className="flex items-center gap-1.5 opacity-40">
                      <Database className="w-2.5 h-2.5" />
                      <span className="text-[7px] font-black uppercase tracking-tighter">Registry</span>
                  </div>
                  <p className="text-[9px] font-mono text-white/60 truncate">
                      {truncateAddress(cloudValue)}
                  </p>
                </motion.div>

                {/* LOCAL SLOT */}
                <motion.div 
                  key={`${chain}-local`}
                  variants={slideVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  className={cn(
                      "p-3 rounded-2xl border transition-colors duration-500 flex flex-col justify-center space-y-0.5 relative",
                      status === 'success' ? "bg-green-500/5 border-green-500/30" : "bg-primary/5 border-primary/20"
                  )}
                >
                  <div className="flex items-center gap-1.5">
                      <Cpu className="w-2.5 h-2.5 text-primary" />
                      <span className="text-[7px] font-black text-primary uppercase tracking-tighter">Local Node</span>
                  </div>
                  <p className="text-[9px] font-mono text-white/80 truncate">
                      {truncateAddress(localValue)}
                  </p>
                  
                  {status === 'success' && (
                      <motion.div 
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="absolute top-1.5 right-1.5"
                      >
                          <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                      </motion.div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* SYSTEM STATUS FOOTER */}
            <AnimatePresence>
              {status === 'completed' && (
                <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center justify-center gap-2 py-2 rounded-xl bg-green-500/10 border border-green-500/20"
                >
                    <ShieldCheck className="w-3.5 h-3.5 text-green-500" />
                    <span className="text-[8px] font-black text-green-500 uppercase tracking-[0.2em]">Institutional Vault Secured</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
