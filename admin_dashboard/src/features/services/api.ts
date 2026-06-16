// src/features/services/api.ts
// Catalog admin calls over the shared resource factory: services + packages CRUD and pest
// categories. Endpoints: /services, /service-packages, /pest-categories.

import { createResourceService, type QueryParams } from '@/services/createResourceService';
import { apiClient } from '@/services/apiClient';
import type { Paginated } from '@/types';
import type { PestCategoryRow, ServicePackageRow, ServiceRow } from './types';

const services = createResourceService<ServiceRow>('/services');
const packages = createResourceService<ServicePackageRow>('/service-packages');

export const servicesApi = {
  list: (params: QueryParams) => services.list(params),
  get: (id: string) => services.get(id),
  create: (body: unknown) => services.create(body),
  update: (id: string, body: unknown) => services.patch(id, body),
  // Packages
  listPackages: (params: QueryParams) => packages.list(params),
  createPackage: (body: unknown) => packages.create(body),
  updatePackage: (id: string, body: unknown) => packages.patch(id, body),
  // Pest categories (usually a small set; fetch a generous page for selects)
  async pestCategories(): Promise<PestCategoryRow[]> {
    const { data } = await apiClient.get<Paginated<PestCategoryRow> | PestCategoryRow[]>('/pest-categories', { params: { limit: 100 } });
    return Array.isArray(data) ? data : data.data;
  },
};
