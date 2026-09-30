# YouMart Catalog Import Spec (v1)

**Audience:** the catalog data team delivering the ~350,000-product catalog.
**Status:** contract between the platform build (W3, 2026-09-30) and the data team. The platform
side is built and verified against this spec; the bulk importer that reads a delivery is a later
pipeline step and will implement exactly what is written here.

The storefront is **attribute-driven**: every product carries free-form attributes, every category
declares which of those attributes it can be filtered by, and one generic listing page renders the
right filters for any category from that data. **Adding a category or a filter is a data change -
no code.** Everything below exists to keep that true.

---

## 1. Delivery format

Deliver **JSON Lines** (`.jsonl`, UTF-8, one JSON object per line), gzip-compressed, in batches:

| File                            | One line per | Section |
| ------------------------------- | ------------ | ------- |
| `categories.jsonl`              | category     | §2      |
| `products-0001.jsonl.gz`, `...` | product      | §3      |

- Batches of **at most 50,000 products** per file (≈ 7 files for 350k).
- `categories.jsonl` is always delivered **complete** (the full tree, every time).
- Every line must be a standalone, valid JSON object. No trailing commas, no comments.
- JSON Lines is chosen over CSV because products have nested data (SKUs, images, list-valued
  attributes) that CSV can only carry through fragile conventions.

A `manifest.json` accompanies each delivery:

```json
{
  "delivery": "2026-10-15-full",
  "type": "full",
  "categories": { "file": "categories.jsonl", "lines": 612 },
  "products": [
    { "file": "products-0001.jsonl.gz", "lines": 50000, "sha256": "..." },
    { "file": "products-0002.jsonl.gz", "lines": 50000, "sha256": "..." }
  ]
}
```

`type` is `"full"` (the complete catalog; products not present are archived) or `"delta"`
(only the products included are created/updated; nothing is archived).

## 2. Categories + filter definitions

```json
{
  "slug": "mobiles",
  "name": "Mobiles",
  "parent_slug": "electronics",
  "filters": [
    { "key": "brand", "label": "Brand", "type": "multi_select", "order": 1 },
    { "key": "ram", "label": "RAM", "type": "multi_select", "unit": "GB", "order": 2 },
    { "key": "storage", "label": "Storage", "type": "multi_select", "unit": "GB", "order": 3 },
    { "key": "screen_size", "label": "Screen Size", "type": "range", "unit": "in", "order": 4 },
    { "key": "network", "label": "Network", "type": "single_select", "order": 5 }
  ]
}
```

| Field         | Required | Type   | Rules                                                                                                                                            |
| ------------- | -------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `slug`        | yes      | string | `^[a-z0-9-]{1,200}$`, unique across ALL categories, **stable forever** (it is the URL: `/product-category/<parent>/<slug>`). Reuse live youmartshop.com slugs. |
| `name`        | yes      | string | 1-200 chars, display name.                                                                                                                       |
| `parent_slug` | no       | string | Slug of the parent; omit/null for a root. Parents must appear earlier in the file. Max depth 3 (root > sub > child), as the storefront menu.      |
| `filters`     | no       | array  | The **filter definition** (below). Omit/null = **inherit** the nearest ancestor's definition. `[]` = explicitly no attribute filters.            |

### Filter definition entries

| Field   | Required | Type    | Rules                                                                                                           |
| ------- | -------- | ------- | --------------------------------------------------------------------------------------------------------------- |
| `key`   | yes      | string  | An attribute key used by this category's products (§4). `^[a-z0-9_]{1,40}$`. Unique within the definition.      |
| `label` | yes      | string  | 1-60 chars, what the shopper sees ("RAM", "Screen Size").                                                       |
| `type`  | yes      | enum    | `multi_select` (checkboxes), `single_select` (radio), `range` (slider), `boolean` (a single "Yes" checkbox).     |
| `unit`  | no       | string  | 1-12 chars, shown after values ("GB", "in", "ml", "pcs"). Never repeat the unit inside attribute values.         |
| `order` | no       | integer | 0-1000, display order (ascending).                                                                              |

- At most **30** filters per category.
- **Price and rating are universal** - every category gets them automatically. Never declare them.
- Reserved keys (rejected): `category`, `categoryId`, `q`, `price`, `min_price`, `max_price`,
  `minPrice`, `maxPrice`, `rating`, `sort`, `page`, `cursor`, `limit`.
