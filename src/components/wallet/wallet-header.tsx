'use client';

import { useRouter } from 'next/navigation';
import { Copy, Bell, Link2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useWallet } from '@/contexts/wallet-provider';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { useUser } from '@/contexts/user-provider';
import NetworkSelector from './network-selector';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';

export default function WalletHeader({ 
    isCollapsed,
}: { 
    isCollapsed: boolean,
}) {
  const router = useRouter();
  const [isCopied, copy] = useCopyToClipboard();

  const { viewingNetwork, wallets, hasNewNotifications, getAddressForChain } = useWallet();
  const { profile } = useUser();

  // Resolve the native address for the current viewing network
  const address = wallets ? getAddressForChain(viewingNetwork, wallets) : null;
  const username = profile?.username || profile?.name || 'User';

  const handleCopyAddress = () => {
    if (address) {
      copy(address);
    }
  };

  return (
    <div
      className={cn(
        'sticky z-50 w-full transition-all duration-300 ease-in-out top-0 left-0 right-0',
        isCollapsed ? '-translate-y-full' : 'translate-y-0'
      )}
    >
      <header className="flex h-16 shrink-0 items-center justify-between bg-black px-4 border-b border-primary/80">
        {/* LEFT: BRANDING / LOGO AREA */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="flex flex-col">
            <span className="font-black text-sm uppercase tracking-tight text-white leading-none">
              Wevina
            </span>
            <span className="text-[8px] font-black uppercase text-primary/60 tracking-widest mt-0.5">
              Terminal
            </span>
          </div>
        </div>

        {/* CENTER-RIGHT: ACTION ICONS (SMARTERSELLER STYLE) */}
        <div className="flex items-center gap-1 sm:gap-2 ml-auto mr-4">
          <NetworkSelector className="h-9 w-9 bg-white/5" />
          
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-muted-foreground hover:text-white"
            onClick={() => router.push('/connect')}
          >
            <Link2 className="h-5 w-5" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-muted-foreground hover:text-white"
            onClick={handleCopyAddress}
            disabled={!address}
          >
            <Copy className="h-5 w-5" />
          </Button>

          <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-white relative">
            <Bell className="h-5 w-5" />
            {hasNewNotifications && <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-primary animate-pulse"/>}
          </Button>
        </div>

        {/* FAR RIGHT: PROFILE IMAGE (AS REQUESTED) */}
        <div 
          onClick={() => router.push('/profile')}
          className="cursor-pointer active:scale-95 transition-transform"
        >
          <Avatar className="w-9 h-9 border border-white/10 ring-2 ring-transparent hover:ring-primary/40 transition-all">
            <AvatarImage src={profile?.photo_url} className="object-cover" />
            <AvatarFallback className="bg-primary/20 text-primary font-black text-xs">
              {username.slice(0, 1).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </div>
      </header>
    </div>
  );
}
