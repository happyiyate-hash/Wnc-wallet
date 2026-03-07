'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import CachedImage from '../CachedImage';
import GenericCoinIcon from '../icons/GenericCoinIcon';
import { getDirectLogoUrl, getFullLogoUrl } from '@/lib/getTokenLogo';
import { registryDb } from '@/lib/storage/registry-db';
import { cn } from '@/lib/utils';

interface TokenLogoDynamicProps {
  logoUrl: string | null | undefined;
  alt?: string;
  size?: number;
  className?: string;
  FallbackComponent?: React.ReactElement;
  chainId?: number;
  symbol?: string; 
  name?: string;
}

/**
 * INSTITUTIONAL LOGO ENGINE
 * Version: 12.0.0 (Zero-Latency Tiered Cache)
 * 
 * Strictly utilizes tiered resolution (Memory -> DB -> Network) to eliminate flicker.
 * Integrated with background pre-fetching worker.
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
  const cacheId = useMemo(() => {
    const slug = (name || alt || '').replace(/\s+/g, '_').toLowerCase();
    const sym = symbol?.toLowerCase() || 'native';
    return `logo_v12_${slug}_${sym}`;
  }, [name, symbol, alt]);

  // Accessibility Handshake: Automated Alt Protocol
  const effectiveAlt = alt || symbol || name || "Token Logo";

  // INSTANT HYDRATION: Check memory cache before first render
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const isFetchingRef = useRef(false);

  useEffect(() => {
    async function resolve() {
      // 1. INSTANT TIERED LOOKUP (Memory + IndexedDB)
      try {
        const cached = await registryDb.getLogo(cacheId);
        if (cached) {
          setResolvedUrl(cached);
          setIsInitializing(false);
          return;
        }
      } catch (e) {}

      if (isFetchingRef.current) return;
      isFetchingRef.current = true;

      // 2. NETWORK HANDSHAKE
      let finalUrl: string | null = null;
      try {
        if (typeof logoUrl === 'string' && logoUrl.length > 0) {
          finalUrl = await getFullLogoUrl(logoUrl);
        } else if (name || symbol) {
          finalUrl = await getDirectLogoUrl(name || '', symbol || '');
        }
      } catch (e) {
        finalUrl = null;
      }

      if (finalUrl) {
        setResolvedUrl(finalUrl);
        await registryDb.saveLogo(cacheId, finalUrl);
      }

      setIsInitializing(false);
      isFetchingRef.current = false;
    }

    resolve();
  }, [logoUrl, symbol, name, cacheId]);

  if (isInitializing && !resolvedUrl) {
    return (
      <div style={{ width: size, height: size }} className={cn("shrink-0 flex items-center justify-center", className)}>
        <div className="w-full h-full rounded-full bg-white/[0.05] animate-pulse border border-white/5" />
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
        alt={effectiveAlt}
        width={size}
        height={size}
        className="rounded-full object-cover transition-opacity duration-300 opacity-0"
        unoptimized
        onLoad={(e) => {
          (e.target as HTMLImageElement).style.opacity = '1';
        }}
        onError={() => {
          setResolvedUrl(null);
          registryDb.saveLogo(cacheId, ''); 
        }}
      />
    </div>
  );
}
