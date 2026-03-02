
'use client';

import { useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useUser } from '@/contexts/user-provider';
import { useWallet } from '@/contexts/wallet-provider';
import { useToast } from '@/hooks/use-toast';

/**
 * INSTITUTIONAL REAL-TIME LISTENER
 * Monitors the 'notifications' table for new ledger events and deductions.
 */
export default function RealtimeNotificationListener() {
  const { user } = useUser();
  const { setHasNewNotifications, refresh } = useWallet();
  const { toast } = useToast();

  useEffect(() => {
    if (!user || !supabase) return;

    // Establishing the real-time tunnel
    const channel = supabase
      .channel(`realtime-notifications-${user.id}`)
      .on('postgres_changes', { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'notifications', 
          filter: `user_id=eq.${user.id}` 
      }, (payload) => {
          // This runs instantly when the SQL trigger inserts a row
          setHasNewNotifications(true);
          
          // Institutional Alert Handshake
          toast({
              title: payload.new.title || "Registry Alert",
              description: payload.new.message,
              variant: payload.new.type === 'BALANCE_DEDUCTION' ? 'destructive' : 'default'
          });
          
          // Refresh balance silently to reflect deduction/credit
          refresh(); 
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, setHasNewNotifications, refresh, toast]);

  return null;
}
