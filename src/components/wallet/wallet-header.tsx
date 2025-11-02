'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Copy, Bell, Expand, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import NetworkSelector from './network-selector';
import { cn } from '@/lib/utils';
import { useWallet } from '@/contexts/wallet-provider';
import { getAddressForChain } from '@/lib/wallets/utils';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { useUser } from '@/contexts/user-provider';

// The header now uses the useWallet hook directly to ensure it always has the freshest state.
export default function WalletHeader({ 
    isCollapsed,
}: { 
    isCollapsed: boolean,
}) {
  const { toast } = useToast();
  const router = useRouter();
  const [isCopied, copy] = useCopyToClipboard();

  // Directly use the context here to get live updates
  const { viewingNetwork, wallets, profile, hasNewNotifications } = useWallet();
  const { user } = useUser();


  const address = wallets ? getAddressForChain(viewingNetwork, wallets) : null;
  const username = profile?.username || null;

  const handleCopyAddress = () => {
    if (address) {
      copy(address);
    }
  };

  const shortAddress = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : 'Loading...';

  return (
    <div
      className={cn(
        'sticky z-20 w-full transition-transform duration-300 ease-in-out top-4 px-2',
        isCollapsed ? '-translate-y-[150%]' : 'translate-y-0'
      )}
    >
      <div className="p-[1px] bg-gradient-to-r from-blue-500 via-purple-500 to-green-500 bg-[length:400%_400%] animate-gradient-flow rounded-2xl">
        <header className="flex h-10 shrink-0 items-center justify-between rounded-2xl bg-black px-2">
          <div className="flex items-center">
            {/* NetworkSelector now correctly reflects the live viewingNetwork from the context */}
            <NetworkSelector className="h-6" />
          </div>

          <div className="flex items-center gap-1">
            { username && 
              <div className="w-4 h-4 rounded-full bg-blue-500" />
            }
            <div className="flex flex-col">
              <span className="font-semibold text-xs leading-none text-white">
                @{username || '...'}
              </span>
              <span className="text-[0.625rem] text-gray-400">
                {shortAddress}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-gray-400"
              onClick={() => router.push('/connect')}
            >
              <Link2 className="h-3 w-3" />
              <span className="sr-only">WalletConnect</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-gray-400"
              onClick={handleCopyAddress}
              disabled={!address}
            >
              <Copy className="h-3 w-3" />
              <span className="sr-only">Copy Address</span>
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-400 relative">
              <Bell className="h-3 w-3" />
              {hasNewNotifications && <div className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-primary animate-pulse"/>}
              <span className="sr-only">Notifications</span>
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-400">
              <Expand className="h-3 w-3" />
              <span className="sr-only">Expand View</span>
            </Button>
          </div>
        </header>
      </div>
    </div>
  );
}
