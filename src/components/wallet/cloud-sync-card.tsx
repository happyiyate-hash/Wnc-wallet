
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
 * INSTITUTIONAL DIAGNOSTIC SENTINEL - REDESIGN V5 (PIXEL PERFECT)
 * Implements the slim hardware form factor with dynamic icon logic.
 * Stretches to edges and uses high-precision symbols in the pill node.
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

  // DYNAMIC ICON LOGIC
  const StatusIcon = () => {
    if (isSuccess) return <CheckCircle2 className="w-6 h-6 text-green-500" />;
    if (isMismatch) return <Loader2 className="w-6 h-6 text-primary animate-spin" />;
    return <Search className="w-6 h-6 text-white/60" />;
  };

  return (
    <motion.div 
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -100, opacity: 0 }}
      transition={{ type: 'spring', damping: 30, stiffness: 150 }}
      className="fixed top-4 left-2 right-2 z-[100] max-w-lg mx-auto"
    >
      <div className="bg-[#0a0a0c] border border-white/10 rounded-[2.5rem] p-6 shadow-[0_0_100px_rgba(0,0,0,0.9)] overflow-hidden relative">
        
        {/* HEADER SECTION - HARDWARE SPEC */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-white/[0.03] border border-white/5 flex items-center justify-center shadow-inner">
              <StatusIcon />
            </div>
            <div className="flex flex-col">
              <h3 className="text-sm font-black uppercase tracking-[0.2em] text-white leading-tight">Cloud Sync Node</h3>
              <div className="flex items-center gap-2 mt-1">
                <div className="w-1 h-2 rounded-full bg-primary" />
                <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest opacity-60">Hardware Identity Handshake</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white/5 border border-white/10 rounded-full px-4 py-1.5 flex items-center gap-2 shadow-xl">
            <Zap className="w-3.5 h-3.5 text-primary fill-primary" />
            <span className="text-[10px] font-black uppercase text-white tracking-widest">
              {chain || 'VAULT'}
            </span>
          </div>
        </div>

        {/* STATUS & PROGRESS */}
        <div className="space-y-2 mb-6">
          <div className="flex justify-between items-center px-1">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400">
              {status === 'checking' ? `${chain} ANALYZING...` : 
               status === 'mismatch' ? `${chain} MISMATCH...` :
               status === 'syncing' ? `${chain} SYNCING...` :
               isSuccess ? `${chain} VERIFIED` : 'INITIALIZING...'}
            </span>
            <span className="text-[10px] font-black text-white/40 uppercase tabular-nums">{Math.round(progress)}%</span>
          </div>
          <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              className={cn(
                "h-full transition-colors duration-500",
                isMismatch ? "bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]" : "bg-primary"
              )}
            />
          </div>
        </div>

        {/* DUAL-BOX REGISTRY GRID - SLIM EDITION */}
        <div className="grid grid-cols-2 gap-3">
          <AnimatePresence mode="wait">
            <motion.div 
              key={`${chain}-cloud`}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              className="bg-white/[0.02] border border-white/5 rounded-[1.5rem] p-3 flex flex-col gap-1.5 h-14 justify-center"
            >
              <div className="flex items-center gap-2">
                <Database className="w-3 h-3 text-muted-foreground" />
                <span className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">Cloud Registry</span>
              </div>
              <p className={cn(
                "text-[9px] font-mono tracking-tighter truncate",
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
                "border rounded-[1.5rem] p-3 flex flex-col gap-1.5 h-14 justify-center transition-colors duration-500",
                isMismatch ? "bg-red-500/5 border-red-500/30" : "bg-primary/5 border-primary/30"
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Cpu className={cn("w-3 h-3", isMismatch ? "text-red-500" : "text-primary")} />
                  <span className={cn("text-[8px] font-black uppercase tracking-widest", isMismatch ? "text-red-500" : "text-primary")}>Local Node</span>
                </div>
                {isSuccess && <CheckCircle2 className="w-2.5 h-2.5 text-green-500" />}
              </div>
              <p className="text-[9px] font-mono text-white tracking-tighter truncate">
                {localValue ? truncateAddress(localValue) : 'Deriving...'}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* LOWER FOOTER */}
        <div className="mt-6 flex items-center justify-center gap-2 opacity-20">
          <ShieldCheck className="w-3 h-3 text-white" />
          <span className="text-[8px] font-black uppercase tracking-widest text-white">Registry Protocol v3.2 Verified</span>
        </div>

      </div>
    </motion.div>
  );
}
