
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

      // 1. Priority: Direct Absolute URL
      if (logoUrl && logoUrl.startsWith('http')) {
        setResolvedUrl(logoUrl);
        setIsLoading(false);
        return;
      }

      // 2. Relative CDN Path Detection (Handle strings like /api/cdn/logo/...)
      if (logoUrl && logoUrl.startsWith('/')) {
        setResolvedUrl(logoUrl);
        setIsLoading(false);
        return;
      }

      // 3. Fallback: Direct lookup via Dedicated Registry (Exact Name -> Symbol)
      if (symbol || name) {
        try {
          const direct = await getDirectLogoUrl(name || '', symbol || '');
          if (direct) {
            setResolvedUrl(direct);
            setIsLoading(false);
            return;
          }
        } catch (e) {
          console.warn("Manual logo lookup failed:", e);
        }
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
