'use client';

import { useMemo } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { useCollection, useFirestore } from '@/firebase';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import { ShieldAlert, Info, Bell, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface NotificationCenterProps {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    userId: string;
}

export default function NotificationCenter({ isOpen, onOpenChange, userId }: NotificationCenterProps) {
  const db = useFirestore();

  const alertsQuery = useMemo(() => {
    if (!db || !userId) return null;
    return query(
      collection(db, 'users', userId, 'alerts'),
      orderBy('timestamp', 'desc'),
      limit(20)
    );
  }, [db, userId]);

  const { data: alerts, loading } = useCollection<any>(alertsQuery);

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="bg-background">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-primary" />
            Notifications
          </SheetTitle>
          <SheetDescription>
            Security alerts and account activity.
          </SheetDescription>
        </SheetHeader>
        
        <div className="py-6 space-y-4">
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : alerts && alerts.length > 0 ? (
            alerts.map((alert) => (
              <div key={alert.id} className={`p-4 rounded-2xl border ${
                alert.type === 'security' ? 'bg-destructive/10 border-destructive/20' : 'bg-secondary/30 border-white/5'
              }`}>
                <div className="flex gap-3">
                  {alert.type === 'security' ? (
                    <ShieldAlert className="w-5 h-5 text-destructive shrink-0" />
                  ) : (
                    <Info className="w-5 h-5 text-primary shrink-0" />
                  )}
                  <div className="space-y-1">
                    <p className="text-sm font-bold">{alert.title}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{alert.message}</p>
                    <p className="text-[10px] text-muted-foreground pt-1">
                      {alert.timestamp?.toDate ? formatDistanceToNow(alert.timestamp.toDate(), { addSuffix: true }) : 'Just now'}
                    </p>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-20">
              <div className="w-12 h-12 rounded-full bg-secondary/30 flex items-center justify-center mx-auto mb-4">
                <Bell className="w-6 h-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground font-medium">All caught up!</p>
              <p className="text-xs text-muted-foreground">No new notifications.</p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
