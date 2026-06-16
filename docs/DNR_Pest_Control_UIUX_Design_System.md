# DNR Pest Control — UI/UX Design System (Step 8)

**Product:** DNR Pest Control app (iOS + Android, Flutter)
**Builds on:** PRD (1) · Architecture (2) · DB (3) · API (4) · Backend (5) · Auth (6) · Flutter Arch (7)
**Roles:** Customer · Technician · Admin
**Target users:** Residential customers · Commercial customers · Field technicians · Business administrators
**Document type:** UI/UX & Design System Specification
**Version:** Draft 1.0
**Scope note:** Design specification only — detailed enough to build from. **No Flutter code.**

> All tokens below map to the `config/theme/` and `shared/` layers defined in Step 7. Values are starting recommendations a designer can refine; the structure is what the developer builds against.

---

# Brand Identity

### Brand personality
DNR is **trustworthy, clean, and competent** — a professional that protects your home or business. The personality balances:
- **Reassuring** — pests are stressful; the app should feel calm and in control.
- **Professional & credible** — handling chemicals and commercial contracts demands seriousness.
- **Efficient & no-nonsense** — both customers and field staff want speed, not decoration.
- **Approachable** — friendly enough for a homeowner, not clinical.

### Visual style
- Clean, **utility-first** layouts with generous whitespace.
- **Nature-and-safety** green as the trust anchor, paired with a deep neutral and an energetic action accent.
- Rounded-but-restrained geometry; clear hierarchy; strong status communication (jobs, payments, compliance).
- Photography/illustration kept minimal and functional (real service photos matter more than decoration).

### Design principles
1. **Clarity over cleverness** — the right action is always obvious.
2. **Status is king** — booking/job/payment state must be instantly legible (color + icon + label, never color alone).
3. **Speed for the field** — technician flows minimize taps and typing; large targets for outdoor/gloved use.
4. **Trust through transparency** — show what's happening (tech en route, what was treated, what's owed).
5. **Consistency** — one component library across all three roles; differences are in density, not language.
6. **Accessible by default** — contrast, sizing, and screen-reader support are baseline, not add-ons.

---

# Color System

### Primary — Green (trust, safety, "pest-free")
| Token | HEX |
|---|---|
| primary/50 | `#E8F5EE` |
| primary/100 | `#C5E7D4` |
| primary/200 | `#9FD8B8` |
| primary/300 | `#79C99C` |
| primary/400 | `#4FB87F` |
| **primary/500 (base)** | `#1E8E5A` |
| primary/600 | `#197C4F` |
| primary/700 | `#136540` |
| primary/800 | `#0D4E31` |
| primary/900 | `#083420` |

### Secondary — Deep Slate Blue (professional, dependable)
| Token | HEX |
|---|---|
| secondary/50 | `#EAEEF3` |
| secondary/100 | `#C9D3DF` |
| secondary/300 | `#7E94AC` |
| **secondary/500 (base)** | `#2F4B6E` |
| secondary/700 | `#21364F` |
| secondary/900 | `#142231` |

### Accent — Amber (energetic CTAs, highlights — use sparingly)
| Token | HEX |
|---|---|
| accent/300 | `#FFD27A` |
| **accent/500 (base)** | `#F5A623` |
| accent/700 | `#C77F12` |

### Success
| Token | HEX |
|---|---|
| success/50 | `#E6F6EC` |
| **success/500** | `#2BA84A` |
| success/700 | `#1C7A35` |

### Warning
| Token | HEX |
|---|---|
| warning/50 | `#FFF6E6` |
| **warning/500** | `#E8A317` |
| warning/700 | `#B47C0C` |

### Error
| Token | HEX |
|---|---|
| error/50 | `#FDEAEA` |
| **error/500** | `#D64545` |
| error/700 | `#A42F2F` |

### Info
| Token | HEX |
|---|---|
| info/50 | `#E8F1FB` |
| **info/500** | `#2D7DD2` |

