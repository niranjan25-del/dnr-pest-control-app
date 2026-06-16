# DNR Pest Control — Product Requirements Document (PRD)

**Product:** DNR Pest Control Mobile Application
**Platform:** Flutter (single codebase, iOS + Android)
**Roles supported:** Customer · Technician · Admin
**Document type:** Product Discovery & Requirements
**Version:** Draft 1.0 — Discovery phase
**Author role:** Senior Product Manager / Business Analyst / Solution Architect

> Scope note: This document covers product discovery and requirements only. It intentionally excludes database schema, API design, architecture diagrams, UI wireframes, and code. Those follow after approval.

---

## 1. Business Goals

### 1.1 Primary Business Objectives
- Establish a single mobile platform that runs the full service lifecycle — booking, dispatch, treatment, documentation, billing, and retention — for one pest control company.
- Shift revenue mix toward **recurring service plans**, which are the most profitable and predictable part of a pest control business.
- Reduce dependency on phone-and-paper operations and the office staff time that consumes.
- Build a defensible compliance record for every chemical application performed.

### 1.2 Revenue Opportunities
| Opportunity | Description | Impact |
|---|---|---|
| Recurring plans | Monthly/quarterly/seasonal subscriptions with auto-renewal | High — predictable MRR |
| Upsell at service | Technician recommends add-on treatments in the field | Medium |
| Reduced no-shows | Reminders recover otherwise-lost billable slots | Medium |
| Faster billing | Sign-off + invoice at completion shortens cash cycle | Medium |
| One-time → plan conversion | Convert single jobs into ongoing plans | High |
| Referral / reviews | Drive new customers at low acquisition cost (future) | Medium |

### 1.3 Operational Efficiency Goals
- Increase completed jobs per technician per day via better scheduling and reduced field admin.
- Eliminate double-bookings and manual dispatch errors.
- Cut the time between job completion and invoice issuance to near-zero.
- Provide Admin a real-time operational picture rather than end-of-day reconstruction.
- Reduce paperwork and manual data re-entry to a minimum.

### 1.4 Customer Experience Goals
- Make booking and rescheduling self-service and simple.
- Give customers transparency: when the tech is coming, what was done, what was found, what's recommended.
- Provide clear records and easy payment.
- Build trust through proof of service (photos, notes, signatures) and consistent communication.

---

## 2. Problems to Solve

### 2.1 Current Industry Pain Points
- Heavy reliance on phone calls, paper work orders, and spreadsheets.
- Inconsistent chemical/pesticide application records that create regulatory and liability exposure.
- Manual scheduling and dispatch producing inefficient routes and idle time.
- Recurring service tracking that depends on memory or fragile spreadsheets, so renewals slip.
- Poor visibility into technician location, job status, and daily revenue.

### 2.2 Customer Challenges
- Must call the office for everything — booking, rescheduling, questions, history.
- No visibility into appointment timing or technician arrival.
- Unclear what was treated or found, and no easy access to past reports.
- Friction around payment and invoices.

### 2.3 Technician Challenges
- Paper-based work orders and handwritten chemical logs are slow and error-prone.
- No consolidated daily schedule, route, or access details (gate codes, pets, entry notes).
- Difficult to capture proof of work (photos, signatures) reliably.
- Connectivity is often poor in the field, yet most tools assume always-online.

### 2.4 Administrative Challenges
- No single source of truth for customers, jobs, and technicians.
- Manual assignment and constant rescheduling by phone.
- Hard to track plan renewals, follow-ups, and warranty/re-treatment obligations.
- Compliance records scattered and hard to produce for audits.
- Limited reporting on revenue, utilization, and retention.

---

## 3. User Roles

### 3.1 Customer
Residential or commercial property owner/tenant receiving service. Mobile-first, low-frequency user (a handful of interactions per year). Priorities: convenience, transparency, trust, easy payment. The experience must be simple enough to use without training.

### 3.2 Technician
Field employee performing inspections and treatments. Mobile-first, frequently offline, working outdoors. Priorities: speed, clarity on what/where, minimal typing, fast compliance capture. A licensed/certified role in most regions.

