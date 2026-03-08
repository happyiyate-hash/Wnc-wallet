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
 * Version: 14.0.0 (Ultra-Slim Neymar + Bottom-Left Precision)
 */
export default function NotificationCenter() {
  const { isNotificationsOpen, setIsNotificationsOpen, setUnreadCount, notifications, setNotifications, isNotificationsLoaded } = useWallet();
  const { user } = useUser();

  useEffect(() => {
    if (isNotificationsOpen && user && supabase && notifications.length > 0) {
      const markAsRead = async () => {
        const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
        if (unreadIds.length === 0) return;

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
        return <ArrowDownLeft className="w-3.5 h-3.5" />;
      case 'TRANSFER_OUT':
        return <ArrowUpRight className="w-3.5 h-3.5" />;
      case 'REQUEST':
        return <HandCoins className="w-3.5 h-3.5" />;
      default:
        return <Zap className="w-3.5 h-3.5" />;
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
          className="absolute top-0 inset-x-0 bg-[#0a0a0c]/80 backdrop-blur-3xl border-b border-white/10 rounded-b-[2rem] shadow-2xl h-[70vh] flex flex-col overflow-hidden"
        >
          {/* ULTRA-SLIM NEYMAR HEADER */}
          <div className="px-6 h-10 border-b border-white/5 flex items-center justify-between bg-black/40 shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                <Bell className="w-3 h-3" />
              </div>
              <h3 className="text-[9px] font-black uppercase tracking-[0.25em] text-white">Registry Nodes</h3>
            </div>
            <button 
              onClick={() => setIsNotificationsOpen(false)}
              className="p-1 rounded-lg hover:bg-white/5 transition-colors"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-2.5 space-y-1.5 pb-20">
              {!isNotificationsLoaded ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4 opacity-40">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  <p className="text-[9px] font-black uppercase tracking-widest text-white">Synchronizing Registry...</p>
                </div>
              ) : notifications.length > 0 ? (
                notifications.map((n, i) => {
                  const isPositive = n.type === 'TRANSFER_IN' || n.type === 'REWARD';
                  const val = Number(n.amount);
                  const formattedAmount = !isNaN(val) 
                    ? val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) 
                    : null;
                  
                  // Peer Identity Node
                  const peerName = n.sender?.name || 'Node';

                  return (
                    <motion.div 
                      key={n.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.02 }}
                      className={cn(
                        "group relative overflow-hidden rounded-xl border p-2 transition-all duration-300 shadow-xl active:scale-[0.99]",
                        n.read ? "bg-white/[0.02] border-white/5" : "bg-primary/[0.05] border-primary/30"
                      )}
                    >
                      <div className="flex items-start gap-2.5 min-w-0">
                        {/* SLIM ICON */}
                        <div className={cn(
                          "w-9 h-9 rounded-xl flex items-center justify-center border shrink-0 transition-transform group-hover:scale-105",
                          isPositive ? "bg-green-500/10 border-green-500/20 text-green-400" : "bg-red-500/10 border-red-500/20 text-red-400"
                        )}>
                          {getIcon(n.type)}
                        </div>
                        
                        {/* SLIM STRETCHED CONTENT */}
                        <div className="flex-1 min-w-0 flex flex-col justify-between min-h-[36px]">
                          <div className="flex items-baseline justify-between w-full">
                              <p className="text-[10px] font-black text-white uppercase tracking-tight truncate mr-2">{n.title}</p>
                              {/* ANCHORED IDENTITY (FAR RIGHT) */}
                              <span className="text-[9px] font-black text-primary uppercase tracking-tighter shrink-0 opacity-80">
                                  @{peerName}
                              </span>
                          </div>
                          
                          <div className="flex items-end justify-between w-full mt-auto">
                              {/* PRECISION AMOUNT BADGE (BOTTOM-LEFT) */}
                              {formattedAmount && (
                                <div className={cn(
                                  "px-1.5 py-0.5 rounded-lg text-[9px] font-black tabular-nums border leading-none",
                                  getStatusColor(n.type)
                                )}>
                                  {isPositive ? '+' : '-'}{formattedAmount} WNC
                                </div>
                              )}
                              
                              <p className="text-[7px] text-muted-foreground font-bold truncate opacity-40 uppercase tracking-widest">
                                  {n.created_at ? formatDistanceToNow(new Date(n.created_at), { addSuffix: true }) : 'Just now'}
                              </p>
                          </div>
                        </div>
                      </div>
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