'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { 
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
 * INSTITUTIONAL MODULAR SYNC SENTINEL
 * Refactored into independent status cards for maximum hierarchy and clarity.
 * Uses vertical independent slots for a professional ripple effect.
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
      case 'checking': return <Search className="w-5 h-5 animate-pulse" />;
      case 'mismatch': return <AlertCircle className="w-5 h-5" />;
      case 'syncing': return <RefreshCw className="w-5 h-5 animate-spin" />;
      case 'success':
      case 'completed': return <CheckCircle2 className="w-5 h-5" />;
      default: return <Database className="w-5 h-5" />;
    }
  };

  const truncateAddress = (addr: string | null) => {
    if (!addr) return 'None';
    if (addr === 'Encrypted Phrase') return addr;
    if (addr === 'Stored') return addr;
    if (addr === 'Missing') return addr;
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  // VERTICAL RIPPLE CONFIG: Fade in from bottom, out to top
  const nodeVariants = {
    initial: { y: 20, opacity: 0 },
    animate: { y: 0, opacity: 1, transition: { type: 'spring', damping: 25, stiffness: 200 } },
    exit: { y: -20, opacity: 0, transition: { duration: 0.2 } }
  };

  return (
    <motion.div 
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -100, opacity: 0 }}
      className="fixed top-20 left-2 right-2 z-[100] max-w-lg mx-auto space-y-2"
    >
      {/* 1. MASTER STATUS HEADER */}
      <div className="bg-[#0a0a0c]/95 backdrop-blur-3xl border border-white/10 rounded-[2rem] p-3.5 shadow-2xl overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-primary/5 opacity-50" />
        
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-9 h-9 rounded-xl flex items-center justify-center transition-colors duration-500",
              status === 'mismatch' ? "bg-red-500/20" : "bg-primary/10"
            )}>
              {getStatusIcon()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <div className={cn("w-1.5 h-1.5 rounded-full", status === 'completed' ? "bg-green-500" : "bg-primary animate-pulse")} />
                <span className={cn("text-[9px] font-black uppercase tracking-widest", status === 'completed' ? "text-green-400" : "text-white")}>
                  {status === 'completed' ? 'Registry Verified' : 'Audit Active'}
                </span>
              </div>
              <p className={cn("text-[8px] font-black uppercase tracking-[0.2em] mt-0.5", getStatusColor())}>
                {status === 'checking' && `Scanning ${chain}...`}
                {status === 'mismatch' && 'Registry mismatch'}
                {status === 'syncing' && 'Reconciling...'}
                {status === 'success' && 'Integrity Nominal'}
                {status === 'completed' && 'Handshake Locked'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <AnimatePresence mode="wait">
              {chain && (
                <motion.div 
                  key={chain}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="bg-primary/10 border border-primary/20 px-3 py-1 rounded-lg flex items-center gap-2"
                >
                  <Zap className="w-2.5 h-2.5 text-primary fill-primary" />
                  <span className="text-[10px] font-black text-white uppercase tracking-tighter">{chain}</span>
                </motion.div>
              )}
            </AnimatePresence>
            <span className="text-[10px] font-mono text-muted-foreground/40 tabular-nums">{Math.round(progress)}%</span>
          </div>
        </div>

        {/* INTEGRATED PROGRESS BAR */}
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/5">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            className={cn(
              "h-full transition-colors duration-500",
              status === 'mismatch' ? "bg-red-500" : "bg-primary shadow-[0_0_10px_rgba(139,92,246,0.5)]"
            )}
          />
        </div>
      </div>

      {/* 2. INDEPENDENT REGISTRY CARDS */}
      <div className="grid grid-cols-2 gap-2">
        <AnimatePresence mode="popLayout">
          <motion.div 
            key={`${chain}-cloud`}
            variants={nodeVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="p-3 rounded-2xl bg-[#0a0a0c]/80 backdrop-blur-xl border border-white/5 space-y-1.5 shadow-xl"
          >
            <div className="flex items-center gap-2 opacity-40">
              <Database className="w-3 h-3" />
              <span className="text-[7px] font-black uppercase tracking-widest">Cloud Vault</span>
            </div>
            <p className={cn(
              "text-[10px] font-mono truncate px-1",
              status === 'mismatch' ? "text-red-400 line-through opacity-50" : "text-white/80"
            )}>
              {truncateAddress(cloudValue)}
            </p>
          </motion.div>
        </AnimatePresence>

        <AnimatePresence mode="popLayout">
          <motion.div 
            key={`${chain}-local`}
            variants={nodeVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="p-3 rounded-2xl bg-[#0a0a0c]/80 backdrop-blur-xl border border-primary/20 space-y-1.5 shadow-xl relative"
          >
            <div className="flex items-center gap-2 text-primary">
              <Cpu className="w-3 h-3" />
              <span className="text-[7px] font-black uppercase tracking-widest">Local Node</span>
            </div>
            <p className="text-[10px] font-mono text-white truncate px-1">
              {truncateAddress(localValue)}
            </p>
            {status === 'success' && (
              <motion.div 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -top-1 -right-1"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-green-500 fill-black" />
              </motion.div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
