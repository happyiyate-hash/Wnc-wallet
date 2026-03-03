
'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { 
  CheckCircle2, 
  RefreshCw, 
  Search, 
  AlertCircle, 
  Zap, 
  ShieldCheck 
} from 'lucide-react';
import { useWallet } from '@/contexts/wallet-provider';
import { cn } from '@/lib/utils';

/**
 * INSTITUTIONAL DIAGNOSTIC SENTINEL
 * Consolidated Single-Node Audit UI.
 * Implements "Snap-Dwell-Snap" rhythm for high-fidelity verification.
 */
export default function CloudSyncCard() {
  const { syncDiagnostic } = useWallet();
  const { status, chain, localValue, progress } = syncDiagnostic;
  
  if (status === 'idle') return null;

  const truncateAddress = (addr: string | null) => {
    if (!addr) return 'None';
    return `${addr.slice(0, 10)}...${addr.slice(-8)}`;
  };

  const renderStatusIcon = () => {
    switch (status) {
      case 'checking':
        return <Search className="w-4 h-4 text-white/80 animate-pulse" />;
      case 'mismatch':
        return <AlertCircle className="w-4 h-4 text-red-500 animate-pulse" />;
      case 'syncing':
        return <RefreshCw className="w-4 h-4 text-primary animate-spin" />;
      case 'success':
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      default:
        return <RefreshCw className="w-4 h-4 text-primary" />;
    }
  };

  const isMismatch = status === 'mismatch' || status === 'syncing';

  return (
    <motion.div 
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -100, opacity: 0 }}
      transition={{ type: 'spring', damping: 30, stiffness: 150 }}
      className="fixed top-4 left-4 right-4 z-[100] max-w-lg mx-auto will-change-transform"
    >
      <div className={cn(
        "backdrop-blur-3xl border rounded-[2rem] p-5 shadow-2xl relative overflow-hidden transition-all duration-500",
        isMismatch ? "bg-red-500/10 border-red-500/30" : "bg-[#0a0a0c]/95 border-white/10"
      )}>
        
        {/* HEADER COCKPIT */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-10 h-10 rounded-2xl flex items-center justify-center transition-colors duration-500 shadow-lg",
              (status === 'success' || status === 'completed') ? "bg-green-500/10" : isMismatch ? "bg-red-500/20" : "bg-white/5"
            )}>
              {renderStatusIcon()}
            </div>
            <div className="flex flex-col">
              <h3 className="text-xs font-black uppercase tracking-widest text-white leading-none">Identity Auditor</h3>
              <p className="text-[8px] font-black uppercase text-white/40 tracking-widest mt-1.5 opacity-60">Cryptographic Handshake Protocol</p>
            </div>
          </div>
          
          <div className="px-4 py-1.5 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-primary fill-primary" />
            <AnimatePresence mode="wait">
              <motion.span 
                key={chain}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="text-xs font-black uppercase text-white tracking-widest"
              >
                {chain || 'Registry'}
              </motion.span>
            </AnimatePresence>
          </div>
        </div>

        {/* UNIFIED AUDIT NODE BOX - ONE PER BLOCKCHAIN */}
        <div className="relative mb-6">
          <AnimatePresence mode="wait">
            <motion.div 
              key={chain}
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -20, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className={cn(
                "w-full p-5 rounded-[1.5rem] flex items-center justify-between border transition-all duration-500 shadow-inner",
                isMismatch ? "bg-red-500/5 border-red-500/20" : "bg-white/[0.03] border-white/5"
              )}
            >
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <ShieldCheck className={cn("w-3 h-3", isMismatch ? "text-red-500" : "text-primary")} />
                  <span className="text-[10px] font-black uppercase text-white/40 tracking-widest">
                    {isMismatch ? 'Mismatch Detected' : 'Verified Node Hash'}
                  </span>
                </div>
                <p className={cn(
                  "font-mono text-sm font-bold tracking-tighter transition-colors duration-500",
                  isMismatch ? "text-red-400" : "text-white"
                )}>
                  {truncateAddress(localValue)}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <AnimatePresence mode="wait">
                  {(status === 'success' || status === 'completed') ? (
                    <motion.div 
                      key="success-mark"
                      initial={{ scale: 0, rotate: -45 }}
                      animate={{ scale: 1, rotate: 0 }}
                      className="w-8 h-8 rounded-xl bg-green-500/20 flex items-center justify-center border border-green-500/30 shadow-lg shadow-green-500/10"
                    >
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                    </motion.div>
                  ) : isMismatch ? (
                    <motion.div 
                      key="mismatch-mark"
                      animate={{ rotate: 360 }} 
                      transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                    >
                      <RefreshCw className="w-5 h-5 text-red-500" />
                    </motion.div>
                  ) : (
                    <motion.div key="scanning-mark" className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                      <Search className="w-4 h-4 text-white/20" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* PROGRESS TRACKER */}
        <div className="space-y-2">
          <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ 
                width: `${progress}%`,
                backgroundColor: isMismatch ? '#ef4444' : '#8b5cf6' 
              }}
              transition={{ 
                width: { type: "spring", stiffness: 60, damping: 20 },
                backgroundColor: { duration: 0.4 } 
              }}
              className="h-full shadow-[0_0_15px_rgba(var(--primary),0.3)]"
            />
          </div>
          <div className="flex justify-between items-center px-1">
            <span className={cn(
              "text-[9px] font-black uppercase tracking-widest transition-colors duration-500",
              isMismatch ? "text-red-500" : "text-muted-foreground"
            )}>
              {status === 'mismatch' ? 'REGISTRY DISCREPANCY' : status === 'syncing' ? 'REPAIRING NODE...' : (status === 'success' || status === 'completed') ? 'NODE VERIFIED' : 'ANALYZING REGISTRY...'}
            </span>
            <span className="text-[9px] font-black text-white/40 uppercase tabular-nums">{Math.round(progress)}%</span>
          </div>
        </div>

      </div>
    </motion.div>
  );
}
