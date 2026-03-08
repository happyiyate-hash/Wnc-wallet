
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
 * Version: 18.0.0 (SmarterSeller Sync Protocol)
 * 
 * Implements the SmarterSeller "Instant-Sync" architecture:
 * 1. Global postgres_changes listener for 'notifications'
 * 2. Immediate UI Toast broadcast
 * 3. Automatic balance revalidation for financial events
 */
export default function RealtimeNotificationListener() {
  const { user, refreshProfile } = useUser();
  const { setUnreadCount, refresh, setNotifications, setIsNotificationsLoaded } = useWallet();
  const { toast } = useToast();
  
  const lastUserIdRef = useRef<string | null>(null);

  /**
   * ATOMIC REGISTRY REVALIDATION
   * Fetches the latest state for both notifications and the balance profile.
   * Triggered on Boot, App Resume, and Financial Notification Events.
   */
  const revalidateRegistryNodes = useCallback(async () => {
    if (!user || !supabase) return;
    
    console.log("[SENTINEL] Syncing global registry nodes...");
    
    try {
      // 1. Fetch Notification Batch with Profile Join
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

      // 2. Refresh Profile (WNC Balance)
      await refreshProfile();

      // 3. Sync Blockchain Wallets (RPCs)
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

  // 2. SMARTERSELLER REAL-TIME LISTENER
  useEffect(() => {
    if (!user || !supabase) return;

    console.log("[SENTINEL] Initializing SmarterSeller Real-time Node:", user.id);

    // CHANNEL: Notification Alerts (INSERT)
    const channel = supabase
      .channel(`user-alerts-${user.id}`)
      .on('postgres_changes', { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'notifications', 
          filter: `user_id=eq.${user.id}` 
      }, async (payload) => {
          console.log("[SENTINEL] Live notification node detected.");
          
          const newRawNotif = payload.new as Notification;

          // Enrich data with identity join for better UI
          const { data: enriched } = await supabase
            .from('notifications')
            .select('*, sender:profiles!from_user_id(name, photo_url)')
            .eq('id', newRawNotif.id)
            .single();

          const newNode = (enriched || newRawNotif) as Notification;

          // A. Update Local Registry State
          setNotifications(prev => [newNode, ...prev].slice(0, 30));
          setUnreadCount(prev => prev + 1);
          
          // B. Broadast UI Toast
          const Icon = newNode.type === 'TRANSFER_IN' || newNode.type === 'REWARD' ? ArrowDownLeft : 
                       newNode.type === 'TRANSFER_OUT' ? ArrowUpRight : 
                       newNode.type === 'REQUEST' ? HandCoins : Zap;
          
          toast({
              title: newNode.title || "Registry Alert",
              description: newNode.message,
              action: (
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20 shadow-lg">
                  <Icon className="w-5 h-5" />
                </div>
              )
          });

          // C. Financial Event Trigger: Refresh balance immediately
          const financialTypes = ['TRANSFER_IN', 'TRANSFER_OUT', 'REWARD', 'BALANCE_DEDUCTION', 'REQUEST'];
          if (financialTypes.includes(newNode.type)) {
            console.log("[SENTINEL] Financial event detected. Synchronizing balance node...");
            refreshProfile();
          }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, setNotifications, setUnreadCount, refreshProfile, toast]);

  return null;
}
