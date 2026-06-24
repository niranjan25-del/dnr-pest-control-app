// src/modules/services/enums/index.ts
//
// Whitelisted sortable columns for catalog list endpoints — guards against arbitrary
// orderBy keys arriving from the `sort` query param.

export const SERVICE_SORT_FIELDS = [
  "name",
  "basePrice",
  "estimatedDurationMin",
  "createdAt",
] as const;
export type ServiceSortField = (typeof SERVICE_SORT_FIELDS)[number];

export const CATEGORY_SORT_FIELDS = ["name", "sortOrder", "createdAt"] as const;
export const PACKAGE_SORT_FIELDS = ["name", "price", "createdAt"] as const;

export function safeSort<T extends readonly string[]>(
  sort: string | undefined,
  allowed: T,
  fallback: T[number],
): T[number] {
  return sort && (allowed as readonly string[]).includes(sort)
    ? (sort as T[number])
    : fallback;
}
