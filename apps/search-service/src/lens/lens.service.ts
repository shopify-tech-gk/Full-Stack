import { createHash } from 'node:crypto';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import type { BrowseItem } from '@youmart/service-client';
import { AppError } from '@youmart/errors';
import { getConnection } from '@youmart/queue';
import { config } from '../config';
import { logger } from '../logger';
import { browse } from '../search/browse.service';
import { taxonomyPromptBlock, validCategoryPairs } from './taxonomy';

/**
 * YouMart Lens (phase 1): Claude looks at the photo and says what the product is and where it sits
 * in our taxonomy; the catalog search (Typesense) then finds the same and related products. The
 * photo itself is never stored - only a hash of it, as the cache key for the identification.
 */

export const LENS_MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type LensMediaType = (typeof LENS_MEDIA_TYPES)[number];

export const LensRequestBody = z.object({
  /** Base64 image bytes (no data: prefix). The apps send a ~1024px JPEG, well under 2 MB. */
  image: z
    .string()
    .min(100)
    .max(6_000_000)
    .regex(/^[A-Za-z0-9+/=\r\n]+$/, 'image must be base64'),
  mediaType: z.enum(LENS_MEDIA_TYPES).default('image/jpeg'),
});
export type LensRequestBody = z.infer<typeof LensRequestBody>;

const Identification = z.object({
  identified: z.boolean(),
  name: z.string().max(120),
  brand: z.string().max(60),
  productType: z.string().max(60),
  colour: z.string().max(40),
  searchQuery: z.string().max(80),
  relatedQuery: z.string().max(80),
  keywords: z.array(z.string().max(40)),
  categories: z.array(z.object({ main: z.string(), sub: z.string() })),
  confidence: z.enum(['high', 'medium', 'low']),
});
type Identification = z.infer<typeof Identification>;

const IDENTIFICATION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'identified',
    'name',
    'brand',
    'productType',
    'colour',
    'searchQuery',
    'relatedQuery',
    'keywords',
    'categories',
    'confidence',
  ],
  properties: {
    identified: { type: 'boolean' },
    name: { type: 'string' },
    brand: { type: 'string' },
    productType: { type: 'string' },
    colour: { type: 'string' },
    searchQuery: { type: 'string' },
    relatedQuery: { type: 'string' },
    keywords: { type: 'array', items: { type: 'string' } },
    categories: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['main', 'sub'],
        properties: { main: { type: 'string' }, sub: { type: 'string' } },
      },
    },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
  },
} as const;

function systemPrompt(): string {
  return `You identify products in photos for YouMart, an Indian online store. The photo was taken by a shopper who wants to find that product, or similar ones, in our catalogue.

Fill in every field:
- identified: false when there is no clear product in the photo (a person, a landscape, a blurry or dark shot). Then leave the text fields empty and the lists empty.
- name: the most specific product name you can tell, e.g. "Apple iPhone 13" or "Prestige pressure cooker". Only name a brand or model you can actually see or recognise; otherwise describe the product generically ("Steel water bottle").
- brand: the brand, or "" when unsure.
- productType: a short generic noun, e.g. "Smartphone", "Running shoes", "Pressure cooker".
- colour: the main colour, or "".
- searchQuery: 1-4 words that would find this exact product by its title, brand + model first (e.g. "iPhone 13"). No colour, storage size or marketing words.
- relatedQuery: 1-3 words that would find similar products (e.g. "iPhone", "smartphone", "running shoes").
- keywords: up to 6 short search keywords.
- categories: up to 3 places in OUR category list below where this product itself would be sold, best first. Copy the names exactly. Give a main and one of its subs only when the product truly belongs in that sub (a phone is not a "Mobile Accessory", a laptop is not a "Computer Accessory"); when no sub fits, give the main with sub "".
- confidence: how sure you are of the name.

Our categories (main: subs):
${taxonomyPromptBlock()}`;
}

let client: Anthropic | null = null;
function anthropic(): Anthropic {
  if (!config.anthropicApiKey) {
    throw new AppError('INTERNAL_ERROR', 503, 'Photo search is not available right now');
  }
  client ??= new Anthropic({ apiKey: config.anthropicApiKey, timeout: 30_000, maxRetries: 1 });
  return client;
}