### 3.3 Admin
Office staff, dispatcher, or owner/manager. Primarily desktop/tablet but should work on the same app. The control center: manages customers, technicians, services, pricing, scheduling, payments, compliance, and reporting. Broadest permissions.

> Recommendation: treat Admin as a permission tier rather than a single person. Most real businesses need at least a **Dispatcher/Office** sub-role and an **Owner/Manager** sub-role. Plan for role granularity even if MVP ships a single Admin level.

---

## 4. Feature Requirements

### 4.1 Customer

| Priority | Feature |
|---|---|
| Must-have | Registration & login; property profile (address, type, access notes, pets, gate codes) |
| Must-have | Book a service (one-time or recurring plan) |
| Must-have | View upcoming appointments; cancel/reschedule within policy |
| Must-have | Notifications: confirmation, reminder, tech en route, completion |
| Must-have | View service history & reports (pests found, treatment, recommendations) |
| Must-have | View invoices and pay |
| Important | Manage multiple properties under one account |
| Important | In-app messaging / requests to the office |
| Important | Saved payment method & auto-pay for plans |
| Optional/Future | Live technician ETA/tracking |
| Optional/Future | Reviews & ratings; referral program |
| Optional/Future | Photo-based pest reporting ("here's what I'm seeing") |

### 4.2 Technician

| Priority | Feature |
|---|---|
| Must-have | Login; daily job list with addresses, customer & access details |
| Must-have | Job detail: service type, history, prior notes, target pests |
| Must-have | Treatment capture: pests found, areas treated, products/chemicals + quantities, target pest, conditions |
| Must-have | Photo capture (before/after) and field notes |
| Must-have | Customer signature / sign-off |
| Must-have | Job status updates (en route, arrived, in progress, complete, follow-up needed) |
| Must-have | Offline capture with sync on reconnect |
| Important | One-tap navigation to address (hand-off to maps) |
| Important | Generate/share a service report on completion |
| Important | Add recommended add-on services / notes for upsell |
| Optional/Future | Optimized multi-stop routing |
| Optional/Future | In-field payment collection |
| Optional/Future | Inventory/chemical stock deduction tied to usage |

### 4.3 Admin

