
'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Bell, Loader2, X, CheckCircle2, ChevronRight, Zap, ArrowDownLeft, ArrowUpRight, QrCode, Workflow, TrendingUp, HandCoins } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { useWallet } from '@/contexts/wallet-provider';
import { useUser } from '@/contexts/user-provider';
import { ScrollArea } from '../ui/scroll-area';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import type { Notification } from '@/lib/types';

export default function NotificationCenter() {
  const { isNotificationsOpen, setIsNotificationsOpen, setUnreadCount } = useWallet();
  const { user } = useUser();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!supabase || !user || !isNotificationsOpen) return;

    const fetchNotifications = async () => {
      setLoading(true);
      try {
        let { data, error } = await supabase
          .from('notifications')
          .select(`
            *,
            sender:from_user_id (
              name,
              photo_url
            )
          `)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(25);

        if (error || !data) {
          const rawFetch = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(25);
          
          if (!rawFetch.error && rawFetch.data) {
            data = rawFetch.data as any;
          }
        }

        if (data) {
          setNotifications(data as Notification[]);
          setUnreadCount(0);
          
          const unreadIds = data.filter(n => !n.read).map(n => n.id);
          if (unreadIds.length > 0) {
            await supabase.from('notifications').update({ read: true }).in('id', unreadIds);
          }
        }
      } catch (e) {
        console.error("[REGISTRY_FETCH_FAIL]", e);
      } finally {
        setLoading(false);
      }
    };

    fetchNotifications();

    const channel = supabase
      .channel(`notifications-ui-sync-${user.id}`)
      .on('postgres_changes', { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'notifications', 
          filter: `user_id=eq.${user.id}` 
      }, (payload) => {
          const newNode = payload.new as Notification;
          setNotifications((prev) => [newNode, ...prev].slice(0, 25));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isNotificationsOpen, user, setUnreadCount]);

  const getIcon = (type: string) => {
    switch (type) {
      case 'TRANSFER_IN':
      case 'REWARD':
        return <ArrowDownLeft className="w-6 h-6" />;
      case 'TRANSFER_OUT':
        return <ArrowUpRight className="w-6 h-6" />;
      case 'QR_SCAN':
        return <QrCode className="w-6 h-6" />;
      case 'CROSS_CHAIN':
        return <Workflow className="w-6 h-6" />;
      case 'REQUEST':
        return <HandCoins className="w-6 h-6" />;
      default:
        return <Zap className="w-6 h-6" />;
    }
  };

  const getIconColor = (type: string) => {
    switch (type) {
      case 'TRANSFER_IN':
      case 'REWARD':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'TRANSFER_OUT':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      default:
        return 'bg-primary/20 text-primary border-primary/30';
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
          className="absolute top-0 inset-x-0 bg-[#0a0a0c]/90 backdrop-blur-3xl border-b border-white/10 rounded-b-[3.5rem] shadow-2xl h-[85vh] flex flex-col overflow-hidden"
        >
          <div className="p-8 border-b border-white/5 flex items-center justify-between bg-black/40">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-[0_0_20px_rgba(139,92,246,0.2)] border border-primary/20">
                <Bell className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-[0.25em] text-white">Registry Handshakes</h3>
                <p className="text-[9px] font-black uppercase text-primary opacity-60">Verified Identity Log</p>
              </div>
            </div>
            <button 
              onClick={() => setIsNotificationsOpen(false)}
              className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors border border-white/10"
            >
              <X className="w-6 h-6 text-muted-foreground" />
            </button>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-6 space-y-4 pb-24">
              {loading && notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 gap-4 opacity-40">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-white">Auditing Ledger...</p>
                </div>
              ) : notifications.length > 0 ? (
                notifications.map((n, i) => {
                  const isPositive = n.type === 'TRANSFER_IN' || n.type === 'REWARD';
                  
                  // Institutional Precision: Show exactly 2 decimals from the raw amount
                  const formattedAmount = n.amount 
                    ? n.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) 
                    : null;
                  
                  // Neymar Protocol: Clean message text by removing redundant long decimals
                  const cleanMessage = n.message 
                    ? n.message.replace(/\d+\.?\d*\s*WNC/g, '').replace(/\s+/g, ' ').trim()
                    : 'System update received.';
                  
                  return (
                    <motion.div 
                      key={n.id}
                      initial={{ opacity: 0, x: -20, scale: 0.95 }}
                      animate={{ opacity: 1, x: 0, scale: 1 }}
                      transition={{ delay: i * 0.05 }}
                      whileHover={{ scale: 1.02 }}
                      className={cn(
                        "group relative overflow-hidden rounded-[2.5rem] border p-1 transition-all duration-300",
                        n.read ? "bg-white/[0.02] border-white/5" : "bg-primary/[0.05] border-primary/30 shadow-[0_0_30px_rgba(139,92,246,0.1)]"
                      )}
                    >
                      <div className={cn(
                        "relative flex gap-4 p-5 rounded-[2.2rem] bg-black/40 backdrop-blur-xl transition-colors group-hover:bg-black/20",
                        !n.read && "border-l-4 border-l-primary"
                      )}>
                        {/* ICON NODE */}
                        <div className="relative shrink-0">
                          <div className={cn(
                            "w-14 h-14 rounded-2xl flex items-center justify-center border shadow-xl transition-transform group-hover:scale-110",
                            getIconColor(n.type)
                          )}>
                            {getIcon(n.type)}
                          </div>

                          {n.sender && (
                            <div className="absolute -bottom-1 -right-1 border-2 border-[#0a0a0c] rounded-full shadow-lg">
                              <Avatar className="w-6 h-6">
                                <AvatarImage src={n.sender.photo_url} />
                                <AvatarFallback className="bg-zinc-900 text-[8px] font-black">{n.sender.name?.[0] || '?'}</AvatarFallback>
                              </Avatar>
                            </div>
                          )}
                        </div>
                        
                        {/* MESSAGE CONTENT */}
                        <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
                          <p className="text-xs font-black text-white uppercase tracking-wider">{n.title}</p>
                          <p className="text-[10px] text-muted-foreground leading-relaxed font-medium line-clamp-2">
                            {cleanMessage}
                          </p>
                          <span className="text-[8px] font-black text-white/20 uppercase tracking-[0.2em] mt-1">
                            {n.created_at ? formatDistanceToNow(new Date(n.created_at), { addSuffix: true }) : 'Just now'}
                          </span>
                        </div>

                        {/* IDENTITY NODE (FAR RIGHT) */}
                        {n.sender && (
                          <div className="flex items-center pl-2 border-l border-white/5 ml-2">
                            <div className="flex flex-col items-end">
                              <span className="text-[8px] font-black text-primary uppercase tracking-widest opacity-40">NODE</span>
                              <span className="text-[10px] font-black text-white tracking-tight">@{n.sender.name}</span>
                            </div>
                          </div>
                        )}

                        {/* AMOUNT BADGE (DOWN RIGHT SIDE - REPOSITIONED) */}
                        {formattedAmount && (
                          <div className={cn(
                            "absolute bottom-3 right-5 px-3 py-1 rounded-full text-[10px] font-black tabular-nums border shadow-2xl z-20 animate-in slide-in-from-right-1",
                            isPositive ? "bg-green-500 text-white border-green-400 shadow-green-500/40" : "bg-red-500 text-white border-red-400 shadow-red-500/40"
                          )}>
                            {isPositive ? '+' : '-'}{formattedAmount}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })
              ) : (
                <div className="py-32 flex flex-col items-center justify-center text-center space-y-4 opacity-30">
                  <div className="w-20 h-20 rounded-[2.5rem] bg-white/5 border border-dashed border-white/10 flex items-center justify-center">
                    <CheckCircle2 className="w-10 h-10 text-white" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-black uppercase tracking-widest text-white">Registry Nominal</p>
                    <p className="text-[10px] font-medium leading-relaxed max-w-[200px]">
                      No identity events detected in this epoch.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          <div className="h-1.5 w-12 bg-white/10 rounded-full mx-auto mb-6 shrink-0" />
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
