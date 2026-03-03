
'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Database, 
  Cpu, 
  Search, 
  CheckCircle2, 
  Zap, 
  Loader2
} from 'lucide-react';
import { useWallet } from '@/contexts/wallet-provider';
import { cn } from '@/lib/utils';

/**
 * INSTITUTIONAL DIAGNOSTIC SENTINEL (Ultra-Slim Hardware v3.5)
 * Reduced height, edge-to-edge stretch, and dynamic logic-gated icons.
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
    if (!addr) return 'None';
    return `${addr.slice(0, 8)}...${addr.slice(-6)}`;
  };

  const isMismatch = status === 'mismatch' || status === 'syncing';
  const isSuccess = status === 'success' || status === 'completed';

  const StatusIcon = () => {
    if (isSuccess) return <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />;
    if (isMismatch) return <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />;
    return <Search className="w-3.5 h-3.5 text-white/40" />;
  };

  return (
    <motion.div 
      initial={{ y: -50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -50, opacity: 0 }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="fixed top-4 left-2 right-2 z-[100] max-w-lg mx-auto"
    >
      <div className="bg-[#0a0a0c] border border-white/10 rounded-[1.5rem] p-2.5 shadow-2xl overflow-hidden relative">
        
        {/* ULTRA-SLIM HEADER */}
        <div className="flex items-center justify-between mb-2 px-1">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-1">
              <StatusIcon />
              <span className="text-[8px] font-black text-white/40 uppercase tracking-[0.2em]">Audit</span>
            </div>
            
            <div className="flex items-center gap-1.5 opacity-80">
              <div className={cn(
                "w-1.5 h-1.5 rounded-full shadow-[0_0_8px]",
                isSuccess ? "bg-green-500 shadow-green-500/50" : "bg-primary animate-pulse shadow-primary/50"
              )} />
              <span className="text-[8px] font-black text-white/60 uppercase tracking-tighter">Verified Active</span>
            </div>
          </div>
          
          <div className="bg-primary/10 border border-primary/20 rounded-md px-2 py-0.5 flex items-center gap-1.5">
            <Zap className="w-2 h-2 text-primary fill-primary" />
            <span className="text-[8px] font-black uppercase text-white tracking-widest">
              {chain || 'SYNC'}
            </span>
          </div>
        </div>

        {/* PROGRESS BAR */}
        <div className="px-1 mb-2">
          <div className="h-0.5 w-full bg-white/5 rounded-full overflow-hidden">
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

        {/* SLIM REGISTRY GRID */}
        <div className="grid grid-cols-2 gap-1.5">
          <AnimatePresence mode="wait">
            <motion.div 
              key={`${chain}-cloud`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="bg-white/[0.02] border border-white/5 rounded-lg px-2.5 flex flex-col h-10 justify-center"
            >
              <p className={cn(
                "text-[9px] font-mono tracking-tighter truncate leading-none",
                status === 'mismatch' ? "text-red-400 line-through" : "text-white/60"
              )}>
                {cloudValue ? truncateAddress(cloudValue) : 'Reading...'}
              </p>
            </motion.div>
          </AnimatePresence>

          <AnimatePresence mode="wait">
            <motion.div 
              key={`${chain}-local`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className={cn(
                "border rounded-lg px-2.5 flex flex-col h-10 justify-center transition-all duration-500",
                isMismatch ? "bg-red-500/5 border-red-500/30" : "bg-primary/5 border-primary/30"
              )}
            >
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
