# Requirements: Solaryn AR Landing Page

**Defined:** 2026-05-26
**Core Value:** Convert FB/IG ad clicks into qualified, callable leads (form submitted with valid phone + complete address) — each lead represents a 150 MAD COD pending order

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Layout & Page Structure

- [ ] **LAYOUT-01**: Mobile-first responsive layout (works 320-1200px viewport, 95 % of traffic is mobile)
- [ ] **LAYOUT-02**: Full RTL layout via `<html lang="ar" dir="rtl">` + CSS logical properties (no margin-left/right)
- [ ] **LAYOUT-03**: Above-the-fold hero with product image, price "150 درهم — التوصيل مجاني", and CTA scrolling to form
- [ ] **LAYOUT-04**: 3-5 scannable darija benefit bullets with icons (respect product-claims rules — no medical/pregnancy/baby/zero-chemicals claims)
- [ ] **LAYOUT-05**: Page deployed at route `/ar` (file `ar.html` at repo root, served via existing `cleanUrls`)
- [ ] **LAYOUT-06**: CSS scoped to landing (class prefix `page-ar` or similar) — zero bleed to existing pages

### Form & Capture

- [ ] **FORM-01**: 5-field COD form, all required: prénom, nom, téléphone (WhatsApp), ville, adresse
- [ ] **FORM-02**: Phone field hardening — `type="tel" inputmode="numeric" dir="ltr" pattern="0[5-7][0-9]{8}|\+212[5-7][0-9]{8}"` with darija placeholder
- [ ] **FORM-03**: Server-side phone normalization — convert Arabic-Indic digits (٠-٩) to Western, canonicalize to `+212XXXXXXXXX`
- [ ] **FORM-04**: Address field min-length validation (≥10 chars; reject single-word like "Casa", "Maroc")
- [ ] **FORM-05**: All form fields use `autocomplete` attributes (`given-name`, `family-name`, `tel`, `address-level2`, `street-address`)
- [ ] **FORM-06**: Form submits via `fetch` POST `/api/ar-lead` (no full page reload), with darija loading state
- [ ] **FORM-07**: Client redirects to `/ar/merci` ONLY on `res.ok && body.ok === true` (server-confirmed)
- [ ] **FORM-08**: Inline darija error message on validation/network failure (no silent failure)

### Trust Signals (MA-Localized)

- [ ] **TRUST-01**: Visible "الدفع عند الاستلام" badge near price AND near submit button
- [ ] **TRUST-02**: Local courier logo + text "توصيل لجميع المدن المغربية"
- [ ] **TRUST-03**: Callback expectation copy near form ("غادي نعيطو ليك باش نأكدو الطلب")
- [ ] **TRUST-04**: Social proof strip — minimum 2-3 testimonials with Moroccan first name + city, OR "+X clientes satisfaites" fallback
- [ ] **TRUST-05**: Prices in MAD only — no $ / € / Visa / Stripe / SSL badges (those signal "foreign scam" in MA)

### Backend (API + Sheet)

- [ ] **BACK-01**: NEW Google Sheet `Solaryn AR Leads` created and shared with service-account email as Editor; header row A1:H1 set
- [ ] **BACK-02**: NEW endpoint `api/ar-lead.js` accepts POST only, returns JSON `{ok, error?}`
- [ ] **BACK-03**: Endpoint validates all 5 fields with `clean()` + `validPhone()` from existing `api/_lib.js`
- [ ] **BACK-04**: Endpoint appends single row to NEW Sheet via additive `appendArLead()` export in `api/_sheets.js` (reuses existing cached `getSheetsClient()`)
- [ ] **BACK-05**: Row format: `[timestamp_iso, prenom, nom, "'+212XXXXXXXXX", ville, adresse, source, fbp|fbc]`
- [ ] **BACK-06**: Environment variable `AR_LEADS_SHEET_ID` added to Vercel (Production + Preview + Development)
- [ ] **BACK-07**: `engines.node` pinned to `22.x` in `package.json`
- [ ] **BACK-08**: Endpoint returns 500 if Sheet append throws (no swallowing errors)

