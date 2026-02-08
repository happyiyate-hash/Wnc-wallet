'use client';

import { useMemo } from 'react';
import { useCollection, useUser, useFirestore } from '@/firebase';
import { collection, query, where, orderBy, limit } from 'firebase/firestore';
import { formatDistanceToNow } from 'date-fns';
import { ArrowUpRight, ArrowDownLeft, RefreshCw, Loader2 } from 'lucide-react';
import type { AssetRow } from "@/lib/types";

export default function TransactionHistory({ token }: { token: AssetRow }) {
  const { user } = useUser();
  const db = useFirestore();

  const historyQuery = useMemo(() => {
    if (!db || !user || !token) return null;
    return query(
      collection(db, 'users', user.uid, 'transactions'),
      where('symbol', '==', token.symbol),
      orderBy('timestamp', 'desc'),
      limit(10)
    );
  }, [db, user, token]);

  const { data: transactions, loading } = useCollection<any>(historyQuery);

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
                {tx.timestamp?.toDate ? formatDistanceToNow(tx.timestamp.toDate(), { addSuffix: true }) : 'Pending...'}
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
