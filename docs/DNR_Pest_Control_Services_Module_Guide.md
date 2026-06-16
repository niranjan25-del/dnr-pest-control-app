# DNR Pest Control — Services & Service Packages Module (Step 20)

**Modules:** `service-categories` + `services` + `service-packages` (NestJS) — production-ready
**Builds on:** Prisma schema (Step 17) · Auth (Step 18) · Users & Profiles (Step 19) · API Spec (Step 4)
**Scope:** Catalog modules ONLY. No other modules generated.

> **Pest Categories — important schema note.** The approved Prisma schema (Step 17) has a single `ServiceCategory` taxonomy and represents pests as `targetPests` tags on each `Service`. There is **no separate `PestCategory` table**. To honor the requirement without unapproved schema drift:
> - `ServiceCategory` is used as the shared **service AND pest** category taxonomy (e.g. "Rodents", "Termites").
> - Finer pest tags are managed via a service's `targetPests` (create/update service).
> - If you want a first-class `PestCategory` entity (its own CRUD table), that requires a schema addition + migration — out of scope for "generate only this module / use the approved schema." Flagged for your decision.

> **Promotional pricing note.** Base service pricing and package pricing are implemented here (dedicated price endpoints). **Promotional pricing is delivered via the Coupon system**, which is a separate concern/module (the `Coupon`/`CouponUsage` models exist in the schema). Not built here to keep scope to this module.

---

## Module Structure

```
src/modules/service-categories/
├── service-categories.module.ts
├── service-categories.controller.ts        # /service-categories
├── service-categories.service.ts
└── dto/ create / update / query

src/modules/services/
├── services.module.ts
├── services.controller.ts                   # /services
├── services.service.ts
├── dto/ create / update / update-price / query (pagination+filter+sort+search)
├── entities/ service.entity.ts
└── interfaces/ paginated-result.interface.ts (shared by the 3 catalog modules)

src/modules/service-packages/
├── service-packages.module.ts
├── service-packages.controller.ts           # /packages
├── service-packages.service.ts
└── dto/ create / update / update-price / query
```

## File purposes (summary)

| File | Purpose |
|---|---|
| `service-categories.service.ts` | Category CRUD (taxonomy for services + pests); soft delete; paginated/search/active list. |
| `services.service.ts` | Service CRUD + dedicated pricing; paginated/filtered/sorted/searched browse; Decimal→string money; validates category. |
| `service-packages.service.ts` | Package CRUD + activate/deactivate + pricing; manages bundled services via `PackageService` inside a transaction; validates serviceIds. |
| controllers | Admin-only mutations via `@Roles`; browse open to any authenticated user; non-admins forced to active-only (derived from `@CurrentUser` role). |
| DTOs | Validation incl. money (`maxDecimalPlaces:2`, `Min(0)`), enums, UUIDs, array caps, sort whitelisting. |
| `service.entity.ts` | Safe service response shape (money as string). |
| `paginated-result.interface.ts` | Shared pagination envelope for all three catalog modules. |

---

## Features → Endpoints

### Service Categories (also serves as Pest Categories)
| Feature | Method/Path | Roles |
|---|---|---|
| List | `GET /api/v1/service-categories` | any authed (non-admin: active only) |
| Create | `POST /api/v1/service-categories` | Super Admin, Ops |
| Update | `PATCH /api/v1/service-categories/:id` | Super Admin, Ops |
| Delete (soft) | `DELETE /api/v1/service-categories/:id` | Super Admin, Ops |

### Services
| Feature | Method/Path | Roles |
|---|---|---|
| Browse (search/filter/sort/paginate) | `GET /api/v1/services` | any authed (non-admin: active only) |
| Detail | `GET /api/v1/services/:id` | any authed |
| Create | `POST /api/v1/services` | Super Admin, Ops |
| Update | `PATCH /api/v1/services/:id` | Super Admin, Ops |
| Update price | `PATCH /api/v1/services/:id/price` | Super Admin, Ops |
| Delete (soft) | `DELETE /api/v1/services/:id` | Super Admin, Ops |

### Service Packages
| Feature | Method/Path | Roles |
|---|---|---|
| Browse | `GET /api/v1/packages` | any authed (non-admin: active only) |
| Detail | `GET /api/v1/packages/:id` | any authed |
| Create | `POST /api/v1/packages` | Super Admin, Ops |
| Update (replaces serviceIds if sent) | `PATCH /api/v1/packages/:id` | Super Admin, Ops |
| Update price | `PATCH /api/v1/packages/:id/price` | Super Admin, Ops |
| Activate | `PATCH /api/v1/packages/:id/activate` | Super Admin, Ops |
| Deactivate | `PATCH /api/v1/packages/:id/deactivate` | Super Admin, Ops |
| Delete (soft) | `DELETE /api/v1/packages/:id` | Super Admin, Ops |

