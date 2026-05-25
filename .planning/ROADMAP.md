# Roadmap: Solaryn AR Landing Page

**Created:** 2026-05-26
**Granularity:** coarse
**Mode:** standard (horizontal layers)
**Core Value:** Convert FB/IG ad clicks into qualified, callable leads (form submitted with valid phone + complete address) — each lead represents a 150 MAD COD pending order

## Phases

- [ ] **Phase 1: Backend Foundation & Sheet Provisioning** - New dedicated Google Sheet provisioned, additive `appendArLead()` helper, hardened `/api/ar-lead` endpoint (validation + phone normalization + anti-spam + server-side CAPI)
- [ ] **Phase 2: Landing Page Build (HTML + RTL + Form + Pixel)** - Mobile-first RTL darija page at `/ar` with above-fold hero, 5-field COD form, FB Pixel client integration, server-confirmed redirect, `/ar/merci` thank-you
- [ ] **Phase 3: Content Localization & Trust Signal Polish** - Native MA darija copy review, real testimonials with first name + city, courier logo confirmation, MA-localized trust signals (COD badge, callback expectation), compliance check vs product-claims rules
- [ ] **Phase 4: Performance, QA, Deploy & Monitoring** - LCP < 2.5s on throttled 3G, Lighthouse ≥ 85 mobile, end-to-end sentinel test, Meta Test Events Pixel+CAPI dedup verified, PII audit, existing-pages smoke test, daily monitoring

## Phase Details

### Phase 1: Backend Foundation & Sheet Provisioning
**Goal**: A POST to `/api/ar-lead` with a valid MA lead payload writes exactly one canonical row to the new `Solaryn AR Leads` sheet, fires a deduplicated server-side CAPI `Lead`, and rejects bots/non-MA traffic — all before any user-facing surface is built
**Depends on**: Nothing (first phase)
**Requirements**: BACK-01, BACK-02, BACK-03, BACK-04, BACK-05, BACK-06, BACK-07, BACK-08, FORM-03, TRACK-04, TRACK-05, TRACK-07, SEC-02, SEC-03, SEC-04, SEC-05, SEC-06, SEC-07
**Success Criteria** (what must be TRUE):
  1. NEW Google Sheet `Solaryn AR Leads` exists, header row A1:H1 set, shared with the service-account email as Editor, and its ID is configured in Vercel as `AR_LEADS_SHEET_ID` across Production + Preview + Development
  2. A valid `curl POST` to `/api/ar-lead` (5 required fields + `x-vercel-ip-country: MA`) returns `{ok:true}` AND appends one canonical row (`+212XXXXXXXXX` phone, ISO timestamp, fbp|fbc) to the new sheet within ~2s
  3. Invalid submissions are rejected with generic error codes (no PII echo): bad phone → `invalid_phone`, missing field → `missing_field`, sheet write fails → 500 (never swallowed)
  4. Anti-spam layers reject silently or with 4xx: honeypot filled → 200 with no sheet write, time-to-submit < 2s → reject, `x-vercel-ip-country !== 'MA'` → reject (testing-flag overrideable), URL/Cyrillic/Chinese in name fields → reject
  5. Server fires Meta CAPI `Lead` event with SHA-256-hashed phone/first-name/city and a shared `event_id` UUID; `META_CAPI_ACCESS_TOKEN` is set as a server-only env var (never `NEXT_PUBLIC_*`); no PII ever appears in `console.log`
**Plans**: TBD

### Phase 2: Landing Page Build (HTML + RTL + Form + Pixel)
**Goal**: A visitor from a FB/IG ad lands on `/ar`, sees a fast-rendering RTL darija page with hero + price + form, submits the 5-field form, and is redirected to `/ar/merci` only after the server confirms the lead — with a matching Pixel `Lead` event fired client-side
**Depends on**: Phase 1 (form needs working backend)
**Requirements**: LAYOUT-01, LAYOUT-02, LAYOUT-03, LAYOUT-04, LAYOUT-05, LAYOUT-06, FORM-01, FORM-02, FORM-04, FORM-05, FORM-06, FORM-07, FORM-08, TRACK-01, TRACK-02, TRACK-03, TRACK-06, CONFIRM-01, CONFIRM-02, CONFIRM-03, CONFIRM-04, SEC-01
**Success Criteria** (what must be TRUE):
  1. `https://solaryn-five.vercel.app/ar` returns a single mobile-first RTL HTML file (`<html lang="ar" dir="rtl">`, CSS scoped under `page-ar` prefix with logical properties only) that renders correctly at 320-1200px viewport
  2. Above-the-fold hero shows product image + "150 درهم — التوصيل مجاني" + scroll-to-form CTA without scrolling at 360×640 viewport; 3-5 darija benefit bullets with icons appear below
  3. The 5-field form (prénom, nom, tél, ville, adresse) submits via `fetch` JSON POST to `/api/ar-lead` with: phone hardened (`type=tel inputmode=numeric dir=ltr pattern`), address min-length ≥10 chars, all fields have correct `autocomplete` attributes, honeypot field included, hidden `data-rendered-at` timestamp included, fbp/fbc cookies forwarded
  4. On `res.ok && body.ok === true` the client fires `fbq('track','Lead',{value:150,currency:'MAD'},{eventID:<uuid>})` with the same UUID sent to the server, then redirects to `/ar/merci`; on failure shows an inline darija error and stays on the form
  5. `/ar/merci` renders the darija thank-you (no further CTA), fires Pixel `PageView` only (no duplicate `Lead`), and guards against direct/bookmark access (referrer check or session token) to prevent Pixel pollution
