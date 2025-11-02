'use client';
import { useWallet } from '@/contexts/wallet-provider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import CachedImage from '../CachedImage';

export default function NetworkSelector({ className }: { className?: string }) {
    const { viewingNetwork } = useWallet();
    
    // In a real app, you'd get a list of available networks.
    const availableNetworks = [viewingNetwork];

    return (
        <Select defaultValue={viewingNetwork.chainId.toString()}>
            <SelectTrigger className={cn("w-auto h-auto bg-transparent border-none text-white focus:ring-0 focus:ring-offset-0", className)}>
                <div className="flex items-center gap-2">
                    <CachedImage src={viewingNetwork.iconUrl!} alt={viewingNetwork.name} width={16} height={16} className="rounded-full" />
                    <SelectValue />
                </div>
            </SelectTrigger>
            <SelectContent>
                {availableNetworks.map(network => (
                    <SelectItem key={network.chainId} value={network.chainId.toString()}>
                         <div className="flex items-center gap-2">
                            <CachedImage src={network.iconUrl!} alt={network.name} width={16} height={16} className="rounded-full" />
                            <span>{network.name}</span>
                        </div>
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}
