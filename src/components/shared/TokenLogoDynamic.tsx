
'use client';

import { useEffect, useState } from 'react';
import CachedImage from '../CachedImage';
import { Skeleton } from '../ui/skeleton';
import { useWallet } from '@/contexts/wallet-provider';
import GenericCoinIcon from '../icons/GenericCoinIcon';
import { getDirectLogoUrl } from '@/lib/getTokenLogo';

interface TokenLogoDynamicProps {
  logoUrl: string | null | undefined;
  alt: string;
  size?: number;
  className?: string;
  FallbackComponent?: React.ReactElement;
  chainId?: number;
  symbol?: string; 
  name?: string;
}

export default function TokenLogoDynamic({
  logoUrl,
  alt,
  size = 32,
  className,
  FallbackComponent,
  chainId,
  symbol,
  name,
}: TokenLogoDynamicProps) {
  const { allChainsMap } = useWallet();
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function resolve() {
      // 1. Priority: Direct URL from metadata table or props
      if (logoUrl && logoUrl.startsWith('http')) {
        setResolvedUrl(logoUrl);
        setIsLoading(false);
        return;
      }

      // 2. Fallback: Search the dedicated logo instance directly if symbol/name provided
      if (symbol || name) {
        const direct = await getDirectLogoUrl(name || '', symbol || '');
        if (direct) {
          setResolvedUrl(direct);
          setIsLoading(false);
          return;
        }
      }

      // 3. Fallback: Native network icon from chain mapping
      if (chainId && allChainsMap[chainId]) {
        const chainIcon = allChainsMap[chainId].iconUrl;
        if (chainIcon) {
          setResolvedUrl(chainIcon);
          setIsLoading(false);
          return;
        }
      }

      setIsLoading(false);
    }

    resolve();
  }, [logoUrl, symbol, name, chainId, allChainsMap]);

  if (isLoading) {
    return <Skeleton className={`rounded-full bg-white/5 animate-pulse`} style={{ width: size, height: size }} />;
  }

  if (!resolvedUrl) {
    return FallbackComponent || <GenericCoinIcon size={size} className={className} />;
  }

  return (
    <CachedImage
      src={resolvedUrl}
      alt={alt}
      width={size}
      height={size}
      className={`rounded-full object-cover bg-white/5 ${className}`}
      unoptimized
    />
  );
}
