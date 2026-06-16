# DNR Pest Control — Final UI Design System & Screen Specifications (Step 15)

**Product:** DNR Pest Control platform
**Builds on / finalizes:** UI/UX Design System (Step 8) + all module designs
**Platforms:** Flutter mobile (Customer · Technician · Admin) + **React Admin Dashboard** (web)
**Document type:** Developer-ready Design Specification
**Version:** 1.0 (Final design baseline)
**Scope note:** Specification only — tokens, components, screens, navigation, a11y. **No code.** This is the implementation contract for `config/theme/` (Flutter) and the React design-token layer.

> Cross-platform token rule: tokens below are defined **once** and mapped to each platform — Flutter via `ThemeData`/token constants, React via CSS variables / Tailwind theme. Values are **identical** across platforms so Customer/Technician/Admin look like one product. This document **supersedes Step 8 where they differ** (they don't — Step 8 tokens are carried forward unchanged and finalized here).

---

# Design System Overview

### Design philosophy
A **calm, competent, utility-first** system. Pests are stressful; the product should feel reassuring and in control. Function leads; decoration is minimal. One visual language across three roles and two platforms — differences are **density**, not identity.

### User experience principles
1. **Clarity over cleverness** — one obvious primary action per screen.
2. **Status is king** — booking/job/payment/compliance state always legible (color + icon + label).
3. **Speed for the field** — technician flows minimize taps/typing; large targets.
4. **Transparency builds trust** — show what's happening and what was done.
5. **Accessible & consistent by default.**

### Consistency guidelines
- One component library; same names/props/behaviors on both platforms.
- Same tokens (color/type/space/radius/elevation) everywhere.
- Same state patterns (loading/empty/error/offline) across all screens.
- Density tiers: **comfortable** (Customer), **field** (Technician, larger targets), **compact** (Admin tables).

---

# Brand Guidelines

- **Brand personality:** trustworthy, professional, approachable, efficient — "your home/business, protected."
- **Visual style:** clean layouts, generous whitespace, nature-and-safety green anchor, restrained rounded geometry, functional photography (real service photos over stock).
- **Design language:** content-first; strong hierarchy; status-forward; minimal accent use; never color-only signaling.

---

# Color System

(Carried from Step 8, finalized. HEX identical on Flutter + React.)

### Primary — Green
`50 #E8F5EE` · `100 #C5E7D4` · `200 #9FD8B8` · `300 #79C99C` · `400 #4FB87F` · **`500 #1E8E5A`** · `600 #197C4F` · `700 #136540` · `800 #0D4E31` · `900 #083420`

### Secondary — Deep Slate Blue
`50 #EAEEF3` · `100 #C9D3DF` · `300 #7E94AC` · **`500 #2F4B6E`** · `700 #21364F` · `900 #142231`

### Accent — Amber (sparingly; pair with dark text)
`300 #FFD27A` · **`500 #F5A623`** · `700 #C77F12`

### Success `50 #E6F6EC` · **`500 #2BA84A`** · `700 #1C7A35`
### Warning `50 #FFF6E6` · **`500 #E8A317`** · `700 #B47C0C`
### Error `50 #FDEAEA` · **`500 #D64545`** · `700 #A42F2F`
### Info `50 #E8F1FB` · **`500 #2D7DD2`**

### Neutral (light)
`0 #FFFFFF` (surface) · `50 #F7F9FA` (bg) · `100 #EDF1F3` · `200 #DDE3E8` (border) · `400 #9AA6B2` (placeholder) · `600 #5C6873` (secondary text) · `800 #2A323B` (text) · `900 #161B21` (headings)

### Dark mode
`bg #0E1419` · `surface #161D24` · `surface-2 #1E2730` · `border #2C3742` · `text-primary #EAEEF1` · `text-secondary #9DAAB6` · `primary #3FB47C` · `accent #FFB94D` · `success #43C063` · `warning #F0B43C` · `error #EA6A6A`

**Contrast rule:** body ≥ 4.5:1, large/UI ≥ 3:1; verify amber-on-white (use dark text on amber). Never status-by-color-only.

---

# Typography System

- **Font family:** **Inter** (UI), tabular figures for numbers/tables; fallbacks SF Pro / Roboto. (React: same via webfont; Flutter: bundled.)

| Style | Size | Weight | Line-height | Use |
|---|---|---|---|---|
| Display | 32 | 700 | 40 | Splash/hero |
| H1 | 28 | 700 | 36 | Screen titles |
| H2 | 24 | 700 | 32 | Section titles |
| H3 | 20 | 600 | 28 | Card titles |
| H4 | 18 | 600 | 26 | Sub-sections |
| Body L | 16 | 400 | 24 | Primary text |
| Body | 14 | 400 | 22 | Default |
| Body S | 13 | 400 | 20 | Dense lists/tables |
| Button | 15 | 600 | 20 | Buttons (tracking 0.2) |
| Label | 13 | 600 | 18 | Field labels/tabs |
| Caption | 12 | 400 | 16 | Helper/meta |
| Overline | 11 | 600 | 16 | Uppercase tags (tracking 0.6) |

Min body 14; never below 12. Headings `neutral/900` (light) / `text-primary` (dark).

---

# Spacing System

- **Base unit 4pt.** Scale: `0,4,8,12,16,20,24,32,40,48,64`.
- **Margins/padding:** screen padding 16 (mobile) / 24 (web); card padding 16; section gap 24; inline gap 8–12.
- **Grid system:** mobile 4-col fluid; web admin **12-col** grid, gutter 24, max content width ~1280–1440 with responsive side nav.
- **Responsive spacing:** scale up paddings on ≥600dp (tablet) and web; maintain rhythm via the same token scale.

Radius: `xs 4 · sm 8 · md 12 (default) · lg 16 · xl 24 · pill 999`.
Elevation: `1` cards, `2` sticky/raised, `3` dialogs/sheets, `4` menus (dark mode: lean on `surface-2`, reduced shadow).

---

# Component Library

(Specs apply to both platforms; min touch target **48×48** mobile, ≥32px clickable web with adequate spacing.)

| Component | Purpose | States | Usage rules |
|---|---|---|---|
| **Buttons** | Primary actions | default, hover/press, focus, disabled, loading | One primary CTA/screen; variants: primary/secondary/tertiary/destructive/icon; sizes L52/M44/S36 |
| **Inputs** | Text entry | default, focus, error, disabled, read-only | Always labeled; helper/error text; h52; show error inline + icon |
| **Dropdowns** | Single/multi select | closed, open, selected, disabled | Bottom sheet on mobile for long lists; searchable when >~8 options |
| **Search bars** | Query | empty, typing, results, no-results | Debounced; clear (×); optional filter chips below |
| **Cards** | Group content | default, pressed (if tappable), selected | Elevation 1, radius md, padding 16; summary/stat/list variants |
| **Tables** (web-primary) | Dense data | loading, empty, sorted, row-hover, selected | Sticky header; tabular figures; sortable; pagination; collapse to list cards on mobile |
| **Badges** | Status | per status color+icon+label | Pill; map to backend enums; never color-only |
| **Chips** | Tags/filters/multi-select | default, selected, disabled | For pest categories, filters, quick tags |
| **Alerts** | Inline messaging | info, success, warning, error | Section-level; dismissible where non-critical |
| **Dialogs** | Confirm/critical | open, loading, error | For destructive/financial actions; 1–2 actions; radius lg |
| **Bottom sheets** (mobile) | Selections/forms | default, expanded, scrolled | Drag handle, sticky action footer |
| **Date pickers** | Date select | default, disabled-dates, selected | Future-only for booking; disable unavailable |
| **Time pickers** | **Window** select | default, disabled-windows, selected | **Window slots** (9–12…), not exact times (PRD) |
| **Navigation bars** | Primary nav | active, inactive, badge | Bottom nav (mobile), side rail/drawer (web admin) |
| **Tabs** | Section switch | active, inactive, scrollable | Catalog (Services/Packages/Coupons), report types |
| **Loaders** | Action progress | indeterminate, determinate | Inline spinner in buttons; top bar on route change |
| **Skeleton loaders** | Content loading | shimmer | Preferred for lists/cards/detail; preserve layout |
| **Empty states** | No data | default | Icon + title + one-line + primary action |
| **Error states** | Failure | inline, section (retry), full-screen | Friendly message; retry; keep request_id in diagnostics |

---

# Customer App Screens (Flutter)

> Convention: app bar + scrollable body (16) + bottom nav (Home/Bookings/Services/Account).

| Screen | Purpose | Layout | Components | Actions | Validation |
|---|---|---|---|---|---|
| **Splash** | Brand + auth gate | Centered logo + loader | logo, loader | auto-route | — |
| **Onboarding** | Value intro | 3 slides + dots | PageView, buttons | swipe/skip/continue | — |
| **Login** | Authenticate | logo + form + social | inputs, buttons, social | login, Google/Apple, nav | email format, required |
| **Register** | Self-register | form + type selector | inputs, segmented, checkbox | submit, social, terms | email, password strength, company-if-commercial, terms |
| **Forgot Password** | Reset (Firebase) | email field | input, button | send reset | email format |
| **Dashboard** | Hub | CTA + upcoming + plan + recent + notif | CTA, cards, badges | book, track, manage | — |
| **Service Selection** | Pick service/pest/package | category chips + service cards | chips, cards, price | select | selection required |
| **Booking Flow** | 10-step booking | stepper + per-step body | cards, calendar+window chips, photo grid, notes, coupon, price, Stripe sheet | back/continue, apply coupon, pay & confirm | per Step 9 (lead time, window, coupon, in-area, payment) |
| **Address Management** | Manage addresses | list + form sheet | list cards, autocomplete, map pin | add/edit/delete/default | required fields, geocode/in-area |
| **Payment** | Pay/auto-pay | invoice summary + method | summary, Stripe sheet | pay (confirm), manage method | valid method, explicit confirm |
| **Booking History** | Past/upcoming | filter chips + list | chips, cards | filter, open, rebook | — |
| **Booking Details** | One booking | header + schedule + tech + report + invoice | detail rows, timeline, map, report, buttons | reschedule/cancel/track/pay/review | policy-gated actions |
| **Live Tracking** | Tech en route | map + status + ETA | map, marker, progress | call/message (future) | active-job only |
| **Chat** *(future)* | Messaging | list → thread | bubbles, composer, attach | send | non-empty/participant |
| **Reviews** | Rate visit | stars + comment | star input, textarea | submit | rating required, one/booking |
| **Notifications** | Feed | grouped list | rows, unread dot | open, mark read | — |
| **Profile** | Account | fields + links | rows, toggles, buttons | edit, manage, logout | field formats |
| **Settings** | Preferences | grouped toggles | toggles, selects | theme, notif prefs, language | — |

---

# Technician App Screens (Flutter)

> Field density: larger targets, high contrast, offline banner.

| Screen | Purpose | Layout | Components | Actions | Validation |
|---|---|---|---|---|---|
| **Login** | Authenticate | form | inputs, button | login | required |
| **Dashboard** | Day at a glance | stats + next job + availability + sync banner | cards, toggle, banner | start, navigate, toggle | — |
| **Assigned Jobs** | Job list | date tabs + cards | tabs, cards, badges | open, refresh | — |
| **Calendar** | Schedule | week/day grid | grid, job chips | navigate, open | — |
| **Job Details** | Perform job | customer/address/access + history + actions | detail card, access (🔒), stepper, buttons | navigate, status, start report | status transitions |
| **Navigation** | Get there | map + route | map, route, button | open external maps, arrived | — |
| **Photo Capture** | Before/after | grid + capture | image grid, progress | capture, remove, retry | type/size, min count (policy) |
| **Service Report** | Compliance capture (offline) | sectioned form | chips, repeatable chemical rows, numeric, notes, signature | add rows, submit | **required compliance fields (pending)**, signature |
| **Signature Capture** | Sign-off | canvas + name | signature pad, buttons | sign, clear, confirm | non-empty, name |
| **Notifications** | Alerts | feed | rows | open | — |
| **Profile** | Read-mostly | fields + availability | rows, toggle | availability, logout | — |

---

# Admin Dashboard Screens (React Web)

> Compact density; 12-col grid; side rail/drawer; full tables (collapse to cards on small screens).

| Screen | Purpose | Layout | Components | Actions | Validation |
|---|---|---|---|---|---|
| **Dashboard** | Command center | stat-card grid + exceptions + schedule | stat cards, alert list, mini schedule | drill, dispatch | — |
| **Customers** | Manage customers | search + filters + table | search, filters, table | view, suspend/activate, notes | — |
| **Technicians** | Manage staff | table + form | table, form, expiry badges | create/edit, set availability | license/expiry, email |
| **Bookings** | Dispatch board | filters + board/table + detail | board, table, assign selector | create/assign/reschedule/cancel | availability/license (409/422) |
| **Services** | Catalog | tabs + lists + forms | tabs, tables, forms | create/edit/deactivate | price ≥0, required |
| **Pricing** | Manage prices | list + edit | tables, inputs | edit (audited) | numeric, role-gated |
| **Payments** | Financial oversight | table + detail + refund | table, detail, refund dialog | view, refund (confirm) | amount ≤ captured, role cap |
| **Reports** | Reporting | selector + filters + charts/tables + export | filters, charts, tables, export | generate, export CSV/PDF | valid range |
| **Analytics** | KPIs/trends | dashboards | charts, KPI cards | filter, drill | — |
| **Notifications** | Ops + broadcast | feed + compose | feed, compose form | read, broadcast (confirm) | audience/content |
| **Settings** | Config/roles | grouped settings + role mgmt | forms, permission matrix | edit roles/permissions (Super Admin) | role-gated |

---

# Navigation Specifications

### Navigation trees
```
Customer (bottom nav): Home · Bookings · Services · Account(+Settings)
Technician (bottom nav): Jobs · Calendar · Notifications · Account
Admin web (side rail): Dashboard · Bookings · Customers · Technicians · Catalog(Services/Pricing) · Payments · Reports · Analytics · Notifications · Settings
```

### User journeys (representative)
- **Customer book:** Home → Service Selection → Booking Flow(1–10) → Payment → Confirmation → Booking Details.
- **Technician job:** Jobs → Job Details → Navigation → status → Service Report → Photos+Signature → Submit.
- **Admin dispatch:** Dashboard(exceptions) → Bookings(board) → Assign → monitor.

### Deep linking requirements
- Notification → screen: booking_id → Booking Details; payment → Invoice; chat → Conversation; assignment → Job Details.
- Role-checked on resolve; unauthenticated → auth gate then continue; web admin supports shareable URLs per resource.

---

# Accessibility Requirements

- **WCAG 2.1 AA** target.
- **Color contrast:** body ≥4.5:1, large/UI ≥3:1; verified across light/dark; status = color+icon+label.
- **Screen reader support:** semantic labels on all controls/images/icons; logical reading order; announce loading/errors/status changes; programmatic field-error association. (Flutter Semantics; React ARIA.)
- **Touch targets:** ≥48×48 mobile; ≥8 spacing; larger in technician flows. Web: keyboard-navigable, visible focus, tab order.
- Respect OS dynamic type up to ~200% without breakage; min body 14.

---

# Dark Mode Specifications

- Full parity via dark tokens; **lighten** brand/accent for contrast (`primary #3FB47C`, `accent #FFB94D`).
- Elevation via surface lightening (`surface`→`surface-2`), reduced shadow.
- Verify badges/charts/maps in both themes; respect system theme + in-app override (stored in prefs/localStorage).
- React admin: same dark token set via CSS variables; charts themed accordingly.

---

# Responsive Design Rules

- **Mobile-first** (360–430dp): single column, bottom nav, bottom sheets.
- **Tablet (≥600dp):** two-pane (list+detail) for jobs/admin; scaled spacing.
- **Web (Admin, ≥1024px):** 12-col grid, persistent side rail, master-detail, full tables; max content width; tables **collapse to list cards** below ~768px.
- Fluid images/maps; landscape support for signature/maps.

---

# UI Performance Guidelines

- **Skeletons + progressive rendering**; never blank screens or layout shift.
- **Lists:** virtualize/paginate long lists (bookings, jobs, admin tables); lazy-load routes.
- **Images:** cached, properly sized thumbnails (`cached_network_image` / responsive `<img>`); compress before upload; lazy-load.
- **Maps:** lazy-init; limit markers/redraws; throttle live updates.
- **State:** granular providers (Riverpod) / memoized selectors (React) to avoid over-rebuild/re-render.
- **Startup:** defer non-critical init; warm only what the role needs.
- **Web admin:** code-split by route; debounce search; server-side pagination/sort for big tables.

---

# Final Design Review

### 1. Design risks
| Risk | Severity | Note |
|---|---|---|
| **Service Report UI vs field speed** | High | Most complex/critical screen; usability-test with techs; defaults, repeatable rows, large targets |
| **Compliance fields unconfirmed** (every step since 1) | High | Report screen + compliance export can't reach final fidelity without jurisdiction rules |
| **Flutter vs React parity drift** | Medium | Single token source + shared component contract; review both implementations against this doc |
| **Admin table UX on mobile** | Medium | Table→card collapse pattern; primary admin is web |
| **Amber contrast** | Medium | Dark text on amber; verify ratios |
| **Dark mode coverage** | Medium | Audit every screen/state in both themes before sign-off |

### 2. Recommendations
1. **Implement tokens + component library FIRST** on both platforms, from this doc, before screens — prevents drift.
2. **Treat this as the single source of truth**; changes go here first, then code.
3. **Usability-test the technician report flow** early with real field staff.
4. **Verify all contrast + dark-mode states** before development sign-off.
5. **Keep future screens (Live Tracking, Chat) behind feature flags** per MVP scope.
6. **Confirm Admin surface** = React web primary (Step 2); keep in-app admin lean.

### 3. Missing screens (to add before/at build)
- **Subscription/Plan management** (customer) — view/pause/resume/upgrade/cancel (functional design exists; needs a dedicated screen spec).
- **Invoice detail / list** (customer) — referenced; specify as standalone.
- **Email verification / verify-prompt** screen (Firebase flow).
- **Admin: Subscriptions, Coupons/Campaigns, Reviews moderation, Audit logs** — referenced in modules; add explicit Admin screen specs.
- **Technician: Waiting/escalation** state UI (from status-model extension).
- **Generic: permission-denied (403) and offline screens.**

### 4. Readiness score before Backend Development
**8.5 / 10 — Ready to begin Backend Development.**
The design system is finalized, cross-platform, and developer-ready; tokens, components, and the major screens are specified to an implementable level, consistent with all upstream architecture, data, API, and module designs. Backend development can begin now (it depends on API/DB/Backend specs, not pixels). Two design closeouts should happen in parallel: add the **missing screen specs** above, and **confirm the compliance fields** so the Service Report and compliance export reach final fidelity. Doing so lifts this to ~9.5/10.

> Build-readiness note (whole project): the architecture, database, API, backend, auth, and module designs are complete and consistent across 15 documents. The recurring blockers for *implementation* (not design) are: **pesticide-reporting/compliance fields** (longest-standing, affects DB/report/export), **service-area definition** (booking + maps), **financial policies** (payments/refunds/tax), and **provider/environment setup** (Firebase, Stripe, Twilio, SendGrid, Google Maps, AWS). None block starting backend development on the confirmed core.

*Next step on approval: Backend Development (or generate buildable artifacts — OpenAPI spec + Prisma schema — first).*