const NOT_IDENTIFIED: Identification = {
  identified: false,
  name: '',
  brand: '',
  productType: '',
  colour: '',
  searchQuery: '',
  relatedQuery: '',
  keywords: [],
  categories: [],
  confidence: 'low',
};

async function identify(image: string, mediaType: LensMediaType): Promise<Identification> {
  let response: Anthropic.Message;
  try {
    response = await anthropic().messages.create({
      model: config.lensModel,
      max_tokens: 1024,
      // A quick look-and-label task: no extended reasoning needed, which also keeps it cheap.
      thinking: { type: 'disabled' },
      system: [{ type: 'text', text: systemPrompt(), cache_control: { type: 'ephemeral' } }],
      output_config: { format: { type: 'json_schema', schema: IDENTIFICATION_SCHEMA } },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: image } },
            { type: 'text', text: 'What product is this?' },
          ],
        },
      ],
    } as Anthropic.MessageCreateParamsNonStreaming);
  } catch (err) {
    if (err instanceof Anthropic.BadRequestError) {
      // e.g. an unreadable / corrupt image
      logger.warn({ err: err.message }, 'lens: request rejected');
      throw new AppError('VALIDATION_ERROR', 400, 'We could not read that photo. Try another one.');
    }
    if (err instanceof Anthropic.RateLimitError) {
      throw new AppError('RATE_LIMITED', 429, 'Photo search is busy. Please try again shortly.');
    }
    if (err instanceof Anthropic.APIError) {
      logger.error({ status: err.status, err: err.message }, 'lens: model call failed');
    } else {
      logger.error({ err }, 'lens: model call failed');
    }
    throw new AppError('INTERNAL_ERROR', 503, 'Photo search is not available right now');
  }

  logger.info(
    {
      model: response.model,
      inputTokens: response.usage.input_tokens,
      cacheReadTokens: response.usage.cache_read_input_tokens,
      outputTokens: response.usage.output_tokens,
      stopReason: response.stop_reason,
    },
    'lens: identified',
  );

  if (response.stop_reason === 'refusal') return NOT_IDENTIFIED;
  const text = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text')?.text;
  if (!text) return NOT_IDENTIFIED;
  try {
    const parsed = Identification.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : NOT_IDENTIFIED;
  } catch {
    return NOT_IDENTIFIED;
  }
}

const CACHE_TTL_SECONDS = 24 * 60 * 60;
const QUOTA_TTL_SECONDS = 2 * 24 * 60 * 60;

/** Same photo again (retry, re-open) answers from cache and does not use up the daily allowance. */
async function cachedIdentify(
  userId: string,
  image: string,
  mediaType: LensMediaType,
): Promise<Identification> {
  const redis = getConnection();
  const hash = createHash('sha256').update(image).digest('hex');
  const cacheKey = `lens:v2:${hash}`;
  const hit = await redis.get(cacheKey);
  if (hit) {
    const parsed = Identification.safeParse(JSON.parse(hit));
    if (parsed.success) return parsed.data;
  }

  const day = new Date().toISOString().slice(0, 10);
  const quotaKey = `lens:quota:${userId}:${day}`;
  const used = await redis.incr(quotaKey);
  if (used === 1) await redis.expire(quotaKey, QUOTA_TTL_SECONDS);
  if (used > config.lensDailyLimit) {
    throw new AppError(
      'RATE_LIMITED',
      429,
      `You've used today's ${config.lensDailyLimit} photo searches. Try again tomorrow.`,
    );
  }

  const result = await identify(image, mediaType);
  await redis.set(cacheKey, JSON.stringify(result), 'EX', CACHE_TTL_SECONDS);
  return result;
}

export interface LensProduct {
  id: string;
  title: string;
  slug: string;
  price: string;
  mrp: string;
  skuId: string | null;
  imageUrl: string | null;
  rating: number | null;
  ratingCount: number;
  category: { id: string; name: string; slug: string };
}

