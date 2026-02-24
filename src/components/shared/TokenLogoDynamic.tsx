'use client';

import CachedImage from '../CachedImage';
import { Skeleton } from '../ui/skeleton';
import { useWallet } from '@/contexts/wallet-provider';
import GenericCoinIcon from '../icons/GenericCoinIcon';
import { getTokenLogoUrl } from '@/lib/getTokenLogo';

interface TokenLogoDynamicProps {
  logoUrl: string | null | undefined;
  alt: string;
  size?: number;
  className?: string;
  FallbackComponent?: React.ReactElement;
  chainId?: number;
  symbol?: string; 
}

export default function TokenLogoDynamic({
  logoUrl,
  alt,
  size = 32,
  className,
  FallbackComponent,
  chainId,
  symbol,
}: TokenLogoDynamicProps) {
  const { allChainsMap } = useWallet();

  // If logoUrl is explicitly undefined (loading state)
  if (logoUrl === undefined && !symbol) {
    return <Skeleton className={`w-[${size}px] h-[${size}px] rounded-full ${className}`} />;
  }

  // Determine the best logo URL based on multi-chain context
  let finalUrl = logoUrl;
  
  if (!finalUrl && symbol) {
    finalUrl = getTokenLogoUrl(symbol, chainId);
  }

  // If we still don't have a URL, check for native chain icons from registry
  if (!finalUrl) {
    if (chainId && allChainsMap[chainId]) {
      const nativeChainIcon = allChainsMap[chainId].iconUrl;
      if (nativeChainIcon) {
        finalUrl = nativeChainIcon;
      }
    }
  }

  // Final rendering logic
  if (!finalUrl) {
    return FallbackComponent || <GenericCoinIcon size={size} className={className} />;
  }

  return (
    <CachedImage
      src={finalUrl}
      alt={alt}
      width={size}
      height={size}
      className={`rounded-full object-cover bg-white/5 ${className}`}
      unoptimized
    />
  );
}
