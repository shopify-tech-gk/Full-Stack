"""Import the client's final category sheet (products_fetch_team_*.xlsx) into the project.

Writes:
  packages/shared-client/data/category-taxonomy.csv   main -> sub -> sub-to-sub (the taxonomy source;
                                                       run `pnpm build:category-taxonomy` after)
  packages/shared-client/src/category-brands.data.ts   brands per main / sub / sub-to-sub, keyed by
                                                       the same slug paths as the category images
and carries existing category artwork over to renamed / moved categories (both
apps/web/public/categories/explore and apps/mobile/assets/categories/explore), deleting artwork
for categories that no longer exist.

Usage:  python scripts/import-category-excel.py [path/to/products_fetch_team.xlsx]
Needs:  pip install openpyxl
"""

from __future__ import annotations

import collections
import csv
import json
import re
import sys
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_XLSX = Path.home() / "Downloads" / "products_fetch_team_v5-final.xlsx"
CSV_OUT = ROOT / "packages/shared-client/data/category-taxonomy.csv"
BRANDS_OUT = ROOT / "packages/shared-client/src/category-brands.data.ts"
IMAGE_DIRS = [
    ROOT / "apps/web/public/categories/explore",
    ROOT / "apps/mobile/assets/categories/explore",
]


def clean(value) -> str | None:
    if value is None:
        return None
    text = re.sub(r"\s+", " ", str(value)).replace("\u2019", "'").strip()
    text = text.strip(",").strip().strip('"').strip()
    return text or None


def slugify(text: str) -> str:
    """Same rule as shared-client slugify() / build-category-taxonomy.mjs."""
    text = text.lower().replace("&", " ")
    return re.sub(r"^-+|-+$", "", re.sub(r"[^a-z0-9]+", "-", text))


def parse_brands(value) -> list[str]:
    if not value:
        return []
    found = re.findall(r'"([^"]+)"', str(value))
    names = found or str(value).split(",")
    out: list[str] = []
    for name in names:
        name = re.sub(r"\s+", " ", name).strip().strip(",").strip()
        if name and name not in out:
            out.append(name)
    return out


def read_sheet(path: Path):
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    ws = wb["Category-Brands"]
    tree: dict[str, dict[str, dict]] = collections.OrderedDict()
    main = sub = None
    for row in list(ws.iter_rows(values_only=True))[1:]:
        m, s, leaf, brands = clean(row[0]), clean(row[1]), clean(row[2]), parse_brands(row[3])
        if m:
            main, sub = m, None
        if s:
            sub = s
        if not main or not sub:
            continue
        node = tree.setdefault(main, collections.OrderedDict()).setdefault(
            sub, {"leaves": collections.OrderedDict(), "brands": []}
        )
        if leaf:
            node["leaves"].setdefault(leaf, [])
            for b in brands:
                if b not in node["leaves"][leaf]:
                    node["leaves"][leaf].append(b)
        else:
            for b in brands:
                if b not in node["brands"]:
                    node["brands"].append(b)
    return tree


def write_csv(tree) -> None:
    with CSV_OUT.open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["main_category", "sub_category", "sub_to_sub_category"])
        for main, subs in tree.items():
            for sub, node in subs.items():
                if node["leaves"]:
                    for leaf in node["leaves"]:
                        w.writerow([main, sub, leaf])
                else:
                    w.writerow([main, sub, ""])


def ranked(lists: list[list[str]]) -> list[str]:
    """Union of brand lists, most widely stocked across the children first (ties: first seen)."""
    count: collections.Counter[str] = collections.Counter()
    first: dict[str, int] = {}
    for lst in lists:
        for b in lst:
            count[b] += 1
            first.setdefault(b, len(first))
    return sorted(count, key=lambda b: (-count[b], first[b]))