### Neutrals / Background (Light mode)
| Token | HEX | Use |
|---|---|---|
| neutral/0 | `#FFFFFF` | Surface / cards |
| neutral/50 | `#F7F9FA` | App background |
| neutral/100 | `#EDF1F3` | Subtle fills / dividers bg |
| neutral/200 | `#DDE3E8` | Borders |
| neutral/400 | `#9AA6B2` | Disabled / placeholder |
| neutral/600 | `#5C6873` | Secondary text |
| neutral/800 | `#2A323B` | Primary text |
| neutral/900 | `#161B21` | Headings / max contrast |

### Dark mode
| Token | HEX | Use |
|---|---|---|
| dark/bg | `#0E1419` | App background |
| dark/surface | `#161D24` | Cards / sheets |
| dark/surface-2 | `#1E2730` | Elevated surfaces |
| dark/border | `#2C3742` | Borders / dividers |
| dark/text-primary | `#EAEEF1` | Primary text |
| dark/text-secondary | `#9DAAB6` | Secondary text |
| dark/primary | `#3FB47C` | Primary (lightened for contrast) |
| dark/accent | `#FFB94D` | Accent (lightened) |
| dark/success | `#43C063` | Success |
| dark/warning | `#F0B43C` | Warning |
| dark/error | `#EA6A6A` | Error |

> Rule: never communicate status with color alone — always pair with icon + text (accessibility + dark mode safety).

---

# Typography System

### Font family
- **Primary UI font: Inter** (excellent legibility at small sizes, wide weight range, free, great for Flutter).
- **Numeric/tabular:** Inter with tabular figures for tables/amounts.
- Fallbacks: system (SF Pro / Roboto). Optional display alternative: *Plus Jakarta Sans* for marketing surfaces (not required for MVP).

### Type scale (size / weight / line-height)
| Style | Size | Weight | Line-height | Use |
|---|---|---|---|---|
| Display | 32 | 700 | 40 | Splash / hero |
| H1 | 28 | 700 | 36 | Screen titles |
| H2 | 24 | 700 | 32 | Section titles |
| H3 | 20 | 600 | 28 | Card titles |
| H4 | 18 | 600 | 26 | Sub-sections |
| Body Large | 16 | 400 | 24 | Primary reading text |
| Body | 14 | 400 | 22 | Default body |
| Body Small | 13 | 400 | 20 | Dense lists |
| Button | 15 | 600 | 20 | Button labels (letter-spacing 0.2) |
| Label | 13 | 600 | 18 | Field labels, tabs |
| Caption | 12 | 400 | 16 | Helper / metadata |
| Overline | 11 | 600 | 16 | Uppercase tags (tracking 0.6) |

- Min on-screen body size **14**; never below **12** for any text.
- Headings use `neutral/900` (light) / `dark/text-primary` (dark); secondary text `neutral/600` / `dark/text-secondary`.

---

# Design Tokens

### Spacing scale (4pt base)
`space/0 = 0` · `1 = 4` · `2 = 8` · `3 = 12` · `4 = 16` · `5 = 20` · `6 = 24` · `8 = 32` · `10 = 40` · `12 = 48` · `16 = 64`
- Default screen padding: **16**. Card padding: **16**. Section gap: **24**. Inline gap: **8–12**.

### Border radius
`radius/xs = 4` · `sm = 8` · `md = 12` (default cards/inputs) · `lg = 16` · `xl = 24` · `pill = 999`

### Shadows / Elevation
| Level | Use | Spec (light) |
|---|---|---|
| 0 | Flat (backgrounds) | none |
| 1 | Cards | y2 blur6 `rgba(16,24,32,0.06)` |
| 2 | Sticky headers, raised cards | y4 blur12 `rgba(16,24,32,0.08)` |
| 3 | Dialogs, bottom sheets | y8 blur24 `rgba(16,24,32,0.12)` |
| 4 | Menus / popovers | y12 blur32 `rgba(16,24,32,0.16)` |

- **Dark mode:** reduce shadow opacity and lean on `surface-2` lightening to convey elevation (shadows read poorly on dark).

