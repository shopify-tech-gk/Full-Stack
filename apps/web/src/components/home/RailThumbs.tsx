import Image from 'next/image';
import Link from 'next/link';
import type { RailItem } from '@youmart/shared-client';
import { skipImageOptimizer } from '@/lib/images';

/** The live rail card's 2 x 2 product grid (below 1025px). */
export function RailThumbs({ items }: { items: readonly RailItem[] }) {
  return (
    <ul className="grid grid-cols-2 gap-[12px]">
      {items.map((item) => (
        <li key={item.id}>
          <Link href={item.href} className="flex flex-col items-center text-rail-title">
            <span className="relative mb-[6px] block aspect-square w-full overflow-hidden rounded-rail-thumb bg-rail-thumb">
              <Image
                src={item.image}
                alt=""
                fill
                unoptimized={skipImageOptimizer(item.image)}
                sizes="(min-width: 1200px) 105px, (min-width: 769px) 20vw, 36vw"
                className="object-cover"
              />
            </span>
            <span className="w-full truncate text-left font-ui text-[12px] leading-[1.3]">
              {item.title}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
