'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
import GradientWalletIcon from './GradientWalletIcon';
import GradientGlobeIcon from './GradientGlobeIcon';
import GradientSwapIcon from './GradientSwapIcon';
import GradientUserIcon from './GradientUserIcon';
import GradientSettingsIcon from './GradientSettingsIcon';
import { ShieldCheck, Cpu } from 'lucide-react';

const navItems = [
  { href: '/', label: 'Wallet Terminal', icon: GradientWalletIcon },
  { href: '/browse', label: 'Ecosystem Browse', icon: GradientGlobeIcon },
  { href: '/swap', label: 'Liquidity Swap', icon: GradientSwapIcon },
  { href: '/profile', label: 'Identity Vault', icon: GradientUserIcon },
  { href: '/settings', label: 'Node Settings', icon: GradientSettingsIcon },
];

export default function DesktopSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar className="hidden md:flex border-r border-white/5 bg-black/50 backdrop-blur-3xl w-64 shrink-0 overflow-hidden">
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

      <SidebarFooter className="p-6">
        <div className="p-4 rounded-[2rem] bg-white/[0.03] border border-white/5 space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[9px] font-black text-white/40 uppercase tracking-widest">Node Status: Active</span>
          </div>
          <div className="flex items-center gap-2">
            <Cpu className="w-3 h-3 text-primary opacity-40" />
            <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-tighter">Watchdog Sync: Optimized</span>
          </div>
        </div>
      </SidebarFooter>

      {/* BRAND WATERMARK */}
      <div className="absolute -bottom-20 -left-20 pointer-events-none opacity-[0.02] select-none rotate-12">
        <div className="text-[20rem] font-black italic">W</div>
      </div>
    </Sidebar>
  );
}
