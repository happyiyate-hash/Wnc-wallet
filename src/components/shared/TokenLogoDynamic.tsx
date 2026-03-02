
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

const CDN_BASE_URL = 'https://gcghriodmljkusdduhzl.supabase.co';

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
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    async function resolve() {
      setIsLoading(true);
      setHasError(false);

      // 1. SMART CACHE: Check persistent cache first
      const cacheKey = `logo_url_${name?.replace(/\s+/g, '_')}_${symbol}`;
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        setResolvedUrl(cached);
        setIsLoading(false);
        return;
      }

      // 2. Perform direct Supabase lookup using Name-first priority
      if (symbol || name) {
        try {
          const direct = await getDirectLogoUrl(name || '', symbol || '');
          if (direct) {
            setResolvedUrl(direct);
            localStorage.setItem(cacheKey, direct); // Save to cache for next render
            setIsLoading(false);
            return;
          }
        } catch (e) {
          console.warn("Direct logo lookup failed:", e);
        }
      }

      // 3. Fallback logic for provided URLs
      if (logoUrl) {
        if (logoUrl.startsWith('http')) {
          setResolvedUrl(logoUrl);
        } else if (logoUrl.startsWith('/')) {
          // Prepend CDN base for relative paths
          setResolvedUrl(`${CDN_BASE_URL}${logoUrl}`);
        }
        setIsLoading(false);
        return;
      }

      setIsLoading(false);
    }

    resolve();
  }, [logoUrl, symbol, name]);

  if (isLoading) {
    return <Skeleton className={`rounded-full bg-white/5 animate-pulse`} style={{ width: size, height: size }} />;
  }

  if (!resolvedUrl || hasError) {
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
        onError={() => setHasError(true)}
      />
    </div>
  );
}