| Priority | Feature |
|---|---|
| Must-have | Customer management (records, properties, history) |
| Must-have | Technician management (profiles, licenses/certifications, availability) |
| Must-have | Schedule & assign jobs; handle reschedules/cancellations |
| Must-have | Real-time job status across the team |
| Must-have | Service catalog & pricing management |
| Must-have | Recurring plan setup and tracking |
| Must-have | Invoicing & payment oversight |
| Must-have | Compliance / chemical-usage records access & export |
| Important | Operational dashboard (today's jobs, status, exceptions) |
| Important | Reports: revenue, completed jobs, utilization, retention |
| Important | Notifications/announcements to customers or techs |
| Optional/Future | Automated dispatch / route optimization |
| Optional/Future | Churn & profitability analytics |
| Optional/Future | Accounting/CRM integrations (e.g., QuickBooks) |
| Optional/Future | Multi-branch / territory management |

---

## 5. Customer Journey

| Stage | What happens | Notes / best practice |
|---|---|---|
| Registration | Customer self-registers or is created by Admin after a phone enquiry; sets up property profile | Support both paths; many pest control customers still start by phone |
| Booking | Selects service type or plan, property, preferred date/time window; sees price; confirms | Use **time windows** (e.g., 9–12), not exact times — field work is unpredictable |
| Payment | Pays on booking, on completion, or on a recurring schedule depending on service type | Recommend deposit or card-on-file for one-time; auto-pay for plans |
| Service completion | Gets en-route and completion notifications; receives a service report (findings, treatment, recommendations) | Proof of service builds trust and reduces disputes |
| Review | Prompted to rate the visit and optionally leave a review | Gate public reviews behind a positive in-app rating (future) |

---

## 6. Technician Journey

| Stage | What happens | Notes / best practice |
|---|---|---|
| Login | Authenticates; sees today's schedule | Keep session persistent to reduce friction in the field |
| Job assignment | Receives assigned jobs (push notification on new/changed jobs); reviews details & access notes | Surface gate codes, pets, parking, special instructions prominently |
| Service execution | Updates status (en route → arrived → in progress); performs treatment; captures pests found, areas, products/chemicals + quantities, photos, notes | Must work fully offline; sync later |
| Reporting | Generates service report; captures customer signature | Pre-fill from job/plan data to minimize typing |
| Job completion | Marks complete (or follow-up needed); triggers invoice/notification | Completion should auto-advance billing where applicable |

---

## 7. Admin Journey

| Stage | What happens | Notes / best practice |
|---|---|---|
| Dashboard management | Monitors today's jobs, statuses, exceptions (late, unassigned, follow-ups) | Exceptions-first view saves the most time |
| User management | Creates/edits customers and technicians; tracks tech licenses & availability | Alert on expiring certifications (future) |
| Service management | Maintains service catalog, pricing, plans; sets booking & cancellation rules | Centralized pricing prevents field inconsistencies |
| Reporting & analytics | Reviews revenue, completion rates, utilization, retention; exports compliance records | Export to PDF/CSV for audits and accounting |

---

## 8. MVP Scope

### 8.1 Version 1 — In Scope
- **Customer:** registration/login, property profile, book one-time & recurring service, view/reschedule/cancel appointments, view history & service reports, view & pay invoices, core notifications.
- **Technician:** login, daily job list, job detail, treatment & chemical capture, photos, signature, status updates, offline capture/sync, navigation hand-off, service report.
- **Admin:** customer & technician management, manual scheduling/assignment, real-time status, service catalog & pricing, recurring plan setup, invoicing, compliance records & export, basic operational dashboard.
- **Payments:** integrated payment for invoices and plan billing (recommended in MVP — see recommendation).
- **Notifications:** booking confirmation, reminder, en route, completion.

### 8.2 Postponed (Fast-follow / Future)
- Automated route optimization and auto-dispatch.
- Live technician GPS tracking / ETA.
- Two-way in-app chat (basic one-way notifications ship in MVP).
- Advanced analytics (churn, profitability).
- Reviews/ratings, referral program.
- Inventory/chemical stock management.
- Accounting/CRM integrations.
- Multi-branch / territory management.
- In-field card-present payment.

---

## 9. Business Rules

These are starting recommendations; confirm against DNR's actual policies.

### 9.1 Booking Rules
- Bookings use **time windows**, not fixed times.
- Minimum lead time for new bookings (e.g., next-day or +24h); same-day only via office.
- Recurring plans auto-generate future appointments per cadence.
- A customer property cannot have two overlapping active appointments.
- Booking confirmed only when a technician is assignable to the window (or routed to Admin queue).

### 9.2 Cancellation Rules
- Free cancellation/reschedule up to a defined cutoff (e.g., 24–48h before).
- Late cancellation may incur a fee (configurable).
- Plan cancellations subject to contract terms / notice period.
- Admin can override any cancellation rule.

### 9.3 Payment Rules
- One-time jobs: pay on booking or on completion (configurable); card-on-file recommended.
- Plans: auto-billed per cycle; failed payment triggers retry + notification.
- Invoices issued automatically on job completion.
- Refunds processed by Admin only.
- No sensitive card data stored in-app; use a PCI-compliant processor (handled at architecture stage).

### 9.4 Technician Assignment Rules
- Manual assignment by Admin in MVP.
- Assign only technicians who are available and (where relevant) licensed for the service.
- Avoid double-booking; respect working hours.
- Reassignment notifies both old and new technician and the customer if timing changes.
- Future: skills/territory/route-based auto-assignment.

---

## 10. Risks and Assumptions

### 10.1 Assumptions
- DNR is a **single business** (not multi-tenant SaaS) unless stated otherwise.
- Both residential and commercial customers are served.
- Recurring plans are a meaningful revenue share.
- Technicians often work offline.
- Chemical application logging is legally required in DNR's operating region.
- Admin uses the same Flutter app (tablet/desktop-friendly layout) rather than a separate web portal in MVP.

### 10.2 Technical Risks
| Risk | Mitigation |
|---|---|
| Reliable **offline-then-sync** with conflict handling is hard | Design sync rules early; treat as a priority workstream |
| Payment integration & PCI scope | Use a hosted/tokenized processor; never store card data |
| Push notification reliability across iOS/Android | Use a proven service; test deeply |
| Flutter performance for Admin-heavy data views | Consider tablet/web layout; paginate heavy lists |

### 10.3 Business Risks
| Risk | Mitigation |
|---|---|
| Scope creep (payments, routing, analytics) | Hold the MVP line; stage fast-follows |
| Low technician adoption if data entry is slow | Minimize typing; pre-fill; usability-test with real techs |
| Plan/contract complexity underestimated | Clarify plan terms before build |

### 10.4 Operational Risks
| Risk | Mitigation |
|---|---|
| Regulatory non-compliance in chemical logging | Validate required fields against local law before build |
| Customer/property data privacy (gate codes, etc.) | Strong access controls; clear data handling policy |
| Change management from paper to app | Plan onboarding/training and a transition period |

---

## 11. Open Questions

1. Is DNR a single company, or should this support multiple companies (multi-tenant)?
2. Residential, commercial, or both — and do they need different account/reporting structures?
3. Should **integrated payments** be in MVP, or is "invoice + pay elsewhere" acceptable initially?
4. Which region(s) do you operate in, and what are the exact chemical-application reporting requirements?
5. Will Admin use the Flutter app, or do you expect a separate web admin portal?
6. What do your service plans look like — frequencies, contract length, notice periods, warranties/re-treatments?
7. How are technicians assigned today (manual, territory, skills)? Should MVP mirror that?
8. Expected scale at launch: number of technicians, customers, and daily jobs?
9. Do customers self-register, or does Admin create accounts after a phone enquiry (or both)?
10. Existing accounting/CRM tools to integrate with later (e.g., QuickBooks)?
11. Is there an existing brand/design direction, or is that open?
12. Do you need multi-language or only one language at launch?

---

## Final Assessment

### A. MVP Recommendation
Ship a focused MVP that proves the **core loop**: *book → schedule/assign → perform with compliant documentation → sign off → invoice/pay → view history.* 

Specifically, I recommend **including integrated payments and recurring-plan billing in MVP**, because recurring revenue is the strategic core of a pest control business and bolting payments on later forces rework of the booking and invoicing flows. Keep **route optimization, live GPS tracking, two-way chat, analytics, and reviews out of MVP** — they add cost without being required to run the business on day one. Use manual dispatch in MVP and treat one-way notifications (not chat) as sufficient communication initially.

Offline-first technician capture should be treated as a first-class MVP requirement, not an afterthought — it's where field tools most often fail.

### B. Estimated Development Complexity

| Area | Complexity | Why |
|---|---|---|
| Customer module | Medium | Standard booking/history/payment flows |
| Technician module | High | Offline sync, media capture, compliance fields |
| Admin module | Medium–High | Broad CRUD, scheduling, reporting, role permissions |
| Payments & recurring billing | High | PCI scope, retries, plan cycles |
| Notifications | Medium | Cross-platform reliability |
| **Overall MVP** | **High** | Three roles, offline support, payments, and compliance in one Flutter app |

**Overall: HIGH complexity** — driven mainly by offline sync, integrated/recurring payments, multi-role permissioning, and regulatory compliance capture.

### C. Readiness Score for System Architecture Design

**Score: 7 / 10 — Conditionally ready.**

The product scope, roles, journeys, MVP boundary, and business rules are well defined. Architecture design can begin, but four answers will materially shape it and should be locked first:
1. Single-company vs multi-tenant (Q1).
2. Payments in MVP — confirmed yes is my recommendation (Q3).
3. Admin in-app vs separate web portal (Q5).
4. Chemical-logging regulatory requirements for your region (Q4).

Resolve those and the readiness score moves to ~9/10.

---

*Prepared as a discovery deliverable. On approval — and answers to the open questions — the next step is System Architecture & Technical Design.*
