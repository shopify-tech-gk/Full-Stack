// Live starburst: 28-point outer burst with an inset inner burst, 100x100 viewBox.
const OUTER =
  '50,0 57.57,16.85 71.69,4.95 71.2,23.42 89.09,18.83 80.63,35.25 98.75,38.87 84,50 98.75,61.13 80.63,64.75 89.09,81.17 71.2,76.58 71.69,95.05 57.57,83.15 50,100 42.43,83.15 28.31,95.05 28.8,76.58 10.91,81.17 19.37,64.75 1.25,61.13 16,50 1.25,38.87 19.37,35.25 10.91,18.83 28.8,23.42 28.31,4.95 42.43,16.85';
const INNER =
  '50,6 56.68,20.75 69.09,10.36 68.7,26.55 84.4,22.57 77.03,36.98 92.9,40.21 80,50 92.9,59.79 77.03,63.02 84.4,77.43 68.7,73.45 69.09,89.64 56.68,79.25 50,94 43.32,79.25 30.91,89.64 31.3,73.45 15.6,77.43 22.97,63.02 7.1,59.79 20,50 7.1,40.21 22.97,36.98 15.6,22.57 31.3,26.55 30.91,10.36 43.32,20.75';

interface OfferBadgeProps {
  lines: readonly [string, string];
}

export function OfferBadge({ lines }: OfferBadgeProps) {
  // Live shrinks the text when the first line is long ("5% to 90%").
  const compact = lines[0].length >= 8;
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute -bottom-[8px] -left-[8px] z-10 size-[70px] drop-shadow-[0_1px_2px_rgba(0,0,0,0.25)] md:-bottom-[20px] md:-left-[12px] md:size-[78px]"
    >
      <svg viewBox="0 0 100 100" className="block size-full">
        <polygon points={OUTER} className="fill-offer-outer" />
        <polygon points={INNER} className="fill-offer-inner" />
      </svg>
      <span
        className={`absolute inset-0 mt-[2px] flex flex-col items-center justify-center break-words text-center font-sans font-medium text-offer-text md:mt-0 ${
          compact
            ? 'px-[4px] text-[9px] leading-[1.05] md:text-[8.5px]'
            : 'px-[3px] text-[8px] leading-[1.15] md:px-[6px] md:text-[10px]'
        }`}
      >
        {lines[0]}
        <br />
        {lines[1]}
      </span>
    </span>
  );
}
