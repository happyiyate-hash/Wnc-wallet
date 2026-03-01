'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import GradientWalletIcon from './GradientWalletIcon';
import GradientGlobeIcon from './GradientGlobeIcon';
import GradientUserIcon from './GradientUserIcon';
import GradientSettingsIcon from './GradientSettingsIcon';
import GradientSwapIcon from './GradientSwapIcon';
import React from 'react';

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
}

export default function MobileNav() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  // HIDE ON ACTION PAGES & REQUEST FLOWS
  const isActionPage = 
    pathname === '/swap' || 
    pathname === '/send' || 
    pathname === '/receive' || 
    pathname === '/buy' ||
    pathname === '/request' ||
    pathname.startsWith('/request/');

  if (isActionPage) return null;

  const navItems: NavItem[] = [
    { href: '/', label: 'Wallet', icon: GradientWalletIcon },
    { href: '/browse', label: 'Browse', icon: GradientGlobeIcon },
    { href: '/swap', label: 'Swap', icon: GradientSwapIcon },
    { href: '/profile', label: 'Profile', icon: GradientUserIcon },
    { href: '/settings', label: 'Settings', icon: GradientSettingsIcon },
  ];
  
  const NavLink = ({ item }: { item: NavItem; }) => {
    const isActive = pathname === item.href;
    const Icon = item.icon;
    
    return (
        <Link 
          href={item.href} 
          className="flex flex-col items-center justify-center h-full flex-1 group transition-all"
        >
            <div className={cn(
              "p-1.5 rounded-xl transition-all",
              isActive ? "bg-primary/10" : ""
            )}>
              <Icon className={cn(
                'h-6 w-6 transition-all', 
                isActive ? 'opacity-100' : 'opacity-40 group-hover:opacity-100 grayscale'
              )} />
            </div>
            <span className={cn(
              "text-[9px] font-black uppercase tracking-tighter mt-1 transition-colors", 
              isActive ? "text-primary" : "text-muted-foreground"
            )}>
              {item.label}
            </span>
        </Link>
    );
  };

  return (
    <footer className="fixed z-50 left-0 right-0 bottom-0 md:hidden bg-black border-t border-primary/80">
      <div className="safe-area-bottom">
          <nav className="flex h-[72px] w-full items-center justify-around px-2">
              {navItems.map((item) => <NavLink key={item.label} item={item} />)}
          </nav>
      </div>
    </footer>
  );
}
