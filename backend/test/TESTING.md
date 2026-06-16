# DNR Pest Control — Backend Testing & Automation Strategy
**Step 30** · Jest · Supertest · Prisma Test Database

## 1. Testing Architecture

Three layers, each with a different cost/confidence trade-off:

- **Unit (fast, no I/O):** pure functions and isolated service logic with dependencies mocked (`jest-mock-extended` for `PrismaService`, module mocks for SDKs). Targets: state machines, money math, validation helpers, utilities. These run anywhere, including CI without a database, and are the backbone of the coverage number.
- **Integration (real app, mocked externals, real DB):** boot the actual `AppModule` with Stripe/Firebase/AWS mocked at the module level, exercise controllers → services → guards → Prisma against a disposable Postgres schema via Supertest. Validates wiring, DTO validation, auth/RBAC guards, the error envelope, and persistence.
- **End-to-end (full journeys):** multi-step business scenarios through HTTP only, seeding supporting data via Prisma. Proves modules cooperate (booking → assignment → payment → invoice).

## 2. Test Folder Structure

```
backend/
├── jest.config.js                 # unit + integration (ts-jest, coverage thresholds)
├── test/
│   ├── jest-e2e.json              # e2e config (serial, longer timeout)
│   ├── support/
│   │   ├── setup-unit.ts          # env + SDK module mocks for unit/integration
│   │   ├── setup-e2e.ts           # env + SDK mocks for e2e (incl. AWS)
│   │   ├── app.ts                 # createTestApp() + resetDb() for Supertest
│   │   ├── mocks/external.ts      # Stripe / Firebase / S3 / Google Maps fakes
│   │   └── factories/index.ts     # user/service/booking/payment/coupon factories
│   ├── unit/
│   │   ├── booking-state-machine.spec.ts
│   │   └── pricing-and-utils.spec.ts     # discount, GST tax, pagination, geo
│   ├── integration/
│   │   └── auth.integration-spec.ts
│   └── e2e/
│       └── customer-journey.e2e-spec.ts
```

Co-located `*.spec.ts` next to a service is also supported by `jest.config.js` (`roots` includes `src`), so module-owners can keep unit specs beside the code.

## 3. Coverage by Module (plan)

The implemented specs cover the highest-risk pure logic and the auth + journey flows. Extend per module to reach the 80% target using the same patterns:

| Module | Unit focus | Integration focus |
|---|---|---|
| Auth | token signing, password hash/compare, refresh rotation | register/login/me/refresh (**implemented**) |
| Users/Profiles | role-scope resolvers | profile CRUD, status change RBAC |
| Services/Packages | slug uniqueness | catalog CRUD (admin-only) |
| Bookings | **state machine (implemented)**, slot conflict | create/cancel/reschedule, status guards |
| Assignment | weighted scoring | assign/accept → CONFIRMED |
| Payments | amount→paise, net-of-refund | create-intent idempotency, **webhook idempotency** |
| Invoices | **tax (implemented)**, number sequence | issue/void/download presign |
| Subscriptions | cycle math | provision/pause/resume/cancel |
| Coupons | **discount (implemented)**, derived status | validate/redeem race (tx) |
| Notifications | template render | dispatch, preferences default |
| Chat | permission matrix | REST history + socket auth |
| GPS | **geo radius (implemented)**, ETA fallback | check-in within radius → ARRIVED |
| Reports | item-label grouping | submit → signature → pdf presign |

## 4. Mocking Strategy

All external SDKs are mocked at the **module boundary** (`jest.mock('stripe'|'firebase-admin'|'@aws-sdk/client-s3'|'@aws-sdk/s3-request-presigner')`) in the setup files, so the real services run their real logic against fakes. `test/support/mocks/external.ts` provides:
- **Stripe** — `paymentIntents`/`refunds`/`subscriptions`/`paymentMethods` + `webhooks.constructEvent` that returns the event unsigned (bypasses signature verification deterministically).
- **Firebase** — `auth().verifyIdToken` (returns a fixed uid/email) + `messaging().sendEachForMulticast` (all-success).
- **AWS S3** — `S3Client.send` (Put/Get/Delete) + `getSignedUrl` → a deterministic fake URL.
- **Google Maps** — Distance Matrix + Geocoding canned responses for ETA/geocoding paths.

