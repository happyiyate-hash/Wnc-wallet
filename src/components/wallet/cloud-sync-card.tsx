'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { 
  Database, 
  CheckCircle2, 
  Cpu, 
  Zap, 
  Activity,
  ShieldCheck
} from 'lucide-react';
import { useWallet } from '@/contexts/wallet-provider';
import { cn } from '@/lib/utils';

/**
 * INSTITUTIONAL INLINE REGISTRY AUDIT
 * Version: 10.0.0 (Persistent Profile Ticker)
 * 
 * Replaces the pop-up card with an inline, slim status bar for the Profile page.
 * Displays real-time cloud-to-hardware handshakes in a non-intrusive sliding format.
 */
export default function CloudSyncCard() {
  const { syncDiagnostic } = useWallet();
  const { status, chain, localValue, cloudValue, progress } = syncDiagnostic;

  if (status === 'idle') return null;

  const truncateAddress = (addr: string | null) => {
    if (!addr) return 'Not Set';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  return (
    <div className="w-full">
      <div className="bg-black/40 backdrop-blur-xl border border-white/5 rounded-[2rem] p-4 shadow-2xl relative overflow-hidden">
        {/* HEADER: ACTIVE SIGNATURE */}
        <div className="flex items-center justify-between mb-4 px-1">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Activity className="w-3.5 h-3.5 text-primary" />
              <div className="absolute inset-0 bg-primary/20 blur-sm rounded-full animate-pulse" />
            </div>
            <h3 className="text-[9px] font-black uppercase tracking-[0.2em] text-white/60">Registry Worker Active</h3>
          </div>
          <div className="bg-primary/10 border border-primary/20 px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
            <Zap className="w-2.5 h-2.5 text-primary fill-primary" />
            <span className="text-[8px] font-black text-primary uppercase tracking-tighter">{chain || 'SYNC'}</span>
          </div>
        </div>

        {/* PROGRESS TRACKER */}
        <div className="h-0.5 w-full bg-white/5 rounded-full overflow-hidden mb-4">
          <motion.div 
            className="h-full bg-primary shadow-[0_0_10px_rgba(139,92,246,0.5)]"
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.1 }}
          />
        </div>

        {/* SLIDING HANDSHAKE PAIR */}
        <div className="h-14 relative overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div 
              key={chain}
              initial={{ x: 100, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -100, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="grid grid-cols-2 gap-2 h-full"
            >
              {/* Cloud Node */}
              <div className="bg-white/[0.02] border border-white/5 rounded-xl p-2.5 flex flex-col justify-center">
                <div className="flex items-center gap-1.5 mb-0.5 opacity-30">
                  <Database className="w-2.5 h-2.5" />
                  <span className="text-[6px] font-black uppercase tracking-tighter">Cloud Vault</span>
                </div>
                <p className="text-[9px] font-mono text-white/40 tracking-tight">{truncateAddress(cloudValue)}</p>
              </div>

              {/* Local Node */}
              <div className={cn(
                "relative border rounded-xl p-2.5 flex flex-col justify-center transition-all duration-500",
                progress >= 100 ? "bg-green-500/10 border-green-500/30" : "bg-primary/5 border-primary/20"
              )}>
                <div className="flex items-center gap-1.5 mb-0.5 relative z-10">
                  <Cpu className={cn("w-2.5 h-2.5", progress >= 100 ? "text-green-400" : "text-primary")} />
                  <span className={cn("text-[6px] font-black uppercase tracking-tighter", progress >= 100 ? "text-green-400" : "text-primary")}>Local Node</span>
                </div>
                <p className={cn("text-[9px] font-mono tracking-tight relative z-10", progress >= 100 ? "text-white" : "text-white/60")}>
                  {truncateAddress(localValue)}
                </p>

                {/* SUCCESS POP */}
                <AnimatePresence>
                  {progress >= 100 && (
                    <motion.div 
                      initial={{ scale: 0 }} 
                      animate={{ scale: 1 }}
                      className="absolute top-1.5 right-1.5 z-20"
                    >
                      <CheckCircle2 className="w-3 h-3 text-green-500" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* FINAL STATUS (MINIMAL) */}
        {status === 'completed' && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }}
            className="mt-3 flex items-center justify-center gap-1.5 opacity-40"
          >
            <ShieldCheck className="w-2.5 h-2.5 text-green-500" />
            <span className="text-[7px] font-black text-white uppercase tracking-widest">Registry Integrity Verified</span>
          </motion.div>
        )}
      </div>
    </div>
  );
}
