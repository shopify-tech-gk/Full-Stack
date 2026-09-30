'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, Maximize, X } from 'lucide-react';
import { useModal } from '@/lib/useModal';
import { skipImageOptimizer } from '@/lib/images';

interface ProductGalleryProps {
  images: readonly string[];
  title: string;
}

const svg = skipImageOptimizer;

// Live (nickx slider): main image with a fade, 4-up thumbnail row (inactive at 70% opacity),
// expand icon bottom-right opening a full-screen lightbox. No hover zoom (live: zoom "off").
export function ProductGallery({ images, title }: ProductGalleryProps) {
  const [index, setIndex] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const count = images.length;

  return (
    <div className="mb-[32px] w-full md:max-w-[650px] lg:w-[600px] lg:shrink-0">
      <div className="relative overflow-hidden">
        {images.map((src, i) => (
          <Image
            key={src}
            src={src}
            alt={i === index ? title : ''}
            aria-hidden={i !== index}
            width={600}
            height={600}
            priority={i === 0}
            unoptimized={svg(src)}
            sizes="(min-width: 1025px) 600px, 100vw"
            className={`h-auto w-full transition-opacity duration-300 motion-reduce:transition-none ${
              i === index ? 'relative opacity-100' : 'absolute inset-0 opacity-0'
            }`}
          />
        ))}
        <button
          type="button"
          onClick={() => setLightbox(true)}
          aria-label="View images full screen"
          className="absolute bottom-[10px] right-[13px] z-10 flex size-[30px] items-center justify-center rounded-[4px] bg-white/70 text-[#6b7280] hover:text-black focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <Maximize aria-hidden="true" className="size-[20px]" />
        </button>
      </div>

      {count > 1 && (
        <ul className="scrollbar-none mt-[10px] flex gap-[10px] overflow-x-auto">
          {images.map((src, i) => (
            <li key={src} className="w-[calc((100%-30px)/4)] shrink-0">
              <button
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Show image ${i + 1} of ${count}`}
                aria-current={i === index}
                className={`block w-full transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                  i === index ? 'opacity-100' : 'opacity-70 hover:opacity-100'
                }`}
              >
                <Image
                  src={src}
                  alt=""
                  width={150}
                  height={150}
                  unoptimized={svg(src)}
                  className="aspect-square h-auto w-full object-cover"
                />
              </button>
            </li>
          ))}
        </ul>
      )}

      {lightbox && (
        <Lightbox
          images={images}
          title={title}
          index={index}
          onIndex={setIndex}
          onClose={() => setLightbox(false)}
        />
      )}
    </div>
  );
}

interface LightboxProps {
  images: readonly string[];
  title: string;
  index: number;
  onIndex: (index: number) => void;
  onClose: () => void;
}

function Lightbox({ images, title, index, onIndex, onClose }: LightboxProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const count = images.length;
  const go = useCallback(
    (step: number) => onIndex((index + step + count) % count),
    [index, count, onIndex],
  );
  useModal(true, onClose, closeRef);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') go(-1);
      if (event.key === 'ArrowRight') go(1);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [go]);

  const src = images[index] ?? images[0] ?? '';
  const control =
    'flex items-center justify-center text-white/80 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${title} - image ${index + 1} of ${count}`}
      className="fixed inset-0 z-[1100] flex items-center justify-center bg-[rgba(30,30,30,0.9)]"
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      <p className="absolute left-[16px] top-[14px] font-sans text-[13px] text-white/80">
        {index + 1} / {count}
      </p>
      <button
        ref={closeRef}
        type="button"
        onClick={onClose}
        aria-label="Close"
        className={`absolute right-[8px] top-[8px] size-[44px] ${control}`}
      >
        <X aria-hidden="true" className="size-[24px]" />
      </button>
      {count > 1 && (
        <button
          type="button"
          onClick={() => go(-1)}
          aria-label="Previous image"
          className={`absolute left-[8px] top-1/2 size-[44px] -translate-y-1/2 ${control}`}
        >
          <ChevronLeft aria-hidden="true" className="size-[32px]" />
        </button>
      )}
      <Image
        src={src}
        alt={title}
        width={1200}
        height={1200}
        unoptimized={svg(src)}
        className="max-h-[88vh] w-auto max-w-[88vw] object-contain"
      />
      {count > 1 && (
        <button
          type="button"
          onClick={() => go(1)}
          aria-label="Next image"
          className={`absolute right-[8px] top-1/2 size-[44px] -translate-y-1/2 ${control}`}
        >
          <ChevronRight aria-hidden="true" className="size-[32px]" />
        </button>
      )}
    </div>
  );
}
