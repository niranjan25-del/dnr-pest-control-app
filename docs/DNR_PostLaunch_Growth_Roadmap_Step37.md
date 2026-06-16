# DNR Pest Control — Post-Launch Operations & 12-Month Growth Roadmap
**Step 37 · Executive Growth Plan**
Prepared by: Chief Product Officer / Growth Strategist / Customer Success Director / Operations Consultant
Market: India (INR) · Field-service pest control · Single-company → multi-city trajectory

> **One grounding note (not a blocker to this plan):** two launch conditions from the readiness review directly shape sections below and should be confirmed closed early. **Review collection** (Customer Success) depends on the backend **Reviews & Ratings module** — if it isn't live yet, treat review collection as a Week-2/3 item gated on that ship. **The KPI/analytics dashboards** below assume analytics instrumentation is wired (Firebase is integrated in the app; event tracking must be turned on). Everything else proceeds as written.

---

## 1. First 7 Days Plan — Stabilize & Watch

The first week is about **proving the system holds under real traffic** and that the human workflows (support, dispatch) function — not growth.

**System monitoring (daily, war-room cadence):** watch the golden signals — API p95 latency, 5xx rate, ECS CPU/memory, RDS connections/CPU, Redis health, payment success rate, push-delivery rate. Hold a 15-minute daily ops standup on these numbers. Tune alarm thresholds to cut noise in the first 48h.

**Error tracking:** triage Sentry (backend/admin) + Crashlytics (mobile) by volume × severity, correlating via `request_id`. Any auth, payment, or permission anomaly is P1. Keep a hotfix path warm; expect 1–2 small fixes in week one (endpoint contract edge cases, a validation message, a timezone display).

**Customer support workflow:** single intake (in-app chat + a support inbox + a phone line — Indian customers expect phone). Tiered: Tier-1 (booking/payment/app questions) → Tier-2 (technical/dispute) → engineering (bugs). Target first-response < 1h business-hours in week one. Log every ticket; the week-one ticket themes become your FAQ and your first bug backlog.

**Technician support workflow:** a dedicated technician channel (WhatsApp group + an ops dispatcher on call) for app issues mid-job (assignment not showing, GPS, photo upload, signature). Dispatchers monitor the admin live board; any technician blocked in the field gets a < 15-min response. Capture every field issue — these reveal the real-world rough edges no test caught.

**Exit criteria for week 1:** zero unresolved P1s, payment success > 98%, no auth/security anomalies, scheduled jobs (renewals/reminders) confirmed firing, and a triaged bug backlog.

---

## 2. First 30 Days Plan — Establish Baselines

Month one converts "it works" into **measured baselines** you'll optimize against. Track and chart from day one:

- **Active users** (DAU/WAU/MAU, customer + technician) — the denominator for everything.
- **Booking conversion rate** — installs → registration → first booking; and session → booking. This is the funnel that funds the business.
- **Revenue** — daily GMV, average booking value, subscription vs one-off mix, refund rate.
- **Customer retention** — repeat-booking rate, 30-day return rate, subscription activation rate.
- **Technician performance** — jobs/day, on-time %, completion rate, average rating (post-Reviews), reschedule/no-show rate.

**Goal of month one:** a clean baseline for each, a weekly trend, and the top-3 conversion leaks identified (e.g., registration drop-off, payment abandonment, slot unavailability). Don't optimize yet — measure, then prioritize.

---

## 3. KPI Dashboard

| Cadence | KPIs |
|---|---|
| **Daily** | Bookings created/completed · GMV · payment success rate · app crash-free rate · API error rate · new registrations · active technicians · support tickets opened/closed |
| **Weekly** | Booking conversion funnel · repeat-booking rate · subscription net adds · average rating · technician utilization · CAC by channel · WoW revenue growth · NPS (rolling) |
| **Monthly** | MRR + churn + net revenue retention · LTV:CAC · cohort retention curves · city-level unit economics · refund/dispute rate · feature adoption (subscriptions, chat, tracking) · technician attrition |

Build this on the admin analytics already shipped (executive dashboard + revenue/booking/customer/technician/subscription tabs) and layer product-analytics funnels (§7) on top.

---

## 4. Customer Success Strategy

**Onboarding:** make the first booking effortless — guided first-time flow, address + service-area validation upfront (so customers never hit "no coverage" late), transparent INR pricing, and a confirmation with technician ETA. Send a welcome message (WhatsApp/email) with what to expect on visit day. First-visit experience is the single biggest retention lever in field service.

**Review collection (gated on the Reviews module):** trigger a review request **immediately after service completion** (push + in-app), one tap, 5-star + optional comment. Auto-update the technician's rating. Route 4–5★ to a Google review prompt (compounds local SEO, §6); route 1–3★ to a service-recovery flow (support reaches out within 2h). This loop is both a retention and an acquisition engine.

**Retention campaigns:** seasonal pest reminders (monsoon → mosquito/termite; summer → ants/cockroaches), subscription nudges after a 2nd one-off booking, win-back offers for lapsed customers at 60/90 days, and a "your technician is available again" re-book prompt. Personalize by pest history.

