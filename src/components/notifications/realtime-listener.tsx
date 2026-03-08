'use client';

import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useUser } from '@/contexts/user-provider';
import { useWallet } from '@/contexts/wallet-provider';
import { useToast } from '@/hooks/use-toast';
import { ArrowDownLeft, Zap, ArrowUpRight, HandCoins } from 'lucide-react';
import type { Notification } from '@/lib/types';

/**
 * INSTITUTIONAL REAL-TIME SENTINEL (SYNC ENGINE)
 * Version: 9.0.0 (Hardened Handshake Sentinel)
 */
export default function RealtimeNotificationListener() {
  const { user } = useUser();
  const { setUnreadCount, refresh, setNotifications, setIsNotificationsLoaded } = useWallet();
  const { toast } = useToast();
  const hasInitializedRef = useRef(false);

  useEffect(() => {
    if (!user || !supabase || hasInitializedRef.current) return;
    hasInitializedRef.current = true;

    const fetchInitialBatch = async () => {
      // 5-second hard limit for registry handshake
      const timeout = setTimeout(() => {
        setIsNotificationsLoaded(true);
      }, 5000);

      try {
        const { data, error } = await supabase
          .from('notifications')
          .select('*, sender:from_user_id(name, photo_url)')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(25);

        clearTimeout(timeout);

        if (!error && data) {
          setNotifications(data as Notification[]);
          const unread = data.filter(n => !n.read).length;
          setUnreadCount(unread);
        }
      } catch (e) {
        console.warn("[SENTINEL] Registry handshake deferred.");
      } finally {
        setIsNotificationsLoaded(true);
      }
    };

    fetchInitialBatch();
  }, [user, setNotifications, setIsNotificationsLoaded, setUnreadCount]);

  useEffect(() => {
    if (!user || !supabase) return;

    const channel = supabase
      .channel(`registry-handshakes-global-${user.id}`)
      .on('postgres_changes', { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'notifications', 
          filter: `user_id=eq.${user.id}` 
      }, async (payload) => {
          // Enrich the notification node silently
          const { data: enriched } = await supabase
            .from('notifications')
            .select('*, sender:from_user_id(name, photo_url)')
            .eq('id', payload.new.id)
            .single();

          const newNode = (enriched || payload.new) as Notification;

          setNotifications(prev => [newNode, ...prev].slice(0, 25));
          setUnreadCount(prev => prev + 1);
          
          const type = newNode.type;
          const Icon = type === 'TRANSFER_IN' || type === 'REWARD' ? ArrowDownLeft : 
                       type === 'TRANSFER_OUT' ? ArrowUpRight : 
                       type === 'REQUEST' ? HandCoins : Zap;
          
          toast({
              title: newNode.title || "Registry Alert",
              description: newNode.message,
              action: (
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-lg border border-primary/20">
                  <Icon className="w-5 h-5" />
                </div>
              )
          });
          
          refresh(); 
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, setUnreadCount, refresh, toast, setNotifications]);

  return null;
}
