
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
 * Version: 5.1.0 (Zero-Latency Background Sync)
 * Independent of auth. Optimized for non-blocking direct display.
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
    return `logo_v11_${slug}_${sym}`;
  }, [name, symbol, alt]);

  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const handshakeAttempted = useRef(false);

  useEffect(() => {
    async function resolve() {
      if (handshakeAttempted.current) return;
      handshakeAttempted.current = true;

      // 1. CHECK PERSISTENT REGISTRY (IndexedDB) - Instant
      const cached = await registryDb.getLogo(cacheKey);
      if (cached) {
        setResolvedUrl(cached);
        setIsLoading(false);
        return;
      }

      // 2. PRIMARY: Metadata URL Check (Independent Handshake)
      if (typeof logoUrl === 'string' && logoUrl.length > 0) {
        let finalUrl = logoUrl;
        // Prepend institutional CDN base for relative paths
        if (logoUrl.startsWith('/api/cdn') || !logoUrl.startsWith('http')) {
          const base = 'https://gcghriodmljkusdduhzl.supabase.co';
          finalUrl = `${base}${logoUrl.startsWith('/') ? logoUrl : '/' + logoUrl}`;
        }
        
        setResolvedUrl(finalUrl);
        await registryDb.saveLogo(cacheKey, finalUrl);
        setIsLoading(false);
        return;
      }

      // 3. SECONDARY: Global Registry Search (Direct Supabase)
      if (name || symbol) {
        try {
          const direct = await getDirectLogoUrl(name || '', symbol || '');
          if (direct) {
            setResolvedUrl(direct);
            await registryDb.saveLogo(cacheKey, direct);
          }
        } catch (e) {
          // Silent defer
        }
      }

      setIsLoading(false);
    }

    resolve();
  }, [logoUrl, symbol, name, cacheKey]);

  if (isLoading && !resolvedUrl) {
    return <Skeleton className={cn("rounded-full bg-white/5 animate-pulse", className)} style={{ width: size, height: size }} />;
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
        className={cn("rounded-full object-cover bg-white/5", className)}
        unoptimized
        onError={() => setResolvedUrl(null)}
      />
    </div>
  );
}
