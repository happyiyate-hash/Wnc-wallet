'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { 
  Cloud, 
  Database, 
  CheckCircle2, 
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
 * INSTITUTIONAL SYNC OVERLAY (Independent 3D Space)
 * Re-engineered for SLIM MODE: h-16 cards with inline verification.
 * Implements vertical Fade-and-Slide with isolated animation slots.
 */
export default function CloudSyncCard() {
  const { syncDiagnostic } = useWallet();
  const { status, chain, localValue, cloudValue, progress } = syncDiagnostic;

  if (status === 'idle') return null;

  const getStatusColor = () => {
    switch (status) {
      case 'mismatch': return 'text-red-400';
      case 'syncing': return 'text-primary';
      case 'success':
      case 'completed': return 'text-green-400';
      default: return 'text-blue-400';
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'checking': return <Search className="w-4 h-4 animate-pulse" />;
      case 'mismatch': return <AlertCircle className="w-4 h-4" />;
      case 'syncing': return <RefreshCw className="w-4 h-4 animate-spin" />;
      case 'success':
      case 'completed': return <CheckCircle2 className="w-4 h-4" />;
      default: return <Cloud className="w-4 h-4" />;
    }
  };

  const truncateAddress = (addr: string | null) => {
    if (!addr) return 'None';
    if (addr === 'Encrypted Phrase') return addr;
    if (addr === 'Stored') return addr;
    if (addr === 'Missing') return addr;
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  // VERTICAL FADE VARIANTS: Optimized for Independent Space & Slim Profile
  const cardVariants = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } },
    exit: { opacity: 0, y: -15, transition: { duration: 0.3 } }
  };

  return (
    <motion.div 
      initial={{ y: -150, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -150, opacity: 0 }}
      transition={{ type: 'spring', damping: 25, stiffness: 120 }}
      className="fixed top-20 left-4 right-4 z-[100] max-w-lg mx-auto"
    >
      <div className="bg-[#0a0a0c]/95 backdrop-blur-3xl border border-white/10 rounded-[3rem] p-6 shadow-2xl overflow-hidden relative">
        {/* Hardware-Level Glow */}
        <div className="absolute inset-0 pointer-events-none opacity-20">
            <motion.div 
                animate={{ 
                    scale: [1, 1.4, 1],
                    opacity: [0.2, 0.4, 0.2]
                }}
                transition={{ duration: 3, repeat: Infinity }}
                className={cn(
                    "absolute -right-20 -top-20 w-64 h-64 blur-3xl rounded-full transition-colors duration-1000",
                    status === 'mismatch' ? "bg-red-500" : status === 'success' || status === 'completed' ? "bg-green-500" : "bg-primary"
                )}
            />
        </div>

        <div className="relative z-10 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-12 h-12 rounded-2xl flex items-center justify-center transition-colors duration-500 shadow-xl",
                status === 'mismatch' ? "bg-red-500/20 text-red-500" : "bg-primary/10 text-primary"
              )}>
                {getStatusIcon()}
              </div>
              <div>
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white">
                  {status === 'completed' ? 'Registry Verified' : 'Cloud Sync Node'}
                </h3>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <div className={cn(
                    "w-1 h-1 rounded-full animate-pulse",
                    status === 'completed' ? "bg-green-500" : "bg-primary"
                  )} />
                  <span className="text-[8px] font-black uppercase text-muted-foreground tracking-widest">
                    {status === 'completed' ? 'System Integrity: Locked' : 'Hardware Identity Handshake'}
                  </span>
                </div>
              </div>
            </div>
            
            <AnimatePresence mode="wait">
                {chain && (
                    <motion.div 
                        key={chain}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="bg-primary/10 border border-primary/20 px-4 py-1.5 rounded-full flex items-center gap-2"
                    >
                        <Zap className="w-3 h-3 text-primary fill-primary" />
                        <span className="text-[10px] font-black text-white">{chain}</span>
                    </motion.div>
                )}
            </AnimatePresence>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center px-1">
                <span className={cn("text-[10px] font-black uppercase tracking-widest", getStatusColor())}>
                    {status === 'checking' && `Scanning ${chain} Registry...`}
                    {status === 'mismatch' && 'Registry Conflict Detected'}
                    {status === 'syncing' && 'Reconciling Identity Nodes...'}
                    {status === 'success' && `${chain} Integrity Verified`}
                    {status === 'completed' && 'Institutional Handshake Complete'}
                </span>
                <span className="text-[10px] font-mono text-muted-foreground">{Math.round(progress)}%</span>
            </div>
            <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.4, ease: "linear" }}
                    className={cn(
                        "h-full bg-gradient-to-r transition-colors duration-500",
                        status === 'mismatch' ? "from-red-500 to-orange-500" : "from-primary to-purple-500"
                    )}
                />
            </div>
          </div>

          {/* INDEPENDENT CARD SPACE - SLIM MODE */}
          <div className="relative min-h-[80px] flex items-center justify-center">
            <div className="grid grid-cols-2 gap-4 w-full">
                
                {/* SLOT 1: CLOUD REGISTRY */}
                <div className="relative">
                    <AnimatePresence mode="wait">
                        <motion.div 
                            key={chain ? `cloud-${chain}` : 'empty-cloud'}
                            variants={cardVariants}
                            initial="initial"
                            animate="animate"
                            exit="exit"
                            className="h-16 py-2 px-4 rounded-2xl bg-white/[0.03] border border-white/5 flex flex-col justify-center shadow-2xl relative group overflow-hidden"
                        >
                            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-transparent to-transparent opacity-50" />
                            <div className="flex items-center gap-2 relative z-10 mb-1">
                                <Database className="w-3 h-3 text-purple-400" />
                                <span className="text-[9px] font-black text-purple-400/60 uppercase tracking-widest">Cloud Registry</span>
                            </div>
                            <p className={cn(
                                "text-[10px] font-mono truncate transition-all duration-500 relative z-10",
                                status === 'mismatch' ? "text-red-400 line-through opacity-50" : "text-white/80"
                            )}>
                                {truncateAddress(cloudValue)}
                            </p>
                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* SLOT 2: LOCAL NODE */}
                <div className="relative">
                    <AnimatePresence mode="wait">
                        <motion.div 
                            key={chain ? `local-${chain}` : 'empty-local'}
                            variants={cardVariants}
                            initial="initial"
                            animate="animate"
                            exit="exit"
                            className="h-16 py-2 px-4 rounded-2xl bg-primary/5 border border-primary/20 flex flex-col justify-center relative shadow-2xl group overflow-hidden"
                        >
                            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent opacity-50" />
                            <div className="flex items-center justify-between relative z-10 mb-1">
                                <div className="flex items-center gap-2">
                                    <Cpu className="w-3 h-3 text-primary" />
                                    <span className="text-[9px] font-black text-primary uppercase tracking-widest">Local Node</span>
                                </div>
                                <AnimatePresence>
                                    {(status === 'success' || status === 'completed') && (
                                        <motion.div 
                                            initial={{ scale: 0, opacity: 0 }}
                                            animate={{ scale: 1, opacity: 1 }}
                                            exit={{ scale: 0, opacity: 0 }}
                                        >
                                            <div className="bg-green-500 rounded-full p-0.5 shadow-lg">
                                                <CheckCircle2 className="w-2.5 h-2.5 text-white" />
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                            <p className="text-[10px] font-mono text-white relative z-10 truncate">
                                {truncateAddress(localValue)}
                            </p>
                        </motion.div>
                    </AnimatePresence>
                </div>
            </div>

            {/* BIG SUCCESS OVERLAY (CENTRAL BEAT) */}
            <AnimatePresence>
                {status === 'completed' && (
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="absolute inset-0 z-30 flex items-center justify-center bg-[#0a0a0c]/80 backdrop-blur-sm rounded-[2.5rem]"
                    >
                        <div className="flex flex-col items-center gap-4">
                            <div className="w-16 h-16 rounded-[2rem] bg-green-500/20 border border-green-500/40 flex items-center justify-center text-green-500 shadow-[0_0_40px_rgba(34,197,94,0.2)]">
                                <ShieldCheck className="w-10 h-10" />
                            </div>
                            <p className="text-[10px] font-black text-green-500 uppercase tracking-[0.3em]">Integrity Locked</p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
          </div>

          {status === 'mismatch' && (
            <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-center gap-3 py-2.5 px-4 rounded-2xl bg-red-500/10 border border-red-500/20"
            >
                <AlertCircle className="w-4 h-4 text-red-500" />
                <span className="text-[9px] font-black text-red-500 uppercase tracking-widest leading-none">
                    Registry Conflict: Automatic Reconciliation Active
                </span>
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
