# DNR Pest Control Platform — Full Source

A pest-control field-service platform: **NestJS/PostgreSQL/Prisma backend**, **Flutter customer + technician app**, **React (Vite) admin dashboard**, plus CI workflows and a Dockerfile.

> ## ⚠️ READ THIS FIRST — honest state of the code
> This is a **complete, coherent codebase that has never been compiled, run, or deployed.** It will almost certainly need fixes on first build. Specifically:
> - **No dependency lockfiles** are committed → `npm install` resolves fresh versions (minor drift possible).
> - **No Prisma migrations exist** → you must generate the first migration before the DB works.
> - **Flutter codegen has not been run** → `build_runner` must run before the app compiles (freezed/riverpod/json_serializable).
> - **The backend Reviews & Ratings module is not built** → the app's review screen and the admin review features will 404.
> - A few admin endpoint contracts (`/users?role=`, coupon deactivate) are assumptions to verify against the running API.
> - Treat the `.md` files at the project root as **design/strategy documents**, not code.
>
> In short: this is a strong starting point to get running locally, not a turnkey production build. Budget time for first-run debugging.

---

## Prerequisites
- **Node.js 20+** and npm
- **PostgreSQL 14+** (local or Docker)
- **Flutter SDK 3.22+** (Dart 3.4+) — only for the mobile app
- (optional) **Docker** — to run the backend containerized

---

## 1. Backend (`backend/`)

```bash
cd backend
npm install

# Set up environment
cp .env.example .env          # then edit values (DB URL, JWT secrets, etc.)

# Point DATABASE_URL at your Postgres, e.g.:
#   postgresql://postgres:postgres@localhost:5432/dnr?schema=public

# Generate Prisma client + create the FIRST migration (none exist yet)
npx prisma generate
npx prisma migrate dev --name init

# Run
npm run start:dev             # http://localhost:3000/api/v1

# Tests (unit tests pass without a DB; integration/e2e need DATABASE_URL)
npm run test:unit
```

Minimum `.env` values to boot: `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`. Stripe/Firebase/AWS/Maps keys are needed only for those features.

---

## 2. Admin Dashboard (`admin_dashboard/`)

```bash
cd admin_dashboard
npm install

# Configure the API base URL
echo "VITE_API_BASE_URL=http://localhost:3000/api/v1" > .env.local

npm run dev                   # http://localhost:5173
# Production build:
npm run build && npm run preview
```

---

## 3. Flutter App (`flutter_app/`)

```bash
cd flutter_app
flutter pub get

# REQUIRED: run code generation before first build
dart run build_runner build --delete-conflicting-outputs

# You must add your own Firebase config:
#   android/app/google-services.json   and   ios/Runner/GoogleService-Info.plist
# Point the app at your backend (see lib/core/config or --dart-define as the code expects)

flutter run                   # on a connected device/emulator
flutter test                  # unit/widget tests
```

---

## 4. Backend via Docker (optional)

```bash
cd backend
docker build -t dnr-backend .
docker run -p 3000:3000 --env-file .env dnr-backend
# (the container runs `prisma migrate deploy` on start)
```

---

## Suggested first steps to get it running
1. Get **Postgres** up, fill `backend/.env`, run `prisma migrate dev --name init`, start the backend, hit `http://localhost:3000/api/v1/health`.
2. Start the **admin dashboard**, register/login, click through the modules.
3. Run **`build_runner`** then `flutter run` for the app.
4. Expect to fix a handful of first-compile issues — that's normal for code that hasn't been executed yet.

## Known gaps to build next
- **Reviews & Ratings backend module** (unblocks app review + admin moderation).
- **First Prisma migration** + commit lockfiles.
- **Terraform IaC** (the AWS design is documented, not coded) before any cloud deploy.

The `.github/workflows/` CI runs lint/test/build; the **deploy** workflow needs AWS infrastructure provisioned first.
