'use client';

import CachedImage from '../CachedImage';
import { Skeleton } from '../ui/skeleton';
import { useWallet } from '@/contexts/wallet-provider';
import GenericCoinIcon from '../icons/GenericCoinIcon';

interface TokenLogoDynamicProps {
  logoUrl: string | null | undefined;
  alt: string;
  size?: number;
  className?: string;
  FallbackComponent?: React.ReactElement;
  chainId?: number;
}

export default function TokenLogoDynamic({
  logoUrl,
  alt,
  size = 32,
  className,
  FallbackComponent,
  chainId,
}: TokenLogoDynamicProps) {
  const { allChainsMap } = useWallet();

  // If logoUrl is undefined, it means we are still in a loading state.
  if (logoUrl === undefined) {
    return <Skeleton className={`w-[${size}px] h-[${size}px] rounded-full ${className}`} />;
  }

  // If logoUrl is null, empty, or invalid, we decide the fallback.
  if (!logoUrl) {
    // If a chainId is provided, try to find the native token icon for that chain.
    if (chainId && allChainsMap[chainId]) {
      const nativeChainIcon = allChainsMap[chainId].iconUrl;
      if (nativeChainIcon) {
        return (
          <CachedImage
            src={nativeChainIcon}
            alt={`${allChainsMap[chainId].name} logo`}
            width={size}
            height={size}
            className={`rounded-full ${className}`}
            unoptimized
          />
        );
      }
    }
    // If we can't find a native icon, use the generic fallback.
    return FallbackComponent || <GenericCoinIcon size={size} className={className} />;
  }

  // If we have a valid logoUrl, display the image.
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
