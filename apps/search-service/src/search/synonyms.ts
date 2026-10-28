import { config } from '../config';
import { logger } from '../logger';

/** The synonym set every text search uses (Typesense 30 keeps synonyms as their own resource, so
 * they survive the alias-swap reindex). Upserted on startup - edit the list, restart. */
export const SYNONYM_SET = 'youmart-synonyms';

/** Words shoppers use interchangeably (English spellings, Hindi/Hinglish names). Each group is
 * multi-way: searching any word also finds the others. Keep groups to true equivalents - a
 * near-miss here pulls unrelated products into results. */
const GROUPS: readonly (readonly string[])[] = [
  ['phone', 'mobile', 'smartphone', 'cellphone', 'mobile phone'],
  ['earphones', 'earphone', 'earbuds', 'earpods', 'in ear'],
  ['headphones', 'headphone', 'headset'],
  ['charger', 'adapter', 'adaptor'],
  ['power bank', 'powerbank'],
  ['back case', 'back cover', 'phone cover', 'mobile cover'],
  ['tempered glass', 'temper glass', 'screen guard', 'screen protector'],
  ['laptop', 'notebook computer'],
  ['tv', 'television'],
  ['fridge', 'refrigerator'],
  ['ac', 'air conditioner'],
  ['mixer', 'mixer grinder', 'mixie'],
  ['car', 'automobile'],
  ['cycle', 'bicycle'],
  ['fertilizer', 'fertiliser', 'plant food', 'plant nutrient'],
  ['manure', 'khad', 'khaad'],
  ['vermicompost', 'vermi compost', 'worm compost', 'kechua khad', 'earthworm compost'],
  ['cow dung', 'gobar', 'cowdung'],
  ['neem cake', 'neem khali'],
  ['potting mix', 'potting soil', 'soil mix'],
  ['pot', 'planter', 'gamla'],
  ['seeds', 'beej'],
  ['composter', 'compost bin'],
  ['diaper', 'diapers', 'nappy', 'nappies'],
  ['bottle', 'water bottle'],
  ['tshirt', 't-shirt', 't shirt', 'tee'],
  ['saree', 'sari'],
  ['slippers', 'chappal', 'flip flops'],
  ['spectacles', 'specs', 'eyeglasses'],
  ['watch', 'wristwatch'],
  ['sofa', 'couch'],
  ['utensils', 'bartan', 'cookware'],
  ['atta', 'wheat flour'],
  ['rice', 'chawal'],
  ['dal', 'lentils', 'pulses'],
  ['detergent', 'washing powder'],
];

/** One-way: searching the root also finds these (but not the other way round - "iphone" must not
 * return every phone). */
const ONE_WAY: readonly { root: string; synonyms: readonly string[] }[] = [
  { root: 'phone', synonyms: ['iphone', 'galaxy', 'redmi', 'oneplus'] },
  { root: 'mobile', synonyms: ['iphone', 'galaxy', 'redmi', 'oneplus'] },
  { root: 'earphones', synonyms: ['airpods', 'neckband'] },
  { root: 'headphones', synonyms: ['airpods max'] },
  // Not "compost": it would rank compost BINS for "fertilizer".
  { root: 'fertilizer', synonyms: ['manure', 'vermicompost', 'bone meal', 'neem cake'] },
  { root: 'compost', synonyms: ['vermicompost'] },
];

const slug = (s: string) => s.replace(/[^a-z0-9]+/g, '-');

export async function ensureSynonyms(): Promise<void> {
  // The JS client has no synonym-set API yet: a plain REST call with the same settings.
  const url = `${config.typesenseProtocol}://${config.typesenseHost}:${config.typesensePort}/synonym_sets/${SYNONYM_SET}`;
  try {
    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        'X-TYPESENSE-API-KEY': config.typesenseApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        items: [
          ...GROUPS.map((synonyms) => ({ id: slug(synonyms[0]!), synonyms })),
          ...ONE_WAY.map(({ root, synonyms }) => ({ id: `to-${slug(root)}`, root, synonyms })),
        ],
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${await res.text()}`);
  } catch (err) {
    // Search still works without synonyms - just less forgiving.
    logger.warn({ err }, 'failed to upsert search synonyms');
  }
}