### Tracking (FB Pixel + CAPI)

- [ ] **TRACK-01**: Meta Pixel base inline in `<head>` of `ar.html` only (NOT global, not via shared header)
- [ ] **TRACK-02**: Pixel fires `PageView` on `ar.html` load
- [ ] **TRACK-03**: Pixel fires `Lead` event with `{value: 150, currency: 'MAD', eventID: <uuid>}` AFTER server confirms `ok === true`
- [ ] **TRACK-04**: Server-side Meta CAPI `Lead` event sent from `api/ar-lead.js` with same `eventID` for deduplication
- [ ] **TRACK-05**: CAPI `user_data` contains SHA-256 hashed phone (canonical), first name, city — hashed server-side, never sent to browser
- [ ] **TRACK-06**: Client captures `_fbp` and `_fbc` cookies and forwards in form payload (col H of Sheet)
- [ ] **TRACK-07**: `META_PIXEL_ID` and `META_CAPI_ACCESS_TOKEN` env vars on Vercel (CAPI token NEVER `NEXT_PUBLIC_*`)

### Confirmation Page

- [ ] **CONFIRM-01**: Static file `ar/merci.html` accessible at `/ar/merci`
- [ ] **CONFIRM-02**: Darija thank-you message + callback expectation, no further CTA
- [ ] **CONFIRM-03**: Guard against direct access (referrer check OR session token) to avoid Pixel pollution
- [ ] **CONFIRM-04**: Fires Pixel `PageView` only (no duplicate Lead from this page)

### Performance

- [ ] **PERF-01**: Largest Contentful Paint (LCP) < 2.5s on Moz throttled 3G + CPU 4× slowdown
- [ ] **PERF-02**: Hero image WebP format, ≤ 80KB, 480w with `srcset` for retina, `fetchpriority="high"`
- [ ] **PERF-03**: Cairo font reused from existing site cache (already loaded by `affiliates.html`)
- [ ] **PERF-04**: Critical CSS inlined in `<head>`; non-critical deferred or removed
- [ ] **PERF-05**: FB Pixel script loaded async; doesn't block render or form submission
- [ ] **PERF-06**: Lighthouse mobile score ≥ 85 (Performance category)

### Security & Anti-Spam

- [ ] **SEC-01**: Honeypot field (`<input class="hp">` per existing `affiliates.html:446` pattern) — reject if filled
- [ ] **SEC-02**: Time-to-submit check — reject if form filled < 2 seconds (bot signature)
- [ ] **SEC-03**: Country gate — endpoint rejects if `x-vercel-ip-country` header ≠ `MA` (override available via env flag for testing)
- [ ] **SEC-04**: Server re-validates EVERY field (never trust client-side validation only)
- [ ] **SEC-05**: Generic error codes in responses (`{ok:false, error:"validation_failed"}` — never echo PII back)
- [ ] **SEC-06**: ZERO `console.log` of PII (Vercel logs are queryable; log only sanitized error class + phone last-4)
- [ ] **SEC-07**: Reject input containing URLs, Cyrillic, Chinese characters, or excessive special chars in name fields

### Pre-launch QA & Monitoring

- [ ] **QA-01**: Sentinel test — manual submission with sentinel value (`prenom: "TEST_SENTINEL_<date>"`) appears in live Sheet within 10 seconds, end-to-end
- [ ] **QA-02**: Meta Events Manager Test Events shows Pixel + CAPI events with matching `eventID` (deduplication verified)
- [ ] **QA-03**: Honeypot test passes (filled honeypot returns 200 but writes nothing to Sheet, fires no Pixel event)
- [ ] **QA-04**: Cross-device test: real Android Chrome + real iOS Safari, 320px viewport, 4G + throttled 3G
- [ ] **QA-05**: Smoke-test existing pages post-deploy: `/`, `/affiliates`, `/kit`, `/admin`, `/api/add-lead` all return 200 and function
- [ ] **QA-06**: PII audit — grep codebase for `console.log` of any form field; verify no PII in GET params or URL fragments

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Differentiators

