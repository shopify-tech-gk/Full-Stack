'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';

/** Shown once per browser session (the app shows it on every cold start). */
export const INTRO_SEEN_KEY = 'ym_intro_seen';
/** Runs before first paint: a visitor who already saw the intro this session never sees it flash. */
export const INTRO_SKIP_SCRIPT = `try{if(sessionStorage.getItem('${INTRO_SEEN_KEY}'))document.documentElement.classList.add('ym-intro-seen')}catch(e){}`;

const MIN_MS = 5600;
const FADE_MS = 450;

/** Mixed products for the rain - the same category artwork the app uses. */
const PRODUCTS = [
  'electronics/headphones/over-ear-headphones',
  'electronics/headphones/tws-earbuds',
  'electronics/speakers/bluetooth-speakers',
  'electronics/cameras/dslr-cameras',
  'clothing/sarees-and-saree-essentials/sarees',
  'clothing/ethnic-wear/kurtas',
  'cosmetics/makeup/lipstick',
  'cosmetics/fragrances/perfumes',
  'footwear/sports-footwear/running-shoes',
  'wall-clock-watches/watches/analog-watches',
  'fashion-jewellery/rings/cocktail-rings',
  'fashion-jewellery/earrings/drop-earrings',
  'travel-accessories/travel-bags/backpacks',
  'electrical-and-lights/decorative-lights/table-lamps',
  'home-appliances/small-kitchen-appliances/air-fryers',
  'musical-instruments/guitars/acoustic-guitars',
  'sports-fitness/cricket/cricket-bats',
  'furniture/chairs/office-chairs',
  'agri-and-gardening/plant-saplings/indoor-plants',
  'kitchenware/plastic-household/water-bottles',
].map((key) => `/categories/explore/${key}.webp`);

/** Deterministic pseudo-random: the server and the browser render identical particles. */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const r = rng(20261015);
const PARTICLES = Array.from({ length: 64 }, (_, i) => ({
  src: PRODUCTS[i % PRODUCTS.length]!,
  x0: `${Math.round(-3 + r() * 106)}vw`,
  size: 26 + Math.round(r() * 18),
  duration: 1.6 + r() * 1.0,
  delay: r() * 1.8,
  rot: Math.round(-25 + r() * 50),
  spin: Math.round(-140 + r() * 280),
}));

/**
 * The website's opening animation, matching the app: the YouMart logo in the centre while a
 * continuous rain of mini product pictures pours into it, then it fades into the page. Once per
 * session; click or any key skips it; with "reduce motion" only the logo shows briefly.
 */
export function IntroSplash() {
  const [gone, setGone] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const done = useRef(false);

  const finish = () => {
    if (done.current) return;
    done.current = true;
    try {
      sessionStorage.setItem(INTRO_SEEN_KEY, '1');
    } catch {
      // private mode: it simply plays again next visit
    }
    setLeaving(true);
    window.setTimeout(() => setGone(true), FADE_MS);
  };

  useEffect(() => {
    if (document.documentElement.classList.contains('ym-intro-seen')) {
      setGone(true);
      return;
    }
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.documentElement.classList.add('ym-intro-playing');
    const timer = window.setTimeout(finish, reduce ? 1000 : MIN_MS);
    const onKey = () => finish();
    window.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('keydown', onKey);
      document.documentElement.classList.remove('ym-intro-playing');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once on load
  }, []);

  useEffect(() => {
    if (gone) document.documentElement.classList.remove('ym-intro-playing');
  }, [gone]);

  if (gone) return null;

  return (
    <div
      id="ym-intro"
      role="presentation"
      onClick={finish}
      className={`ym-intro${leaving ? ' ym-intro--leaving' : ''}`}
    >
      <div className="ym-intro__halo" />
      <div className="ym-intro__rain" aria-hidden="true">
        {PARTICLES.map((p, i) => (
          <span
            key={i}
            className="ym-intro__drop"
            style={
              {
                '--x0': p.x0,
                '--size': `${p.size}px`,
                '--dur': `${p.duration.toFixed(2)}s`,
                '--delay': `${p.delay.toFixed(2)}s`,
                '--r0': `${p.rot}deg`,
                '--r1': `${p.rot + p.spin}deg`,
                backgroundImage: `url(${p.src})`,
              } as CSSProperties
            }
          />
        ))}
      </div>
      <div className="ym-intro__center">
        <div className="ym-intro__glow" />
        <div className="ym-intro__plate">
          {/* eslint-disable-next-line @next/next/no-img-element -- must paint before hydration */}
          <img src="/logo.png" alt="YouMart" className="ym-intro__logo" />
        </div>
        <p className="ym-intro__tagline">
          Shop Easy, Live Better
          <span className="ym-intro__bar" />
        </p>
      </div>
      <span className="ym-intro__skip">Click anywhere to skip</span>
    </div>
  );
}
