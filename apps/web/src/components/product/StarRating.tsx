const STAR = 'M14 3.5l3.1 7.1 7.7.7-5.8 5.1 1.7 7.6L14 20l-6.7 4 1.7-7.6-5.8-5.1 7.7-.7z';
const SLOTS = [0, 1, 2, 3, 4];

interface StarRatingProps {
  /** 0-5, fractional allowed. */
  rating: number;
}

// Live draws font glyphs (black outline stars, gold fill clipped to the rating); SVG keeps the
// same 145.6x28 box identical on every device.
export function StarRating({ rating }: StarRatingProps) {
  const value = Math.min(5, Math.max(0, rating));
  const stars = (className: string) => (
    <svg viewBox="0 0 145.6 28" aria-hidden="true" className={`h-[28px] w-[145.6px] ${className}`}>
      {SLOTS.map((slot) => (
        <path key={slot} d={STAR} transform={`translate(${slot * 29.12} 0)`} />
      ))}
    </svg>
  );

  return (
    <span
      role="img"
      aria-label={`Rated ${value} out of 5`}
      className="relative inline-block h-[28px] w-[145.6px] align-top"
    >
      {stars('fill-none stroke-star-empty stroke-[1.3]')}
      <span
        className="absolute inset-y-0 left-0 overflow-hidden"
        style={{ width: `${value * 20}%` }}
      >
        {stars('fill-star-filled')}
      </span>
    </span>
  );
}
