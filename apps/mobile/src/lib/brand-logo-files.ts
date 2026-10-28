// Bundled logos for brands Brandfetch has no logo for: each taken from the brand's own website
// (header logo, trimmed; white-on-dark logos recoloured for our light tiles). Keyed by the
// lower-cased brand name as products carry it. BrandLogo tries these before Brandfetch.
/* eslint-disable @typescript-eslint/no-require-imports */
const FILES: Readonly<Record<string, number>> = {
  biodrops: require('../../assets/brand-logos/biodrops.webp'),
  brigreenery: require('../../assets/brand-logos/brigreenery.webp'),
  'coir garden': require('../../assets/brand-logos/coir-garden.webp'),
  'daily dump': require('../../assets/brand-logos/daily-dump.webp'),
  'dharti crop sciences': require('../../assets/brand-logos/dharti-crop-sciences.webp'),
  hadly: require('../../assets/brand-logos/hadly.webp'),
  'kesar organic farm': require('../../assets/brand-logos/kesar-organic-farm.webp'),
  'korrel seeds': require('../../assets/brand-logos/korrel-seeds.webp'),
  kshoni: require('../../assets/brand-logos/kshoni.webp'),
  'lazy gardener': require('../../assets/brand-logos/lazy-gardener.webp'),
  'mitti soul': require('../../assets/brand-logos/mitti-soul.webp'),
  'msaf bio organics': require('../../assets/brand-logos/msaf-bio-organics.webp'),
  orgamify: require('../../assets/brand-logos/orgamify.webp'),
  'organic plant': require('../../assets/brand-logos/organic-plant.webp'),
  trustbasket: require('../../assets/brand-logos/trustbasket.webp'),
  utkarsh: require('../../assets/brand-logos/utkarsh.webp'),
};
/* eslint-enable @typescript-eslint/no-require-imports */

export function bundledBrandLogo(name: string): number | null {
  return FILES[name.trim().toLowerCase()] ?? null;
}
