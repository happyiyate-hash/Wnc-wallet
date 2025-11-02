'use client';

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";

interface NotificationCenterProps {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    userId: string;
}

export default function NotificationCenter({ isOpen, onOpenChange, userId }: NotificationCenterProps) {
  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Notifications</SheetTitle>
          <SheetDescription>
            Recent activity and alerts.
          </SheetDescription>
        </SheetHeader>
        <div className="py-4">
          <p>Notification items for user {userId} will be displayed here.</p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
