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
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  return (
    <motion.div 
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -100, opacity: 0 }}
      className="fixed top-4 left-4 right-4 z-[100] max-w-lg mx-auto"
    >
      <div className="bg-[#0a0a0c]/90 backdrop-blur-3xl border border-white/5 rounded-[2.5rem] p-5 shadow-2xl overflow-hidden relative">
        {/* Background Animation Node */}
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-20">
            <motion.div 
                animate={{ 
                    scale: [1, 1.2, 1],
                    opacity: [0.3, 0.5, 0.3]
                }}
                transition={{ duration: 4, repeat: Infinity }}
                className={cn(
                    "absolute -right-20 -top-20 w-64 h-64 blur-3xl rounded-full transition-colors duration-1000",
                    status === 'mismatch' ? "bg-red-500" : status === 'success' ? "bg-green-500" : "bg-primary"
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
                  Cloud Node Active
                </h3>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <div className="w-1 h-1 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-[8px] font-black uppercase text-muted-foreground tracking-widest">
                    Hardware Integrity Check
                  </span>
                </div>
              </div>
            </div>
            
            {chain && (
                <div className="bg-white/5 border border-white/10 px-3 py-1 rounded-full flex items-center gap-2">
                    <Zap className="w-2.5 h-2.5 text-primary fill-primary" />
                    <span className="text-[9px] font-black text-white">{chain}</span>
                </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center px-1">
                <span className={cn("text-[9px] font-black uppercase tracking-widest", getStatusColor())}>
                    {status === 'checking' && `Scanning ${chain} Registry...`}
                    {status === 'mismatch' && 'Registry Conflict Detected'}
                    {status === 'syncing' && 'Reconciling Nodes...'}
                    {status === 'success' && `${chain} Verified & Locked`}
                    {status === 'completed' && 'Institutional Sync Complete'}
                </span>
                <span className="text-[9px] font-mono text-muted-foreground">{Math.round(progress)}%</span>
            </div>
            <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    className="h-full bg-gradient-to-r from-primary to-purple-500"
                />
            </div>
          </div>

          <AnimatePresence mode="wait">
            <motion.div 
                key={chain}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="grid grid-cols-2 gap-2"
            >
                <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/5 space-y-1">
                    <div className="flex items-center gap-1.5">
                        <Database className="w-2.5 h-2.5 text-muted-foreground" />
                        <span className="text-[7px] font-black text-muted-foreground uppercase">Cloud Registry</span>
                    </div>
                    <p className={cn(
                        "text-[10px] font-mono truncate",
                        status === 'mismatch' ? "text-red-400 line-through" : "text-white/60"
                    )}>
                        {truncateAddress(cloudValue)}
                    </p>
                </div>
                <div className="p-3 rounded-2xl bg-primary/5 border border-primary/20 space-y-1">
                    <div className="flex items-center gap-1.5">
                        <Cpu className="w-2.5 h-2.5 text-primary" />
                        <span className="text-[7px] font-black text-primary uppercase">Local Node</span>
                    </div>
                    <p className="text-[10px] font-mono text-white truncate">
                        {truncateAddress(localValue)}
                    </p>
                </div>
            </motion.div>
          </AnimatePresence>

          {status === 'mismatch' && (
            <div className="flex items-center justify-center gap-2 py-1 px-4 rounded-xl bg-red-500/10 border border-red-500/20 animate-pulse">
                <AlertCircle className="w-3 h-3 text-red-500" />
                <span className="text-[8px] font-black text-red-500 uppercase tracking-widest">
                    Outdated Registry Node Found - Auto Repair Initialized
                </span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
