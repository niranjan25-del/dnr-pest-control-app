# DNR Pest Control — Admin Dashboard Foundation (React)

Production-ready **foundation** for the web admin: app shell, auth, routing + permission guards, layout, theme, API layer, and the error/loading/form frameworks. **No management pages** — those attach to this foundation in later modules.

**Stack:** React 18 + TypeScript + Vite · React Router 6 · TanStack Query 5 · Axios · **MUI v6** · React Hook Form + zod.

> **Why MUI?** It's explicitly requested and has the deepest enterprise component set (incl. `@mui/x-data-grid` for the data-heavy management modules to come), good a11y, and first-class theming — so the brand design system maps cleanly. Reasonable alternatives: **Ant Design** (even more batteries-included tables/forms, less design flexibility) or **shadcn/ui + Radix + Tailwind** (maximum control, more assembly). MUI is the best fit here.

> **Reconciliations (flagged honestly):**
> - **Staff login path.** Admins sign in with **email + password** at `POST /auth/login`. The mobile clients exchange a `firebase_id_token` at the same endpoint; the Auth Design references a staff "password set / direct path." **Confirm the backend accepts `{email, password}` for staff** (or exposes a dedicated staff-login endpoint) and adjust `authService.login`.
> - **Role shape.** The four admin sub-roles (Super Admin / Operations Manager / Dispatcher / Customer Support) are formalized via the backend `roles`/`permissions` model, and the PRD notes MVP *might* ship a single "Admin" role. The client tolerates this: `resolveAdminRole` normalizes `user.role` / `user.admin_role`, and **if the backend returns an explicit `permissions[]` it overrides the static matrix**. So the UI is correct whichever way the backend models it.
> - **PRD "◐ limited" cells** are granted in the client matrix (entry visible) and enforced server-side; exact boundaries are a confirm item.

---

## Project Structure
```
src/
├── app/         App shell (providers → router). Thin composition root.
├── routes/      Route table + path constants + guards (Protected / Permission).
├── layouts/     Page chrome: DashboardLayout (sidebar+topbar), AuthLayout (login card).
├── pages/       Route-level screens (foundation: Login, Dashboard home, 403/404).
├── features/    Feature logic grouped by domain (foundation: auth/permissions).
├── components/  Reusable UI: layout (Sidebar/Topbar), feedback (loaders/errors/empty), form (RHF+zod).
├── services/    API layer: axios client (interceptors/refresh) + typed service calls.
├── hooks/       Cross-cutting hooks (useAuth, usePermissions, useColorMode).
├── providers/   React context providers (Auth, Query, ThemeMode) + composition.
├── theme/       MUI theme (brand tokens, light/dark).
├── types/       Shared TS types (API envelope, pagination, auth DTOs).
└── utils/       Pure helpers (env, token storage, formatting).
```

## Authentication
- **Login:** `LoginPage` → `useAuth().login` → `authService.login` (stores tokens) → `/auth/me` shape on the user. Returns to the intended URL.
- **Session management:** `AuthProvider` restores the session on load (token present → `GET /auth/me`), exposes `{user, status, login, logout}`. `status` drives guards/loaders.
- **Token refresh:** the axios response interceptor catches 401, performs a **single-flight** `POST /auth/refresh` (concurrent 401s queue behind one refresh), retries the original request, and on failure clears tokens + emits `auth:logout` (AuthProvider resets → routing falls to `/login`).
- **Logout:** `POST /auth/logout {refresh_token}` then clear storage.

## Routing & Permissions
- **Protected routes:** `ProtectedRoute` holds on a loader while the session restores, else redirects to `/login` preserving `from`.
- **Permission routes:** `PermissionRoute permission=…` redirects to `/403` when the role lacks it. Used per management section as modules land.
- **Permission system:** `Permission` keys + `ROLE_PERMISSIONS` matrix transcribed from the PRD capability table. `usePermissions().can()` gates nav, routes, and action buttons. Backend `permissions[]` wins when present.

## Dashboard Layout
`DashboardLayout` = permanent sidebar (desktop) / temporary drawer (mobile) + fixed `Topbar` + `<Outlet>`. **Sidebar** renders only nav items the role can access (foundation: Dashboard is live, other sections show a "soon" chip). **Topbar** has the mobile menu toggle, theme switch, **NotificationsMenu** (empty-state now; fed by the notifications module later), and **UserMenu** (name/role + logout).

## API Layer
`apiClient` (axios): base `VITE_API_BASE_URL`, bearer injection, refresh-on-401, and **error normalization** — the backend envelope `{error:{code,message,details,request_id}}` becomes a typed `ApiError` (with `requestId` for support). Services (`authService`, future resource services) call through it and return typed data.

## Global State Strategy
- **Server state → TanStack Query** (caching, retries, background refetch). Don't mirror server data in React state.
- **Session/identity → AuthProvider context** (small, app-wide, non-cacheable).
- **UI/theme → small contexts** (ThemeMode) + local component state.
- This separation keeps a single source of truth per concern and avoids a heavyweight global store; add Zustand only if genuine cross-tree client state appears.

## Theme System
`createAppTheme(mode)` builds light + dark from the documented tokens (brand green `#1E8E5A`, neutral-blue secondary, status colors, Inter, radius 12, 8-pt spacing). `ThemeModeProvider` persists the choice (defaults to OS preference); `useColorMode().toggle` flips it from the topbar.

## Error / Loading / Form Frameworks
- **Error:** `ApiError` everywhere; `ErrorState` for query failures; top-level `ErrorBoundary` (crash-reporter hook point) for render crashes; `/403` + `/404`.
- **Loading:** `FullScreenLoader` (route/session) and `LoadingScreen` (in-page); buttons disable via form submitting state.
- **Forms:** `Form` (RHF + zod resolver) + `RHFTextField` + `useFormSubmitting` — typed values, inline validation, consistent error surfacing.

## Environment & Build
`utils/env.ts` reads `VITE_*` (fail-fast warnings). Vite builds to `dist/` with sourcemaps; `@`→`/src` alias.

---

## Setup Instructions
1. `cd admin_dashboard && npm install`
2. `cp .env.example .env.local` and set `VITE_API_BASE_URL` (e.g. `http://localhost:3000/api/v1`).
3. `npm run dev` → http://localhost:5173
4. Sign in with a staff account once the backend staff-login path is confirmed (see reconciliation).

## Required Packages
Runtime: `react`, `react-dom`, `react-router-dom`, `@tanstack/react-query` (+ devtools), `axios`, `@mui/material` + `@mui/icons-material` + `@emotion/react` + `@emotion/styled`, `@mui/x-data-grid` (for later tables), `react-hook-form`, `zod`, `@hookform/resolvers`, `date-fns`.
Dev: `typescript`, `vite`, `@vitejs/plugin-react`, `@types/react*`, eslint stack.

## Build Instructions
- `npm run typecheck` — strict TS, no emit.
- `npm run build` — `tsc -b` then `vite build` → `dist/`.
- `npm run preview` — serve the production build locally.
- Deploy `dist/` as a static SPA behind your CDN/host; ensure history-API fallback to `index.html` for client routing, and set `VITE_API_BASE_URL` at build time per environment.

---

**Stopping after the React foundation, per instruction.** No management pages generated. Next modules plug in here: each adds a `features/<domain>` (service + queries + components), a `pages/<Domain>` screen, a `PermissionRoute`-wrapped route in `router.tsx`, and flips its sidebar item to `ready`. Recommended first management module: **Bookings** (highest operational value), then Dispatch, Customers/Technicians, Catalog/Pricing, Payments, and Analytics dashboards.
