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
 * INSTITUTIONAL SYNC SENTINEL - GESTURE ENABLED
 * Version: 4.2.0 (Double-Tap to Background)
 * Consolidates registry nodes into a high-fidelity hardware card.
 * Features global double-tap detection to hide the UI node while preserving the background handshake.
 */
export default function CloudSyncCard() {
  const { syncDiagnostic } = useWallet();
  const { status, chain, localValue, cloudValue, progress } = syncDiagnostic;
  
  const [isManuallyHidden, setIsManuallyHidden] = useState(false);
  const lastTapRef = useRef<number>(0);

  // 1. RESET SENTINEL: Re-enable visibility when the system returns to IDLE
  useEffect(() => {
    if (status === 'idle') {
      setIsManuallyHidden(false);
    }
  }, [status]);

  // 2. GESTURE HANDSHAKE: Global double-tap listener
  useEffect(() => {
    if (status === 'idle' || isManuallyHidden) return;

    const handleGlobalDoubleTap = () => {
      const now = Date.now();
      const DOUBLE_TAP_DELAY = 300;
      
      if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
        setIsManuallyHidden(true);
      }
      lastTapRef.current = now;
    };

    window.addEventListener('click', handleGlobalDoubleTap);
    window.addEventListener('touchstart', handleGlobalDoubleTap);
    
    return () => {
      window.removeEventListener('click', handleGlobalDoubleTap);
      window.removeEventListener('touchstart', handleGlobalDoubleTap);
    };
  }, [status, isManuallyHidden]);

  if (status === 'idle') return null;

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
    if (addr === 'Encrypted Phrase' || addr === 'Stored' || addr === 'Missing') return addr;
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const swipeVariants = {
    initial: { x: '110%', opacity: 0 },
    animate: { x: 0, opacity: 1, transition: { type: 'spring', damping: 25, stiffness: 150 } },
    exit: { x: '-110%', opacity: 0, transition: { duration: 0.3, ease: "easeInOut" } }
  };

  return (
    <AnimatePresence>
      {!isManuallyHidden && (
        <motion.div 
          initial={{ y: -150, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -150, opacity: 0, scale: 0.9 }}
          transition={{ type: 'spring', damping: 25, stiffness: 120 }}
          className="fixed top-20 left-4 right-4 z-[100] max-w-lg mx-auto pointer-events-none"
        >
          <div className="bg-[#0a0a0c]/90 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] p-5 shadow-2xl overflow-hidden relative pointer-events-auto">
            {/* HARDWARE BACKGROUND GLOW */}
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
              {/* HEADER NODE */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-10 h-10 rounded-2xl flex items-center justify-center transition-colors duration-500 shadow-lg",
                    status === 'mismatch' ? "bg-red-500/20" : "bg-primary/10"
                  )}>
                    {getStatusIcon()}
                  </div>
                  <div>
                    <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-white">
                      {status === 'completed' ? 'Registry Secured' : 'Registry Sentinel'}
                    </h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <div className={cn(
                        "w-1 h-1 rounded-full animate-pulse",
                        status === 'completed' ? "bg-green-500" : "bg-primary"
                      )} />
                      <span className="text-[7px] font-black uppercase text-muted-foreground tracking-widest">
                        Double-tap to hide UI
                      </span>
                    </div>
                  </div>
                </div>

                <AnimatePresence mode="wait">
                    {chain && (
                        <motion.div 
                            key={chain}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            className="bg-white/5 border border-white/10 px-3 py-1 rounded-full flex items-center gap-2 shadow-inner"
                        >
                            <Zap className="w-2.5 h-2.5 text-primary fill-primary" />
                            <span className="text-[9px] font-black text-white">{chain}</span>
                        </motion.div>
                    )}
                </AnimatePresence>
              </div>

              {/* CENTER: PROGRESS NODE */}
              <div className="space-y-2 py-1">
                <div className="flex justify-between items-center px-1">
                    <span className={cn("text-[8px] font-black uppercase tracking-[0.2em]", getStatusColor())}>
                        {status === 'checking' && `Auditing ${chain} Registry...`}
                        {status === 'mismatch' && 'Registry Mismatch'}
                        {status === 'syncing' && 'Reconciling Nodes...'}
                        {status === 'success' && `${chain} Verified`}
                        {status === 'completed' && 'Terminal Fully Synchronized'}
                    </span>
                    <span className="text-[9px] font-mono text-muted-foreground/60">{Math.round(progress)}%</span>
                </div>
                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                    <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 0.3, ease: "linear" }}
                        className={cn(
                            "h-full bg-gradient-to-r transition-colors duration-500 shadow-[0_0_10px_rgba(139,92,246,0.3)]",
                            status === 'mismatch' ? "from-red-500 to-orange-500" : "from-primary to-purple-500"
                        )}
                    />
                </div>
              </div>

              {/* BOTTOM: SLIM SWIPING REGISTRY NODES */}
              <div className="grid grid-cols-2 gap-2 h-14 relative">
                {/* CLOUD REGISTRY SLOT */}
                <div className="relative overflow-hidden h-full rounded-2xl bg-white/[0.02] border border-white/5">
                    <AnimatePresence mode="popLayout">
                        <motion.div 
                            key={`${chain}-cloud`}
                            variants={swipeVariants}
                            initial="initial"
                            animate="animate"
                            exit="exit"
                            className="p-3 h-full flex flex-col justify-center space-y-0.5"
                        >
                            <div className="flex items-center gap-1.5 opacity-40">
                                <Database className="w-2.5 h-2.5 text-muted-foreground" />
                                <span className="text-[7px] font-black text-muted-foreground uppercase tracking-tighter">Cloud Vault</span>
                            </div>
                            <p className={cn(
                                "text-[9px] font-mono truncate transition-all duration-500",
                                status === 'mismatch' ? "text-red-400 line-through opacity-50" : "text-white/60"
                            )}>
                                {truncateAddress(cloudValue)}
                            </p>
                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* LOCAL NODE SLOT */}
                <div className={cn(
                    "relative overflow-hidden h-full rounded-2xl border transition-colors duration-500",
                    status === 'success' || status === 'completed' ? "bg-green-500/5 border-green-500/30" : "bg-primary/5 border-primary/20"
                )}>
                    <AnimatePresence mode="popLayout">
                        <motion.div 
                            key={`${chain}-local`}
                            variants={swipeVariants}
                            initial="initial"
                            animate="animate"
                            exit="exit"
                            className="p-3 h-full flex flex-col justify-center space-y-0.5 relative"
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
                                    initial={{ scale: 0, rotate: -45 }}
                                    animate={{ scale: 1, rotate: 0 }}
                                    className="absolute top-1 right-1"
                                >
                                    <CheckCircle2 className="w-3.5 h-3.5 text-green-500 fill-black shadow-lg" />
                                </motion.div>
                            )}
                        </motion.div>
                    </AnimatePresence>
                </div>
              </div>

              {/* FINAL SYSTEM INTEGRITY NODE */}
              <AnimatePresence>
                {status === 'completed' && (
                  <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-green-500/10 border border-green-500/20 backdrop-blur-md"
                  >
                      <ShieldCheck className="w-3.5 h-3.5 text-green-500" />
                      <span className="text-[8px] font-black text-green-500 uppercase tracking-[0.2em]">Institutional Vault Verified</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
