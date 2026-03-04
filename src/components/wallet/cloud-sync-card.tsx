'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Database, 
  Cpu, 
  Search, 
  CheckCircle2, 
  Zap, 
  Loader2,
  ShieldCheck
} from 'lucide-react';
import { useWallet } from '@/contexts/wallet-provider';
import { cn } from '@/lib/utils';

/**
 * INSTITUTIONAL DIAGNOSTIC SENTINEL (Hardware v5.0 - Robust)
 * Restored to a professional, robust form factor.
 * Stretches edge-to-edge while maintaining clear separation between Cloud and Local nodes.
 */
export default function CloudSyncCard() {
  const { syncDiagnostic, wallets } = useWallet();
  const { status, chain, localValue, cloudValue, progress } = syncDiagnostic;
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);
  
  if (!hasMounted || status === 'idle' || !wallets || wallets.length === 0) return null;

  const truncateAddress = (addr: string | null) => {
    if (!addr) return 'None Detected';
    return `${addr.slice(0, 12)}...${addr.slice(-10)}`;
  };

  const isMismatch = status === 'mismatch' || status === 'syncing';
  const isSuccess = status === 'success' || status === 'completed';

  const StatusIcon = () => {
    if (isSuccess) return <CheckCircle2 className="w-6 h-6 text-green-500" />;
    if (isMismatch) return <Loader2 className="w-6 h-6 text-primary animate-spin" />;
    return <Search className="w-6 h-6 text-white/40" />;
  };

  return (
    <motion.div 
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -100, opacity: 0 }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="fixed top-4 left-2 right-2 z-[100] max-w-lg mx-auto"
    >
      <div className="bg-[#0a0a0c] border border-white/10 rounded-[2.5rem] p-6 shadow-[0_30px_60px_rgba(0,0,0,0.8)] overflow-hidden relative">
        
        {/* PROGRESS LAYER */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-white/5">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            className={cn(
              "h-full transition-colors duration-500 shadow-[0_0_10px]",
              isMismatch ? "bg-red-500 shadow-red-500/50" : "bg-primary shadow-primary/50"
            )}
          />
        </div>

        {/* HEADER COCKPIT */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10">
              <StatusIcon />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[8px] font-black text-white/40 uppercase tracking-[0.2em]">Audit Mode</span>
                <div className={cn(
                  "w-1.5 h-1.5 rounded-full animate-pulse",
                  isSuccess ? "bg-green-500" : "bg-primary"
                )} />
              </div>
              <h3 className="text-[10px] font-black uppercase text-white tracking-widest flex items-center gap-2">
                {isSuccess ? `${chain} VERIFIED ACTIVE` : `SCANNIG ${chain} NODE...`}
              </h3>
            </div>
          </div>
          
          <div className="bg-primary/10 border border-primary/20 rounded-xl px-4 py-1.5 flex items-center gap-2 shadow-inner">
            <Zap className="w-3 h-3 text-primary fill-primary" />
            <span className="text-[10px] font-black uppercase text-white tracking-widest">
              {chain || 'Registry'}
            </span>
          </div>
        </div>

        {/* DUAL REGISTRY GRID */}
        <div className="grid grid-cols-2 gap-3">
          <AnimatePresence mode="wait">
            <motion.div 
              key={`${chain}-cloud`}
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -20, opacity: 0 }}
              className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 flex flex-col h-20 justify-center gap-1"
            >
              <div className="flex items-center gap-2 opacity-40">
                <Database className="w-4 h-4" />
                <span className="text-[8px] font-black uppercase tracking-widest">Cloud Registry</span>
              </div>
              <p className={cn(
                "text-[11px] font-mono tracking-tighter truncate leading-none",
                status === 'mismatch' ? "text-red-400 line-through" : "text-white/80"
              )}>
                {cloudValue ? truncateAddress(cloudValue) : 'Initializing...'}
              </p>
            </motion.div>
          </AnimatePresence>

          <AnimatePresence mode="wait">
            <motion.div 
              key={`${chain}-local`}
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 20, opacity: 0 }}
              className={cn(
                "border rounded-2xl p-4 flex flex-col h-20 justify-center gap-1 transition-all duration-500",
                isMismatch ? "bg-red-500/5 border-red-500/30" : "bg-primary/5 border-primary/30 shadow-[inset_0_0_20px_rgba(139,92,246,0.05)]"
              )}
            >
              <div className="flex items-center gap-2 text-primary">
                <Cpu className="w-4 h-4" />
                <span className="text-[8px] font-black uppercase tracking-widest">Local Node</span>
              </div>
              <p className="text-[11px] font-mono text-white tracking-tighter truncate leading-none">
                {localValue ? truncateAddress(localValue) : 'Deriving...'}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* STATUS FOOTER */}
        <div className="mt-4 flex items-center justify-center gap-2 opacity-20">
          <ShieldCheck className="w-3 h-3" />
          <span className="text-[7px] font-black uppercase tracking-[0.3em]">Master Wevina Protocol v5.0</span>
        </div>

      </div>
    </motion.div>
  );
}
