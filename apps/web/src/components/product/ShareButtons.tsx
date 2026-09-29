'use client';

import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { FaWhatsapp } from '@/components/ui/FaIcons';

interface ShareButtonsProps {
  title: string;
}

// Live (Heateor): "Share" + 35px round Facebook / X / WhatsApp / More buttons.
export function ShareButtons({ title }: ShareButtonsProps) {
  const [url, setUrl] = useState('');
  useEffect(() => setUrl(window.location.href), []);

  const enc = encodeURIComponent;
  const links = [
    {
      label: 'Share on Facebook',
      bg: 'bg-share-btn-facebook',
      href: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`,
      icon: (
        <svg viewBox="0 0 320 512" aria-hidden="true" className="h-[18px]" fill="currentColor">
          <path d="M279.14 288l14.22-92.66h-88.91v-60.13c0-25.35 12.42-50.06 52.24-50.06h40.42V6.26S260.43 0 225.36 0c-73.22 0-121.08 44.38-121.08 124.72v70.62H22.89V288h81.39v224h100.17V288z" />
        </svg>
      ),
    },
    {
      label: 'Share on X',
      bg: 'bg-share-btn-x',
      href: `https://x.com/intent/post?text=${enc(title)}&url=${enc(url)}`,
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="size-[15px]" fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      ),
    },
    {
      label: 'Share on WhatsApp',
      bg: 'bg-share-btn-whatsapp',
      href: `https://api.whatsapp.com/send?text=${enc(`${title} ${url}`)}`,
      icon: <FaWhatsapp className="size-[20px]" />,
    },
  ];

  const more = async () => {
    if (navigator.share) {
      await navigator.share({ title, url }).catch(() => undefined);
    } else {
      await navigator.clipboard?.writeText(url).catch(() => undefined);
    }
  };

  const circle =
    'm-[2px] flex size-[35px] items-center justify-center rounded-full text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1';

  return (
    <div>
      <p className="font-sans text-[16px] font-bold leading-[25.6px] text-ink-body">Share</p>
      <ul className="my-px flex flex-wrap">
        {links.map((link) => (
          <li key={link.label}>
            <a
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={link.label}
              className={`${circle} ${link.bg}`}
            >
              {link.icon}
            </a>
          </li>
        ))}
        <li>
          <button
            type="button"
            onClick={more}
            aria-label="More sharing options"
            className={`${circle} bg-share-btn-more`}
          >
            <Plus aria-hidden="true" className="size-[20px]" strokeWidth={3} />
          </button>
        </li>
      </ul>
    </div>
  );
}
