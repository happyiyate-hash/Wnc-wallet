
'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { 
  Database, 
  CheckCircle2, 
  Cpu, 
  Zap, 
  Activity,
  ShieldCheck,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { useWallet } from '@/contexts/wallet-provider';
import { cn } from '@/lib/utils';

/**
 * INSTITUTIONAL INLINE REGISTRY AUDIT (TICKER)
 * Version: 11.0.0 (Advertisement Marquee Style)
 * 
 * Embedded directly within the Profile page as a slim, non-intrusive monitoring node.
 * Features a horizontal slide animation where Cloud and Local cards move together.
 */
export default function CloudSyncCard() {
  const { syncDiagnostic } = useWallet();
  const { status, chain, localValue, cloudValue, progress } = syncDiagnostic;

  if (status === 'idle') return null;

  const truncateAddress = (addr: string | null) => {
    if (!addr) return 'None';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const isSuccess = status === 'success' || status === 'completed';
  const isSyncing = status === 'syncing' || status === 'mismatch';

  return (
    <div className="w-full">
      <div className="bg-black/40 backdrop-blur-xl border border-white/5 rounded-[2rem] p-4 shadow-2xl relative overflow-hidden">
        
        {/* HEADER: ACTIVE SIGNATURE */}
        <div className="flex items-center justify-between mb-4 px-1">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Activity className={cn("w-3.5 h-3.5 text-primary", !isSuccess && "animate-pulse")} />
              <div className="absolute inset-0 bg-primary/20 blur-sm rounded-full animate-pulse" />
            </div>
            <div className="flex flex-col">
              <h3 className="text-[9px] font-black uppercase tracking-[0.2em] text-white/60 leading-none">
                {status === 'completed' ? 'Registry Nominal' : 'Cloud Registry Active'}
              </h3>
              <p className="text-[7px] font-black text-primary/40 uppercase tracking-widest mt-1">
                {status === 'syncing' ? 'Repairing Node...' : status === 'mismatch' ? 'Mismatch Detected' : '24/7 Security Audit'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-white/30">{Math.round(progress)}%</span>
            <div className="bg-primary/10 border border-primary/20 px-3 py-0.5 rounded-full flex items-center gap-1.5">
              <Zap className={cn("w-2.5 h-2.5 text-primary fill-primary", !isSuccess && "animate-pulse")} />
              <span className="text-[8px] font-black text-primary uppercase tracking-tighter">{chain || 'SYNC'}</span>
            </div>
          </div>
        </div>

        {/* PROGRESS TRACKER */}
        <div className="h-0.5 w-full bg-white/5 rounded-full overflow-hidden mb-4">
          <motion.div 
            className="h-full bg-primary shadow-[0_0_10px_rgba(139,92,246,0.5)]"
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>

        {/* SLIDING HANDSHAKE PAIR (UNIFIED ROW) */}
        <div className="h-14 relative overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div 
              key={chain}
              initial={{ x: 150, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -150, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="grid grid-cols-2 gap-2 h-full"
            >
              {/* Cloud Node */}
              <div className="bg-white/[0.02] border border-white/5 rounded-xl p-2.5 flex flex-col justify-center">
                <div className="flex items-center gap-1.5 mb-0.5 opacity-30">
                  <Database className="w-2.5 h-2.5" />
                  <span className="text-[6px] font-black uppercase tracking-tighter">Cloud Registry</span>
                </div>
                <p className="text-[9px] font-mono text-white/40 tracking-tight">{truncateAddress(cloudValue)}</p>
              </div>

              {/* Local Node */}
              <div className={cn(
                "relative border rounded-xl p-2.5 flex flex-col justify-center transition-all duration-500",
                isSuccess ? "bg-green-500/10 border-green-500/30" : isSyncing ? "bg-amber-500/10 border-amber-500/30" : "bg-primary/5 border-primary/20"
              )}>
                <div className="flex items-center gap-1.5 mb-0.5 relative z-10">
                  {isSyncing ? (
                    <RefreshCw className="w-2.5 h-2.5 text-amber-500 animate-spin" />
                  ) : (
                    <Cpu className={cn("w-2.5 h-2.5", isSuccess ? "text-green-400" : "text-primary")} />
                  )}
                  <span className={cn("text-[6px] font-black uppercase tracking-tighter", isSuccess ? "text-green-400" : isSyncing ? "text-amber-500" : "text-primary")}>
                    Local Node
                  </span>
                </div>
                <p className={cn("text-[9px] font-mono tracking-tight relative z-10", isSuccess ? "text-white" : "text-white/60")}>
                  {truncateAddress(localValue)}
                </p>

                {/* SUCCESS POP */}
                <AnimatePresence>
                  {isSuccess && (
                    <motion.div 
                      initial={{ scale: 0, rotate: -45 }} 
                      animate={{ scale: 1, rotate: 0 }}
                      className="absolute top-1.5 right-1.5 z-20"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-500 fill-black" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* STATUS FOOTER */}
        <AnimatePresence>
          {status === 'completed' && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }} 
              animate={{ opacity: 1, y: 0 }}
              className="mt-3 flex items-center justify-center gap-1.5"
            >
              <ShieldCheck className="w-2.5 h-2.5 text-green-500" />
              <span className="text-[7px] font-black text-green-500 uppercase tracking-widest">Global Identity Synchronization Verified</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
