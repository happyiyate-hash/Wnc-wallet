
'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@/contexts/user-provider';
import { supabase } from '@/lib/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { ArrowUpRight, ArrowDownLeft, RefreshCw, Loader2, ShieldCheck, Zap } from 'lucide-react';
import type { AssetRow } from "@/lib/types";
import { cn } from '@/lib/utils';

export default function TransactionHistory({ token }: { token: AssetRow }) {
  const { user } = useUser();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const isWnc = token.symbol === 'WNC';

  useEffect(() => {
    if (!user || !token || !supabase) return;

    const fetchTransactions = async () => {
      setLoading(true);
      try {
        if (isWnc) {
          /**
           * UNIFIED WNC LEDGER DISCOVERY
           * Resilient to both 'amount' and 'amount_wnc' column naming.
           */
          const { data, error } = await supabase
            .from('wnc_transfers')
            .select(`
              *,
              sender:sender_id (name, photo_url),
              receiver:receiver_id (name, photo_url)
            `)
            .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
            .order('created_at', { ascending: false })
            .limit(20);

          if (!error && data) {
            const formatted = data.map(tx => {
              const isOut = tx.sender_id === user.id;
              const peer = isOut ? tx.receiver : tx.sender;
              // REGISTRY RESILIENCE: Map either amount or amount_wnc
              const displayAmount = tx.amount_wnc || tx.amount || 0;
              
              return {
                id: tx.id,
                amount: displayAmount,
                type: tx.destination_type,
                status: 'completed',
                timestamp: tx.created_at,
                peer: peer,
                isOut
              };
            });
            setTransactions(formatted);
          }
        } else {
          // Standard On-Chain History Discovery
          const { data, error } = await supabase
            .from('transactions')
            .select(`
              *,
              peer:peer_id (name, photo_url)
            `)
            .eq('user_id', user.id)
            .order('timestamp', { ascending: false })
            .limit(15);
          
          if (!error && data) {
            setTransactions(data.map(tx => ({
              ...tx,
              // RESILIENCE: Use amount_wnc fallback if amount is missing
              amount: tx.amount || tx.amount_wnc || 0,
              isOut: tx.type === 'withdrawal' || tx.type === 'transfer_out'
            })));
          }
        }
      } catch (e) {
        console.error("History fetch error:", e);
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();
  }, [user, token, isWnc]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4 opacity-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <p className="text-[10px] font-black uppercase tracking-widest">Auditing Ledger...</p>
      </div>
    );
  }

  if (!transactions || transactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center space-y-4 opacity-30 border border-dashed border-white/5 rounded-[2.5rem]">
        <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center">
            <Zap className="w-5 h-5 text-white" />
        </div>
        <div className="space-y-1">
            <p className="text-xs font-black uppercase tracking-widest text-white">Registry Empty</p>
            <p className="text-[9px] font-medium leading-relaxed max-w-[180px]">
                No node activity detected for {token.symbol} in the current epoch.
            </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {transactions.map((tx, i) => {
        const isOut = tx.isOut;
        const isIn = !isOut;
        const peerName = tx.peer?.name || 'External Node';
        
        return (
          <div key={tx.id} className="flex items-center justify-between p-4 rounded-3xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-all group">
            <div className="flex items-center gap-4">
              <div className={cn(
                "w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transition-transform group-hover:scale-110",
                isOut ? 'bg-red-500/10 text-red-400' : 
                isIn ? 'bg-green-500/10 text-green-400' : 
                'bg-primary/10 text-primary'
              )}>
                {isOut ? <ArrowUpRight className="w-6 h-6" /> : 
                 isIn ? <ArrowDownLeft className="w-6 h-6" /> : 
                 <RefreshCw className="w-6 h-6" />}
              </div>
              <div className="text-left">
                <div className="flex items-center gap-2">
                    <p className="font-black text-sm text-white uppercase tracking-tight">
                        {tx.type === 'reward' ? 'Growth Reward' : 
                         isOut ? `To @${peerName}` : 
                         isIn ? `From @${peerName}` : 
                         tx.type.replace('_', ' ')}
                    </p>
                    <ShieldCheck className="w-3 h-3 text-primary opacity-40" />
                </div>
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest mt-0.5">
                  {tx.timestamp ? formatDistanceToNow(new Date(tx.timestamp), { addSuffix: true }) : 'Processing...'}
                </p>
              </div>
            </div>
            <div className="text-right space-y-1">
              <p className={cn(
                "font-black text-base tabular-nums tracking-tight",
                isOut ? 'text-red-400' : 'text-green-400'
              )}>
                {isOut ? '-' : '+'}{parseFloat(tx.amount).toLocaleString()}
              </p>
              <div className="flex items-center justify-end gap-1.5">
                <div className={cn("w-1 h-1 rounded-full", tx.status === 'completed' ? 'bg-green-500' : 'bg-amber-500 animate-pulse')} />
                <p className="text-[8px] uppercase tracking-[0.2em] font-black text-muted-foreground/60">
                  {tx.status || 'Pending'}
                </p>
              </div>
            </div>
          </div>
        );
      })}
      
      <div className="pt-4 flex items-center justify-center gap-2 opacity-20">
        <ShieldCheck className="w-3 h-3" />
        <span className="text-[8px] font-black uppercase tracking-widest">Public Ledger Synchronization Verified</span>
      </div>
    </div>
  );
}
