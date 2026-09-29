const STAR = 'M14 3.5l3.1 7.1 7.7.7-5.8 5.1 1.7 7.6L14 20l-6.7 4 1.7-7.6-5.8-5.1 7.7-.7z';
const SLOTS = [0, 1, 2, 3, 4];

const VARIANTS = {
  // Homepage grid: 28px glyphs in a 145.6x28 box.
  grid: {
    slot: 29.12,
    empty: 'fill-none stroke-star-empty stroke-[1.3]',
    filled: 'fill-star-filled',
  },
  // WooCommerce "star" font (listing/product pages): 5.4em wide, gold fill with a black outline.
  woo: {
    slot: 30.24,
    empty: 'fill-none stroke-black stroke-[1.4]',
    filled: 'fill-catalog-starFill stroke-black stroke-[1.4]',
  },
} as const;

interface StarRatingProps {
  /** 0-5, fractional allowed. */
  rating: number;
  variant?: keyof typeof VARIANTS;
  /** Glyph height in px (woo variant). */
  size?: number;
}

// Live draws font glyphs; SVG keeps the same box identical on every device.
export function StarRating({ rating, variant = 'grid', size = 28 }: StarRatingProps) {
  const value = Math.min(5, Math.max(0, rating));
  const { slot, empty, filled } = VARIANTS[variant];
  const box =
    variant === 'grid' ? { width: 145.6, height: 28 } : { width: size * 5.4, height: size };
  const stars = (className: string) => (
    <svg
      viewBox={`0 0 ${slot * 5} 28`}
      aria-hidden="true"
      className={className}
      style={{ width: box.width, height: box.height }}
    >
      {SLOTS.map((index) => (
        <path key={index} d={STAR} transform={`translate(${index * slot} 0)`} />
      ))}
    </svg>
  );

  return (
    <span
      role="img"
      aria-label={`Rated ${value} out of 5`}
      className="relative inline-block align-top"
      style={{ width: box.width, height: box.height }}
    >
      {stars(empty)}
      <span
        className="absolute inset-y-0 left-0 overflow-hidden"
        style={{ width: `${value * 20}%` }}
      >
        {stars(filled)}
      </span>
    </span>
  );
}
