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
          className="flex flex-col items-center justify-center p-1 flex-1 group gap-1 transition-all"
        >
            <div className={cn(
              "transition-all duration-300",
              isActive ? "scale-110" : "opacity-40 group-hover:opacity-100"
            )}>
              <Icon className="h-6 w-6" />
            </div>
            <span className={cn(
              "text-[8px] font-black uppercase tracking-widest transition-colors duration-300",
              isActive ? "text-primary" : "text-muted-foreground/60"
            )}>
              {item.label}
            </span>
        </Link>
    );
  };

  return (
    <footer className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-black/90 backdrop-blur-2xl border-t-2 border-primary">
      <nav className="flex h-[70px] w-full items-center justify-around px-2 shadow-2xl">
          {navItems.map((item) => <NavLink key={item.label} item={item} />)}
      </nav>
    </footer>
  );
}
