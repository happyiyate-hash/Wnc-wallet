
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
 * INSTITUTIONAL SYNC OVERLAY
 * Optimized for "Real-Time" swiping feedback. 
 * Cards enter from right, pause for checkmark, and slide out to the left.
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

  // SLIDE TRANSITION CONFIG: No fading, strict horizontal flow
  const swipeVariants = {
    initial: { x: 50, opacity: 1 },
    animate: { x: 0, opacity: 1, transition: { type: 'spring', damping: 25, stiffness: 120 } },
    exit: { x: -100, opacity: 1, transition: { duration: 0.3, ease: "easeIn" } }
  };

  return (
    <motion.div 
      initial={{ y: -150, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -150, opacity: 0 }}
      transition={{ type: 'spring', damping: 25, stiffness: 120 }}
      className="fixed top-20 left-4 right-4 z-[100] max-w-lg mx-auto"
    >
      <div className="bg-[#0a0a0c]/90 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] p-5 shadow-2xl overflow-hidden relative">
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

        <div className="relative z-10 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-10 h-10 rounded-2xl flex items-center justify-center transition-colors duration-500",
                status === 'mismatch' ? "bg-red-500/20" : "bg-primary/10"
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
                        className="bg-white/5 border border-white/10 px-3 py-1 rounded-full flex items-center gap-2"
                    >
                        <Zap className="w-2.5 h-2.5 text-primary fill-primary" />
                        <span className="text-[9px] font-black text-white">{chain}</span>
                    </motion.div>
                )}
            </AnimatePresence>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center px-1">
                <span className={cn("text-[9px] font-black uppercase tracking-widest", getStatusColor())}>
                    {status === 'checking' && `Scanning ${chain} Registry...`}
                    {status === 'mismatch' && 'Registry Conflict Detected'}
                    {status === 'syncing' && 'Reconciling Identity Nodes...'}
                    {status === 'success' && `${chain} Integrity Verified`}
                    {status === 'completed' && 'Institutional Handshake Complete'}
                </span>
                <span className="text-[9px] font-mono text-muted-foreground">{Math.round(progress)}%</span>
            </div>
            <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.3, ease: "linear" }}
                    className={cn(
                        "h-full bg-gradient-to-r transition-colors duration-500",
                        status === 'mismatch' ? "from-red-500 to-orange-500" : "from-primary to-purple-500"
                    )}
                />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 h-16 relative">
            <AnimatePresence mode="popLayout">
                <motion.div 
                    key={`${chain}-cloud`}
                    variants={swipeVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    className="p-3 rounded-2xl bg-white/[0.03] border border-white/5 space-y-1 relative h-full flex flex-col justify-center"
                >
                    <div className="flex items-center gap-1.5">
                        <Database className="w-2.5 h-2.5 text-muted-foreground" />
                        <span className="text-[7px] font-black text-muted-foreground uppercase">Cloud Registry</span>
                    </div>
                    <p className={cn(
                        "text-[10px] font-mono truncate transition-all duration-500",
                        status === 'mismatch' ? "text-red-400 line-through scale-95 opacity-50" : "text-white/60"
                    )}>
                        {truncateAddress(cloudValue)}
                    </p>
                </motion.div>

                <motion.div 
                    key={`${chain}-local`}
                    variants={swipeVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    className="p-3 rounded-2xl bg-primary/5 border border-primary/20 space-y-1 relative h-full flex flex-col justify-center"
                >
                    <div className="flex items-center gap-1.5">
                        <Cpu className="w-2.5 h-2.5 text-primary" />
                        <span className="text-[7px] font-black text-primary uppercase">Local Node</span>
                    </div>
                    <p className="text-[10px] font-mono text-white truncate">
                        {truncateAddress(localValue)}
                    </p>
                    {status === 'success' && (
                        <motion.div 
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring', bounce: 0.5, delay: 0.1 }}
                            className="absolute -top-1 -right-1"
                        >
                            <CheckCircle2 className="w-3 h-3 text-green-500 fill-black" />
                        </motion.div>
                    )}
                </motion.div>
            </AnimatePresence>
          </div>

          {status === 'mismatch' && (
            <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-center gap-2 py-1.5 px-4 rounded-xl bg-red-500/10 border border-red-500/20"
            >
                <AlertCircle className="w-3 h-3 text-red-500" />
                <span className="text-[8px] font-black text-red-500 uppercase tracking-widest">
                    Registry Mismatch Found - Reconciling...
                </span>
            </motion.div>
          )}

          {status === 'completed' && (
            <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center justify-center gap-2 py-1 px-4 rounded-xl bg-green-500/10 border border-green-500/20"
            >
                <ShieldCheck className="w-3 h-3 text-green-500" />
                <span className="text-[8px] font-black text-green-500 uppercase tracking-widest">
                    Institutional Vault Verified
                </span>
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
