// src/features/coupons/api.ts
import { createResourceService, type QueryParams } from '@/services/createResourceService';
import type { CouponRow } from './types';

const coupons = createResourceService<CouponRow>('/coupons');

export const couponsApi = {
  list: (params: QueryParams) => coupons.list(params),
  get: (id: string) => coupons.get(id),
  create: (body: unknown) => coupons.create(body),
  update: (id: string, body: unknown) => coupons.patch(id, body),
  activate: (id: string) => coupons.action(`/${id}/activate`),
  deactivate: (id: string) => coupons.action(`/${id}/deactivate`),
};
