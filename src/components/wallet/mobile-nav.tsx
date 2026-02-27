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

  const isActionPage = pathname === '/swap' || pathname === '/send' || pathname === '/receive' || pathname === '/buy';
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
        <Link href={item.href} className="flex flex-col items-center justify-center p-1 flex-1 group gap-0.5">
            <Icon className={cn('h-6 w-6 transition-all', isActive ? 'opacity-100 scale-110' : 'opacity-40 group-hover:opacity-100')} />
            <span className={cn("text-[9px] font-black uppercase tracking-tighter transition-colors", isActive ? "text-primary" : "text-muted-foreground")}>
              {item.label}
            </span>
        </Link>
    );
  };

  return (
    <footer className="fixed z-50 left-4 right-4 transition-all duration-500 ease-in-out bottom-6 md:hidden">
      <div className="p-[1px] bg-gradient-to-r from-blue-500 via-purple-500 to-green-500 bg-[length:400%_400%] animate-gradient-flow rounded-[1.5rem]">
          <nav className="flex h-[60px] w-full items-center justify-around rounded-[1.5rem] bg-black/90 backdrop-blur-xl px-1 shadow-2xl">
              {navItems.map((item) => <NavLink key={item.label} item={item} />)}
          </nav>
      </div>
    </footer>
  );
}
