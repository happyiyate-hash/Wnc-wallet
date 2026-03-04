
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
 * INSTITUTIONAL UNIFIED SYNC SENTINEL
 * Re-engineered into a single robust hardware card matching the Quick Swap dimensions.
 * Features vertical independent transition slots for Cloud vs. Local registry nodes.
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

  // VERTICAL HANDSHAKE CONFIG: Nodes fade in from bottom and snap out to top
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
      className="fixed top-20 left-4 right-4 z-[100] max-w-lg mx-auto"
    >
      <div className="bg-[#0a0a0c]/95 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] p-5 shadow-2xl overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-primary/5 opacity-30 pointer-events-none" />
        
        <div className="relative z-10 space-y-5">
          {/* HEADER COCKPIT */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-10 h-10 rounded-2xl flex items-center justify-center transition-colors duration-500",
                status === 'mismatch' ? "bg-red-500/20" : "bg-primary/10"
              )}>
                {getStatusIcon()}
              </div>
              <div>
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white">
                  {status === 'completed' ? 'Registry Verified' : 'Diagnostic Audit'}
                </h3>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <div className={cn(
                    "w-1 h-1 rounded-full animate-pulse",
                    status === 'completed' ? "bg-green-500" : "bg-primary"
                  )} />
                  <span className="text-[8px] font-black uppercase text-muted-foreground tracking-widest">
                    {status === 'completed' ? 'Verified Active' : 'Sequential Handshake'}
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
                  className="bg-primary/10 border border-primary/20 px-3 py-1 rounded-lg flex items-center gap-2"
                >
                  <Zap className="w-2.5 h-2.5 text-primary fill-primary" />
                  <span className="text-[10px] font-black text-white uppercase tracking-tighter">{chain}</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* PROGRESS BAR */}
          <div className="space-y-2">
            <div className="flex justify-between items-center px-1">
              <span className={cn("text-[9px] font-black uppercase tracking-widest", getStatusColor())}>
                {status === 'checking' && `Scanning ${chain} Registry...`}
                {status === 'mismatch' && 'Registry mismatch'}
                {status === 'syncing' && 'Reconciling Node...'}
                {status === 'success' && 'Integrity Nominal'}
                {status === 'completed' && 'Institutional Handshake Complete'}
              </span>
              <span className="text-[9px] font-mono text-muted-foreground tabular-nums">{Math.round(progress)}%</span>
            </div>
            <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                className={cn(
                  "h-full transition-colors duration-500",
                  status === 'mismatch' ? "bg-red-500" : "bg-primary"
                )}
              />
            </div>
          </div>

          {/* HANDSHAKE REGISTRY NODES */}
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-0 h-16 relative bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden">
            {/* SLOT 1: CLOUD REGISTRY */}
            <div className="relative h-full overflow-hidden flex flex-col justify-center px-4">
              <AnimatePresence mode="popLayout">
                <motion.div 
                  key={`${chain}-cloud`}
                  variants={nodeVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  className="space-y-1"
                >
                  <div className="flex items-center gap-1.5 opacity-40">
                    <Database className="w-2.5 h-2.5" />
                    <span className="text-[7px] font-black uppercase tracking-widest">Cloud Vault</span>
                  </div>
                  <p className={cn(
                    "text-[10px] font-mono truncate",
                    status === 'mismatch' ? "text-red-400 line-through opacity-50" : "text-white/80"
                  )}>
                    {truncateAddress(cloudValue)}
                  </p>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* VERTICAL DIVIDER */}
            <div className="w-[1px] h-8 bg-white/10 relative">
              <div className="absolute inset-0 bg-primary/20 blur-[2px]" />
            </div>

            {/* SLOT 2: LOCAL NODE */}
            <div className="relative h-full overflow-hidden flex flex-col justify-center px-4">
              <AnimatePresence mode="popLayout">
                <motion.div 
                  key={`${chain}-local`}
                  variants={nodeVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  className="space-y-1 relative"
                >
                  <div className="flex items-center gap-1.5 text-primary">
                    <Cpu className="w-2.5 h-2.5" />
                    <span className="text-[7px] font-black uppercase tracking-widest">Local Node</span>
                  </div>
                  <p className="text-[10px] font-mono text-white truncate">
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
          </div>

          {/* BOTTOM STATUS ALERT */}
          <AnimatePresence>
            {status === 'completed' && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-green-500/10 border border-green-500/20"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-green-500" />
                <span className="text-[8px] font-black text-green-500 uppercase tracking-[0.2em]">
                  Registry Protocol Secured
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
