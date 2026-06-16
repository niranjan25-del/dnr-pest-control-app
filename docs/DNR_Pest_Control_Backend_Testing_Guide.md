# DNR Pest Control — Backend Testing Strategy & Implementation (Step 44)

Production-grade automated testing for the NestJS backend: Jest (unit + integration), Supertest + a real disposable Postgres (e2e), Prisma. Covers the revenue-critical workflows, an 80% coverage gate, and CI. Backend only — no Flutter tests.

> **Faithful to the real code:** specs were written against the actual module layout (`src/modules/<m>/`, `PrismaService` at `src/database/prisma.service.ts`) and verified method names — `AuthService.login/refresh/logout`, `BookingsService.create/reschedule/cancel/updateStatus`, `PaymentsService.createBookingPaymentIntent/handleStripeEvent`. Files carry their intended repo path in the header; drop them into the backend repo at those paths.

> **Honest caveats:** these are reference implementations to run in the repo, not in this workspace. Two things to reconcile on first run: (1) exact **constructor/provider tokens** — unit specs use NestJS `useMocker` + `jest-mock-extended` to auto-mock dependencies so they don't hard-code wiring, but the external-service override tokens in `external.mocks.ts` are placeholder strings to swap for the real classes (`StripeService`, etc.); (2) a few **DTO/field names** in request bodies and the `canTransition` export — confirm against the source. Required devDeps: `jest ts-jest @types/jest jest-mock-extended supertest @types/supertest`.

---

## Testing Architecture
A classic **test pyramid**:

- **Unit (most):** pure logic + service business rules in isolation. No DB, no network — Prisma and all dependencies are mocked. Milliseconds per test. This is where branch coverage is won.
- **Integration (some):** real Nest app + real Postgres test DB, externals mocked. Proves controller ↔ pipe ↔ guard ↔ service ↔ Prisma wiring and the HTTP contract (snake_case, `/api/v1`, pagination meta, error envelope).
- **E2E (few):** the full critical workflows over HTTP against a real DB. Slowest, highest confidence; kept to the handful of journeys that *are* the business.

Determinism is enforced: frozen system time for window math (`setup-unit.ts`), table truncation between DB specs for isolation, `maxWorkers: 1` for e2e to avoid cross-test DB races.

## Test Folder Structure
```
jest.config.ts                         # unit + integration
test/
├── jest-e2e.json                      # e2e (real DB)
├── setup-unit.ts                      # frozen clock, quiet logs
├── setup-e2e.ts                       # requires TEST_DATABASE_URL, migrate deploy
├── utils/
│   ├── prisma-test.util.ts            # test PrismaClient + truncateAll
│   ├── test-app.util.ts               # boot full app, override Prisma + externals
│   └── auth-test.util.ts              # seed roles/users, mint JWTs, headers
├── factories/index.ts                 # user/customer/technician/service/address/booking/invoice/payment
├── mocks/
│   ├── prisma.mock.ts                 # DeepMockProxy<PrismaService> (+$transaction)
│   └── external.mocks.ts              # Stripe/Firebase/FCM/SMS/email/S3 mocks + providers
├── integration/bookings.api.int-spec.ts
└── e2e/booking-workflow.e2e-spec.ts
src/modules/
├── auth/auth.service.spec.ts
├── bookings/bookings.service.spec.ts
├── bookings/enums/booking-status.spec.ts
└── payments/payments.service.spec.ts
.github/workflows/backend-tests.yml
```

## Unit Tests — per-module strategy
| Module | Focus (what would actually break) |
|---|---|
| **Auth** | login (valid / unknown email — no enumeration / suspended), refresh **rotation**, invalid/revoked refresh → 401, logout revokes. *(provided)* |
| **Users** | role/status transitions (ACTIVE↔SUSPENDED↔DEACTIVATED), suspend revokes sessions, admin list filters/pagination, self-vs-admin authorization. |
| **Services** | catalog CRUD validation, price as Decimal-string, active/inactive visibility, category/package linkage. |
| **Bookings** | **lead-time / reschedule-cutoff / cancel-fee windows**, overlap guard, status-transition guard, customer-vs-admin scoping. *(provided)* |
| **Payments** | intent for unpaid invoice only, amount as string, webhook succeeded → invoice PAID, **idempotent** duplicate events, refund state. *(provided)* |
| **Notifications** | template + channel selection, preference suppression, FCM/SMS/email dispatch called with the right payload (mocked). |
| **Chat** | message persistence, room membership authorization, unread counts, gateway event names. |
| **GPS / Location** | distance/serviceability calc, last-known-location upsert, geofence/arrival detection thresholds. |
| **Reports** | metric→tabular flattening for CSV, dashboard shape for PDF, date-range/granularity bucketing, zero-denominator guards. |

