'use client';
import { useWallet } from '@/contexts/wallet-provider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import CachedImage from '../CachedImage';
import { Skeleton } from '../ui/skeleton';

export default function NetworkSelector({ className }: { className?: string }) {
    const { viewingNetwork } = useWallet();
    
    // In a real app, you'd get a list of available networks.
    const availableNetworks = [viewingNetwork];
    const iconUrl = viewingNetwork.iconUrl;

    return (
        <Select defaultValue={viewingNetwork.chainId.toString()}>
            <SelectTrigger className={cn("w-auto h-auto p-0 bg-transparent border-none text-white focus:ring-0 focus:ring-offset-0", className)}>
                <div className="flex items-center gap-1">
                    {iconUrl ? (
                      <CachedImage src={iconUrl} alt={viewingNetwork.name} width={24} height={24} className="rounded-full" />
                    ) : (
                      <Skeleton className="w-6 h-6 rounded-full" />
                    )}
                </div>
            </SelectTrigger>
            <SelectContent>
                {availableNetworks.map(network => (
                    <SelectItem key={network.chainId} value={network.chainId.toString()}>
                         <div className="flex items-center gap-2">
                            {network.iconUrl ? (
                              <CachedImage src={network.iconUrl} alt={network.name} width={16} height={16} className="rounded-full" />
                            ) : (
                              <Skeleton className="w-4 h-4 rounded-full" />
                            )}
                            <span>{network.name}</span>
                        </div>
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}
