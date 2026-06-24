// src/common/interfaces/api-response.interface.ts
//
// The platform's API contract types. Success reads return data directly (or a Paginated<T>
// for lists); errors use a single, stable envelope so every client can parse failures the
// same way: { error: { code, message, details, request_id } }.

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

export interface Paginated<T> {
  data: T[];
  meta: PageMeta;
}

export interface ErrorBody {
  code: string; // machine-readable, e.g. VALIDATION_ERROR, NOT_FOUND
  message: string; // human-readable summary
  details?: unknown; // optional field errors / context
  request_id: string; // correlates with logs
}

export interface ErrorResponse {
  error: ErrorBody;
}