- `range` filters need **numeric** attribute values (§4.2); the other types use any value.
- A filter whose key no product in the category carries is simply not shown - it is not an error.
- Put the definition on the most specific category whose products share it. Parents may carry a
  smaller common definition (e.g. `baby-care`: Brand + Age) that children without their own inherit.

## 3. Products

```json
{
  "external_id": "DT-00012345",
  "title": "Samsung Galaxy M35 5G (8GB RAM, 128GB)",
  "slug": "samsung-galaxy-m35-5g-8gb-128gb",
  "description": "6.6-inch sAMOLED display, 6000mAh battery...",
  "category_slug": "mobiles",
  "status": "ACTIVE",
  "attributes": {
    "brand": "Samsung",
    "ram": "8",
    "storage": "128",
    "screen_size": 6.6,
    "network": "5G",
    "color": ["Black", "Blue"]
  },
  "hsn_code": "85171300",
  "gst_rate_percent": "18.00",
  "rating": 4.3,
  "rating_count": 812,
  "skus": [
    {
      "sku_code": "SM-M35-8-128-BLK",
      "mrp": "24999.00",
      "selling_price": "18999.00",
      "stock": 25,
      "attributes": { "color": "Black" }
    }
  ],
  "images": [
    { "url": "products/sm-m35/1.jpg", "position": 0 },
    { "url": "products/sm-m35/2.jpg", "position": 1 }
  ]
}
```

| Field              | Required | Type             | Rules                                                                                                                  |
| ------------------ | -------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `external_id`      | yes      | string           | The data team's stable id, 1-100 chars. The importer upserts by it - re-delivering a product updates it, never duplicates. |
| `title`            | yes      | string           | 1-300 chars.                                                                                                           |
| `slug`             | no       | string           | `^[a-z0-9-]{1,200}$`, unique. Generated from the title when omitted. Stable once published (it is the product URL).     |
| `description`      | no       | string           | Up to 5,000 chars, plain text. The first sentence doubles as the short description.                                     |
| `category_slug`    | yes      | string           | Must exist in `categories.jsonl`. Assign the **most specific** (leaf) category.                                         |
| `status`           | no       | enum             | `ACTIVE` (listed) \| `DRAFT` (hidden) \| `ARCHIVED` (withdrawn). Default `ACTIVE`.                                      |
| `attributes`       | yes      | object           | §4. May be `{}`, but products without attributes can't be filtered.                                                     |
| `hsn_code`         | no       | string           | GST HSN/SAC code, 1-20 chars. Platform default applies when omitted.                                                    |
| `gst_rate_percent` | no       | decimal string   | e.g. `"18.00"`. Platform default applies when omitted.                                                                   |
| `rating`           | no       | number           | Average review rating 1.0-5.0 (one decimal), feeds the rating filter/sort. Omit when there are no ratings.              |
| `rating_count`     | no       | integer          | Number of ratings behind `rating`. Default 0.                                                                           |
| `skus`             | yes      | array (1+)       | Sellable variants (below).                                                                                              |
| `images`           | no       | array            | §5. First by `position` is the listing image.                                                                           |

### SKUs

| Field           | Required | Type           | Rules                                                                                      |
| --------------- | -------- | -------------- | ------------------------------------------------------------------------------------------ |
| `sku_code`      | yes      | string         | 1-100 chars, unique across the whole catalog, stable.                                      |
| `mrp`           | yes      | decimal string | Rupees with exactly 2 decimals (`"24999.00"`). Never a JSON number (float rounding).        |
| `selling_price` | yes      | decimal string | Same format, `<= mrp`.                                                                     |
| `stock`         | no       | integer        | Units available, >= 0. Default 0 (listed but not purchasable).                              |
| `attributes`    | no       | object         | What distinguishes this variant (`{"color": "Black"}`), same format as §4.                 |

The listing shows the **cheapest SKU's** price and MRP.

## 4. Attributes (the key to filtering)

`attributes` is a flat JSON object: **attribute key -> value**.

### 4.1 Keys

- `lower_snake_case`, `^[a-z0-9_]{1,40}$`: `brand`, `ram`, `screen_size`, `pack_count`, `age_group`.
- **Consistent across a category.** Every product in Mobiles uses `ram` - never `RAM`, `ram_gb`,
  `memory` for the same thing. A filter only finds products that use its exact key.
