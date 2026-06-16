# DNR Pest Control — Mobile App Release Strategy & Store Submission Prep

**Platforms:** Apple App Store · Google Play Store
**Context:** India-first (INR), field pest-control service. Two role experiences (Customer + Technician) from one Flutter codebase. Backend on AWS; Firebase Auth + FCM; Stripe payments; live technician GPS tracking; in-app chat.
**Policy baseline:** verified against current (mid-2026) Apple + Google requirements.

> **Scope note:** this is release *preparation* — checklists, compliance, listing content, ASO, rollout. It is not a production review of the running app. Store policies change frequently; re-verify the dated requirements in App Store Connect / Play Console at submission time.

---

## 1. Release Overview

Ship as **two public store listings per platform** — **DNR Pest Control** (customer) and **DNR Pro** (technician) — built from one Flutter codebase via flavors. The customer app is the ASO/marketing focus; the technician app is a functional tool (lighter ASO, still fully compliant). Sequence: internal testing → closed beta → **staged rollout** (soft launch in one region) → full launch. Target a submission window **outside Apple's Sept–Nov launch crush** to keep review times short — Apple currently reviews roughly 90% of submissions within about 24 hours and 98% within 48.

**Critical compliance clarification (reduces rejection risk):** pest control is a **physical, real-world service consumed outside the app**, so payments are processed via **Stripe / external payment** — Apple's In-App-Purchase requirement does **not** apply (App Review Guideline 3.1.3(e)/3.1.5 for physical goods & services). Do **not** wire IAP for bookings; do keep purchase flows free of "buy here to unlock app content" framing.

---

## 2. App Store (Apple) Submission Checklist

**Developer account**
- [ ] Apple Developer Program enrollment (Organization, with D-U-N-S) — not Individual, for a company app.
- [ ] Agreements, Tax, and Banking complete in App Store Connect (paid/commerce requires banking even though payments are external — needed for account status).
- [ ] Roles assigned (Admin / App Manager / Developer) with 2FA enforced.

**Certificates & signing**
- [ ] Apple Distribution certificate.
- [ ] App IDs (bundle IDs) for customer + technician flavors, with capabilities: Push Notifications (APNs), Sign in with Apple (if offered), Associated Domains (deep links), Maps/Location, Background Modes (location — see §7 risk).
- [ ] APNs key (.p8) for FCM.
- [ ] **App Store provisioning profiles** (Distribution) per bundle ID; prefer Xcode **automatic signing** or fastlane **match** for CI.

**Build requirements (current)**
- [ ] Built with **Xcode 26 / iOS 26 SDK or later** — required for uploads since April 28, 2026, apps must be built with Xcode 26 and the iOS 26 SDK.
- [ ] **Privacy manifest** (`PrivacyInfo.xcprivacy`) declaring data collection + required-reason APIs, including for third-party SDKs (Firebase, Stripe) — required since May 1, 2024 for apps adding listed third-party SDKs.
- [ ] ATS compliant (HTTPS only); support the two latest iOS majors; arm64.