---

# Component Library

> Each component lists variants, states, and key specs. All interactive components meet min touch target **48×48**.

### Buttons
- **Variants:** Primary (filled `primary/500`), Secondary (outline), Tertiary/Text, Destructive (filled `error/500`), Icon button.
- **Sizes:** Large (h52, field actions), Medium (h44, default), Small (h36, inline).
- **States:** default, hover/pressed (darken 1 step), disabled (`neutral/200` bg / `neutral/400` text), loading (spinner replaces label, width preserved).
- Radius `md`; full-width primary CTAs on mobile; label = Button style.

### Text fields
- **Anatomy:** label (Label style) · input · helper/error · optional leading/trailing icon.
- **States:** default (border `neutral/200`), focus (border `primary/500`, 2px), error (border `error/500` + message + icon), disabled, read-only.
- Height 52; radius `md`; placeholder `neutral/400`. Supports password reveal, char counter, prefix (e.g., currency/phone).

### Dropdowns / Selects
- Trigger styled like a text field with chevron; opens menu (elevation 4) or bottom sheet on mobile for long lists.
- Supports search for long option sets; single & multi-select (checkbox rows); selected state with check + `primary` tint.

### Cards
- Surface `neutral/0` / `dark/surface`, radius `md`, elevation 1, padding 16.
- Patterns: **summary card** (booking/job), **stat card** (admin dashboard), **list card** (tappable with chevron/status badge).

### Tables (Admin / dense)
- Sticky header row (overline labels), zebra optional, row h48–56, tabular figures for numbers.
- Row actions via trailing menu; sortable headers; pagination footer (page/limit/total from API `meta`).
- On narrow screens, tables **collapse into list cards** (key/value stacks) — see Responsive.

### Search bars
- Pill or `md` radius, leading search icon, clear (×) trailing, debounce input, optional filter chip row beneath.

### Date / Time pickers
- **Booking uses time windows** (per PRD) — present **window slots** (e.g., 9–12, 12–3), not exact times.
- Calendar picker for date; segmented control or chips for windows; disabled past dates and unavailable windows.

### Status badges
- Pill, `radius/pill`, icon + label + tint. Mapped to backend enums:
  - Booking: pending (`warning`), confirmed (`info`), en_route/in_progress (`primary`), completed (`success`), cancelled/no_show (`neutral`/`error`), follow_up (`accent`).
  - Invoice/Payment: paid (`success`), overdue (`error`), pending (`warning`), refunded (`neutral`).
- Always icon + text (never color-only).

### Dialogs
- Centered, radius `lg`, elevation 3, max-width ~340; title (H3) + body + 1–2 actions (Primary + Text).
- Use for confirmations (cancel booking, refund, delete) and destructive warnings.

### Bottom sheets
- Mobile-primary container for selections, filters, quick actions, and forms; drag handle, radius `lg` top, elevation 3; scrollable; sticky action footer.

### Loading states
- **Skeletons** for lists/cards/detail (preferred over spinners for content), inline spinner for button actions, top progress bar for route transitions. Never a blank screen.

### Empty states
- Icon/illustration + short title + one-line guidance + primary action (e.g., "No bookings yet — Book a service").

### Error states
- Inline (field) errors; section error card with **Retry**; full-screen error for hard failures with retry + support hint. Map to typed failures from Step 7; show friendly message, keep `request_id` in diagnostics.

---

# Customer App Screens

> Layout convention: top app bar (title + optional action), scrollable body with 16 padding, bottom nav (Home / Bookings / Services / Account) where applicable.

### Splash Screen
- **Purpose:** Brand moment + auth gate (checks tokens, Step 6/7).
- **Layout:** centered logo on `primary` or surface; subtle loader.
- **Components:** logo, loading indicator.
- **Actions:** none (auto-routes to home or login).

### Onboarding
- **Purpose:** Brief value intro for first-time users.
- **Layout:** 3 swipeable slides (illustration + headline + caption) + dots + Skip/Next.
- **Components:** PageView, primary "Get Started", text "Skip".
- **Actions:** swipe, skip, continue → Login/Register.

