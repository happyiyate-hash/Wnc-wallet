
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Copy, Bell, Link2, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useWallet } from '@/contexts/wallet-provider';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { useUser } from '@/contexts/user-provider';
import NetworkSelector from './network-selector';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { motion, AnimatePresence } from 'framer-motion';

export default function WalletHeader({ 
    isCollapsed,
}: { 
    isCollapsed: boolean,
}) {
  const router = useRouter();
  const [isCopied, copy] = useCopyToClipboard();
  const [hasMounted, setHasMounted] = useState(false);

  const { viewingNetwork, wallets, unreadCount, getAddressForChain, setIsNotificationsOpen } = useWallet();
  const { profile } = useUser();

  useEffect(() => {
    setHasMounted(true);
  }, []);

  const address = wallets ? getAddressForChain(viewingNetwork, wallets) : null;
  const username = profile?.name || 'User';

  const handleCopyAddress = () => {
    if (address) {
      copy(address);
    }
  };

  const shortAddress = hasMounted && address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : 'Synchronizing...';

  return (
    <div
      className={cn(
        'sticky z-20 w-full transition-transform duration-300 ease-in-out top-4 px-2',
        isCollapsed ? '-translate-y-[150%]' : 'translate-y-0'
      )}
    >
      <div className="p-[1px] bg-gradient-to-r from-blue-500 via-purple-500 to-green-500 bg-[length:400%_400%] animate-gradient-flow rounded-2xl">
        <header className="flex h-12 shrink-0 items-center justify-between rounded-2xl bg-black px-3">
          <div className="flex items-center">
            <NetworkSelector />
          </div>

          <div className="flex items-center gap-2">
            <Avatar className="w-7 h-7 border border-white/10">
              <AvatarImage src={profile?.photo_url} />
              <AvatarFallback className="bg-primary/20 text-[10px]"><User className="w-3 h-3"/></AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span className="font-semibold text-xs leading-none text-white">
                @{hasMounted ? username : 'Node'}
              </span>
              <span className="text-[0.625rem] text-gray-400 font-mono">
                {shortAddress}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-gray-400"
              onClick={() => router.push('/connect')}
            >
              <Link2 className="h-4 w-4" />
              <span className="sr-only">WalletConnect</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-gray-400"
              onClick={handleCopyAddress}
              disabled={!address}
            >
              <Copy className="h-4 w-4" />
              <span className="sr-only">Copy Address</span>
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 text-gray-400 relative group"
              onClick={() => setIsNotificationsOpen(true)}
            >
              <Bell className={cn("h-4 w-4 transition-transform", unreadCount > 0 && "animate-bounce")} />
              <AnimatePresence>
                {unreadCount > 0 && (
                  <motion.div 
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    className="absolute -top-1 -right-1 min-w-[14px] h-[14px] bg-primary rounded-full border border-black flex items-center justify-center px-1 shadow-[0_0_10px_rgba(139,92,246,0.5)]"
                  >
                    <span className="text-[8px] font-black text-white leading-none">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
              <span className="sr-only">Notifications</span>
            </Button>
          </div>
        </header>
      </div>
    </div>
  );
}