---

## Validation · Authorization · Pagination · Search · Filtering · Sorting
- **Validation:** DTOs via global `ValidationPipe`; money limited to 2 dp & ≥0; enums for billing cycle & sort; UUIDs for ids; array size caps.
- **Authorization:** mutations `@Roles(SUPER_ADMIN, OPERATIONS_MANAGER)`; browse open to any authenticated user; non-admins (incl. Customer/Technician) are forced to **active, non-deleted** records in the service layer.
- **Pagination:** `page`/`limit` (≤100); `meta { page, limit, total, totalPages }`; rows+count in one `$transaction`.
- **Search:** case-insensitive `contains` (service name+description; category/package name).
- **Filtering:** services by `categoryId`/`isActive`; packages by `billingCycle`/`isActive`.
- **Sorting:** whitelisted `sortBy` (`name`/`basePrice|price`/`createdAt`) + `sortOrder`.

## Error Handling
- 404 not found; 400 invalid category/serviceIds or DTO errors; 409 duplicate category name; 403 insufficient role. All via the foundation's global exception filter.

## Logging
- `Logger` per service logs create/price/delete/activate actions (ids only). Admin pricing/catalog changes are additionally captured by the foundation audit layer.

---

## Setup Instructions
1. Place the three folders under `src/modules/`.
2. Register modules in `app.module.ts`: `ServiceCategoriesModule`, `ServicesModule`, `ServicePackagesModule`.
3. Requires the Auth module (global guards + `@Roles`/`@CurrentUser`) and a global `ValidationPipe` (`transform: true`) — both from earlier steps.
4. No new packages (`@prisma/client`, `class-validator`, `class-transformer`).
5. The shared `paginated-result.interface.ts` lives under `services/interfaces` and is imported by the sibling modules; you may relocate it to `src/common/interfaces` later and update imports.

## Testing Instructions
**Unit (mock PrismaService):**
- `ServicesService.create`: invalid `categoryId` → 400; success → entity with `basePrice` as string.
- `findMany`: non-admin forced to `isActive:true`; admin honors `isActive` filter; sort uses whitelisted column; meta math.
- `ServicePackagesService.create/update`: invalid `serviceIds` → 400; update with `serviceIds` replaces links atomically (transaction).
- `setActive`/`remove`: missing → 404; soft delete sets `deletedAt` + `isActive:false`.
- `ServiceCategoriesService.create`: duplicate name → 409.

**e2e (Supertest + seeded roles):**
```
GET   /api/v1/services?search=rodent&sortBy=basePrice&sortOrder=asc  (customer) → active only
POST  /api/v1/services                         (customer) → 403; (admin) → 201
PATCH /api/v1/services/:id/price {basePrice:129.99} (admin) → 200
POST  /api/v1/packages {serviceIds:[…]}        (admin) → 201 with services[]
PATCH /api/v1/packages/:id/deactivate          (admin) → 200 isActive:false; customer list no longer shows it
GET   /api/v1/service-categories               (customer) → active only
```

---

## API Examples

**Browse services (customer):**
```
GET /api/v1/services?page=1&limit=20&search=ant&categoryId=<uuid>&sortBy=basePrice&sortOrder=asc
Authorization: Bearer <customer token>
```
```json
{
  "data": [{
    "id": "…", "name": "Ant Treatment", "description": "...",
    "categoryId": "…", "category": { "id": "…", "name": "Crawling Insects" },
    "targetPests": ["ants"], "basePrice": "120.00",
    "estimatedDurationMin": 60, "isActive": true, "createdAt": "…"
  }],
  "meta": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 }
}
```

**Create a service (admin):**
```
POST /api/v1/services
Authorization: Bearer <admin token>

{ "name": "Termite Inspection", "categoryId": "<uuid>",
  "targetPests": ["termites"], "basePrice": 199.00, "estimatedDurationMin": 90 }
```

**Create a package (admin):**
```
POST /api/v1/packages
Authorization: Bearer <admin token>

{ "name": "Quarterly Home Shield", "price": 49.00, "billingCycle": "QUARTERLY",
  "visitFrequency": "quarterly", "contractLengthMonths": 12,
  "serviceIds": ["<svc1>", "<svc2>"] }
```

**Update package price (admin):**
```
PATCH /api/v1/packages/<uuid>/price
Authorization: Bearer <admin token>

{ "price": 54.00 }
```

---

**Stopping after the Services module, per instruction.** No other modules generated. With Services + Packages in place (both exported), the next module in the build order is **Bookings** (which depends on Services and Subscriptions) — and that is the module where the **service-area definition** becomes a real dependency.
