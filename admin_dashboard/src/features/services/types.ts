// src/features/services/types.ts
// Catalog domain types (services, pest categories, packages). Money is a string/number the
// backend returns as Decimal(10,2); we keep it as number for editing and send back as-is.

export interface ServiceRow {
  id: string;
  name: string;
  slug?: string;
  description?: string | null;
  base_price: number;
  duration_minutes?: number | null;
  is_active: boolean;
  pest_category_id?: string | null;
  created_at?: string;
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
  base_price: number;
  duration_minutes?: number;
  pest_category_id?: string;
  is_active: boolean;
}
