// src/common/utils/slug.util.ts
//
// Deterministic slugify + a uniqueness helper. Catalog entities (categories, services,
// packages) carry a unique slug derived from the name; on collision we append a short
// base36 suffix so create/rename never throws on the unique constraint.

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'item';
}

/**
 * Produce a slug guaranteed unique under `exists` (a predicate that returns true if a slug
 * is already taken). Tries the base slug, then base-XXXX suffixes.
 */
export async function uniqueSlug(
  name: string,
  exists: (slug: string) => Promise<boolean>,
): Promise<string> {
  const base = slugify(name);
  if (!(await exists(base))) return base;
  for (let i = 0; i < 5; i++) {
    const candidate = `${base}-${Math.random().toString(36).slice(2, 6)}`;
    if (!(await exists(candidate))) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}
