
'use client';

import { useEffect, useState, useMemo } from 'react';
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

/**
 * INSTITUTIONAL TOKEN LOGO ENGINE (CACHED)
 * Version: 4.1.0 (Name-Priority Cache)
 * Features immediate localStorage resolution to eliminate UI flickering.
 * Optimized to differentiate between assets sharing symbols (e.g., Blast ETH).
 */
export default function TokenLogoDynamic({
  logoUrl,
  alt,
  size = 32,
  className,
  FallbackComponent,
  symbol,
  name,
}: TokenLogoDynamicProps) {
  // 1. DETERMINISTIC NAME-FIRST CACHE KEY
  // Leading with the name ensures "Base" vs "Blast" vs "Ethereum" doesn't collide on "ETH"
  const cacheKey = useMemo(() => {
    const slug = (name || alt || '').replace(/\s+/g, '_').toLowerCase();
    const sym = symbol?.toLowerCase() || 'native';
    return `logo_v4.1_${slug}_${sym}`;
  }, [name, symbol, alt]);

  // 2. SYNCHRONOUS HYDRATION
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(cacheKey);
    }
    return null;
  });

  const [isLoading, setIsLoading] = useState(!resolvedUrl);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    async function resolve() {
      const cached = localStorage.getItem(cacheKey);
      
      if (cached) {
        if (resolvedUrl !== cached) setResolvedUrl(cached);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setHasError(false);

      // A. Perform Name-Priority Registry Lookup
      // Passing both ensures the resolver can prioritize the full name (e.g. "Blast")
      if (name || symbol) {
        try {
          const direct = await getDirectLogoUrl(name || '', symbol || '');
          if (direct) {
            setResolvedUrl(direct);
            localStorage.setItem(cacheKey, direct); 
            setIsLoading(false);
            return;
          }
        } catch (e) {
          console.warn("[LOGO_CACHE_ADVISORY] Registry lookup deferred.");
        }
      }

      // B. Fallback to provided URL nodes
      if (logoUrl) {
        let finalUrl = logoUrl;
        if (logoUrl.startsWith('http')) {
          finalUrl = logoUrl;
        } else if (logoUrl.startsWith('/')) {
          finalUrl = `${CDN_BASE_URL}${logoUrl}`;
        }
        
        setResolvedUrl(finalUrl);
        localStorage.setItem(cacheKey, finalUrl);
        setIsLoading(false);
        return;
      }

      setIsLoading(false);
    }

    resolve();
  }, [logoUrl, symbol, name, cacheKey, resolvedUrl]);

  if (isLoading && !resolvedUrl) {
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
