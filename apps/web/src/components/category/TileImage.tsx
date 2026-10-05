import Image from 'next/image';
import { CATEGORY_TILE_PLACEHOLDER } from '@youmart/shared-client';

/** Sub / sub-to-sub artwork in its portrait (2:3) frame; the styled placeholder until it exists. */
export function TileImage({ src, sizes }: { src: string | null; sizes: string }) {
  const image = src ?? CATEGORY_TILE_PLACEHOLDER;
  return (
    <Image
      src={image}
      alt=""
      fill
      sizes={sizes}
      unoptimized={image.endsWith('.svg')}
      className="object-cover"
    />
  );
}
