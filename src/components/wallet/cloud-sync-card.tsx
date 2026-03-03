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
  Search
} from 'lucide-react';
import { useWallet } from '@/contexts/wallet-provider';
import { cn } from '@/lib/utils';

/**
 * INSTITUTIONAL SYNC HEADER BAR (Slim Top Node)
 * Re-engineered from a centered card to a top-fixed horizontal banner.
 * Features corner-badge verification nodes with Neon Green styling.
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
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const swipeVariants = {
    initial: { x: "50%", opacity: 0 },
    animate: { x: 0, opacity: 1, transition: { type: 'spring', damping: 25, stiffness: 200 } },
    exit: { x: "-100%", opacity: 0, transition: { duration: 0.4, ease: "easeInOut" } }
  };

  const badgeVariants = {
    initial: { scale: 0, opacity: 0 },
    animate: { 
      scale: 1, 
      opacity: 1, 
      transition: { type: 'spring', stiffness: 300, damping: 20 } 
    }
  };

  return (
    <motion.div 
      initial={{ y: -120, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -120, opacity: 0 }}
      transition={{ type: 'spring', damping: 25, stiffness: 120 }}
      className="fixed top-0 left-0 right-0 z-[110]"
    >
      <div className="bg-[#050505]/95 backdrop-blur-3xl border-b border-white/10 h-[100px] px-6 py-3 relative flex flex-col justify-center shadow-[0_10px_50px_rgba(0,0,0,0.5)]">
        
        {/* TOP ROW: HEADER & GLOBAL BADGE */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-8 h-8 rounded-xl flex items-center justify-center transition-colors duration-500 shadow-lg",
              status === 'mismatch' ? "bg-red-500/20 text-red-500" : "bg-primary/10 text-primary"
            )}>
              {getStatusIcon()}
            </div>
            <div>
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white">
                {status === 'completed' ? 'Registry Verified' : 'Cloud Sync Node'}
              </h3>
              <p className="text-[7px] font-black uppercase text-muted-foreground tracking-widest opacity-60">
                Hardware Identity Handshake
              </p>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {chain && (
              <motion.div 
                key={chain}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="bg-primary/10 border border-primary/20 px-3 py-1 rounded-full flex items-center gap-2"
              >
                <Zap className="w-2.5 h-2.5 text-primary fill-primary" />
                <span className="text-[9px] font-black text-white">{chain}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* BOTTOM ROW: SIDE-BY-SIDE SLIM NODES WITH CORNER BADGES */}
        <div className="grid grid-cols-2 gap-4 relative h-12">
          
          {/* SLOT 1: CLOUD REGISTRY */}
          <div className="relative">
            <AnimatePresence mode="wait">
              <motion.div 
                key={chain ? `cloud-${chain}` : 'empty-cloud'}
                variants={swipeVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="h-full px-3 rounded-xl bg-white/[0.03] border border-white/5 flex flex-col justify-center relative overflow-visible"
              >
                <div className="flex items-center gap-1.5 mb-0.5">
                  <Database className="w-2.5 h-2.5 text-purple-400 opacity-60" />
                  <span className="text-[8px] font-black text-purple-400/60 uppercase tracking-widest">Cloud</span>
                </div>
                <p className={cn(
                  "text-[9px] font-mono truncate transition-all duration-500",
                  status === 'mismatch' ? "text-red-400 line-through opacity-50" : "text-white/70"
                )}>
                  {truncateAddress(cloudValue)}
                </p>

                {/* PREMIUM SUCCESS BADGE (TOP-RIGHT) */}
                <AnimatePresence>
                  {(status === 'success' || status === 'completed') && (
                    <motion.div 
                      variants={badgeVariants}
                      initial="initial"
                      animate="animate"
                      className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-black/80 border border-[#00FF00] shadow-[0_0_10px_rgba(0,255,0,0.3)] flex items-center justify-center z-20"
                    >
                      <Check className="w-3 h-3 text-[#00FF00]" strokeWidth={3} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* SLOT 2: LOCAL NODE */}
          <div className="relative">
            <AnimatePresence mode="wait">
              <motion.div 
                key={chain ? `local-${chain}` : 'empty-local'}
                variants={swipeVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="h-full px-3 rounded-xl bg-primary/5 border border-primary/20 flex flex-col justify-center relative overflow-visible"
              >
                <div className="flex items-center gap-1.5 mb-0.5">
                  <Cpu className="w-2.5 h-2.5 text-primary" />
                  <span className="text-[8px] font-black text-primary uppercase tracking-widest">Local</span>
                </div>
                <p className="text-[9px] font-mono text-white truncate">
                  {truncateAddress(localValue)}
                </p>

                {/* PREMIUM SUCCESS BADGE (TOP-RIGHT) */}
                <AnimatePresence>
                  {(status === 'success' || status === 'completed') && (
                    <motion.div 
                      variants={badgeVariants}
                      initial="initial"
                      animate="animate"
                      className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-black/80 border border-[#00FF00] shadow-[0_0_10px_rgba(0,255,0,0.3)] flex items-center justify-center z-20"
                    >
                      <Check className="w-3 h-3 text-[#00FF00]" strokeWidth={3} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* BIG SUCCESS OVERLAY (FINAL STATE) */}
          <AnimatePresence>
            {status === 'completed' && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute inset-0 z-30 flex items-center justify-center bg-[#050505]/90 backdrop-blur-sm rounded-xl border border-green-500/30 shadow-[0_0_30px_rgba(34,197,94,0.1)]"
              >
                <div className="flex items-center gap-3">
                  <ShieldCheck className="w-4 h-4 text-green-500" />
                  <span className="text-[9px] font-black text-green-500 uppercase tracking-[0.3em]">Integrity Locked</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* BOTTOM EDGE PRECISION PROGRESS LINE */}
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
