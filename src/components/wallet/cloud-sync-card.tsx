'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { 
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
 * INSTITUTIONAL DIAGNOSTIC SENTINEL
 * Implements Physical Card Swiping: The entire card container moves, not just the text.
 * Decoupled Architecture: Independent slots for Cloud and Local nodes with zero-clipping overlays.
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
      default: return <Database className="w-4 h-4" />;
    }
  };

  const truncateAddress = (addr: string | null) => {
    if (!addr) return 'None';
    if (addr === 'Encrypted Phrase' || addr === 'Stored' || addr === 'Missing') return addr;
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  // PHYSICAL SWIPE CONFIG: The entire card container slides horizontally
  const swipeVariants = {
    initial: { x: '110%', opacity: 0 },
    animate: { x: 0, opacity: 1, transition: { type: 'spring', damping: 25, stiffness: 150 } },
    exit: { x: '-110%', opacity: 0, transition: { duration: 0.3, ease: "easeInOut" } }
  };

  return (
    <div className="fixed top-20 left-4 right-4 z-[100] max-w-lg mx-auto flex flex-col gap-3 pointer-events-none">
      
      {/* 1. MASTER ANALYSIS CARD (MISSION CONTROL) */}
      <motion.div 
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -100, opacity: 0 }}
        className="bg-[#0a0a0c]/95 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] p-6 shadow-2xl relative overflow-hidden pointer-events-auto"
      >
        <div className="absolute inset-0 pointer-events-none opacity-10">
            <motion.div 
                animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.3, 0.1] }}
                transition={{ duration: 4, repeat: Infinity }}
                className={cn(
                    "absolute -right-20 -top-20 w-64 h-64 blur-3xl rounded-full transition-colors duration-1000",
                    status === 'mismatch' ? "bg-red-500" : status === 'success' || status === 'completed' ? "bg-green-500" : "bg-primary"
                )}
            />
        </div>

        <div className="relative z-10 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={cn(
                "w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transition-colors duration-500",
                status === 'mismatch' ? "bg-red-500/20" : "bg-primary/10"
              )}>
                {getStatusIcon()}
              </div>
              <div className="text-left">
                <h3 className="text-sm font-black uppercase tracking-[0.2em] text-white">Registry Sentinel</h3>
                <p className="text-[9px] font-black uppercase text-muted-foreground/60 tracking-widest mt-0.5">Hardware Identity Handshake</p>
              </div>
            </div>
            
            {chain && (
                <div className="bg-white/5 border border-white/10 px-4 py-1.5 rounded-full flex items-center gap-2">
                    <Zap className="w-3 h-3 text-primary fill-primary animate-pulse" />
                    <span className="text-[10px] font-black text-white">{chain}</span>
                </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center px-1">
                <span className={cn("text-[10px] font-black uppercase tracking-widest", getStatusColor())}>
                    {status === 'checking' && `Scanning ${chain} Registry...`}
                    {status === 'mismatch' && 'Registry mismatch'}
                    {status === 'syncing' && 'Reconciling Nodes...'}
                    {status === 'success' && 'Integrity Verified'}
                    {status === 'completed' && 'Handshake complete'}
                </span>
                <span className="text-[10px] font-mono text-muted-foreground">{Math.round(progress)}%</span>
            </div>
            <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.4 }}
                    className={cn(
                        "h-full bg-gradient-to-r transition-colors duration-500",
                        status === 'mismatch' ? "from-red-500 to-orange-500" : "from-primary to-purple-500"
                    )}
                />
            </div>
          </div>
        </div>
      </motion.div>

      {/* 2. PHYSICAL REGISTRY CARDS (DECOUPLED HORIZONTAL SWIPE) */}
      <div className="grid grid-cols-2 gap-3 h-24">
        
        {/* CLOUD REGISTRY SLOT */}
        <div className="relative overflow-visible pointer-events-auto">
            <AnimatePresence mode="popLayout">
                <motion.div 
                    key={`${chain}-cloud`}
                    variants={swipeVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    className="absolute inset-0 p-5 rounded-[2rem] border border-white/10 bg-[#0a0a0c]/90 backdrop-blur-3xl shadow-2xl flex flex-col justify-center space-y-1.5"
                >
                    <div className="flex items-center gap-2">
                        <Database className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">Cloud Registry</span>
                    </div>
                    <p className={cn(
                        "text-xs font-mono truncate transition-all duration-500",
                        status === 'mismatch' ? "text-red-400 line-through opacity-50" : "text-white/80"
                    )}>
                        {truncateAddress(cloudValue)}
                    </p>
                </motion.div>
            </AnimatePresence>
        </div>

        {/* LOCAL NODE SLOT */}
        <div className="relative overflow-visible pointer-events-auto">
            <AnimatePresence mode="popLayout">
                <motion.div 
                    key={`${chain}-local`}
                    variants={swipeVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    className={cn(
                        "absolute inset-0 p-5 rounded-[2rem] border backdrop-blur-3xl shadow-2xl transition-colors duration-500 bg-[#0a0a0c]/90 flex flex-col justify-center space-y-1.5",
                        status === 'success' || status === 'completed' ? "border-green-500/40 shadow-green-500/5" : "border-primary/20"
                    )}
                >
                    <div className="flex items-center gap-2">
                        <Cpu className="w-3.5 h-3.5 text-primary" />
                        <span className="text-[8px] font-black text-primary uppercase tracking-widest">Local Node</span>
                    </div>
                    <p className="text-xs font-mono text-white truncate">
                        {truncateAddress(localValue)}
                    </p>
                    
                    {/* PHYSICAL CHECKMARK OVERLAY (OUTSIDE POSITIONING) */}
                    {status === 'success' && (
                        <motion.div 
                            initial={{ scale: 0, rotate: -45 }}
                            animate={{ scale: 1, rotate: 0 }}
                            className="absolute -top-2 -right-2 z-[110]"
                        >
                            <CheckCircle2 className="w-6 h-6 text-green-500 fill-black shadow-2xl" />
                        </motion.div>
                    )}
                </motion.div>
            </AnimatePresence>
        </div>
      </div>

      {/* 3. FINAL INTEGRITY STATUS NODE */}
      <AnimatePresence>
        {status === 'completed' && (
          <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="flex items-center justify-center gap-2 py-3 px-6 rounded-2xl bg-green-500/10 border border-green-500/20 backdrop-blur-md shadow-xl pointer-events-auto"
          >
              <ShieldCheck className="w-4 h-4 text-green-500" />
              <span className="text-[9px] font-black text-green-500 uppercase tracking-[0.2em]">Institutional Vault Verified</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
