
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import GradientWalletIcon from './GradientWalletIcon';
import GradientGlobeIcon from './GradientGlobeIcon';
import GradientUserIcon from './GradientUserIcon';
import GradientSettingsIcon from './GradientSettingsIcon';
import { Zap } from 'lucide-react';
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

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

  const leftItems: NavItem[] = [
    { href: '/', label: 'Wallet', icon: GradientWalletIcon },
    { href: '/browse', label: 'Browse', icon: GradientGlobeIcon },
  ];

  const rightItems: NavItem[] = [
    { href: '/profile', label: 'Profile', icon: GradientUserIcon },
    { href: '/settings', label: 'Settings', icon: GradientSettingsIcon },
  ];

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
    <footer className="fixed z-50 left-4 right-4 transition-all duration-500 ease-in-out bottom-6 md:hidden">
      <div className="relative">
        {/* CENTERED SWAP NODE (PROTRUDING) */}
        <div className="absolute left-1/2 -top-6 -translate-x-1/2 z-20">
            <Link href="/swap">
                <motion.div 
                    whileTap={{ scale: 0.9 }}
                    className="relative p-[2px] rounded-full bg-gradient-to-tr from-primary via-purple-500 to-green-500 shadow-[0_0_30px_rgba(139,92,246,0.3)] group"
                >
                    <div className="w-16 h-16 rounded-full bg-black flex items-center justify-center relative overflow-hidden">
                        {/* Interactive Glow */}
                        <div className="absolute inset-0 bg-primary/10 group-hover:bg-primary/20 transition-colors" />
                        <div className="absolute -inset-1 bg-primary/20 blur-xl opacity-0 group-active:opacity-100 transition-opacity" />
                        
                        <Zap className={cn(
                            "w-7 h-7 relative z-10 transition-all duration-500",
                            pathname === '/swap' ? "text-primary fill-primary" : "text-white"
                        )} />
                    </div>
                </motion.div>
            </Link>
        </div>

        <div className="p-[1px] bg-white/5 rounded-[2.2rem] backdrop-blur-3xl">
            <nav className="flex h-[68px] w-full items-center justify-between rounded-[2.2rem] bg-black/90 px-2">
                <div className="flex flex-1 justify-around pr-8">
                    {leftItems.map((item) => <NavLink key={item.label} item={item} />)}
                </div>
                
                <div className="w-16 shrink-0" /> {/* Spacer for centered button */}

                <div className="flex flex-1 justify-around pl-8">
                    {rightItems.map((item) => <NavLink key={item.label} item={item} />)}
                </div>
            </nav>
        </div>
      </div>
    </footer>
  );
}