- **Consistent across categories where the meaning is the same.** `brand` is `brand` everywhere;
  `color` is `color` everywhere.
- `brand` is conventional: provide it on every product that has a brand. The storefront's
  "Shop by brand" strip uses it when the category's definition includes `brand`.
- Keys a category's definition doesn't mention are still stored and shown in the product's
  Specifications table - so deliver every useful spec, not only the filterable ones.

### 4.2 Values

| Value type    | Example                          | Use for                                                                                 |
| ------------- | -------------------------------- | --------------------------------------------------------------------------------------- |
| string        | `"Samsung"`, `"5G"`, `"M"`       | `multi_select` / `single_select` filters.                                               |
| number        | `6.6`, `1000`, `54`              | `range` filters (also fine for select filters). A numeric string (`"8"`) counts too.     |
| boolean       | `true` / `false`                 | `boolean` filters ("Insulated: Yes").                                                   |
| list          | `["Black", "Blue"]`              | Multi-valued attributes; the product matches a filter on any of its values.              |

Rules:

- **No units inside values**: `"ram": "8"` with the filter's `"unit": "GB"` - not `"8GB"` or
  `"8 GB"`. A range filter can only use values that are plain numbers.
- **Consistent spelling and casing** of values within a category: `"Samsung"` everywhere, not
  `"SAMSUNG"`/`"samsung"`. Each distinct spelling shows as a separate filter option.
- Values: 1-100 characters, **no commas** (the listing URL separates selected values with commas)
  and no backticks.
- Numbers are plain JSON numbers or numeric strings, `.` as the decimal separator, no thousands
  separators.
- Nested objects are not allowed. Prefer 5-30 attributes per product.

## 5. Images

- Deliver each `url` as either:
  - a **key/path** on the YouMart CDN bucket (`products/sm-m35/1.jpg`) - **preferred**; the platform
    prepends `CDN_BASE_URL` (e.g. `https://cdn.youmart.in`) at read time, so moving CDNs never
    touches the data; or
  - an **absolute `https://` URL** on an existing host (e.g. the current S3/CloudFront bucket),
    used as delivered.
- JPEG or WebP, **at least 800x800 px, square (1:1)**, product on a white background, at most
  500 KB each, up to 8 images per product. `position` 0 is the main/listing image.
- URLs must be publicly readable without auth and must not change once delivered (they are cached).
- The storefront serves catalog images straight from the CDN (no resize on our side), so upload
  them already sized.

## 6. How the import runs

1. **Validate** the whole delivery against this spec first (schema, uniqueness of slugs/SKU codes,
   categories exist, `selling_price <= mrp`, value formats). Nothing is written if validation fails;
   a line-numbered error report goes back to the data team.
2. **Categories** are upserted by `slug` (including their filter definitions). This alone updates
   every storefront filter - no reindex needed.
3. **Products** are upserted by `external_id` in batches (transactions of ~1,000), SKUs by
   `sku_code`, images replaced per product. A `full` delivery archives active products missing
   from it.
4. **Stock** is written to inventory per SKU.
5. The **search index is rebuilt once** at the end (zero-downtime alias swap, the same job that runs
   nightly) instead of one reindex per product.
6. A summary (created / updated / archived / rejected counts) is produced per delivery.

## 7. Checklist before delivering

- [ ] Every product's `category_slug` exists; categories are leaf-level where possible.
- [ ] Every category that needs filters has a `filters` definition (or inherits one on purpose).
- [ ] Every filter `key` is actually used, with the same spelling, by that category's products.
- [ ] Range filters point at attributes whose values are numbers without units.
- [ ] Values are consistently cased/spelled per category; no commas or backticks in values.
- [ ] Money fields are 2-decimal strings; `selling_price <= mrp`.
- [ ] `external_id`, `slug` and `sku_code` are unique and stable across deliveries.
- [ ] Images are reachable over HTTPS, square, >= 800 px.

## 8. How it scales (for reference)

Listing, filter values/counts and filtering are answered by the Typesense search index, never by
scanning Postgres per request. Every attribute is indexed automatically under a generic field
(`attrs_<key>` for values, `attrn_<key>` for numbers), so a new attribute key needs no schema
change, and a filter definition only chooses which indexed attributes a category offers. Details:
`docs/contracts/API.md` §4 and `docs/contracts/search-api.md`.
