
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
 * Version: 17.0.0 (The Professional Handshake)
 * 
 * Implements the Triple-Trigger logic:
 * 1. Realtime Listeners (INSERT/UPDATE)
 * 2. Periodic Refresh (5s Heartbeat via UserProvider)
 * 3. App Lifecycle (Visibility Change)
 */
export default function RealtimeNotificationListener() {
  const { user, refreshProfile } = useUser();
  const { setUnreadCount, refresh, setNotifications, setIsNotificationsLoaded } = useWallet();
  const { toast } = useToast();
  
  const lastUserIdRef = useRef<string | null>(null);

  /**
   * ATOMIC REGISTRY REVALIDATION
   * Fetches the latest state for both notifications and the balance profile.
   * Triggered on Boot and App Resume.
   */
  const revalidateRegistryNodes = useCallback(async () => {
    if (!user || !supabase) return;
    
    console.log("[SENTINEL] Syncing global registry nodes...");
    
    try {
      // 1. Fetch Notification Batch
      const { data, error } = await supabase
        .from('notifications')
        .select('*, sender:profiles!from_user_id(name, photo_url)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(30);

      if (!error && data) {
        setNotifications(data as Notification[]);
        setUnreadCount(data.filter(n => !n.read).length);
      }

      // 2. Refresh Profile Balance (WNC)
      await refreshProfile();

      // 3. Sync Wallets (Blockchain RPCs)
      await refresh();

    } catch (e) {
      console.warn("[SENTINEL] Registry revalidation interrupted.");
    } finally {
      setIsNotificationsLoaded(true);
    }
  }, [user, setNotifications, setUnreadCount, refreshProfile, refresh, setIsNotificationsLoaded]);

  // 1. BOOT & APP LIFECYCLE SYNC
  useEffect(() => {
    if (!user || !supabase) {
      if (!user) setIsNotificationsLoaded(true);
      return;
    }

    // Trigger initial fetch on user identity change
    if (lastUserIdRef.current !== user.id) {
      lastUserIdRef.current = user.id;
      revalidateRegistryNodes();
    }

    // App Resume Handler (Visibility change)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log("[SENTINEL] App resumed - Executing priority handshake...");
        revalidateRegistryNodes();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [user, revalidateRegistryNodes, setIsNotificationsLoaded]);

  // 2. GLOBAL REAL-TIME CHANNELS
  useEffect(() => {
    if (!user || !supabase) return;

    console.log("[SENTINEL] Initializing real-time monitor for node:", user.id);

    // CHANNEL A: Notification Alerts (INSERT)
    const notificationChannel = supabase
      .channel(`realtime-notifications-${user.id}`)
      .on('postgres_changes', { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'notifications', 
          filter: `user_id=eq.${user.id}` 
      }, async (payload) => {
          console.log("[SENTINEL] Live notification node detected.");
          
          // Enrich data with identity join
          const { data: enriched } = await supabase
            .from('notifications')
            .select('*, sender:profiles!from_user_id(name, photo_url)')
            .eq('id', payload.new.id)
            .single();

          const newNode = (enriched || payload.new) as Notification;

          // Update local state & badge counter
          setNotifications(prev => [newNode, ...prev].slice(0, 30));
          setUnreadCount(prev => prev + 1);
          
          // Logic trigger: If money came in, refresh balance instantly
          if (newNode.type === 'TRANSFER_IN' || newNode.type === 'REWARD') {
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
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20 shadow-lg">
                  <Icon className="w-5 h-5" />
                </div>
              )
          });
      })
      .subscribe();

    // CHANNEL B: Balance Node Monitor (UPDATE on Profiles)
    // Ensures balance updates instantly even without notification
    const balanceChannel = supabase
      .channel(`realtime-balance-${user.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'profiles',
        filter: `id=eq.${user.id}`
      }, () => {
        console.log("[SENTINEL] Live balance update detected via profile node.");
        refreshProfile();
      })
      .subscribe();

    // CHANNEL C: Direct Ledger Monitor (INSERT on Transfers)
    const ledgerChannel = supabase
      .channel(`realtime-ledger-${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'wnc_transfers',
        filter: `receiver_id=eq.${user.id}`
      }, () => {
        console.log("[SENTINEL] Incoming WNC detected via direct ledger.");
        refreshProfile();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(notificationChannel);
      supabase.removeChannel(balanceChannel);
      supabase.removeChannel(ledgerChannel);
    };
  }, [user, setNotifications, setUnreadCount, refreshProfile, toast]);

  return null;
}