export interface LensResult {
  identified: boolean;
  /** What we think it is ("Apple iPhone 13"), null when nothing recognisable was found. */
  label: string | null;
  brand: string | null;
  productType: string | null;
  colour: string | null;
  confidence: 'high' | 'medium' | 'low';
  /** The text query the apps can hand to normal search ("See all results"). */
  query: string | null;
  /** Where this product is sold in our taxonomy (names exactly as in the apps' category tree). */
  categories: { main: string; sub: string | null }[];
  /** Catalogue categories the matched products are actually listed in (most products first) -
   * these always open a real listing (`/category/<slug>`). */
  catalogCategories: { id: string; name: string; slug: string; count: number }[];
  /** The same product (title match). */
  matches: LensProduct[];
  /** Similar products (same type / brand line), never repeating a match. */
  related: LensProduct[];
}

const toProduct = (item: BrowseItem): LensProduct => ({
  id: item.id,
  title: item.title,
  slug: item.slug,
  price: item.price,
  mrp: item.mrp,
  skuId: item.skuId,
  imageUrl: item.imageUrl,
  rating: item.rating,
  ratingCount: item.ratingCount,
  category: item.category,
});

async function searchProducts(q: string, perPage: number): Promise<BrowseItem[]> {
  if (!q.trim()) return [];
  const result = await browse({
    q: q.trim().slice(0, 200),
    filters: [],
    facets: [],
    includeStats: false,
    sort: 'relevance',
    page: 1,
    perPage,
  });
  return result.items;
}

function categoriesOf(items: BrowseItem[]): LensResult['catalogCategories'] {
  const byId = new Map<string, LensResult['catalogCategories'][number]>();
  for (const { category } of items) {
    const entry = byId.get(category.id) ?? { ...category, count: 0 };
    entry.count += 1;
    byId.set(category.id, entry);
  }
  return [...byId.values()].sort((a, b) => b.count - a.count);
}

/** "iPhone 13 Pro" -> ["iPhone 13", "iPhone"]: the nearest models first, then the wider family. */
function broaderQueries(query: string): string[] {
  const words = query.trim().split(/\s+/);
  const out: string[] = [];
  for (let n = words.length - 1; n >= 1; n -= 1) out.push(words.slice(0, n).join(' '));
  return out;
}

const RELATED_LIMIT = 12;

export async function lensSearch(userId: string, body: LensRequestBody): Promise<LensResult> {
  const image = body.image.replace(/[\r\n]/g, '');
  const id = await cachedIdentify(userId, image, body.mediaType);

  if (!id.identified) {
    return {
      identified: false,
      label: null,
      brand: null,
      productType: null,
      colour: null,
      confidence: 'low',
      query: null,
      categories: [],
      catalogCategories: [],
      matches: [],
      related: [],
    };
  }

  const exactQuery = id.searchQuery || id.name;
  const matches = await searchProducts(exactQuery, 12);
  const seen = new Set(matches.map((p) => p.id));
  const related: BrowseItem[] = [];
  const tried = new Set([exactQuery.toLowerCase()]);
  const relatedQueries = [...broaderQueries(exactQuery), id.relatedQuery, id.productType, id.brand];
  for (const q of relatedQueries) {
    if (related.length >= RELATED_LIMIT) break;
    // A lone brand word ("Apple") is only a last resort - it pulls in every product of the brand.
    if (!q || tried.has(q.toLowerCase())) continue;
    tried.add(q.toLowerCase());
    for (const item of await searchProducts(q, RELATED_LIMIT)) {
      if (seen.has(item.id) || related.length >= RELATED_LIMIT) continue;
      seen.add(item.id);
      related.push(item);
    }
  }

  return {
    identified: true,
    label: id.name || id.productType || null,
    brand: id.brand || null,
    productType: id.productType || null,
    colour: id.colour || null,
    confidence: id.confidence,
    query: exactQuery || null,
    categories: validCategoryPairs(id.categories).slice(0, 3),
    catalogCategories: categoriesOf(matches.length ? matches : related),
    matches: matches.map(toProduct),
    related: related.map(toProduct),
  };
}