---

## 5. Technician Success Strategy

**Training:** an onboarding module (app usage, safety, chemical handling, customer etiquette, photo/signature/report discipline) + ongoing micro-training on low-scoring areas surfaced by reviews. Certification/license tracking already exists in the model — operationalize verification.

**Performance tracking:** a per-technician scorecard (jobs completed, on-time %, rating, completion rate, reschedule/no-show, revenue generated) from the analytics already built. Monthly 1:1s on the scorecard; coach the bottom quartile, recognize the top.

**Incentives:** tiered earnings (base + per-job + rating bonus), a monthly top-performer reward, completion-streak and on-time bonuses, and a referral bounty for recruiting quality technicians (your supply constraint at scale). Tie a portion of incentive to rating + on-time to align with customer experience.

---

## 6. Marketing Roadmap

**Local SEO + Google Business Profile (highest ROI for field service):** fully optimized GBP per service city — categories, service areas, photos, Q&A, and a steady review flow (from §4). Local landing pages per city/pest type targeting "pest control near me / termite control \<city\>". This is the cheapest durable acquisition channel in India for home services.

**Paid:** **Google Ads** on high-intent local keywords (search + Local Services Ads where available) — start here, intent is highest. **Facebook/Instagram Ads** for awareness + retargeting (seasonal pest creatives, subscription offers). Layer **JustDial/Sulekha** presence (India home-services intent) and **WhatsApp** as a conversion + retention channel (Indian customers convert on WhatsApp).

**Referral program:** two-sided incentive (referrer + referee both get INR credit on the next booking), surfaced post-positive-review and post-completion. Word-of-mouth is dominant in local home services; instrument it.

**Sequence:** Month 1–2 GBP + local SEO + referral (cheap, compounding). Month 2–4 add Google Ads. Month 3+ scale FB/retargeting once funnel + LTV:CAC are proven.

---

## 7. Product Analytics Strategy

**Stack:** **Firebase Analytics** (already integrated — turn on event tracking) for mobile baseline + Crashlytics for stability. Add **Mixpanel** *or* **PostHog** for funnels/cohorts/retention (PostHog if you want self-hostable + session replay + India data-residency control under DPDP; Mixpanel for fastest product-analytics UX). Don't run both — pick one.

**Events to track (grounded in the real app flows):** `app_open`, `sign_up_started/completed`, `address_added`, `service_viewed`, `booking_started`, `slot_selected`, `payment_started`, `payment_succeeded/failed`, `booking_completed`, `review_prompt_shown`, `review_submitted`, `subscription_viewed/started/paused/cancelled`, `chat_opened`, `technician_tracked`. Technician side: `assignment_received/accepted`, `navigation_started`, `photos_uploaded`, `signature_captured`, `report_submitted`.

**Funnels to track:** **Acquisition** (install → sign-up → first booking), **Conversion** (service view → booking → payment success), **Activation** (first booking → 2nd booking / subscription), **Technician** (assignment → completion), **Review** (completion → review submitted). Watch drop-off at each step weekly.

---

## 8. Feature Roadmap

**Version 2.0 (months 4–8) — deepen the core:**
- **AI Pest Identification** — customer photographs the pest → suggests service + pricing (cuts booking friction, a strong differentiator). Leverages the media pipeline already built.
- **Smart Scheduling** — optimize technician routing/slotting by location + availability + skill (the assignment + GPS foundations exist); raises utilization (your margin lever).
- **Customer Loyalty Program** — points/tiers on bookings + subscriptions, redeemable for discounts; compounds retention.

**Version 3.0 (months 9–14) — platformize for multi-city/franchise:**
- **Franchise Management** — onboard independent operators under the brand with isolated ops + revenue share.
- **Multi-Location Support** — region/branch hierarchy, location-scoped admin roles, per-city pricing/catalog.
- **White-Label Platform** — re-skin + tenant-isolate the stack to license to other service businesses (a second revenue model).

Sequence v2 to defend and grow the core before v3 expands the business model.

---

## 9. Scaling Roadmap (operational, not just technical)

- **1 city (now → month 4):** prove unit economics in one city. Dense technician coverage, tight ops loop, GBP + referral dominance locally. Don't expand until LTV:CAC > 3 and repeat-rate is healthy. Technically: MVP infra holds (Step 35).
- **10 cities (months 5–12):** replicable city-launch playbook (technician recruitment, GBP setup, local SEO, demand seeding). Multi-location support (v3) becomes load-bearing; regional dispatchers; per-city pricing. Technically: Growth tier — Redis active, read replica, queues.
- **100 cities (year 2+):** franchise + white-label to scale supply without owning every technician; centralized brand/quality + local operators. Technically: Enterprise tier — multi-region, sharded Redis, partitioned data, warehouse BI.

**The constraint at every tier is technician supply + quality, not software.** Build recruitment + training + incentive machinery as deliberately as the product.

---

## 10. Revenue Growth Plan

