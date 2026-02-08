'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@/contexts/user-provider';
import { supabase } from '@/lib/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { ArrowUpRight, ArrowDownLeft, RefreshCw, Loader2 } from 'lucide-react';
import type { AssetRow } from "@/lib/types";

export default function TransactionHistory({ token }: { token: AssetRow }) {
  const { user } = useUser();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !token) return;

    const fetchTransactions = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('timestamp', { ascending: false })
        .limit(10);
      
      setTransactions(data || []);
      setLoading(false);
    };

    fetchTransactions();
  }, [user, token]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!transactions || transactions.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm border border-dashed border-white/10 rounded-2xl">
        No recent activity for {token.symbol}.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {transactions.map((tx) => (
        <div key={tx.id} className="flex items-center justify-between p-4 rounded-2xl bg-secondary/20 border border-white/5">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
              tx.type === 'withdrawal' ? 'bg-red-500/10 text-red-400' : 
              tx.type === 'deposit' ? 'bg-green-500/10 text-green-400' : 
              'bg-primary/10 text-primary'
            }`}>
              {tx.type === 'withdrawal' ? <ArrowUpRight className="w-5 h-5" /> : 
               tx.type === 'deposit' ? <ArrowDownLeft className="w-5 h-5" /> : 
               <RefreshCw className="w-5 h-5" />}
            </div>
            <div>
              <p className="font-bold text-sm capitalize">{tx.type}</p>
              <p className="text-xs text-muted-foreground">
                {tx.timestamp ? formatDistanceToNow(new Date(tx.timestamp), { addSuffix: true }) : 'Just now'}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className={`font-bold text-sm ${tx.type === 'withdrawal' ? 'text-red-400' : 'text-green-400'}`}>
              {tx.type === 'withdrawal' ? '-' : '+'}{tx.amount} {token.symbol}
            </p>
            <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
              {tx.status}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
