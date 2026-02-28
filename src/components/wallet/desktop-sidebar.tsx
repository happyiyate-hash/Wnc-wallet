
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { 
  Sidebar, 
  SidebarContent, 
  SidebarFooter, 
  SidebarHeader, 
  SidebarMenu, 
  SidebarMenuItem, 
  SidebarMenuButton 
} from '@/components/ui/sidebar';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import GradientWalletIcon from './GradientWalletIcon';
import GradientGlobeIcon from './GradientGlobeIcon';
import GradientSwapIcon from './GradientSwapIcon';
import GradientUserIcon from './GradientUserIcon';
import GradientSettingsIcon from './GradientSettingsIcon';
import { ShieldCheck, Cpu, LogOut, Trash2, ShieldX, Loader2 } from 'lucide-react';
import { useWallet } from '@/contexts/wallet-provider';
import { useUser } from '@/contexts/user-provider';
import { useToast } from '@/hooks/use-toast';

const navItems = [
  { href: '/', label: 'Wallet Terminal', icon: GradientWalletIcon },
  { href: '/browse', label: 'Ecosystem Browse', icon: GradientGlobeIcon },
  { href: '/swap', label: 'Liquidity Swap', icon: GradientSwapIcon },
  { href: '/profile', label: 'Identity Vault', icon: GradientUserIcon },
  { href: '/settings', label: 'Node Settings', icon: GradientSettingsIcon },
];

export default function DesktopSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { logout, deleteWallet } = useWallet();
  const { toast } = useToast();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
        await logout();
        toast({ title: "Session Terminated", description: "Identity and keys have been purged safely." });
        router.push('/');
    } catch (e) {
        toast({ title: "Logout Error", variant: "destructive" });
    } finally {
        setIsLoggingOut(false);
    }
  };

  return (
    <Sidebar className="hidden md:flex border-r border-white/5 bg-black/20 backdrop-blur-3xl w-64 shrink-0 overflow-hidden">
      <SidebarHeader className="p-6">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-2xl shadow-primary/20">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-black uppercase tracking-[0.2em] text-white">Wevina</span>
            <span className="text-[8px] font-black uppercase tracking-widest text-primary opacity-60">Terminal v3.0</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-4">
        <SidebarMenu className="gap-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            
            return (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton asChild>
                  <Link 
                    href={item.href}
                    className={cn(
                      "flex items-center gap-4 h-14 px-4 rounded-2xl transition-all group",
                      isActive ? "bg-primary/10 border border-primary/20" : "hover:bg-white/5 border border-transparent"
                    )}
                  >
                    <Icon className={cn(
                      "w-6 h-6 transition-all",
                      isActive ? "opacity-100 scale-110" : "opacity-40 group-hover:opacity-100"
                    )} />
                    <span className={cn(
                      "text-xs font-black uppercase tracking-widest transition-colors",
                      isActive ? "text-white" : "text-muted-foreground group-hover:text-white"
                    )}>
                      {item.label}
                    </span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter className="p-4 space-y-2 mt-auto pb-8">
        <div className="space-y-1">
            <AlertDialog>
                <AlertDialogTrigger asChild>
                    <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-red-500/10 text-red-500/60 hover:text-red-500 transition-all group">
                        <Trash2 className="w-4 h-4" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Purge Local Keys</span>
                    </button>
                </AlertDialogTrigger>
                <AlertDialogContent className="bg-black border-red-500/20 rounded-[2.5rem] shadow-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-xl font-black text-white uppercase tracking-tight">Purge Node Cache?</AlertDialogTitle>
                        <AlertDialogDescription className="text-zinc-400">
                            This will permanently remove the secret phrase from this device. Access can only be restored via Cloud Vault.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="mt-6">
                        <AlertDialogCancel className="rounded-2xl h-12 bg-white/5 border-white/10">Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={deleteWallet} className="bg-red-500 hover:bg-red-600 rounded-2xl h-12 font-black">Yes, Purge Node</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog>
                <AlertDialogTrigger asChild>
                    <button className="w-full flex items-center justify-between px-4 py-3 rounded-xl hover:bg-red-500/10 text-red-500/60 hover:text-red-500 transition-all group">
                        <div className="flex items-center gap-3">
                            {isLoggingOut ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldX className="w-4 h-4" />}
                            <span className="text-[10px] font-black uppercase tracking-widest">Terminate Session</span>
                        </div>
                        <LogOut className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                </AlertDialogTrigger>
                <AlertDialogContent className="bg-black border-red-500/20 rounded-[2.5rem] shadow-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-xl font-black text-white uppercase tracking-tight">End Node Session?</AlertDialogTitle>
                        <AlertDialogDescription className="text-zinc-400">
                            This will clear your credentials and end your active SmarterSeller session.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="mt-6">
                        <AlertDialogCancel className="rounded-2xl h-12 bg-white/5 border-white/10">Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleLogout} className="bg-red-500 hover:bg-red-600 rounded-2xl h-12 font-black">Yes, Terminate</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>

        <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[8px] font-black text-white/40 uppercase tracking-widest">Node Status: Active</span>
          </div>
          <div className="flex items-center gap-2">
            <Cpu className="w-3 h-3 text-primary opacity-40" />
            <span className="text-[7px] font-bold text-muted-foreground uppercase tracking-tighter">Watchdog Sync: Optimized</span>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
