'use client';

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { useUser } from "@/contexts/user-provider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Check, UserPlus, Trash2, ShieldCheck, ChevronRight } from 'lucide-react';
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import { ScrollArea } from "../ui/scroll-area";

interface AccountSwitcherSheetProps {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
}

export default function AccountSwitcherSheet({ isOpen, onOpenChange }: AccountSwitcherSheetProps) {
  const { sessions, activeSessionId, switchSession, removeSession, signOut } = useUser();

  const handleSwitch = async (sessionId: string) => {
    await switchSession(sessionId);
    onOpenChange(false);
  };

  const handleAddAccount = async () => {
    // Correctly terminate current user session to show login for "Add Account"
    await signOut();
    onOpenChange(false);
  };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="bg-[#0a0a0c] border-t border-primary/20 rounded-t-[3.5rem] p-0 h-[60vh] overflow-hidden shadow-2xl">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/10 via-transparent to-black/80 -z-10" />
        
        <div className="flex flex-col h-full relative z-10">
            <div className="w-12 h-1 bg-white/10 rounded-full mx-auto my-4 shrink-0" />
            
            <SheetHeader className="px-6 mb-6">
              <SheetTitle className="text-2xl font-black uppercase tracking-widest text-center">Node Identities</SheetTitle>
              <SheetDescription className="text-center text-[10px] text-muted-foreground uppercase tracking-widest font-bold">
                Switch between saved vault profiles
              </SheetDescription>
            </SheetHeader>

            <ScrollArea className="flex-1 px-6">
              <div className="space-y-2 pb-24">
                {sessions.map((session) => (
                    <div 
                        key={session.id}
                        className={cn(
                            "flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer group active:scale-[0.98]",
                            activeSessionId === session.id 
                                ? "bg-primary/10 border-primary/40 shadow-[0_0_20px_rgba(139,92,246,0.1)]" 
                                : "bg-white/5 border-white/5 hover:bg-white/10"
                        )}
                        onClick={() => handleSwitch(session.id)}
                    >
                        <div className="flex items-center gap-4">
                            <div className="relative">
                                <Avatar className="w-12 h-12 rounded-xl border border-white/10">
                                    <AvatarImage src={session.profile.photo_url} />
                                    <AvatarFallback className="bg-zinc-900 text-primary font-black uppercase">
                                        {session.profile.name?.[0] || 'U'}
                                    </AvatarFallback>
                                </Avatar>
                                {activeSessionId === session.id && (
                                    <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-[#0a0a0c] flex items-center justify-center">
                                        <Check className="w-3 h-3 text-white" />
                                    </div>
                                )}
                            </div>
                            <div className="text-left">
                                <div className="flex items-center gap-2">
                                    <p className="font-black text-sm text-white tracking-tight">{session.profile.name}</p>
                                    <ShieldCheck className="w-3 h-3 text-primary" />
                                </div>
                                <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold opacity-60">
                                    ID: {session.profile.account_number || '---'}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            {activeSessionId !== session.id && (
                                <button 
                                    onClick={(e) => { e.stopPropagation(); removeSession(session.id); }}
                                    className="p-2 rounded-lg hover:bg-red-500/20 text-muted-foreground hover:text-red-500 transition-all opacity-0 group-hover:opacity-100"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            )}
                            <ChevronRight className="w-4 h-4 text-muted-foreground opacity-40" />
                        </div>
                    </div>
                ))}

                <button 
                    onClick={handleAddAccount}
                    className="w-full flex items-center gap-4 p-4 rounded-2xl bg-white/[0.02] border border-dashed border-white/10 hover:bg-white/5 transition-all group"
                >
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                        <UserPlus className="w-6 h-6" />
                    </div>
                    <div className="text-left">
                        <p className="font-bold text-sm text-white">Add New Identity</p>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-black opacity-40">Register or Import Node</p>
                    </div>
                </button>
              </div>
            </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  );
}