### Login
- **Purpose:** Authenticate (email/Google/Apple per Step 6).
- **Layout:** logo, email + password fields, primary "Log in", "Forgot password?", divider "or", Google & Apple buttons, "Create account".
- **Components:** text fields, buttons, social buttons.
- **Actions:** login, social sign-in, navigate to register/forgot.

### Register
- **Purpose:** Customer self-registration.
- **Layout:** name, email, phone, password (strength meter), residential/commercial selector (company name if commercial), terms checkbox, primary "Create account", social options.
- **Components:** fields, segmented selector, checkbox.
- **Actions:** submit, social sign-up, accept terms (explicit), navigate to login.

### Dashboard (Home)
- **Purpose:** Entry hub — book fast, see what's next.
- **Layout:** greeting + property selector; prominent **"Book a Service"** CTA; "Upcoming appointment" card (with status + tech en-route entry point); quick links (Plans, Invoices); promo/coupon banner (optional).
- **Components:** CTA, summary card, status badge, quick-action tiles.
- **Actions:** book, view upcoming, track technician, open plan.

### Service Booking
- **Purpose:** Create a one-time or plan booking.
- **Layout (stepped):** 1) choose service or plan → 2) select address → 3) pick date + **time window** → 4) apply coupon → 5) review price → confirm.
- **Components:** selectable service cards, address selector, calendar + window chips, coupon field, price summary, primary "Confirm booking".
- **Actions:** select, apply coupon (validate), confirm (idempotent), handle conflict/lead-time errors (422/409).

### Address Management
- **Purpose:** Manage service locations.
- **Layout:** list of address cards (label, line1, default tag) + "Add address"; form sheet for create/edit incl. access notes & gate code (sensitive).
- **Components:** list cards, FAB/button, bottom-sheet form, map pin (optional).
- **Actions:** add/edit/delete (confirm delete; block if referenced), set default.

### Payment
- **Purpose:** Pay an invoice / set up plan auto-pay.
- **Layout:** invoice summary, amount due, saved method (last4) or "Add payment method" (Stripe sheet), primary "Pay".
- **Components:** summary, Stripe payment sheet, success/failure states.
- **Actions:** pay (explicit confirm), manage method. **No card data in-app.**

### Booking History
- **Purpose:** Past & upcoming bookings.
- **Layout:** filter chips (Upcoming/Completed/Cancelled), list of booking cards (service, date/window, status badge).
- **Components:** chips, list cards, skeletons, empty state.
- **Actions:** filter, open detail, rebook.

### Booking Details
- **Purpose:** Everything about one booking.
- **Layout:** header (service + status), schedule, address, assigned technician, **service report** (when completed: pests/areas/recommendations), invoice link, actions.
- **Components:** detail rows, status timeline (from status-history), report section, map (en-route), buttons.
- **Actions:** reschedule/cancel (policy-gated), track tech, pay, leave review.

### Reviews
- **Purpose:** Rate a completed visit.
- **Layout:** star rating, comment field, submit.
- **Components:** star input, text area, primary button.
- **Actions:** submit (one per booking), edit pending.

### Profile
- **Purpose:** Account info & settings.
- **Layout:** avatar/name, editable fields, addresses link, notification prefs, plans/subscriptions, payment methods, logout.
- **Components:** list rows, toggles, buttons.
- **Actions:** edit profile, manage prefs/plans, logout (revokes session).

### Notifications
- **Purpose:** In-app notification feed.
- **Layout:** list grouped by date; unread emphasized; tap → deep link.
- **Components:** notification rows, unread dot, empty state.
- **Actions:** open (deep link), mark read / read-all.

### Chat *(future)*
- **Purpose:** Message office/technician.
- **Layout:** conversation list → thread (bubbles, timestamps, attachment, composer).
- **Components:** message bubbles, input + attach, send.
- **Actions:** send message/attachment.

---

# Technician App Screens

> Field-optimized: larger targets, high contrast, minimal typing, offline-aware banners.