**Plans**: TBD
**UI hint**: yes

### Phase 3: Content Localization & Trust Signal Polish
**Goal**: Every visible string and trust signal on `/ar` and `/ar/merci` is darija-native, MA-localized, and compliance-cleared — so that a Moroccan woman 25-45 reads the page as trustworthy local commerce, not foreign scam
**Depends on**: Phase 2 (needs page surface to localize)
**Requirements**: LAYOUT-04 (compliance side), TRUST-01, TRUST-02, TRUST-03, TRUST-04, TRUST-05
**Success Criteria** (what must be TRUE):
  1. A native MA darija reviewer has approved every user-facing string: hero, benefits, form labels, placeholders, errors, callback copy, merci page — no Fus'ha, no Arabizi, no pharma/medical jargon
  2. "الدفع عند الاستلام" badge is visible BOTH near the price AND near the submit button; "غادي نعيطو ليك باش نأكدو الطلب" callback copy appears near the form
  3. Local courier logo + "توصيل لجميع المدن المغربية" appears (Sendit / Speedaf / Amana — courier partner confirmed and logo usage rights validated)
  4. Social proof strip shows minimum 2-3 testimonials with realistic Moroccan first name + city (e.g. "نادية، الدار البيضاء"), OR an approved "+X clientes satisfaites" fallback if real testimonials are not yet available
  5. No foreign trust signals appear anywhere (no $ / € prices, no Visa/Stripe/SSL badges, no foreign-model imagery); compliance check confirms no disallowed claims per product-claims memory (no pregnancy/baby/Argan-Aloe/zero-chemicals)
**Plans**: TBD

### Phase 4: Performance, QA, Deploy & Monitoring
**Goal**: Before any ad budget is spent, the page meets mobile performance targets, every silent-failure mode has been actively tested, and ongoing monitoring exists to catch divergence between Pixel leads, Sheet rows, and Vercel invocations
**Depends on**: Phase 1, Phase 2, Phase 3
**Requirements**: PERF-01, PERF-02, PERF-03, PERF-04, PERF-05, PERF-06, QA-01, QA-02, QA-03, QA-04, QA-05, QA-06
**Success Criteria** (what must be TRUE):
  1. Lighthouse mobile audit on the deployed `/ar` URL shows LCP < 2.5s on throttled 3G + CPU 4× slowdown, Performance score ≥ 85; hero is WebP ≤ 80KB @ 480w with `srcset` + `fetchpriority="high"`, Cairo font reused from existing site cache, critical CSS inlined, FB Pixel script `async` (non-render-blocking)
  2. Sentinel test passes end-to-end: manual submission with `prenom: "TEST_SENTINEL_<date>"` appears as a row in the live `Solaryn AR Leads` sheet within 10 seconds, AND Meta Events Manager → Test Events shows both Pixel + CAPI `Lead` events with matching `eventID` (deduplication confirmed)
  3. Negative tests pass: honeypot submission returns 200 but writes nothing to the sheet and fires no Pixel event; non-MA country header is rejected; bot-speed submission (< 2s) is rejected
  4. Cross-device verification: page renders + form submits cleanly on real Android Chrome AND real iOS Safari at 320px viewport on both 4G and throttled 3G
  5. Regression smoke test passes: `/`, `/affiliates`, `/kit`, `/admin`, `/api/add-lead` all return 200 and function unchanged post-deploy; PII audit grep finds zero `console.log` of any form field and zero PII in GET params, URL fragments, or error response bodies
**Plans**: TBD

## Phase Dependencies

```
Phase 1 (Backend) → Phase 2 (Frontend) → Phase 3 (Content polish) → Phase 4 (QA + Launch)
                                       ↗ (Phase 3 parallelizable with Phase 2 — content gates launch independently)
```

Phase 1 must complete first (frontend depends on working endpoint). Phase 3 can begin in parallel with Phase 2 since content production is independent of code. Phase 4 hardens everything and gates the ad spend launch.

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Backend Foundation & Sheet Provisioning | 0/0 | Not started | - |
| 2. Landing Page Build (HTML + RTL + Form + Pixel) | 0/0 | Not started | - |
| 3. Content Localization & Trust Signal Polish | 0/0 | Not started | - |
| 4. Performance, QA, Deploy & Monitoring | 0/0 | Not started | - |

## Coverage

- v1 requirements: 51 total
- Mapped to phases: 51
- Unmapped: 0 ✓
- No duplicates across phases ✓

See REQUIREMENTS.md Traceability table for exact phase mapping per requirement.

## Out of Scope (v1)

Deferred to v2 per REQUIREMENTS.md:
- DIFF-01 to DIFF-07 (sticky CTA, FAQ accordion, WhatsApp click-to-chat, before/after imagery, UGC video, specific delivery SLA copy, server-side phone dedup)
- SCALE-01 to SCALE-04 (lighter Sheets SDK migration, DB migration, cron healthcheck, IP rate limit)

---
*Roadmap created: 2026-05-26*
*Last updated: 2026-05-26 after initial roadmap creation*