- **DIFF-01**: Sticky bottom-bar CTA on mobile (hide when form in viewport)
- **DIFF-02**: FAQ accordion with 3-5 common darija questions
- **DIFF-03**: WhatsApp click-to-chat fallback button (requires staffed WA number with SLA)
- **DIFF-04**: Authentic before/after product imagery (compliance gate first — no medical claims)
- **DIFF-05**: UGC video testimonial 15-30s vertical with captions
- **DIFF-06**: Specific delivery time copy ("التوصيل فـ 2-4 ايام") — pending courier SLA confirmation
- **DIFF-07**: Server-side phone-based dedup (add when traffic ≥ 1k/day)

### Scale / Infra

- **SCALE-01**: Migrate from `googleapis` SDK to lighter `google-auth-library` + raw fetch (if cold-start p95 > 2s)
- **SCALE-02**: Migrate Sheet writes to proper DB (Vercel Postgres / Supabase) when traffic > 10k leads/day
- **SCALE-03**: Daily cron healthcheck endpoint that asserts the Sheet is writable (alerts on failure)
- **SCALE-04**: IP-based rate limit via Upstash Redis (only if abuse detected post-launch)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Online payment (Stripe / CMI) | COD via phone confirmation is the MA standard for this audience; adding payment ≠ higher conversion |
| Account creation / login | One-shot lead capture, no user state needed |
| Multi-language toggle (FR/EN/AR) | Arabic-only for this campaign — audience-specific, switching languages erodes trust signal |
| Affiliate tracking / commissions | This is direct-to-consumer paid acquisition, not affiliate-driven (affiliés have `/affiliates`) |
| Live chat widget | Phone callback is the confirmation channel — chat adds complexity without conversion uplift |
| Cookie consent modal | Not legally required for MA-only traffic; modal kills conversion |
| Exit-intent popup | Tested in MA market and reads as "scam pattern" |
| Foreign model in hero (white woman) | MA audience trust drops vs. Moroccan model or product-only |
| English copy anywhere | Even microcopy in EN reads as "international scam" |
| Email field in form | MA COD doesn't use email for callback — phone is the channel |
| Terms-and-conditions checkbox | MA audience treats as friction/scam-like; not legally required for this product |
| Pure Fus'ha Arabic | Reads cold/formal; darija converts better for this audience |
| Pure French copy | Subset of audience would convert, but darija is the primary language for FB MA ads |
| Stock counter ("only X left") | Fake-urgency pattern; MA audience scam-detector |
| Countdown timer | Same — scam-association unless paired with strong genuine social proof |
| Multi-step checkout wizard | Each step = drop-off; single-page form is the MA COD standard |
| Pricing tiers / variants | Single offer (150 MAD) = simpler decision = higher conversion |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| LAYOUT-01 | Phase 2 | Pending |
| LAYOUT-02 | Phase 2 | Pending |
| LAYOUT-03 | Phase 2 | Pending |
| LAYOUT-04 | Phase 2 | Pending |
| LAYOUT-05 | Phase 2 | Pending |
| LAYOUT-06 | Phase 2 | Pending |
| FORM-01 | Phase 2 | Pending |
| FORM-02 | Phase 2 | Pending |
| FORM-03 | Phase 1 | Pending |
| FORM-04 | Phase 2 | Pending |
| FORM-05 | Phase 2 | Pending |
| FORM-06 | Phase 2 | Pending |
| FORM-07 | Phase 2 | Pending |
| FORM-08 | Phase 2 | Pending |
| TRUST-01 | Phase 3 | Pending |
| TRUST-02 | Phase 3 | Pending |
| TRUST-03 | Phase 3 | Pending |
| TRUST-04 | Phase 3 | Pending |
| TRUST-05 | Phase 3 | Pending |
| BACK-01 | Phase 1 | Pending |
| BACK-02 | Phase 1 | Pending |
| BACK-03 | Phase 1 | Pending |
| BACK-04 | Phase 1 | Pending |
| BACK-05 | Phase 1 | Pending |
| BACK-06 | Phase 1 | Pending |
| BACK-07 | Phase 1 | Pending |
| BACK-08 | Phase 1 | Pending |
| TRACK-01 | Phase 2 | Pending |
| TRACK-02 | Phase 2 | Pending |
| TRACK-03 | Phase 2 | Pending |
| TRACK-04 | Phase 1 | Pending |
| TRACK-05 | Phase 1 | Pending |
| TRACK-06 | Phase 2 | Pending |
| TRACK-07 | Phase 1 | Pending |
| CONFIRM-01 | Phase 2 | Pending |
| CONFIRM-02 | Phase 2 | Pending |
| CONFIRM-03 | Phase 2 | Pending |
| CONFIRM-04 | Phase 2 | Pending |
| PERF-01 | Phase 4 | Pending |
| PERF-02 | Phase 4 | Pending |
| PERF-03 | Phase 4 | Pending |
| PERF-04 | Phase 4 | Pending |
| PERF-05 | Phase 4 | Pending |
| PERF-06 | Phase 4 | Pending |
| SEC-01 | Phase 2 | Pending |
| SEC-02 | Phase 1 | Pending |
| SEC-03 | Phase 1 | Pending |
| SEC-04 | Phase 1 | Pending |
| SEC-05 | Phase 1 | Pending |
| SEC-06 | Phase 1 | Pending |
| SEC-07 | Phase 1 | Pending |
| QA-01 | Phase 4 | Pending |
| QA-02 | Phase 4 | Pending |
| QA-03 | Phase 4 | Pending |
| QA-04 | Phase 4 | Pending |
| QA-05 | Phase 4 | Pending |
| QA-06 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 51 total
- Mapped to phases: 51
- Unmapped: 0 ✓
- Duplicates across phases: 0 ✓