def write_brands(tree) -> int:
    per_key: dict[str, list[str]] = {}
    for main, subs in tree.items():
        m = slugify(main)
        sub_lists = []
        for sub, node in subs.items():
            s = f"{m}/{slugify(sub)}"
            leaf_lists = []
            for leaf, brands in node["leaves"].items():
                per_key[f"{s}/{slugify(leaf)}"] = brands
                leaf_lists.append(brands)
            sub_brands = ranked(leaf_lists + [node["brands"]])
            per_key[s] = sub_brands
            sub_lists.append(sub_brands)
        per_key[m] = ranked(sub_lists)

    usage = collections.Counter(b for lst in per_key.values() for b in lst)
    names = sorted(usage, key=lambda b: (-usage[b], b.lower()))
    index = {b: i for i, b in enumerate(names)}
    body = ",\n".join(
        f"  {json.dumps(k)}: [{', '.join(str(index[b]) for b in v)}]"
        for k, v in sorted(per_key.items())
        if v
    )
    BRANDS_OUT.write_text(
        "// GENERATED by scripts/import-category-excel.py from the client's category sheet - do not edit.\n"
        "// Brands each category stocks: a deduplicated name list + per-node indexes into it, keyed by\n"
        "// taxonomy slug path (`main`, `main/sub`, `main/sub/sub-to-sub`; same keys as the artwork).\n"
        "// Not re-exported from the package index (size): import from\n"
        "// '@youmart/shared-client/src/category-brands.data'.\n\n"
        f"export const CATEGORY_BRAND_NAMES: readonly string[] = {json.dumps(names, ensure_ascii=False)};\n\n"
        "export const CATEGORY_BRAND_INDEX: Readonly<Record<string, readonly number[]>> = {\n"
        f"{body},\n}};\n",
        encoding="utf-8",
    )
    return len(names)


def tokens(slug: str) -> set[str]:
    stop = {"and", "accessories", "items", "products", "kit", "kits"}
    return {t for t in slug.split("-") if t and t not in stop}


# Renamed sub-categories whose names share no words (new key -> previous artwork key).
RENAMED = {
    "footwear/men-s-footwear": "footwear/men-s-casual-shoes",
    "footwear/women-s-footwear": "footwear/women-s-flats",
    "musical-instruments/wind-instruments": "musical-instruments/flutes",
    "pet-supplies/pet-bowls-feeders": "pet-supplies/dog-bowls",
    "home-furnishing/table-linen": "home-furnishing/table-covers",
    "tailoring-materials/measuring-marking": "tailoring-materials/measuring-tapes",
    "clothing/ethnic-wear": "clothing/kurtas-ethnic-sets-and-bottoms",
    "clothing/dresses-western-wear": "clothing/women-s-clothing",
    "clothing/kids-clothing": "clothing/kids-combos-and-costumes",
    "clothing/accessories": "clothing/clothing-and-accessories",
    "travel-accessories/travel-comfort": "travel-accessories/neck-pillows",
}


def previous_tree() -> dict[str, dict[str, list[str]]]:
    """The taxonomy before this import (the committed CSV), as slugs: main -> sub -> [leaf]."""
    import subprocess

    try:
        text = subprocess.run(
            ["git", "show", "HEAD:packages/shared-client/data/category-taxonomy.csv"],
            cwd=ROOT, capture_output=True, text=True, encoding="utf-8", check=True,
        ).stdout
    except (subprocess.CalledProcessError, FileNotFoundError):
        return {}
    old: dict[str, dict[str, list[str]]] = collections.defaultdict(lambda: collections.defaultdict(list))
    for row in csv.DictReader(text.lstrip("\ufeff").splitlines()):
        m, s, l = (clean(row.get(k)) for k in ("main_category", "sub_category", "sub_to_sub_category"))
        if m and s:
            old[slugify(m)][slugify(s)]
            if l:
                old[slugify(m)][slugify(s)].append(slugify(l))
    return old


