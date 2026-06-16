// src/common/utils/pagination.util.ts
//
// Builds the Paginated<T> response shape consistently. Services compute `data` + `total`
// (typically via prisma.$transaction([findMany, count])) and pass them here.

import { Paginated } from '../interfaces/api-response.interface';

export function paginate<T>(data: T[], total: number, page: number, limit: number): Paginated<T> {
  return {
    data,
    meta: {
      page,
      limit,
      total,
      total_pages: limit > 0 ? Math.ceil(total / limit) : 0,
    },
  };
}
