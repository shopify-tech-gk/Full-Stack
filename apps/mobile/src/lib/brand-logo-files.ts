// Bundled logos for brands Brandfetch has no logo for: each taken from the brand's own website
// (header logo, trimmed; white-on-dark logos recoloured for our light tiles). Keyed by the
// lower-cased brand name as products carry it. BrandLogo tries these before Brandfetch.
/* eslint-disable @typescript-eslint/no-require-imports */
const FILES: Readonly<Record<string, number>> = {
  'anand agro care': require('../../assets/brand-logos/anand-agro-care.webp'),
  "anandi green's": require('../../assets/brand-logos/anandi-greens.webp'),
  bazodo: require('../../assets/brand-logos/bazodo.webp'),
  behoma: require('../../assets/brand-logos/behoma.webp'),
  biodrops: require('../../assets/brand-logos/biodrops.webp'),
  biostadt: require('../../assets/brand-logos/biostadt.webp'),
  brigreenery: require('../../assets/brand-logos/brigreenery.webp'),
  'coir garden': require('../../assets/brand-logos/coir-garden.webp'),
  'daily dump': require('../../assets/brand-logos/daily-dump.webp'),
  'dharti crop sciences': require('../../assets/brand-logos/dharti-crop-sciences.webp'),
  'foodie puppies': require('../../assets/brand-logos/foodie-puppies.webp'),
  gacil: require('../../assets/brand-logos/gacil.webp'),
  'go garden': require('../../assets/brand-logos/go-garden.webp'),
  hadly: require('../../assets/brand-logos/hadly.webp'),
  homecrop: require('../../assets/brand-logos/homecrop.webp'),
  'kesar organic farm': require('../../assets/brand-logos/kesar-organic-farm.webp'),
  'korrel seeds': require('../../assets/brand-logos/korrel-seeds.webp'),
  kraftskala: require('../../assets/brand-logos/kraftskala.webp'),
  kshoni: require('../../assets/brand-logos/kshoni.webp'),
  'lazy gardener': require('../../assets/brand-logos/lazy-gardener.webp'),
  'leafy tales': require('../../assets/brand-logos/leafy-tales.webp'),
  mahadhan: require('../../assets/brand-logos/mahadhan.webp'),
  'mitti soul': require('../../assets/brand-logos/mitti-soul.webp'),
  'msaf bio organics': require('../../assets/brand-logos/msaf-bio-organics.webp'),
  myowngarden: require('../../assets/brand-logos/myowngarden.webp'),
  orgamify: require('../../assets/brand-logos/orgamify.webp'),
  'organic plant': require('../../assets/brand-logos/organic-plant.webp'),
  organicdews: require('../../assets/brand-logos/organicdews.webp'),
  'pi industries ltd': require('../../assets/brand-logos/pi-industries-ltd.webp'),
  'the decorshed': require('../../assets/brand-logos/the-decorshed.webp'),
  trustbasket: require('../../assets/brand-logos/trustbasket.webp'),
  'urban plant': require('../../assets/brand-logos/urban-plant.webp'),
  utkarsh: require('../../assets/brand-logos/utkarsh.webp'),
  vikalp: require('../../assets/brand-logos/vikalp.webp'),
  xergy: require('../../assets/brand-logos/xergy.webp'),
};
/* eslint-enable @typescript-eslint/no-require-imports */

export function bundledBrandLogo(name: string): number | null {
  return FILES[name.trim().toLowerCase()] ?? null;
}
