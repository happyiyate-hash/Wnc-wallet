'use client';

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
 * INSTITUTIONAL SYNC OVERLAY
 * Optimized for "Real-Time" vertical swiping feedback with isolated transition slots.
 * Features Fade-in from Bottom / Fade-out to Top logic for a high-fidelity handshake.
 */
export default function CloudSyncCard() {
  const { syncDiagnostic } = useWallet();
  const { status, chain, localValue, cloudValue, progress } = syncDiagnostic;

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
    if (addr === 'Encrypted Phrase') return addr;
    if (addr === 'Stored') return addr;
    if (addr === 'Missing') return addr;
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  // INDEPENDENT VERTICAL ANIMATION: Fade in from bottom, out to top
  const cardVariants = {
    initial: { y: 25, opacity: 0 },
    animate: { 
      y: 0, 
      opacity: 1, 
      transition: { type: 'spring', damping: 25, stiffness: 200 } 
    },
    exit: { 
      y: -25, 
      opacity: 0, 
      transition: { duration: 0.2, ease: "easeIn" } 
    }
  };

  return (
    <motion.div 
      initial={{ y: -150, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -150, opacity: 0 }}
      transition={{ type: 'spring', damping: 25, stiffness: 120 }}
      className="fixed top-20 left-4 right-4 z-[100] max-w-lg mx-auto"
    >
      <div className="bg-[#0a0a0c]/95 backdrop-blur-3xl border border-white/10 rounded-[3rem] p-6 shadow-2xl overflow-hidden relative">
        {/* Hardware Glow Sentinel */}
        <div className="absolute inset-0 pointer-events-none opacity-20">
            <motion.div 
                animate={{ 
                    scale: [1, 1.4, 1],
                    opacity: [0.2, 0.4, 0.2]
                }}
                transition={{ duration: 3, repeat: Infinity }}
                className={cn(
                    "absolute -right-20 -top-20 w-64 h-64 blur-3xl rounded-full transition-colors duration-1000",
                    status === 'mismatch' ? "bg-red-500" : status === 'success' || status === 'completed' ? "bg-green-500" : "bg-primary"
                )}
            />
        </div>

        <div className="relative z-10 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-10 h-10 rounded-2xl flex items-center justify-center transition-colors duration-500 shadow-xl",
                status === 'mismatch' ? "bg-red-500/20" : "bg-primary/10"
              )}>
                {getStatusIcon()}
              </div>
              <div>
                <h3 className="text-xs font-black uppercase tracking-[0.25em] text-white">
                  {status === 'completed' ? 'Registry Verified' : 'Cloud Sync Node'}
                </h3>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <div className={cn(
                    "w-1.5 h-1.5 rounded-full animate-pulse",
                    status === 'completed' ? "bg-green-500" : "bg-primary"
                  )} />
                  <span className="text-[8px] font-black uppercase text-muted-foreground/60 tracking-widest">
                    {status === 'completed' ? 'System Integrity: Locked' : 'Hardware Identity Handshake'}
                  </span>
                </div>
              </div>
            </div>

            <AnimatePresence mode="wait">
                {chain && (
                    <motion.div 
                        key={chain}
                        initial={{ opacity: 0, scale: 0.8, x: 20 }}
                        animate={{ opacity: 1, scale: 1, x: 0 }}
                        exit={{ opacity: 0, scale: 0.8, x: -20 }}
                        className="bg-primary/10 border border-primary/20 px-4 py-1.5 rounded-full flex items-center gap-2 shadow-lg"
                    >
                        <Zap className="w-3 h-3 text-primary fill-primary" />
                        <span className="text-[10px] font-black text-white uppercase tracking-tighter">{chain}</span>
                    </motion.div>
                )}
            </AnimatePresence>
          </div>

          <div className="space-y-2.5">
            <div className="flex justify-between items-center px-1">
                <span className={cn("text-[10px] font-black uppercase tracking-widest", getStatusColor())}>
                    {status === 'checking' && `Scanning ${chain} Registry...`}
                    {status === 'mismatch' && 'Registry Conflict Detected'}
                    {status === 'syncing' && 'Reconciling Identity Nodes...'}
                    {status === 'success' && `${chain} Integrity Verified`}
                    {status === 'completed' && 'Institutional Handshake Complete'}
                </span>
                <span className="text-[10px] font-mono text-muted-foreground/40">{Math.round(progress)}%</span>
            </div>
            <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.3, ease: "linear" }}
                    className={cn(
                        "h-full bg-gradient-to-r transition-colors duration-500",
                        status === 'mismatch' ? "from-red-500 to-orange-500" : "from-primary to-purple-500 shadow-[0_0_10px_rgba(139,92,246,0.5)]"
                    )}
                />
            </div>
          </div>

          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-0 h-16 relative">
            {/* SLOT 1: CLOUD REGISTRY */}
            <div className="relative overflow-hidden h-full rounded-l-2xl">
                <AnimatePresence mode="popLayout">
                    <motion.div 
                        key={`${chain}-cloud`}
                        variants={cardVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        className="p-3 rounded-2xl bg-white/[0.01] space-y-1.5 h-full flex flex-col justify-center"
                    >
                        <div className="flex items-center gap-2">
                            <Database className="w-3 h-3 text-muted-foreground/40" />
                            <span className="text-[8px] font-black text-muted-foreground/60 uppercase tracking-widest">Cloud Registry</span>
                        </div>
                        <p className={cn(
                            "text-[11px] font-mono truncate transition-all duration-500 px-1",
                            status === 'mismatch' ? "text-red-400 line-through scale-95 opacity-50" : "text-white/80"
                        )}>
                            {truncateAddress(cloudValue)}
                        </p>
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* INTEGRATED VERTICAL DIVIDER */}
            <div className="w-[1px] h-10 bg-white/10 mx-3 rounded-full shadow-[0_0_10px_rgba(255,255,255,0.05)]" />

            {/* SLOT 2: LOCAL NODE */}
            <div className="relative overflow-hidden h-full rounded-r-2xl">
                <AnimatePresence mode="popLayout">
                    <motion.div 
                        key={`${chain}-local`}
                        variants={cardVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        className="p-3 rounded-2xl bg-primary/5 space-y-1.5 relative h-full flex flex-col justify-center"
                    >
                        <div className="flex items-center gap-2">
                            <Cpu className="w-3 h-3 text-primary/60" />
                            <span className="text-[8px] font-black text-primary/80 uppercase tracking-widest">Local Node</span>
                        </div>
                        <p className="text-[11px] font-mono text-white truncate px-1">
                            {truncateAddress(localValue)}
                        </p>
                        {status === 'success' && (
                            <motion.div 
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ type: 'spring', bounce: 0.5, delay: 0.1 }}
                                className="absolute -top-1 -right-1"
                            >
                                <CheckCircle2 className="w-4 h-4 text-green-500 fill-black shadow-lg" />
                            </motion.div>
                        )}
                    </motion.div>
                </AnimatePresence>
            </div>
          </div>

          {status === 'mismatch' && (
            <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-center gap-3 py-2 px-4 rounded-2xl bg-red-500/10 border border-red-500/20 shadow-2xl shadow-red-500/5"
            >
                <AlertCircle className="w-4 h-4 text-red-500" />
                <span className="text-[9px] font-black text-red-500 uppercase tracking-widest">
                    Registry Mismatch Found - Reconciling...
                </span>
            </motion.div>
          )}

          {status === 'completed' && (
            <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center justify-center gap-3 py-2 px-4 rounded-2xl bg-green-500/10 border border-green-500/20 shadow-2xl shadow-green-500/5"
            >
                <ShieldCheck className="w-4 h-4 text-green-500" />
                <span className="text-[9px] font-black text-green-500 uppercase tracking-widest">
                    Institutional Vault Verified
                </span>
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
