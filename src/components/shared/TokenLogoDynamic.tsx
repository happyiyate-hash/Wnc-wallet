'use client';

import { useState, useEffect } from 'react';
import { getTokenLogoUrl } from '@/lib/getTokenLogo';
import CachedImage from '../CachedImage';
import { Skeleton } from '../ui/skeleton';

interface TokenLogoDynamicProps {
  symbol: string | null;
  name: string | null;
  address: string | null;
  chainKey: number | null;
  isNative?: boolean;
  alt: string;
  size?: number;
  className?: string;
  FallbackComponent?: React.ReactElement;
}

export default function TokenLogoDynamic({
  symbol,
  name,
  chainKey,
  alt,
  size = 32,
  className,
  FallbackComponent,
}: TokenLogoDynamicProps) {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const fetchLogo = async () => {
      if (!symbol || !name) {
          setIsLoading(false);
          return;
      };
      
      setIsLoading(true);
      try {
        const url = await getTokenLogoUrl(symbol, name);
        if (isMounted) {
          setLogoUrl(url);
          setIsLoading(false);
        }
      } catch (error) {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchLogo();

    return () => {
      isMounted = false;
    };
  }, [symbol, name, chainKey]);

  if (isLoading) {
    return <Skeleton className={`w-[${size}px] h-[${size}px] rounded-full ${className}`} />;
  }

  if (logoUrl) {
    return (
      <CachedImage
        src={logoUrl}
        alt={alt}
        width={size}
        height={size}
        className={`rounded-full ${className}`}
        unoptimized
      />
    );
  }

  return FallbackComponent || <div className={`w-[${size}px] h-[${size}px] rounded-full bg-muted ${className}`} />;
}
