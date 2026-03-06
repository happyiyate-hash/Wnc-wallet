'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import CachedImage from '../CachedImage';
import { Skeleton } from '../ui/skeleton';
import GenericCoinIcon from '../icons/GenericCoinIcon';
import { getDirectLogoUrl } from '@/lib/getTokenLogo';
import { registryDb } from '@/lib/storage/registry-db';
import { cn } from '@/lib/utils';

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

/**
 * INSTITUTIONAL LOGO ENGINE
 * Version: 6.0.0 (Cache-First Non-Blocking)
 * 
 * Implements a professional logo caching architecture:
 * 1. Check IndexedDB Registry (Instant)
 * 2. Fallback to provided URL (Async)
 * 3. Fallback to Global Registry Search (Async)
 * 4. Cache result for future loads.
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
  const cacheKey = useMemo(() => {
    const slug = (name || alt || '').replace(/\s+/g, '_').toLowerCase();
    const sym = symbol?.toLowerCase() || 'native';
    return `logo_v12_${slug}_${sym}`;
  }, [name, symbol, alt]);

  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const isFetchingRef = useRef(false);

  useEffect(() => {
    async function resolve() {
      if (isFetchingRef.current) return;
      
      // 1. ATOMIC CACHE CHECK (IndexedDB)
      const cached = await registryDb.getLogo(cacheKey);
      if (cached) {
        setResolvedUrl(cached);
        setIsLoading(false);
        return;
      }

      // 2. NETWORK HANDSHAKE (Non-Blocking)
      isFetchingRef.current = true;
      let finalUrl: string | null = null;

      // Check provided logoUrl first
      if (typeof logoUrl === 'string' && logoUrl.length > 0) {
        finalUrl = logoUrl;
        if (logoUrl.startsWith('/api/cdn') || !logoUrl.startsWith('http')) {
          const base = 'https://gcghriodmljkusdduhzl.supabase.co';
          finalUrl = `${base}${logoUrl.startsWith('/') ? logoUrl : '/' + logoUrl}`;
        }
      } 
      // If no URL provided, search global registry by name/symbol
      else if (name || symbol) {
        try {
          finalUrl = await getDirectLogoUrl(name || '', symbol || '');
        } catch (e) {
          finalUrl = null;
        }
      }

      if (finalUrl) {
        setResolvedUrl(finalUrl);
        // Persist to local registry for next reload
        await registryDb.saveLogo(cacheKey, finalUrl);
      }

      setIsLoading(false);
      isFetchingRef.current = false;
    }

    resolve();
  }, [logoUrl, symbol, name, cacheKey]);

  // NON-BLOCKING UI: Render immediate fallback if still loading and no cache
  if (isLoading && !resolvedUrl) {
    return (
      <div style={{ width: size, height: size }} className={cn("shrink-0 flex items-center justify-center", className)}>
        <div className="w-full h-full rounded-full bg-white/[0.03] animate-pulse border border-white/5" />
      </div>
    );
  }

  if (!resolvedUrl) {
    return (
      <div style={{ width: size, height: size }} className={cn("shrink-0 flex items-center justify-center", className)}>
        {FallbackComponent || <GenericCoinIcon size={size} />}
      </div>
    );
  }

  return (
    <div style={{ width: size, height: size }} className={cn("shrink-0 flex items-center justify-center relative overflow-hidden", className)}>
      <CachedImage
        src={resolvedUrl}
        alt={alt}
        width={size}
        height={size}
        className="rounded-full object-cover transition-opacity duration-300"
        unoptimized
        onLoad={(e) => {
          (e.target as HTMLImageElement).style.opacity = '1';
        }}
        onError={() => {
          setResolvedUrl(null);
          registryDb.saveLogo(cacheKey, ''); // Mark as failed in cache
        }}
      />
    </div>
  );
}
