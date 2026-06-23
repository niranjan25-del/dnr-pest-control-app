# DNR Pest Control Platform

A pest-control field-service platform built with **NestJS / PostgreSQL / Prisma** (backend), **React + Vite** (web frontend — admin, technician & customer portals), and **Flutter** (iOS/Android mobile app for customers & technicians).

> **Honest state of the codebase**
> This is a complete, coherent codebase that has not yet been compiled or deployed end-to-end. Expect a handful of first-run issues:
> - No Prisma migrations are committed — run `prisma migrate dev --name init` before the DB works.
> - Flutter codegen has not been run — `build_runner` must execute before the app compiles.
> - The Reviews & Ratings backend module is not yet wired — review screens will 404.
> - Treat files under `docs/` as design and strategy documents, not finished specs.

---

## Project structure

```
dnr-pest-control-app/
├── backend/          NestJS API — Prisma/PostgreSQL, versioned at /api/v1
├── frontend/         React (Vite + MUI) — admin, technician & customer portals
├── mobile/           Flutter — customer & technician mobile app
├── docs/
│   ├── architecture/ System design, DB schema, API spec, auth, UI/UX
│   ├── backend/      Backend module guides (bookings, payments, dispatch …)
│   ├── frontend/     Admin dashboard development guides
│   ├── mobile/       Flutter module guides
│   ├── deployment/   CI/CD, AWS infrastructure, release strategy
│   └── reports/      Security audits, performance reviews, launch readiness
└── .github/
    └── workflows/    CI (backend, frontend, flutter) + deploy + security
```

---

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js + npm | 20+ |
| PostgreSQL | 14+ |
| Flutter SDK | 3.22+ (Dart 3.4+) — mobile only |
| Docker | optional, for containerised backend |

---

## 1. Backend (`backend/`)

```bash
cd backend
npm install

cp .env.example .env        # fill in DATABASE_URL, JWT secrets, etc.

npx prisma generate
npx prisma migrate dev --name init   # creates the first migration

npm run start:dev           # → http://localhost:3000/api/v1
```

Minimum `.env` keys to boot: `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`.
Stripe / Firebase / AWS / Maps keys are required only for those features.

```bash
npm run test:unit           # no DB needed
npm run test:integration    # needs DATABASE_URL
```

---

## 2. Frontend (`frontend/`)

React SPA serving three role-based portals at the same URL:

| Role | Path prefix |
|------|-------------|
| Admin / staff | `/dashboard` |
| Technician | `/technician/*` |
| Customer | `/customer/*` |

```bash
cd frontend
npm install

echo "VITE_API_BASE_URL=http://localhost:3000/api/v1" > .env.local

npm run dev                 # → http://localhost:5173
npm run build               # production bundle → frontend/dist
npm run typecheck           # TypeScript check
```

---

## 3. Mobile app (`mobile/`)

Flutter app for customers and technicians (iOS + Android).

```bash
cd mobile
flutter pub get

# Code generation is required before the first build
dart run build_runner build --delete-conflicting-outputs

# Add Firebase config files:
#   android/app/google-services.json
#   ios/Runner/GoogleService-Info.plist

flutter run                 # connected device or emulator
flutter test                # unit/widget tests
```

---

## 4. Backend via Docker (optional)

```bash
cd backend
docker build -t dnr-backend .
docker run -p 3000:3000 --env-file .env dnr-backend
```

---

## Recommended first-run order

1. Start Postgres, fill `backend/.env`, run `prisma migrate dev --name init`, start the backend, verify `http://localhost:3000/api/v1/health`.
2. Start the frontend (`npm run dev`), log in as an admin, browse the modules.
3. Run `build_runner` then `flutter run` for the mobile app.

---

## CI / CD

| Workflow | Trigger | What it does |
|----------|---------|--------------|
| `backend-ci.yml` | push / PR on `backend/**` | lint → unit tests → integration tests → Docker build + Trivy scan → ECR push |
| `admin-ci.yml` | push / PR on `frontend/**` | lint → typecheck → build → artifact upload |
| `flutter-ci.yml` | push / PR on `mobile/**` | format → analyze → tests → Android + iOS build validation |
| `security.yml` | PR + weekly | Gitleaks secret scan + CodeQL SAST + dependency review |
| `deploy.yml` | push to `develop` (staging) / GitHub Release (production) | backend ECS rolling update + frontend S3 sync + CloudFront invalidation |

Deploy requires AWS infrastructure (see `docs/deployment/`). The CI workflows run independently of that.

---

## Known gaps

- **Prisma migrations** — generate and commit the first migration.
- **Reviews & Ratings backend module** — unblocks review screens in app and admin.
- **Terraform IaC** — the AWS architecture is documented in `docs/deployment/` but not yet coded.
- **Flutter Firebase config** — `google-services.json` and `GoogleService-Info.plist` must be added locally (not committed).