**App Store Connect setup**
- [ ] App record (name, bundle ID, SKU, primary language en-IN).
- [ ] **Privacy Nutrition Labels** matching the privacy manifest + Data Safety (location, contact, payment, identifiers, usage).
- [ ] **Age rating** via the **new age-rating questionnaire** — Apple updated the system and requires responses to the updated age-rating questions, with ratings auto-updated as of January 31, 2026.
- [ ] Account-deletion path in-app (Apple requires apps with account creation to offer in-app deletion).
- [ ] Demo account + reviewer notes (how to log in, place a test booking, what's external-payment).
- [ ] Export-compliance answer (standard HTTPS encryption → typically exempt).
- [ ] (If distributing in the EU) **DSA trader status** verified.

---

## 3. Google Play Submission Checklist

**Developer account**
- [ ] Play Console **Organization** account, identity + D-U-N-S verified (Google's verification for org accounts), 2FA.
- [ ] Payments profile (even with external payment, for account standing).

**Play Console configuration**
- [ ] Two app entries (customer + technician).
- [ ] **Data safety form** (collection/sharing/security — location, payment, messages, identifiers; "data encrypted in transit", account-deletion link).
- [ ] **Account deletion**: in-app **and** a web URL to request deletion (Google requirement for apps with accounts).
- [ ] Content rating questionnaire (IARC).
- [ ] Target audience (adults; not directed to children) + ads declaration (no ads).
- [ ] Privacy Policy URL.
- [ ] **Permissions declarations** — especially the **background-location declaration form** if used (see §7).

**App signing / build**
- [ ] **Play App Signing** enrolled; upload **AAB** (not APK).
- [ ] **Target API level 35 (Android 15)** to submit now — new apps and updates must target Android 15 (API 35) or higher; **plan to move to API 36 (Android 16)**, which becomes required for new apps and updates on August 31, 2026.
- [ ] App bundle obfuscated (`--obfuscate --split-debug-info`) with mapping + symbols uploaded.

---

## 4. Privacy Policy Requirements

A public Privacy Policy URL is mandatory on both stores. Must disclose:

- **Data collection:** account (name, email, phone via Firebase), addresses, booking history, device + identifiers, crash/analytics.
- **Location tracking:** that the **technician** app collects location **in the background/while-in-use to enable live job tracking + ETA**, the **customer** app uses location for address/serviceability + viewing the technician en route; purpose, retention, and that it stops when off-shift.
- **Payment:** payments processed by **Stripe**; the app does not store full card numbers (PCI SAQ-A); what billing data is retained (invoices).
- **Chat/messaging:** in-app messages between customer and technician are stored to deliver the conversation; retention + moderation/abuse handling; not used for ads.
- **Third parties / sub-processors:** Firebase, Stripe, AWS, Google Maps, Twilio/SendGrid; international transfer note.
- **Rights & deletion:** how to access/delete data + account; contact.
- **India DPDP Act 2023** alignment (consent, purpose limitation, grievance officer) since the user base is India-first; align with GDPR-style language if any EU users.

---

## 5. Terms & Conditions Requirements

- Service scope (pest-control booking marketplace operated by the company), eligibility (18+), account responsibilities.
- Bookings, **cancellation & rescheduling** rules and **cancellation-fee window** (mirror the backend's 24h policy), pricing in INR, taxes.
- **Payment terms** (Stripe), refunds/chargebacks, no-show policy.
- Technician/customer conduct, prohibited use, chat acceptable-use.
- Liability limits, warranties/disclaimers (service outcomes), indemnity, governing law (India), dispute resolution.
- Changes-to-terms + termination.

## 6. Required Legal Documents

Privacy Policy · Terms of Service / EULA · Refund & Cancellation Policy · Data Processing / sub-processor list · Acceptable-Use (chat) · Cookie/tracking notice (web/admin) · DPDP-required grievance/contact notice · (EU, if applicable) DSA trader info. All reachable via public URLs and linked in both store listings + in-app Settings.

---

## 7. App Permissions Review

| Permission | Why required | Customer-facing description (Info.plist / Android rationale) |
|---|---|---|
| **Location (while-in-use)** | Customer: serviceability + address + view technician en route. Technician: navigate to jobs, check-in proximity. | *"DNR uses your location to set your service address and show your technician's live arrival."* |
| **Location (background)** — technician app only | Continuous live tracking + ETA while a job is active/en route. | *"DNR Pro uses background location to share your live position with the customer during active jobs."* |
| **Camera** | Service before/after photos, technician service reports, profile photo. | *"DNR uses the camera to capture service photos and reports."* |
| **Photos / storage** | Attach/upload images (reports, issue photos, avatar). | *"DNR needs access to your photos to upload service images."* |
| **Notifications** | Booking status, technician en-route, chat messages, reminders. | *"Enable notifications for booking updates and messages from your technician."* |

**Background location is the #1 review risk** (both stores scrutinize it). Mitigations: keep it **only in the technician app**, prefer **while-in-use** and elevate to background only during an active job, show a **prominent in-app disclosure + explicit consent before the OS prompt**, complete Google Play's **background-location declaration** with a demo video, and justify in Apple reviewer notes. Never request location the customer app doesn't need in the background.

---

## 8. Store Listing Content (Customer App)

### App Name
**DNR Pest Control — Book Experts** *(≤30 chars iOS title: "DNR Pest Control")*

### Subtitle (iOS, 30 chars)
**Book trusted pest control**

### Short Description (Google, 80 chars)
**Book trusted pest control, track your technician live, and pay securely.**

### Full Description
Keep your home and business pest-free with DNR Pest Control. Book certified technicians for termite, cockroach, rodent, mosquito, and general pest treatments in a few taps — then track your technician live on the day of service.

- **Book in minutes:** pick a service, choose a time slot, confirm your address.
- **Live tracking & ETA:** see your technician en route on the map.
- **Secure payments:** pay by card with bank-grade security (powered by Stripe); get instant invoices.
- **Plans & subscriptions:** schedule recurring treatments and save.
- **Chat with your technician:** ask questions and share photos in-app.
- **Service history & reports:** view past visits, reports, and invoices anytime.

Trusted, certified, on time. Download DNR Pest Control and book your first treatment today.

### Keywords (iOS, 100-char field)
`pest control,exterminator,termite,cockroach,rodent,mosquito,pest service,fumigation,home service`

### Promotional Text (iOS, 170 chars, updatable)
**New: recurring plans and live technician tracking. Book pest control in minutes and pay securely — your pest-free home is a tap away.**

### Feature Highlights
On-demand booking · Live GPS tracking + ETA · Secure card payments + instant invoices · Recurring service plans · In-app chat & photos · Full service history.

> **Technician app ("DNR Pro") listing** — Name: *DNR Pro — Technician*; Short: *Manage jobs, navigate, and submit service reports.*; Full description focuses on job queue, navigation, check-in, photo reports, earnings. Minimal keyword competition; mark clearly as a tool for DNR technicians to avoid "who is this for" review confusion.

---

## 9. Screenshot Strategy

Provide device-correct sizes (iPhone 6.9"/6.5"/5.5"; iPad 13"; Android phone + 7"/10" tablet). 1024×1024 App Store icon; 512×512 Play icon; Play **feature graphic** 1024×500. First 2–3 screenshots carry conversion — lead with value, use captions.

**Customer app**
| Screen | Caption | Marketing copy |
|---|---|---|
| Dashboard | **Your home, pest-free** | "Upcoming visits, plans, and quick booking in one place." |
| Booking | **Book in minutes** | "Pick a service and slot — confirmed instantly." |
| Live tracking | **Track your technician live** | "See them en route with real-time ETA." |
| Payments/invoice | **Pay securely, get instant invoices** | "Bank-grade card payments. No cash hassle." |

**Technician app**
| Screen | Caption | Marketing copy |
|---|---|---|
| Jobs | **Your day, organized** | "Assigned jobs, schedule, and details at a glance." |
| Navigation | **Navigate to every job** | "Turn-by-turn directions and check-in." |
| Reports | **Report from the field** | "Capture photos and submit service reports on site." |

Use a consistent device frame + brand-green (#1E8E5A) background panels; localize text for target regions; avoid status-bar clutter and real PII in captures.

---

## 10. App Icons & Branding Requirements

- **iOS:** 1024×1024 (no alpha/rounded corners — Apple masks); all asset-catalog sizes generated.
- **Android:** **adaptive icon** (foreground + background layers, safe zone), legacy 512×512, monochrome layer for themed icons.
- Brand: green **#1E8E5A**, consistent logomark across both flavors (Pro variant visually distinct, e.g. badge/colorway), high-contrast on light/dark; no copyrighted/again-store-trademark imagery; icons free of text where possible.

---

## 11. Beta Testing Strategy

1. **Internal testing** — Play **Internal testing** track + **TestFlight internal** (≤100 testers, no review) for the core team; smoke the critical flows on real devices.
2. **Closed beta** — TestFlight external groups + Play **Closed testing** with a recruited group of real customers + a pilot set of technicians; gather crash/ANR + UX feedback (Play requires a closed-testing track history for new personal accounts; org accounts plan it anyway).
3. **Open/soft beta (optional)** — Play **Open testing** in the soft-launch region before full production.
Wire **Sentry** + store vitals (Play Android vitals, Xcode Organizer) during beta; define exit criteria (crash-free ≥99.5%, no P1 bugs, payment + tracking validated end-to-end).

---

## 12. Release Rollout Plan

- **Soft launch:** one metro/region (e.g. a single city) at **staged rollout 5–10%** on Play; phased release on App Store. Validate booking→assignment→tracking→payment→invoice on production infra and watch vitals + Sentry.
- **Regional launch:** expand to additional Indian metros; ramp Play staged rollout 10→25→50→100% as metrics hold.
- **Full launch:** nationwide; enable promotional text + ASO experiments; coordinate marketing.
Keep the ability to **halt rollout** (Play) / **phased-release pause** (App Store) if crash-free or payment-success dips.

---

## 13. ASO Recommendations

- **Keyword strategy:** target high-intent + local terms — "pest control near me", "exterminator", "termite/cockroach/rodent control", "[city] pest control". iOS: fill the 100-char keyword field with non-duplicated, comma-separated terms (don't repeat words from the title). Android: weave keywords naturally into title/short/full description (Play indexes the description).
- **Conversion optimization:** strong first 2 screenshots + caption value props; localized listing (en-IN, + Hindi/regional as you expand); compelling icon; ratings prompts after a successful service (not mid-flow); respond to reviews; run **Play store-listing experiments** and **App Store product-page optimization (PPO)** A/B tests on icon/screenshots; keep the promotional text fresh around campaigns.
- Seed early **ratings/reviews** via the closed beta + post-service in-app prompts (policy-compliant, no incentivized reviews).

---

## 14. App Review Risk Assessment

| Risk | Likelihood | Mitigation |
|---|---|---|
| **Background location** justification (both stores) | High | Technician-app only; while-in-use default + active-job elevation; prominent disclosure + consent; Play declaration + demo video; reviewer notes |
| **Payments / IAP confusion** | Medium | Document that bookings are **physical services** → external payment is allowed; no "unlock content" framing; reviewer note citing 3.1.3(e)/3.1.5 |
| **Incomplete privacy data** (labels ≠ manifest ≠ data-safety) | Medium | Single source of truth; reconcile Apple labels + manifest + Play Data Safety; list all SDKs |
| **Account deletion missing** | Medium | In-app deletion + web URL on both stores |
| **Demo/login for review** | Medium | Provide working demo customer + technician accounts + seeded data |
| **UGC/chat moderation** | Medium | Report/block + abuse handling + acceptable-use terms (Apple 1.2 UGC) |
| **Min functionality / "is this a web wrapper"** | Low | Native flows, offline-friendly, real device features |
| **Permissions over-ask** | Low | Request only what's used, at point-of-use, with rationale |
| **Stale links/metadata** | Low | Verify all URLs (privacy, support, marketing) live before submit |

---

## 15. Launch Checklist

- [ ] Both flavors build with current SDKs (iOS 26 / API 35) and pass CI (lint/tests/coverage)
- [ ] Signing: Apple Distribution + provisioning; Play App Signing + AAB
- [ ] Privacy: manifest + Nutrition Labels + Data Safety reconciled; Privacy Policy + ToS live
- [ ] Account deletion (in-app + web URL) verified
- [ ] Permissions: rationale strings + background-location disclosure/declaration done
- [ ] Demo accounts + reviewer notes (external-payment explanation) prepared
- [ ] Store listings: names, descriptions, keywords, promo text, icons, screenshots, feature graphic
- [ ] Age/content ratings completed (new Apple questionnaire + IARC)
- [ ] Crash reporting (Sentry) + store vitals wired; deep links verified
- [ ] Beta exit criteria met (crash-free ≥99.5%, payment + tracking validated)
- [ ] Staged rollout configured + rollback/pause plan ready
- [ ] Support channel + reviews-response owner assigned

---

## 16. Release Readiness Score

**Readiness Score: 68 / 100 — strong product + plan; gated on store-compliance assets + the app-prereqs from prior reviews.**

The feature set maps cleanly to compliant store experiences, payments are correctly external (avoids the most common rejection), and the rollout/beta plan is sound. The score is held down by **deliverables that don't exist yet** (privacy policy/ToS URLs, privacy manifest + labels + data-safety, account-deletion flow, background-location disclosure + Play declaration, store creatives) and by **dependencies carried over from earlier reviews** (the app needs the wired backend `main.ts`/health, and the Flutter **Step 40 integration** is unfinished — the app must be functionally complete + stable before submission).

**Risks:** background-location approval; privacy-disclosure consistency across three forms; account-deletion requirement; unfinished app integration blocking a stable build; review-window timing.

**Recommendations:** finish the Flutter integration + stabilize a release build first; draft Privacy Policy/ToS (DPDP-aligned) early; build the privacy manifest + reconciled labels; implement in-app + web account deletion; prepare the background-location disclosure + Play declaration video; produce localized creatives; run closed beta to seed ratings + validate the booking→tracking→payment journey on production. Target an **off-peak submission window**.

With those assets produced and a stable build, estimated **88–90 / 100** (submission-ready).

---

*Prepared as release preparation (not a production review). Dated store requirements (SDK levels, target API, privacy/age-rating rules) change frequently — re-verify in App Store Connect and Play Console at submission time. App-store-internal review outcomes cannot be guaranteed; this maximizes approval readiness.*
