'use client';

import { useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Bell, Loader2, X, CheckCircle2, Zap, ArrowDownLeft, ArrowUpRight, HandCoins } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { useWallet } from '@/contexts/wallet-provider';
import { useUser } from '@/contexts/user-provider';
import { ScrollArea } from '../ui/scroll-area';
import { cn } from '@/lib/utils';
import type { Notification } from '@/lib/types';

/**
 * INSTITUTIONAL NOTIFICATION CENTER (VIEW NODE)
 * Version: 13.0.0 (Neymar Slim + Precision Decimals)
 */
export default function NotificationCenter() {
  const { isNotificationsOpen, setIsNotificationsOpen, setUnreadCount, notifications, setNotifications, isNotificationsLoaded } = useWallet();
  const { user } = useUser();

  useEffect(() => {
    if (isNotificationsOpen && user && supabase && notifications.length > 0) {
      const markAsRead = async () => {
        const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
        if (unreadIds.length === 0) return;

        // Optimistic UI Handshake
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        setUnreadCount(0);

        try {
          await supabase.from('notifications').update({ read: true }).in('id', unreadIds);
        } catch (e) {
          console.warn("[REGISTRY] Mark as read handshake deferred.");
        }
      };

      markAsRead();
    }
  }, [isNotificationsOpen, user, notifications, setNotifications, setUnreadCount]);

  const getIcon = (type: string) => {
    switch (type) {
      case 'TRANSFER_IN':
      case 'REWARD':
        return <ArrowDownLeft className="w-3 h-3" />;
      case 'TRANSFER_OUT':
        return <ArrowUpRight className="w-3 h-3" />;
      case 'REQUEST':
        return <HandCoins className="w-3 h-3" />;
      default:
        return <Zap className="w-3 h-3" />;
    }
  };

  const getStatusColor = (type: string) => {
    switch (type) {
      case 'TRANSFER_IN':
      case 'REWARD':
        return 'bg-green-500/20 text-green-400 border-green-500/30 shadow-[0_0_15px_rgba(34,197,94,0.3)]';
      case 'TRANSFER_OUT':
        return 'bg-red-500/20 text-red-400 border-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.3)]';
      default:
        return 'bg-primary/20 text-primary border-primary/30 shadow-[0_0_15px_rgba(139,92,246,0.3)]';
    }
  };

  if (!isNotificationsOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[200] overflow-hidden">
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          exit={{ opacity: 0 }}
          onClick={() => setIsNotificationsOpen(false)}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />

        <motion.div 
          initial={{ y: '-100%' }}
          animate={{ y: 0 }}
          exit={{ y: '-100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="absolute top-0 inset-x-0 bg-[#0a0a0c]/80 backdrop-blur-3xl border-b border-white/10 rounded-b-[2.5rem] shadow-2xl h-[75vh] flex flex-col overflow-hidden"
        >
          {/* SLIM NEYMAR HEADER */}
          <div className="px-6 h-12 border-b border-white/5 flex items-center justify-between bg-black/40 shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                <Bell className="w-3.5 h-3.5" />
              </div>
              <h3 className="text-[10px] font-black uppercase tracking-[0.25em] text-white">Registry</h3>
            </div>
            <button 
              onClick={() => setIsNotificationsOpen(false)}
              className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 transition-colors border border-white/10"
            >
              <X className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-3 space-y-1.5 pb-20">
              {!isNotificationsLoaded ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4 opacity-40">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  <p className="text-[9px] font-black uppercase tracking-widest text-white">Auditing Ledger...</p>
                </div>
              ) : notifications.length > 0 ? (
                notifications.map((n, i) => {
                  const isPositive = n.type === 'TRANSFER_IN' || n.type === 'REWARD';
                  
                  // PRECISION DECIMAL HANDSHAKE: Ensure non-zero decimals are visible
                  const val = Number(n.amount);
                  const formattedAmount = !isNaN(val) 
                    ? val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) 
                    : null;
                  
                  // Peer Identity Resolution
                  const peerName = n.sender?.name || 'External Node';

                  return (
                    <motion.div 
                      key={n.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.02 }}
                      className={cn(
                        "group relative overflow-hidden rounded-2xl border p-2.5 transition-all duration-300 shadow-xl",
                        n.read ? "bg-white/[0.02] border-white/5" : "bg-primary/[0.05] border-primary/30"
                      )}
                    >
                      <div className="flex items-center justify-between gap-3 min-w-0">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          {/* SLIM ICON */}
                          <div className={cn(
                            "w-8 h-8 rounded-xl flex items-center justify-center border shrink-0 transition-transform group-hover:scale-105",
                            isPositive ? "bg-green-500/10 border-green-500/20 text-green-400" : "bg-red-500/10 border-red-500/20 text-red-400"
                          )}>
                            {getIcon(n.type)}
                          </div>
                          
                          {/* SLIM CONTENT */}
                          <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
                            <div className="flex items-baseline justify-between w-full">
                                <p className="text-[10px] font-black text-white uppercase tracking-wider truncate mr-2">{n.title}</p>
                                {/* PEER IDENTITY (FAR RIGHT) */}
                                <span className="text-[8px] font-black text-primary uppercase tracking-tighter shrink-0 opacity-60">
                                    @{peerName}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <p className="text-[8px] text-muted-foreground font-medium truncate opacity-60">
                                    {n.created_at ? formatDistanceToNow(new Date(n.created_at), { addSuffix: true }) : 'Just now'}
                                </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* BOTTOM-LEFT AMOUNT PILL (Slim Placement) */}
                      {formattedAmount && (
                        <div className="mt-1.5 flex pl-11">
                          <div className={cn(
                            "px-2 py-0.5 rounded-lg text-[9px] font-black tabular-nums border",
                            getStatusColor(n.type)
                          )}>
                            {isPositive ? '+' : '-'}{formattedAmount} WNC
                          </div>
                        </div>
                      )}
                    </motion.div>
                  );
                })
              ) : (
                <div className="py-32 flex flex-col items-center justify-center text-center space-y-4 opacity-30">
                  <CheckCircle2 className="w-10 h-10 text-white/20" />
                  <p className="text-[9px] font-black uppercase tracking-widest text-white">Registry Nominal</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
