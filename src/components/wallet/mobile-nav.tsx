'use client';

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

// Shared Gradient Definition
const SharedGradient = () => (
  <svg width="0" height="0" className="absolute">
    <defs>
      <linearGradient id="nav-icon-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#818cf8" />
        <stop offset="100%" stopColor="#c084fc" />
      </linearGradient>
    </defs>
  </svg>
);

export default function MobileNav() {
  const pathname = usePathname();

  const navItems: NavItem[] = [
    { href: '/tokens', label: 'Wallet', icon: GradientWalletIcon },
    { href: '/browse', label: 'Browse', icon: GradientGlobeIcon },
    { href: '/swap', label: 'Swap', icon: GradientSwapIcon },
    { href: '/profile', label: 'Profile', icon: GradientUserIcon },
    { href: '/settings', label: 'Settings', icon: GradientSettingsIcon },
  ];
  
  const NavLink = ({ item }: { item: NavItem; }) => {
    const isActive = pathname === item.href || (item.href === '/tokens' && pathname === '/');
    const Icon = item.icon;
    
    // All navigation items now use a consistent Link component.
    return (
        <Link href={item.href} className="flex flex-col items-center justify-center p-1 flex-1 group gap-0">
            <Icon className={cn('h-6 w-6 transition-all', isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground')} />
            <span className={cn("text-[10px] font-medium transition-colors", isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground")}>
              {item.label}
            </span>
        </Link>
    );
  };

  return (
    <>
      <SharedGradient />
       <footer
        className={cn(
          'sticky z-10 mx-2 transition-transform duration-300 ease-in-out bottom-4 md:hidden'
        )}
      >
        <div className="p-[1px] bg-gradient-to-r from-blue-500 via-purple-500 to-green-500 bg-[length:400%_400%] animate-gradient-flow rounded-2xl">
            <nav className="flex h-[52px] w-full items-center justify-around rounded-2xl bg-black px-1">
                {navItems.map((item) => <NavLink key={item.label} item={item} />)}
            </nav>
        </div>
      </footer>
    </>
  );
}