- **Subscription growth (the flywheel):** convert one-off customers to recurring plans (monsoon/annual shields). Target a rising subscription mix — recurring revenue is the valuation and stability driver. Nudge after the 2nd booking; bundle a discount + priority scheduling.
- **Upsell:** premium/comprehensive packages, add-on treatments, priority/same-day slots, extended warranty on treatments.
- **Cross-sell:** adjacent services (sanitization, disinfection, deep-clean) to the existing base; seasonal pest-specific campaigns; B2B (offices, restaurants, societies) as a higher-AOV segment.
- **Pricing:** dynamic seasonal pricing; city-level price optimization once data supports it.

Recurring + upsell on the existing base is far cheaper than new acquisition — prioritize NRR.

---

## 11. Operational Risk Review

| Type | Risk | Mitigation |
|---|---|---|
| **Business** | Technician supply/quality can't keep up with demand → poor experience, churn | Recruitment + incentive engine from day one; rating-gated dispatch; cap growth to supply |
| **Business** | Seasonality (monsoon spikes, lean months) → uneven cash flow | Subscriptions smooth revenue; off-season cross-sell; flexible technician capacity |
| **Business** | Reputation risk from a bad visit (amplified by reviews) | Service-recovery flow on low ratings; QA on technician scorecards; insurance |
| **Technical** | Scaling constraints (in-memory state) under growth | Execute the Redis/queue/replica plan before 10k (Step 33) |
| **Technical** | The known feature/security conditions if not fully closed | Confirm Reviews module + P0 security closed (Step 36 conditions) |
| **Technical** | Third-party dependency (Stripe/Firebase/Maps) outage or cost | Graceful degradation, monitoring, budget alerts on Maps/FCM quotas |
| **Staffing** | Key-person risk (small team owns critical systems) | Documentation, on-call rotation, cross-training; hire SRE/ops as you scale |
| **Staffing/Compliance** | PII/location/payment handling under DPDP Act | Privacy policy + consent + deletion flows; data-residency (ap-south-1); periodic audit |

---

## 12. Executive Dashboard (Founder View)

**Weekly (operating rhythm):** GMV + WoW growth · bookings + conversion rate · payment success rate · repeat-booking rate · subscription net adds · average rating · CAC by channel · support ticket volume + first-response time · top 3 product/ops issues.

**Monthly (strategic):** MRR + churn + **net revenue retention** · **LTV:CAC** by channel · cohort retention curves · **city-level unit economics** (contribution margin) · technician supply/utilization/attrition · cash runway · feature adoption · NPS. These are the numbers that decide when to expand a city and when to raise.

---

## 13. 12-Month Strategic Roadmap

- **Q1 — Stabilize & Baseline:** close any launch conditions; nail ops/support/dispatch; establish KPI baselines; GBP + local SEO + referral live; instrument analytics. *Goal: a reliable, measured single-city engine.*
- **Q2 — Optimize & Acquire:** fix the top conversion leaks; launch Google Ads; drive subscription mix + reviews; harden for scale (Redis/queues). *Goal: LTV:CAC > 3, healthy repeat-rate, growth tier ready.*
- **Q3 — Expand & Deepen:** city-launch playbook → first 3–5 new cities; ship v2.0 (AI pest ID, smart scheduling, loyalty); scale paid + retargeting. *Goal: multi-city proof + product differentiation.*
- **Q4 — Platformize & Scale:** to ~10 cities; begin v3.0 (multi-location/franchise foundations); B2B segment; evaluate white-label. *Goal: repeatable expansion + a second revenue model in motion.*

---

## 14. Final Recommendations

**Top 10 priorities after launch:**
1. Confirm the launch conditions are fully closed (Reviews module, P0 security) — they gate review collection + trust.
2. Stand up the ops loop: support + dispatch + technician channel with SLAs.
3. Instrument analytics + the KPI dashboard; establish baselines.
4. Win local SEO + GBP + the review loop in the launch city (cheapest durable growth).
5. Launch the two-sided referral program.
6. Drive subscription conversion (the recurring-revenue flywheel).
7. Build the technician recruitment + training + incentive engine (your real constraint).
8. Fix the top-3 conversion leaks from funnel data.
9. Execute the Redis/queue/replica scaling step before pushing volume.
10. Prove single-city unit economics (LTV:CAC > 3) before expanding.

**Biggest growth opportunities:** subscription/recurring revenue + NRR on the existing base; local-SEO + review-loop compounding; AI pest ID as a differentiator; franchise/white-label as a capital-efficient multi-city + second revenue model.

**Biggest risks:** technician supply/quality (the binding constraint), unproven unit economics if you expand too early, the in-memory scaling constraint under growth, and DPDP/compliance exposure on PII/location/payments. Manage these and the platform's quality becomes a durable advantage.

---

**Bottom line:** the engineering is done; the next 12 months are won or lost on **operations, technician supply, the local-SEO/review flywheel, and recurring revenue.** Prove one city's economics, build the city-launch playbook, ship v2 to differentiate, then platformize for scale. The software will keep up if you execute the scaling steps on schedule — the business will be decided by execution on the ground.
```