## User Stories

For PR body generation by `/gsd:ship` (per ship.pr_body_sections config).

**Story 1 — Visitor from FB ad arrives:**
*As a* MA woman 25-45 clicking a FB ad in my feed,
*I want to* see a fast-loading Arabic darija page that explains Solaryn SPF clearly and shows the price upfront,
*So that* I can decide in under 60 seconds whether to order.

*Acceptance:*
- Page loads in <3s on my mobile 4G
- Hero shows product + "150 درهم" + benefits without scrolling
- Trust signals (COD, local courier) visible above the form

**Story 2 — Lead submits the form:**
*As a* MA woman who decided to order,
*I want to* enter my prénom, nom, téléphone, ville, adresse in one short form,
*So that* I receive a callback within hours to confirm my Solaryn delivery.

*Acceptance:*
- 5 fields visible, no surprises
- Phone field accepts both `06...` and `+212 6...` formats
- After submit, I see a clear darija thank-you with what happens next

**Story 3 — Admin captures the lead:**
*As the* Solaryn admin,
*I want* every form submission to land in a dedicated Google Sheet with all 5 fields + timestamp + source,
*So that* I can call the lead within 2h to confirm and ship via Sendit.

*Acceptance:*
- Each submission = exactly one row in the AR Leads sheet
- Phone is preserved as text with `+212` prefix (no Sheets auto-format)
- Source field distinguishes ad campaigns (UTM-ready)
- FB CAPI fires the matching `Lead` event for ad optimization

---
*Requirements defined: 2026-05-26*
*Last updated: 2026-05-26 after roadmap traceability update*
