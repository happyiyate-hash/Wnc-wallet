
'use client';

import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useUser } from '@/contexts/user-provider';
import { useWallet } from '@/contexts/wallet-provider';
import { useToast } from '@/hooks/use-toast';
import { ArrowDownLeft, Zap, ArrowUpRight, HandCoins } from 'lucide-react';
import type { Notification } from '@/lib/types';

/**
 * INSTITUTIONAL REAL-TIME SENTINEL (SYNC ENGINE)
 * Version: 15.0.0 (Lifecycle Integration & Balance Cross-Trigger)
 * 
 * Ensures notifications are fetched on app start and resume.
 * Triggers WNC balance refresh upon relevant incoming events.
 */
export default function RealtimeNotificationListener() {
  const { user, refreshProfile } = useUser();
  const { setUnreadCount, refresh, setNotifications, setIsNotificationsLoaded } = useWallet();
  const { toast } = useToast();
  
  const lastUserIdRef = useRef<string | null>(null);

  /**
   * REGISTRY HANDSHAKE (Initial & Resume Fetch)
   */
  const fetchInitialBatch = useCallback(async () => {
    if (!user || !supabase) return;
    
    console.log("[SENTINEL] Syncing notification registry for node:", user.id);
    
    try {
      // Attempt high-fidelity fetch with profile join
      const { data, error } = await supabase
        .from('notifications')
        .select('*, sender:profiles!from_user_id(name, photo_url)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(30);

      if (error) {
        // Fallback Join logic
        const { data: simpleJoin } = await supabase
          .from('notifications')
          .select('*, sender:profiles(name, photo_url)')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(30);
        
        if (simpleJoin) {
          setNotifications(simpleJoin as any[]);
          setUnreadCount(simpleJoin.filter((n: any) => !n.read).length);
        } else {
          // Raw Fallback
          const { data: rawData } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(30);
          if (rawData) {
            setNotifications(rawData as Notification[]);
            setUnreadCount(rawData.filter(n => !n.read).length);
          }
        }
      } else if (data) {
        setNotifications(data as Notification[]);
        setUnreadCount(data.filter(n => !n.read).length);
      }
    } catch (e) {
      console.warn("[SENTINEL] Registry revalidation interrupted.");
    } finally {
      setIsNotificationsLoaded(true);
    }
  }, [user, setNotifications, setIsNotificationsLoaded, setUnreadCount]);

  // 1. BOOT SYNC
  useEffect(() => {
    if (!user || !supabase || lastUserIdRef.current === user.id) {
      if (!user) setIsNotificationsLoaded(true);
      return;
    }
    lastUserIdRef.current = user.id;
    fetchInitialBatch();
  }, [user, fetchInitialBatch, setIsNotificationsLoaded]);

  // 2. RESUME SYNC (App returned to foreground)
  useEffect(() => {
    if (!user) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log("[SENTINEL] App resumed - Revalidating alerts...");
        fetchInitialBatch();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [user, fetchInitialBatch]);

  // 3. PERSISTENT SENTINEL STREAM (Filtered Subscription)
  useEffect(() => {
    if (!user || !supabase) return;

    console.log("[SENTINEL] Establishing live registry channel for node:", user.id);

    const channel = supabase
      .channel(`registry-alerts-${user.id}`)
      .on('postgres_changes', { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'notifications', 
          filter: `user_id=eq.${user.id}` 
      }, async (payload) => {
          console.log("[SENTINEL] Live ledger event detected.");
          
          // Enrich data with identity join
          const { data: enriched } = await supabase
            .from('notifications')
            .select('*, sender:profiles!from_user_id(name, photo_url)')
            .eq('id', payload.new.id)
            .single();

          const newNode = (enriched || payload.new) as Notification;

          // Atomic UI Update
          setNotifications(prev => [newNode, ...prev].slice(0, 30));
          setUnreadCount(prev => prev + 1);
          
          // CROSS-NODE TRIGGER: If it's a transfer in or reward, refresh WNC balance instantly
          if (newNode.type === 'TRANSFER_IN' || newNode.type === 'REWARD') {
            console.log("[SENTINEL] Incoming credits detected - Forcing balance re-sync.");
            refreshProfile();
          }
          
          // Broadcast Visual Handshake
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
          
          refresh(); // Sync blockchain balances
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, setUnreadCount, refresh, toast, setNotifications, refreshProfile]);

  return null;
}