### Login
- Same auth pattern; technicians are Admin-provisioned (Step 6). Email/password (or Firebase per chosen model).

### Dashboard
- **Purpose:** Day at a glance.
- **Layout:** today's date, job count, next job card (address + window + navigate), availability toggle, sync/offline status banner.
- **Components:** summary stats, next-job card, toggle, offline banner.
- **Actions:** start next job, toggle availability, view jobs.

### Assigned Jobs
- **Purpose:** The job list (today/upcoming).
- **Layout:** date selector, list of job cards (time window, customer, address, status badge).
- **Components:** date tabs, job cards, skeletons.
- **Actions:** open job, refresh, filter by status.

### Calendar
- **Purpose:** Schedule overview.
- **Layout:** week/day view with job blocks.
- **Components:** calendar grid, job chips.
- **Actions:** navigate dates, open job.

### Job Details
- **Purpose:** Everything to perform a job.
- **Layout:** customer + address + **access notes/gate code**, service & history, target pests, prior notes, status actions, "Navigate", "Start report".
- **Components:** detail card, access info (sensitive), status stepper, action buttons.
- **Actions:** update status (en_route→arrived→in_progress), navigate, open report.

### Navigation Screen
- **Purpose:** Get to the location.
- **Layout:** Google Map with route; "Open in Maps" hand-off; arrival → mark "Arrived".
- **Components:** map, route, primary action.
- **Actions:** launch external nav, set arrived (pushes GPS per API).