Pattern (resilient to exact wiring):
```ts
Test.createTestingModule({ providers: [SomeService] })
  .useMocker((token) => {
    if (token === PrismaService) return prismaMock;   // explicit
    if (typeof token === 'function') return mock();    // auto-mock the rest
  }).compile();
```

## Integration Tests
Real app + real Postgres (`createTestApp` overrides only `PrismaService` → test DB and the external providers → mocks). Cover: **DB** (factories persist, FK integrity, truncation isolation), **API** (status codes, snake_case bodies, pagination meta, 401/400 envelope), and **service interaction** (booking create → status history row written; assignment → booking CONFIRMED). Example provided: `bookings.api.int-spec.ts`.

## End-to-End Tests
One spec proves the whole money-making path: **register → create booking → dispatcher assign → technician accept → status to COMPLETED → invoice issued → payment intent → Stripe webhook → invoice PAID**, asserting each transition. Add siblings later for subscription billing and refund.

## Mocking Strategy
- **Unit:** `mockDeep<PrismaService>()` (every model method is a `jest.fn`), `$transaction` wired to run callbacks against the same mock; dependencies auto-mocked via `useMocker`.
- **Integration / e2e:** **real DB** (truth for queries/constraints), **mocked externals** — Stripe (intents/refunds + `constructEvent` skipping signature), Firebase (`verifyIdToken`), FCM, Twilio, SendGrid, S3 — deterministic and call-recording so tests assert side effects without network.

## Test Data Strategy
Factories (`test/factories`) return Prisma `create` inputs with overridable defaults (money as string, valid future windows), so specs declare only what matters. Isolation by **`TRUNCATE … RESTART IDENTITY CASCADE`** between specs — faster than re-migrating, order-independent. No shared mutable fixtures across tests.

## CI Test Execution Strategy
`backend-tests.yml`: a **unit+integration** job and an **e2e** job, each with a Postgres service container; `npm ci` → `prisma generate` → `migrate deploy` → tests. Coverage uploaded as an artifact; the Jest `coverageThreshold` fails the build under target. No secrets (externals mocked).

## Coverage Requirements
Global gate **80%** (branches/functions/lines/statements) in `jest.config.ts`; DTOs/modules/interfaces/`main.ts` excluded from the denominator. Hold money + lifecycle files higher (≈90%) via a per-path threshold once stable: `payments.service.ts`, `bookings.service.ts`, `token.service.ts`, `booking-status`.

---

## Test Execution Commands
Add to `package.json` scripts:
```jsonc
{
  "test": "jest",                                   // unit + integration
  "test:watch": "jest --watch",
  "test:unit": "jest --testPathPattern=\\.spec\\.ts$",
  "test:int": "jest --testPathPattern=\\.int-spec\\.ts$ --runInBand",
  "test:cov": "jest --coverage --runInBand",
  "test:e2e": "jest --config test/jest-e2e.json --runInBand"
}
```
```bash
npm test                 # unit + integration
npm run test:e2e         # full workflow (needs TEST_DATABASE_URL)
npm test -- auth.service # single file
npm run test:watch       # TDD loop
```

## Coverage Commands
```bash
npm run test:cov                 # report + enforce 80% gate
npx jest --coverage --coverageReporters=html && open coverage/lcov-report/index.html
```

## Recommendations
1. **Write the workflow e2e first, then drive units down** for each business rule until the gate is green — order of business risk, not file order.
2. **Swap the placeholder external tokens** in `external.mocks.ts` for the real classes immediately; that unlocks all integration/e2e.
3. **Add property/edge tests** for window math (DST, exact boundary at cutoff) and money rounding (Decimal, never float).
4. **Contract-guard the API**: snapshot the error envelope + a sample paginated response so contract drift fails loudly.
5. **Speed at scale:** keep e2e to true journeys; prefer integration for breadth. Consider Testcontainers if you want the DB fully ephemeral per run.
6. **Track flakiness**: `--runInBand` for DB suites; never share state across specs; reset external mocks in `beforeEach`.

---

**Stopping after Backend Testing, per instruction.** Open elsewhere in the project: Admin Dashboard Wave 2 (Services/Pricing/Subscriptions/Coupons/Notifications) and the Flutter Mobile App Integration (Step 40) finish.
