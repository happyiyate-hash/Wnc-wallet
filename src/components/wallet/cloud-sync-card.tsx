
'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { 
  Database, 
  Cpu, 
  Search, 
  CheckCircle2, 
  Zap, 
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import { useWallet } from '@/contexts/wallet-provider';
import { cn } from '@/lib/utils';

/**
 * INSTITUTIONAL DIAGNOSTIC SENTINEL - REDESIGN V4
 * Implements the "Snap-Dwell-Snap" rhythm within the dual-box registry layout.
 * Optimized for full-speed transitions and deliberate logical dwells.
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

  return (
    <motion.div 
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -100, opacity: 0 }}
      transition={{ type: 'spring', damping: 30, stiffness: 150 }}
      className="fixed top-4 left-4 right-4 z-[100] max-w-lg mx-auto"
    >
      <div className="bg-[#0a0a0c]/95 border border-white/10 rounded-[2.5rem] p-6 shadow-[0_0_100px_rgba(0,0,0,0.8)] overflow-hidden relative">
        
        {/* HEADER SECTION */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center border border-white/5">
              <Search className="w-5 h-5 text-white/60" />
            </div>
            <div className="flex flex-col">
              <h3 className="text-sm font-black uppercase tracking-[0.2em] text-white">Cloud Sync Node</h3>
              <div className="flex items-center gap-2 mt-1">
                <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Hardware Identity Handshake</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white/5 border border-white/10 rounded-full px-4 py-1.5 flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-primary fill-primary" />
            <span className="text-[10px] font-black uppercase text-white tracking-widest">Vault</span>
          </div>
        </div>

        {/* STATUS & PROGRESS */}
        <div className="space-y-3 mb-6">
          <div className="flex justify-between items-center px-1">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400">
              {status === 'checking' ? `SCANNING ${chain} REGISTRY...` : 
               status === 'mismatch' ? 'MISMATCH DETECTED...' :
               status === 'syncing' ? 'REPAIRING NODE...' :
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
                isMismatch ? "bg-red-500" : "bg-primary"
              )}
            />
          </div>
        </div>

        {/* DUAL-BOX REGISTRY GRID */}
        <div className="grid grid-cols-2 gap-4">
          <AnimatePresence mode="wait">
            <motion.div 
              key={`${chain}-cloud`}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              className="bg-white/[0.02] border border-white/5 rounded-[1.5rem] p-4 flex flex-col gap-2 h-20 justify-center"
            >
              <div className="flex items-center gap-2">
                <Database className="w-3 h-3 text-muted-foreground" />
                <span className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">Cloud Registry</span>
              </div>
              <p className={cn(
                "text-[10px] font-mono tracking-tighter truncate",
                status === 'mismatch' ? "text-red-400/60 line-through" : "text-white/60"
              )}>
                {status === 'checking' ? 'Reading...' : cloudValue ? truncateAddress(cloudValue) : 'Empty'}
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
                "border rounded-[1.5rem] p-4 flex flex-col gap-2 h-20 justify-center transition-colors duration-500",
                isMismatch ? "bg-red-500/5 border-red-500/30" : "bg-purple-500/5 border-purple-500/30"
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Cpu className={cn("w-3 h-3", isMismatch ? "text-red-500" : "text-primary")} />
                  <span className={cn("text-[8px] font-black uppercase tracking-widest", isMismatch ? "text-red-500" : "text-primary")}>Local Node</span>
                </div>
                {isSuccess && <CheckCircle2 className="w-3 h-3 text-green-500" />}
              </div>
              <p className="text-[10px] font-mono text-white tracking-tighter truncate">
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