### Service Report
- **Purpose:** Compliance-critical capture (works offline).
- **Layout (sectioned):** pests found (chips/multi) · areas treated · **chemical applications** (repeatable rows: product, EPA #, target pest, quantity+unit, method, area) · summary · recommendations · photos · signature · submit.
- **Components:** multi-select chips, repeatable form rows, numeric inputs, photo grid, signature pad, primary "Submit report".
- **Actions:** add chemical rows, attach photos, capture signature, submit (queues if offline, idempotent).
- **Note:** the **chemical fields are placeholders pending jurisdiction confirmation** (long-standing open item).

### Photo Upload
- **Purpose:** Before/after evidence.
- **Layout:** grid of thumbnails + add (camera/gallery), upload progress, captions optional.
- **Components:** image grid, capture button, progress, retry.
- **Actions:** capture/select, remove, retry upload (S3 presigned, queued offline).

### Signature Capture
- **Purpose:** Customer sign-off.
- **Layout:** signature canvas, name field, clear/confirm.
- **Components:** signature pad, buttons.
- **Actions:** sign, clear, confirm (stored as file, linked to report).

### Notifications
- New/changed assignments, schedule changes; same feed pattern as Customer.

### Profile
- License info, skills, availability, logout. Mostly read-only (Admin manages).

---

# Admin App Screens

> Denser layouts (tables, filters). Per Step 2, a **web admin** is the recommended long-term surface; in-app mirrors core ops for MVP/parity.

### Dashboard
- **Purpose:** Operational command center.
- **Layout:** stat cards (jobs today, unassigned, in-progress, completed, overdue invoices, revenue), exceptions list, today's schedule.
- **Components:** stat cards, alert list, mini schedule.
- **Actions:** drill into exceptions, jump to bookings.

### User Management
- **Purpose:** Manage customer/all users.
- **Layout:** searchable table (name, role, status, joined), filters, row actions.
- **Components:** table → list cards on mobile, search, filters, status toggle.
- **Actions:** search/filter, view detail, suspend/activate (audited).

### Technician Management
- **Purpose:** Manage field staff.
- **Layout:** table (name, license, expiry, availability, status), create/edit form.
- **Components:** table, form sheet, expiry warning badges.
- **Actions:** create (provision), edit licensing/skills/status.

### Booking Management
- **Purpose:** Dispatch & oversee jobs.
- **Layout:** filterable table/board (status, date, technician), detail with **assign technician**.
- **Components:** filters, table/board, assignment selector (availability + license checks), status view.
- **Actions:** assign/reassign (409/422 guarded), reschedule, cancel, view report.

### Service Management
- **Purpose:** Catalog, packages, coupons, pricing.
- **Layout:** tabbed (Services / Packages / Coupons); list + create/edit forms.
- **Components:** tables, forms, price inputs, active toggles.
- **Actions:** create/edit/deactivate; manage package contents & coupon rules.

### Payments
- **Purpose:** Financial oversight.
- **Layout:** payments/invoices table (status, amount, customer, date), invoice detail, refund action.
- **Components:** table, detail, refund dialog (confirm).
- **Actions:** view, issue refund (Admin-only, audited).

### Reports
- **Purpose:** Analytics & compliance.
- **Layout:** report type selector, date range, charts/tables, export.
- **Components:** filters, charts, data tables, export (CSV/PDF) incl. **chemical-usage compliance export**.
- **Actions:** generate, export.

### Notifications
- **Purpose:** System/ops notifications; optionally broadcast to customers/techs.
- **Layout:** feed + (optional) compose broadcast.
- **Actions:** read, broadcast (explicit confirm, future).

---

# Navigation Structure

### Customer navigation flow
```
Splash → (auth) → Onboarding(first) → Login/Register → [Customer Shell]
Bottom nav: Home · Bookings · Services · Account
Home → Book Service (stepper) → Confirm → Booking Details
Bookings → Detail → {Reschedule | Cancel | Track | Pay | Review}
Services → Package → Subscribe
Account → Profile / Addresses / Plans / Payment methods / Notifications / Logout
```

### Technician navigation flow
```
Splash → Login → [Technician Shell]
Bottom nav: Jobs · Calendar · Notifications · Account
Jobs → Job Details → {Navigate | Update Status | Service Report}
Service Report → Photos + Signature → Submit (offline-queued)
```

### Admin navigation flow
```
Splash → Login → [Admin Shell]
Rail/Drawer: Dashboard · Bookings · Customers · Technicians · Catalog · Payments · Reports · Account
Dashboard → exceptions → Booking Management → Assign
Catalog → Services/Packages/Coupons
Reports → generate/export (incl. compliance)
```

---

# User Experience Guidelines

- **Loading:** skeletons for content, inline spinners for actions, top bar for navigation. No blank screens; preserve layout to avoid shift.
- **Error handling:** typed, friendly messages; inline for fields, retp for sections; never expose raw/vendor errors; offer Retry; keep `request_id` for support.
- **Empty states:** always icon + message + primary action; encouraging, never dead ends.
- **Success messages:** lightweight snackbars/toasts for confirmations (booked, paid, submitted); inline confirmation for major actions; avoid blocking dialogs for routine success.
- **Offline mode (technician-critical):** persistent offline banner; allow capture/queue; show per-item sync status (pending/synced/failed-retry); disable actions that truly require connectivity with clear messaging; auto-sync on reconnect (idempotent).

---

# Accessibility Requirements

- **Color contrast:** body text ≥ **4.5:1**, large text/UI ≥ **3:1**; verify all tokens (esp. accent/amber on white — pair with dark text). Status never conveyed by color alone (icon + label).
- **Font sizing:** respect OS dynamic type / text scaling up to ~200% without breaking layout; min 14 body.
- **Screen reader support:** semantic labels on all controls, images, icons; meaningful reading order; announce state changes (loading, errors, status updates); label form fields + errors programmatically.
- **Touch targets:** min **48×48**; ≥ 8 spacing between targets; field-friendly larger targets in technician flows.
- Focus states visible; support keyboard/switch where relevant (web admin).

---

# Dark Mode Design

- Full parity using the dark token set; **lighten brand colors** for contrast (`dark/primary`, `dark/accent`).
- Convey elevation via **surface lightening** (`surface` → `surface-2`), not heavy shadows.
- Maintain contrast ratios; test status badges and charts in both modes.
- Respect system theme by default with an in-app override toggle (stored in prefs).

---

# Responsive Design Guidelines

- **Mobile-first** (≈360–430dp). Single-column, bottom nav, bottom sheets for selection.
- **Tablet (≥600dp):** two-pane where useful (list + detail), especially Technician job list/detail and Admin.
- **Web/large (Admin):** master-detail, persistent nav rail, full data **tables** (which collapse to list cards on mobile).
- Fluid spacing scale; max content width on large screens for readability; images/maps scale responsively.
- Orientation: support landscape for signature capture and maps.

---

# UI/UX Best Practice Recommendations

1. **Lead with the primary action per screen** (Book, Start Job, Pay, Submit Report) — one obvious CTA.
2. **Time windows, not exact times** — set expectations and reduce complaints (PRD).
3. **Make status unmistakable** everywhere with badge = color + icon + label.
4. **Optimize the technician report for speed** — defaults, repeatable rows, large inputs, offline-safe; this screen's usability determines field adoption.
5. **Confirm destructive/irreversible actions** (cancel, refund, delete) with dialogs.
6. **Build the shared component library first** (Step 7 `shared/`), then assemble screens — prevents drift across three roles.
7. **Show, don't hide, the service report to customers** — transparency drives trust and retention.
8. **Design the offline and error states as first-class**, not afterthoughts.
9. **Keep Admin-in-app lean**; invest detailed admin UX in web (Step 2).
10. **Test color/contrast in both themes** before finalizing the palette.

---

# UI/UX Review

This design system translates the seven prior steps into a coherent, build-ready interface language: a trustworthy green-led brand, a complete token set (color incl. dark mode, type, spacing, radius, elevation), and a single component library that serves all three roles by varying density rather than language. Every required screen across Customer, Technician, and Admin is specified with purpose, layout, components, and actions, and each maps to concrete API endpoints and statuses from Steps 3–4 (booking windows, status enums, invoices, reports, GPS, chat). Navigation flows implement the Step 6/7 auth-gated, role-based routing. Accessibility, dark mode, responsive behavior, and offline-first UX (critical for technicians) are defined as baseline. A designer can produce high-fidelity mockups and a Flutter developer can build `config/theme/` and `shared/` directly from these tokens and component specs.

# Design Risks

| Risk | Severity | Mitigation |
|---|---|---|
| **Service-report UI complexity vs field speed** | High | Heavy usability testing with real technicians; defaults, repeatable rows, large targets; minimize typing |
| **Compliance fields unconfirmed** (8 steps running) — shapes the report form | High | Confirm jurisdiction before finalizing that screen; design flexible repeatable rows meanwhile |
| **Admin in Flutter** (dense tables) compromises UX | Medium | Lean in-app admin; full admin on web (Step 2); table→card collapse pattern |
| **Accent/amber contrast** on light surfaces | Medium | Pair amber with dark text; verify ratios; restrict to accents |
| **Three-role single app** scope/visual creep | Medium | One component library, density tokens; feature flags for Chat/GPS |
| **Offline status legibility** for technicians | Medium | Explicit per-item sync states; persistent banner; tested in poor connectivity |

# Recommendations Before Customer Module Design

1. **Finalize the design tokens** (sign off color/type/spacing) — they are the contract `config/theme/` is built from; changing them later is costly.
2. **Build the shared component library first** (buttons, fields, cards, badges, sheets, states) before assembling Customer screens, so all roles stay consistent.
3. **Confirm light + dark palettes pass contrast** (especially amber and status badges) before high-fidelity design.
4. **Lock the booking UX specifics** — time-window slot model, coupon application, and price-summary layout — since the Customer module centers on booking.
5. **Confirm Admin-in-app scope** (parity vs minimal) so effort isn't duplicated with a web admin.
6. **Confirm the staff-auth model (Step 6)** so the shared auth screens are designed once.
7. **Confirm compliance fields** (still open) before the technician report screen reaches high fidelity — flexible repeatable-row design in the interim.

Once tokens are signed off and the shared component library is specified to high fidelity, the **Customer Module Design** can proceed.

*Next step on approval: Customer Module Design.*
