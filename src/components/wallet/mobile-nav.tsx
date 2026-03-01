
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import GradientWalletIcon from './GradientWalletIcon';
import GradientGlobeIcon from './GradientGlobeIcon';
import GradientUserIcon from './GradientUserIcon';
import GradientSettingsIcon from './GradientSettingsIcon';
import { Repeat } from 'lucide-react';
import React from 'react';
import { motion } from 'framer-motion';

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
    pathname === '/send' || 
    pathname === '/receive' || 
    pathname === '/buy' ||
    pathname === '/request' ||
    pathname.startsWith('/request/');

  if (isActionPage) return null;

  const NavLink = ({ item }: { item: NavItem; }) => {
    const isActive = pathname === item.href;
    const Icon = item.icon;

    return (
        <Link href={item.href} className="flex flex-col items-center justify-center p-1 flex-1 group gap-0.5">
            <Icon className={cn(
                'h-6 w-6 transition-all duration-500', 
                isActive ? 'opacity-100 scale-110 drop-shadow-[0_0_8px_rgba(139,92,246,0.5)]' : 'opacity-40 group-hover:opacity-100'
            )} />
            <span className={cn(
                "text-[9px] font-black uppercase tracking-tighter transition-colors", 
                isActive ? "text-primary" : "text-muted-foreground"
            )}>
              {item.label}
            </span>
        </Link>
    );
  };

  return (
    <footer className="fixed z-50 left-4 right-4 bottom-6 md:hidden">
      <div className="p-[1px] bg-white/5 rounded-[2.2rem] backdrop-blur-3xl shadow-2xl">
        <nav className="flex h-[72px] w-full items-center justify-around rounded-[2.2rem] bg-black/90 px-2 relative overflow-hidden">
            
            {/* ITEM 1: WALLET */}
            <NavLink item={{ href: '/', label: 'Wallet', icon: GradientWalletIcon }} />
            
            {/* ITEM 2: BROWSE */}
            <NavLink item={{ href: '/browse', label: 'Browse', icon: GradientGlobeIcon }} />

            {/* ITEM 3: SWAP (CENTER BOLD NODE) */}
            <div className="flex-1 flex items-center justify-center">
                <Link href="/swap">
                    <motion.div 
                        whileTap={{ scale: 0.9 }}
                        className="relative p-[2px] rounded-full bg-gradient-to-tr from-primary via-purple-500 to-primary/50 shadow-lg group"
                    >
                        <div className="w-12 h-12 rounded-full bg-black flex items-center justify-center relative overflow-hidden">
                            {/* Inner Glow */}
                            <div className="absolute inset-0 bg-primary/10 group-hover:bg-primary/20 transition-colors" />
                            
                            {/* Active/Tap Glow */}
                            <motion.div 
                                initial={false}
                                animate={{ opacity: pathname === '/swap' ? 1 : 0 }}
                                className="absolute inset-0 bg-primary/20 blur-md"
                            />
                            
                            <Repeat className={cn(
                                "w-5 h-5 relative z-10 transition-all duration-500",
                                pathname === '/swap' ? "text-primary scale-110" : "text-white"
                            )} />
                        </div>
                    </motion.div>
                </Link>
            </div>

            {/* ITEM 4: PROFILE */}
            <NavLink item={{ href: '/profile', label: 'Profile', icon: GradientUserIcon }} />

            {/* ITEM 5: SETTINGS */}
            <NavLink item={{ href: '/settings', label: 'Settings', icon: GradientSettingsIcon }} />

        </nav>
      </div>
    </footer>
  );
}
