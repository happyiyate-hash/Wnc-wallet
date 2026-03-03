'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { 
  Cloud, 
  Database, 
  Check, 
  AlertCircle, 
  RefreshCw, 
  Cpu, 
  Zap, 
  ShieldCheck,
  Search,
  X
} from 'lucide-react';
import { useWallet } from '@/contexts/wallet-provider';
import { cn } from '@/lib/utils';

/**
 * INSTITUTIONAL SYNC NODE (Quick Swap Style)
 * Re-engineered to match the layout, size, and positioning of the Quick Swap component.
 * Features vertical fade-and-slide transitions and premium corner badges.
 */
export default function CloudSyncCard() {
  const { syncDiagnostic } = useWallet();
  const { status, chain, localValue, cloudValue, progress } = syncDiagnostic;

  if (status === 'idle') return null;

  const getStatusIcon = () => {
    switch (status) {
      case 'checking': return <Search className="w-3 h-3 animate-pulse" />;
      case 'mismatch': return <AlertCircle className="w-3 h-3" />;
      case 'syncing': return <RefreshCw className="w-3 h-3 animate-spin" />;
      case 'success':
      case 'completed': return <Check className="w-3 h-3" />;
      default: return <Cloud className="w-3 h-3" />;
    }
  };

  const truncateAddress = (addr: string | null) => {
    if (!addr) return 'None';
    if (addr === 'Encrypted Phrase' || addr === 'Stored' || addr === 'Missing') return addr;
    return `${addr.slice(0, 10)}...${addr.slice(-8)}`;
  };

  const textVariants = {
    initial: { opacity: 0, y: 15 },
    animate: { opacity: 1, y: 0, transition: { type: 'spring', damping: 20, stiffness: 300 } },
    exit: { opacity: 0, y: -10, transition: { duration: 0.2 } }
  };

  const badgeVariants = {
    initial: { scale: 0, opacity: 0 },
    animate: { 
      scale: 1, 
      opacity: 1, 
      transition: { type: 'spring', stiffness: 400, damping: 15 } 
    }
  };

  return (
    <motion.div 
      initial={{ y: -120, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -120, opacity: 0 }}
      transition={{ type: 'spring', damping: 25, stiffness: 120 }}
      className="fixed top-3 left-2 right-2 z-[110] pointer-events-none"
    >
      <div className="bg-[#050505]/95 backdrop-blur-3xl border border-white/10 rounded-[2rem] p-3.5 max-w-lg mx-auto pointer-events-auto shadow-[0_20px_80px_rgba(0,0,0,0.8)] relative overflow-hidden">
        
        {/* HEADER: SYNC TITLE & PROTOCOL BADGE */}
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-2 bg-primary/10 px-3 py-0.5 rounded-full border border-primary/20">
            <Zap className="w-2.5 h-2.5 text-primary fill-primary animate-pulse" />
            <span className="text-[7px] font-black uppercase tracking-[0.15em] text-primary">Institutional Sync Node</span>
          </div>
          
          <AnimatePresence mode="wait">
            {chain && (
              <motion.div 
                key={chain}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="flex items-center gap-1.5"
              >
                <span className="text-[8px] font-black uppercase text-muted-foreground/40 tracking-widest">Protocol:</span>
                <span className="text-[9px] font-black text-white px-2 py-0.5 bg-white/5 rounded-md border border-white/5">{chain}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* DATA SLOTS: CLOUD & LOCAL */}
        <div className="space-y-1.5 relative">
          
          {/* SLOT 1: CLOUD REGISTRY */}
          <div className="relative h-12 px-4 rounded-xl bg-white/[0.03] border border-white/5 flex flex-col justify-center shadow-inner group">
            <div className="flex items-center gap-1.5 mb-0.5">
              <Database className="w-2.5 h-2.5 text-purple-400 opacity-60" />
              <span className="text-[8px] font-black text-purple-400/60 uppercase tracking-widest">Cloud Registry</span>
            </div>
            
            <div className="overflow-hidden h-4">
              <AnimatePresence mode="wait">
                <motion.p 
                  key={chain ? `cloud-${chain}-${cloudValue}` : 'empty-cloud'}
                  variants={textVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  className={cn(
                    "text-[10px] font-mono tracking-tight transition-all duration-500",
                    status === 'mismatch' ? "text-red-400 line-through opacity-50" : "text-white/70"
                  )}
                >
                  {truncateAddress(cloudValue)}
                </motion.p>
              </AnimatePresence>
            </div>

            {/* CORNER BADGE: CLOUD */}
            <AnimatePresence>
              {(status === 'success' || status === 'completed') && (
                <motion.div 
                  variants={badgeVariants}
                  initial="initial"
                  animate="animate"
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-black/80 border border-[#00FF00] shadow-[0_0_10px_rgba(0,255,0,0.4)] flex items-center justify-center z-20 backdrop-blur-md"
                >
                  <Check className="w-3 h-3 text-[#00FF00]" strokeWidth={3} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* SLOT 2: LOCAL NODE */}
          <div className="relative h-12 px-4 rounded-xl bg-primary/5 border border-primary/20 flex flex-col justify-center shadow-inner group">
            <div className="flex items-center gap-1.5 mb-0.5">
              <Cpu className="w-2.5 h-2.5 text-primary" />
              <span className="text-[8px] font-black text-primary uppercase tracking-widest">Local Hardware Node</span>
            </div>
            
            <div className="overflow-hidden h-4">
              <AnimatePresence mode="wait">
                <motion.p 
                  key={chain ? `local-${chain}-${localValue}` : 'empty-local'}
                  variants={textVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  className="text-[10px] font-mono text-white tracking-tight"
                >
                  {truncateAddress(localValue)}
                </motion.p>
              </AnimatePresence>
            </div>

            {/* CORNER BADGE: LOCAL */}
            <AnimatePresence>
              {(status === 'success' || status === 'completed') && (
                <motion.div 
                  variants={badgeVariants}
                  initial="initial"
                  animate="animate"
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-black/80 border border-[#00FF00] shadow-[0_0_10px_rgba(0,255,0,0.4)] flex items-center justify-center z-20 backdrop-blur-md"
                >
                  <Check className="w-3 h-3 text-[#00FF00]" strokeWidth={3} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* FINAL INTEGRITY OVERLAY */}
          <AnimatePresence>
            {status === 'completed' && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute inset-0 z-30 flex items-center justify-center bg-[#050505]/90 backdrop-blur-md rounded-xl border border-green-500/30 shadow-[0_0_40px_rgba(34,197,94,0.15)]"
              >
                <div className="flex items-center gap-3">
                  <ShieldCheck className="w-4 h-4 text-green-500 animate-pulse" />
                  <span className="text-[9px] font-black text-green-500 uppercase tracking-[0.4em]">Registry Integrity: Nominal</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* FOOTER: STATUS & PROGRESS */}
        <div className="mt-3 flex items-center justify-between px-1">
          <div className="flex items-center gap-3 text-[8px] font-black uppercase text-muted-foreground/40 tracking-[0.1em]">
            <div className="flex items-center gap-1.5">
              <div className={cn(
                "w-1.5 h-1.5 rounded-full animate-pulse",
                status === 'completed' ? "bg-green-500" : "bg-primary"
              )} />
              <span>Status: {status.toUpperCase()}</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-1 h-1 rounded-full bg-white/10" />
              <span>Watchdog Sync: ACTIVE</span>
            </div>
          </div>
          <span className="text-[8px] font-mono text-primary/60 font-black">{Math.round(progress)}%</span>
        </div>

        {/* BOTTOM PRECISION PROGRESS LINE */}
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/5 overflow-hidden">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ type: 'spring', damping: 30, stiffness: 50 }}
            className={cn(
              "h-full bg-gradient-to-r transition-colors duration-500",
              status === 'mismatch' ? "from-red-500 to-orange-500" : "from-primary to-purple-500"
            )}
          />
        </div>
      </div>
    </motion.div>
  );
}
