
'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { 
  Database, 
  Cpu, 
  Search, 
  CheckCircle2, 
  Zap, 
  ShieldCheck,
  Loader2
} from 'lucide-react';
import { useWallet } from '@/contexts/wallet-provider';
import { cn } from '@/lib/utils';

/**
 * INSTITUTIONAL DIAGNOSTIC SENTINEL - ULTRA-SLIM HARDWARE EDITION
 * Reduced height, edge-to-edge stretching, and minimalist branding.
 * Implements "Verified Active" indicator and high-speed Snap-Dwell-Snap logic.
 */
export default function CloudSyncCard() {
  const { syncDiagnostic } = useWallet();
  const { status, chain, localValue, cloudValue, progress } = syncDiagnostic;
  
  if (status === 'idle') return null;

  const truncateAddress = (addr: string | null) => {
    if (!addr) return 'None';
    return `${addr.slice(0, 8)}...${addr.slice(-6)}`;
  };

  const isMismatch = status === 'mismatch' || status === 'syncing';
  const isSuccess = status === 'success' || status === 'completed';

  // DYNAMIC LOGIC ICON
  const StatusIcon = () => {
    if (isSuccess) return <CheckCircle2 className="w-4 h-4 text-green-500" />;
    if (isMismatch) return <Loader2 className="w-4 h-4 text-primary animate-spin" />;
    return <Search className="w-4 h-4 text-white/40" />;
  };

  return (
    <motion.div 
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -100, opacity: 0 }}
      transition={{ type: 'spring', damping: 30, stiffness: 150 }}
      className="fixed top-4 left-2 right-2 z-[100] max-w-lg mx-auto"
    >
      <div className="bg-[#0a0a0c] border border-white/10 rounded-[2rem] p-3.5 shadow-[0_0_100px_rgba(0,0,0,0.9)] overflow-hidden relative">
        
        {/* ULTRA-SLIM HEADER */}
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 bg-white/[0.03] border border-white/5 px-2 py-1 rounded-full shadow-inner">
              <StatusIcon />
              <span className="text-[9px] font-black text-white/40 uppercase tracking-widest">Cloud Sync</span>
            </div>
            
            {/* INTEGRATED ACTIVE INDICATOR */}
            <div className="flex items-center gap-1.5 opacity-80">
              <div className={cn(
                "w-1.5 h-1.5 rounded-full shadow-[0_0_8px]",
                isSuccess ? "bg-green-500 shadow-green-500/50" : "bg-primary animate-pulse shadow-primary/50"
              )} />
              <span className="text-[8px] font-black text-white/60 uppercase tracking-tighter">Verified Active</span>
            </div>
          </div>
          
          <div className="bg-primary/10 border border-primary/20 rounded-full px-3 py-1 flex items-center gap-1.5">
            <Zap className="w-2.5 h-2.5 text-primary fill-primary" />
            <span className="text-[9px] font-black uppercase text-white tracking-widest">
              {chain || 'SYNC'}
            </span>
          </div>
        </div>

        {/* COMPACT PROGRESS BAR */}
        <div className="px-1 mb-3">
          <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              className={cn(
                "h-full transition-colors duration-500",
                isMismatch ? "bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]" : "bg-primary shadow-[0_0_10px_rgba(139,92,246,0.3)]"
              )}
            />
          </div>
        </div>

        {/* SLIM REGISTRY GRID - h-12 OPTIMIZED */}
        <div className="grid grid-cols-2 gap-2">
          <AnimatePresence mode="wait">
            <motion.div 
              key={`${chain}-cloud`}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              className="bg-white/[0.02] border border-white/5 rounded-xl p-2.5 flex flex-col gap-1 h-12 justify-center"
            >
              <div className="flex items-center gap-1.5">
                <Database className="w-2.5 h-2.5 text-muted-foreground" />
                <span className="text-[7px] font-black text-muted-foreground uppercase tracking-widest">Cloud Registry</span>
              </div>
              <p className={cn(
                "text-[9px] font-mono tracking-tighter truncate leading-none",
                status === 'mismatch' ? "text-red-400/60 line-through" : "text-white/60"
              )}>
                {cloudValue ? truncateAddress(cloudValue) : 'Reading...'}
              </p>
            </motion.div>
          </AnimatePresence>

          <AnimatePresence mode="wait">
            <motion.div 
              key={`${chain}-local`}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.2 }}
              className={cn(
                "border rounded-xl p-2.5 flex flex-col gap-1 h-12 justify-center transition-colors duration-500",
                isMismatch ? "bg-red-500/5 border-red-500/30" : "bg-primary/5 border-primary/30 shadow-[inset_0_0_10px_rgba(139,92,246,0.05)]"
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Cpu className={cn("w-2.5 h-2.5", isMismatch ? "text-red-500" : "text-primary")} />
                  <span className={cn("text-[7px] font-black uppercase tracking-widest", isMismatch ? "text-red-500" : "text-primary")}>Local Node</span>
                </div>
                {isSuccess && <CheckCircle2 className="w-2.5 h-2.5 text-green-500" />}
              </div>
              <p className="text-[9px] font-mono text-white tracking-tighter truncate leading-none">
                {localValue ? truncateAddress(localValue) : 'Deriving...'}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

      </div>
    </motion.div>
  );
}
