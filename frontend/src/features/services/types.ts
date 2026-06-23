// src/features/services/types.ts
// Catalog domain types. Field names are camelCase to match Prisma/backend responses.

export interface ServiceRow {
  id: string;
  name: string;
  slug?: string;
  description?: string | null;
  basePrice: number;
  estimatedDurationMin?: number | null;
  isActive: boolean;
  categoryId?: string;
  pestCategoryId?: string | null;
  warrantyDays?: number;
  createdAt?: string;
}

export interface PestCategoryRow {
  id: string;
  name: string;
  description?: string | null;
  is_active: boolean;
}

export interface ServicePackageRow {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  is_active: boolean;
}

export interface ServiceFormValues {
  name: string;
  description?: string;
  basePrice: number;
  estimatedDurationMin?: number;
  pestCategoryId?: string;
  isActive: boolean;
  warrantyDays?: number;
}