def carry_images(tree) -> dict[str, int]:
    """Keep artwork for kept categories; copy it to renamed/moved ones; delete orphans."""
    stats = collections.Counter()
    old = previous_tree()
    for root in IMAGE_DIRS:
        if not root.exists():
            continue
        existing = {p.relative_to(root).as_posix()[: -len(p.suffix)]: p for p in root.rglob("*.webp")}
        old_subs_by_main: dict[str, list[str]] = collections.defaultdict(list)
        for key in existing:
            parts = key.split("/")
            if len(parts) == 2 and parts[0] != "mobile":
                old_subs_by_main[parts[0]].append(parts[1])

        wanted: dict[str, Path | None] = {}
        is_web = "web" in root.parts
        for main, subs in tree.items():
            m = slugify(main)
            if is_web:
                wanted[m] = existing.get(m)
            wanted[f"mobile/{m}"] = existing.get(f"mobile/{m}")
            for sub, node in subs.items():
                s = slugify(sub)
                key = f"{m}/{s}"
                src = existing.get(key) or existing.get(RENAMED.get(key, ""))
                if src is None:
                    # A former main category that is now a sub (Crockery -> Kitchenware/Crockery).
                    src = existing.get(f"mobile/{s}")
                if src is None and s in old:
                    # ...with no portrait main art: its old sub with the most items stands in.
                    for old_sub in sorted(old[s], key=lambda o: -len(old[s][o])):
                        if f"{s}/{old_sub}" in existing:
                            src = existing[f"{s}/{old_sub}"]
                            break
                if src is None:
                    # The same sub-category moved from another main.
                    src = next((existing[k] for k in existing if k.endswith(f"/{s}") and k.count("/") == 1 and not k.startswith("mobile/")), None)
                if src is None:
                    # Renamed within the same main (Rugs -> Rugs & Mats, Dolls -> Dolls & Action Figures).
                    new_t = tokens(s)
                    for prev_sub in old_subs_by_main.get(m, []):
                        old_t = tokens(prev_sub)
                        if old_t and (old_t <= new_t or (new_t and new_t <= old_t)):
                            src = existing[f"{m}/{prev_sub}"]
                            break
                wanted[key] = src
                for leaf in node["leaves"]:
                    l = slugify(leaf)
                    lkey = f"{key}/{l}"
                    # Leaf art kept in place, or a former main's sub that is now this sub's leaf.
                    lsrc = existing.get(lkey) or existing.get(f"{s}/{l}")
                    if lsrc is None and s in old:
                        # A former main's sub was flattened into leaves (Crockery > Dinner Sets >
                        # Dinner Plates is now Kitchenware > Crockery > Dinner Plates): reuse that
                        # old sub's art for each of its former items.
                        parent = next((o for o, items in old[s].items() if l in items), None)
                        if parent:
                            lsrc = existing.get(f"{s}/{parent}")
                    wanted[lkey] = lsrc

        # Read every source first, so a copy can never overwrite a file another key still needs.
        payload = {key: src.read_bytes() for key, src in wanted.items() if src is not None}
        for key, data in payload.items():
            dest = root / f"{key}.webp"
            src = wanted[key]
            if dest.resolve() == src.resolve():
                stats["kept"] += 1
                continue
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(data)
            stats["carried"] += 1
        keep = {k for k, v in wanted.items() if v is not None}
        for key, path in existing.items():
            if key not in keep:
                path.unlink()
                stats["removed"] += 1
        for d in sorted((p for p in root.rglob("*") if p.is_dir()), key=lambda p: -len(p.parts)):
            if not any(d.iterdir()):
                d.rmdir()
    return dict(stats)


def main() -> None:
    xlsx = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_XLSX
    tree = read_sheet(xlsx)
    write_csv(tree)
    brand_count = write_brands(tree)
    images = carry_images(tree)
    print(
        f"mains={len(tree)} subs={sum(len(s) for s in tree.values())} "
        f"leaves={sum(len(n['leaves']) for s in tree.values() for n in s.values())} "
        f"brands={brand_count} images={images}"
    )


if __name__ == "__main__":
    main()
