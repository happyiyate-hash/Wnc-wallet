
'use client';

import { useEffect, useState } from 'react';
import CachedImage from '../CachedImage';
import { Skeleton } from '../ui/skeleton';
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
  symbol,
  name,
}: TokenLogoDynamicProps) {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function resolve() {
      setIsLoading(true);

      // 1. Check if provided logoUrl is already a full absolute path
      if (logoUrl && logoUrl.startsWith('http')) {
        setResolvedUrl(logoUrl);
        setIsLoading(false);
        return;
      }

      // 2. Perform direct Supabase lookup using Name-first priority
      if (symbol || name) {
        try {
          const direct = await getDirectLogoUrl(name || '', symbol || '');
          if (direct) {
            setResolvedUrl(direct);
            setIsLoading(false);
            return;
          }
        } catch (e) {
          console.warn("Direct logo lookup failed:", e);
        }
      }

      // 3. Fallback to relative CDN path if provided
      if (logoUrl && logoUrl.startsWith('/')) {
        setResolvedUrl(logoUrl);
      }

      setIsLoading(false);
    }

    resolve();
  }, [logoUrl, symbol, name]);

  if (isLoading) {
    return <Skeleton className={`rounded-full bg-white/5 animate-pulse`} style={{ width: size, height: size }} />;
  }

  if (!resolvedUrl) {
    return FallbackComponent || <GenericCoinIcon size={size} className={className} />;
  }

  return (
    <div style={{ width: size, height: size }} className="shrink-0 flex items-center justify-center">
      <CachedImage
        src={resolvedUrl}
        alt={alt}
        width={size}
        height={size}
        className={`rounded-full object-cover bg-white/5 ${className}`}
        unoptimized
      />
    </div>
  );
}