## 5. Test Data Factories

`test/support/factories` produces overridable, Prisma-shaped objects (`userFactory`, `technicianUserFactory`, `serviceFactory`, `bookingFactory`, `paymentFactory`, `couponFactory`). Unit tests use them as fixtures; integration tests strip ids/timestamps and pass them to `prisma.*.create`.

## 6. Prisma Test Database

Integration/e2e specs require a disposable Postgres schema:
```bash
# spin up a throwaway DB (CI service container or local docker)
export DATABASE_URL="postgresql://test:test@localhost:5432/dnr_test?schema=public"
npx prisma migrate deploy          # apply migrations to the test schema
npm run test:integration           # or test:e2e
```
`resetDb()` truncates mutable tables (FK-safe, `RESTART IDENTITY CASCADE`) between specs. Specs **auto-skip** when `DATABASE_URL` is unset, so `npm run test:ci` (unit + coverage) stays green in DB-less environments.

## 7. CI Commands

```bash
npm run test:unit          # pure-logic specs, no DB
npm run test:ci            # unit + coverage + --ci (PR gate)
npm run test:integration   # real app + mocked SDKs + test DB
npm run test:e2e           # full journeys (serial)
npm run test:cov           # everything with coverage
```
Coverage thresholds are enforced in `jest.config.js` (lines/statements/functions 80%, branches 70%). Wire `test:ci` as the required PR check and `test:integration` + `test:e2e` as a post-merge / nightly job with a Postgres service container.

## 8. Error & Edge-Case Testing

- **Validation:** every create endpoint rejects malformed input → `400 VALIDATION_ERROR` (global `ValidationPipe` + filter).
- **Authorization:** missing/expired bearer → `401`; wrong role → `403`.
- **Payment failures:** point the Stripe mock's `constructEvent` at `payment_intent.payment_failed` and assert the invoice/payment reconcile to FAILED without flipping booking status.
- **Network failures:** make a mock `send`/SDK call reject and assert the service surfaces a domain error, not a 500 leak.
- **Idempotency:** replay the same Stripe webhook event twice → exactly one state change.

## 9. Performance Testing Recommendations

- **Load testing (k6 or Artillery):** model the read-heavy hot paths — `GET /bookings`, `GET /analytics/dashboard`, `GET /services` — at expected concurrency; assert p95 latency and error rate. Seed a realistic dataset (10k bookings, 1k customers) first.
- **API stress testing:** ramp concurrent `create-intent` + webhook traffic to find the Stripe/DB saturation point; verify idempotency holds under contention and that the connection pool + Throttler behave.
- **Socket scale:** simulate N concurrent `/chat` + `/location` clients (artillery-socketio) **after** the Redis adapter is attached (Step 19 P0) to validate multi-instance fan-out.
- **DB:** capture `EXPLAIN ANALYZE` on the analytics aggregations under load; promote the hottest to materialized views/rollups (Step 18 recommendation).

## 10. What's Implemented vs. Templated

**Implemented and green without a database:** the unit suite (`booking-state-machine`, `pricing-and-utils`) — grounded in the real exported signatures (`isTransitionAllowed`, `BOOKING_TRANSITIONS`, `computeDiscount`, `TaxService.calculate`, `paginate`, `haversineKm`/`isWithinRadius`). These are deterministic and authoritative.

**Templated for the test DB:** the auth integration suite and the 8-step e2e journey boot the real app and assert real endpoints; they require `DATABASE_URL` and auto-skip otherwise. A few request shapes (address create, booking status route, the **review** endpoint) encode the documented contract — the review step tolerates `404` because the **Reviews & Ratings module isn't built yet** (Step 19 P2), and will assert success the moment it ships. Run them against a migrated test schema and adjust any path/body that diverges from a module's final controller.
