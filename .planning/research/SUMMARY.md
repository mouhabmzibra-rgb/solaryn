# Research Summary — Solaryn AR Landing Page

**Project:** Mobile-first Arabic darija landing page (FB/IG ads → COD lead capture, MA market)
**Synthesized:** 2026-05-26
**Inputs:** STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md
**Overall confidence:** HIGH (stack & architecture); MEDIUM-HIGH (features); HIGH (pitfalls)

---

## Executive Summary

Single-page lead-capture funnel layered onto the existing `solaryn` Vercel repo: one new static HTML at `ar.html` (served at `/ar` via `cleanUrls`), one new serverless `api/ar-lead.js`, one additive helper in `api/_sheets.js`, and one NEW dedicated Google Sheet. **Zero new deps, zero build step, zero changes to existing pages, env vars, or `vercel.json`.**

The job is **not "sell SPF 50"** — it is **"convert FB/IG ad clicks into callable leads"** a human can confirm within 2h for 150 MAD COD orders. Engineering quality = right phone numbers reliably land in right Sheet + FB's optimizer gets accurate signal. Content quality (darija register, MA-localized trust signals) is critical-path and gates launch independent of code.

Dominant risks are **silent failure modes that burn ad budget invisibly**: form submits succeeding in browser but never reaching Sheet, FB Pixel undercounting from iOS 14+ ATT, US/EU trust signals reading as "foreign scam" to Moroccans, phone fields accepting garbage. Mitigations are well-understood and cheap up front, ruinous to retrofit.

---

## Key Findings

1. **Stay 100% inside existing repo conventions.** Vanilla HTML/CSS/JS + new Vercel Function reusing `googleapis` service-account pattern from `api/_sheets.js`. No framework, no Tailwind, no TS, no build — all violate PROJECT.md + add cold-start latency.

2. **NEW dedicated Google Sheet, NOT `/api/add-lead`.** Existing endpoint dedupes by phone (silently drops legit AR leads), triggers WhatsApp-group bot, writes to wrong sheet. Provision `Solaryn AR Leads`, share with service account, store ID in `AR_LEADS_SHEET_ID`.

3. **Form integrity is highest-stakes engineering.** Phone validation (MA regex + Arabic-Indic digit conversion + `dir="ltr"` on input), address min-length (single-word = #1 fake-order signal), server-confirmed redirect before showing `/merci`. 5 required fields per PROJECT.md.

4. **Dual FB Pixel + CAPI with shared `event_id` is table stakes in 2026**, not Phase 2 nice-to-have. Pixel-only loses 25-40% events to iOS 17+ ATT + Safari ITP + ad-blockers → degrades FB optimization + inflates CPL by 30-50%.

5. **Content is on the critical path.** Darija register (not Fus'ha, not Arabizi). MA-localized trust: "الدفع عند الاستلام" badge, local courier logo (Sendit/Speedaf), Moroccan first names + cities on testimonials, MAD only. US/EU templates cost 27%+ conversion.

6. **Mobile-first ≠ slogan; 95% GA traffic mobile.** LCP > 4s on 3G = abandoned before form renders. Hero WebP ≤80KB @ 480w, Cairo font (already cached site-wide), inline critical CSS, defer Pixel script.

7. **Spam protection mandatory day-1.** Public unauthenticated endpoint sees bots within hours. Layer cheap: honeypot (per `affiliates.html:446`), time-to-submit check, country gate (`x-vercel-ip-country == 'MA'`), server re-validation.

---

## Stack at a Glance

Vanilla HTML5/CSS3/JS (ES2022, no modules) as one static file `ar.html` (routed `/ar` via `cleanUrls: true`). RTL native via `<html lang="ar" dir="rtl">` + CSS logical properties (`margin-inline-start`). Google Fonts Cairo (already cached site-wide). Backend: one new Vercel Function `api/ar-lead.js` (pin Node 22.x in `engines.node`) calling new ~15-line additive `appendArLead()` in `api/_sheets.js`, reusing cached `googleapis` v144 + existing `_lib.js` helpers. Meta Pixel inline in `<head>`, Meta CAPI POST server-side after Sheet write — deduped via shared `crypto.randomUUID()` `event_id`. NEW env: `AR_LEADS_SHEET_ID`, `META_PIXEL_ID`, `META_CAPI_ACCESS_TOKEN`. REUSED: `GOOGLE_SERVICE_ACCOUNT_JSON`. Zero new npm deps.

---

## Table Stakes (Phase 1 — Must Ship to Validate)

1. Mobile-first RTL darija layout (`<html lang="ar" dir="rtl">` + CSS logical properties)
2. Above-fold hero: product image + "150 درهم — التوصيل مجاني" + scroll-to-form CTA
3. 3-5 scannable darija benefit bullets (respect product-claims rules)
4. 5-field COD form (all required)
5. Phone hardening (`type=tel inputmode=numeric dir=ltr pattern` + server-side normalize + canonical)
6. Address min-length validation (≥10 chars)
7. "الدفع عند الاستلام" badge near price AND submit
8. Phone callback expectation copy near form
9. Local courier logo + "توصيل لجميع المدن المغربية"
10. <3s load on 4G (WebP hero ≤80KB, Cairo self-cached, inline critical CSS, deferred Pixel)
11. `/ar/merci` thank-you in darija, no CTA
12. FB Pixel `Lead` event on confirmed submit + Lead CAPI server-side with shared `event_id`
13. Honeypot + time-to-submit + MA country gate
14. NEW Sheet `Solaryn AR Leads` with header row, shared with service-account
15. Server-confirmed redirect (only navigate to `/merci` on `ok === true`)
16. SHA-256 hash phone/name/city server-side for CAPI `user_data`
17. Static social-proof strip (2-3 testimonials with Moroccan first name + city)

---

## Differentiators (Phase 2+)

| Feature | Lift | Notes |
|---------|------|-------|
| Sticky bottom-bar CTA mobile | +5-8% | Cheap; high ROI |
| Real testimonials w/ name+city | Authenticity++ | Needs content |
| FAQ accordion (3-5 darija Q) | Preempts objections | Can ship P1 if copy ready |
| Specific delivery time | Beats vague "rapide" | Cheap if SLA confirmed |
| WhatsApp click-to-chat | MA preference | Needs staffed WA |
| Before/after (authentic only) | +20-30% skincare | Compliance gate |
| UGC video testimonial 15-30s | Strongest social proof | Production cost |
| Migrate to lighter Sheets SDK | Reduces cold-start | Only if p95 > 2s |
| Server-side dedup by phone | Prevents double-submits | Add at 1k+/day |

**Defer indefinitely:** Stock counter, fake countdown, MA-institution badges (unless real).
**Never:** Online payment, account creation, multi-language toggle, live chat, cookie modal, exit-intent popup, foreign-model hero, English copy, email field, terms-checkbox, Fus'ha-only, pure French.

---

## Critical Pitfalls (Top 7 — Phase-Mapped)

| # | Pitfall | Prevention | Phase |
|---|---------|------------|-------|
| 1 | Form succeeds but row never reaches Sheet (silent data loss) | `await` Sheet append + return 500 on fail; client redirects only on `ok === true`; pre-launch sentinel test; daily cron healthcheck | Backend + Pre-launch QA |
| 2 | FB Pixel undercounts iOS 14+ ATT (~25-35% MA mobile) | Dual Pixel + CAPI day-1 w/ shared `event_id`; SHA-256 hash PII for `user_data`; Meta Test Events | Tracking (concurrent backend) |
| 3 | US/EU trust signals → -27% conversion | COD badge prominent; real MA names + cities on testimonials; local courier logo; MAD prices only; no SSL/Stripe/Visa badges | Content & UX |
| 4 | Phone field accepts garbage → 10-20% unreachable | `type=tel inputmode=numeric pattern dir=ltr`; server: strip non-digits, convert `٠-٩→0-9`, canonicalize `+212XXXXXXXXX` | Form build |
| 5 | LCP > 4s on 3G → abandoned before form renders | WebP hero ≤80KB @ 480w + `fetchpriority=high` + `srcset`; self-host Cairo subsetted; inline critical CSS; throttled 3G test | Performance pass |
| 6 | Open endpoint → bot spam | Honeypot + time-to-submit ≥2s + MA country gate + server re-validation + reject Cyrillic/Chinese/URL-in-name | Backend hardening |
| 7 | PII leaked via console.log/GET/error echoes/Vercel logs | Strip all `console.log`; POST only; generic error codes; no echo; no PII in URL | Pre-launch security |

---

## Suggested Phase Structure (Coarse — 4 Phases)

### Phase 1 — Backend Foundation & Sheet Provisioning (~1-2 days)
Backend before frontend so form has real dependency. Provisioning Sheet + sharing with SA + env vars is manual work that must precede code calling it.

**Includes:** Provision NEW Sheet + share + headers; add 3 NEW env vars to Vercel; pin `engines.node: 22.x`; extend `api/_sheets.js` with additive `appendArLead()`; build `api/ar-lead.js` (CORS, POST gate, validation, phone normalize, Sheet append, server-side CAPI `Lead` with hashed PII + shared `event_id`); honeypot + time-trap + country gate.

**Addresses pitfalls:** #1, #4, #6, #7

### Phase 2 — Landing Page Build (HTML + RTL + Form + Pixel) (~2-3 days)
With backend ready, build user-facing surface as cohesive QA-able unit.

**Includes:** `ar.html` (lang/dir, viewport, Cairo, inline critical CSS w/ logical properties); hero (WebP, price, CTA); benefits; trust + COD badges; 5-field form (hardening, autocomplete, honeypot, hidden time); Pixel base + client `Lead` w/ `eventID`; client JS (fetch, redirect on ok, inline darija errors); `ar/merci.html` (darija thank-you, guard); localized `<title>` + `og:image` 1200×630 <200KB.

**Addresses:** #3, #7 (W3C dir), Phase 1 + bidi numbers

### Phase 3 — Content Localization & Trust Signal Polish (~1-2 days, parallelizable w/ P2)
Content gates launch independently of code.

**Includes:** Native MA reviewer pass on darija (hero, benefits, FAQ, labels, errors, merci); collect 2-3 real testimonials w/ name + city; confirm courier partner + logo rights; FAQ accordion (3-5 darija Q); delivery SLA; compliance check vs product-claims memory; 5-second test with 3-5 native MA women.

**Addresses:** #3

### Phase 4 — Performance, QA, Deploy & Monitoring (~1 day)
Single hardening + launch phase before ad spend.

**Includes:** Lighthouse mobile LCP <2.5s + perf ≥85; throttled 3G + CPU 4× test; 320px viewport; real iOS Safari + Android Chrome; pre-launch sentinel verified in live Sheet <10s; Meta Test Events verifying Pixel+CAPI dedupe; manual honeypot test; PII audit; smoke-test existing pages; daily monitoring (FB Lead count vs Sheet rows vs Vercel invocations); update `SESSION.md`.

**Addresses:** #1, #2, #5, #6, #7

---

## Open Questions / Pending Decisions

1. **City field: free text or `<select>`?** PROJECT.md says free text. Pitfall research recommends dropdown for routing. Default: free text per PROJECT.md.
2. **Real testimonials available or fallback strip?** Phase 3 decision.
3. **Courier partner.** Sendit / Speedaf / Amana / other — affects which logo to use.
4. **WhatsApp fallback staffing.** Staffed WA number with SLA for `/merci` deep-link, or omit.
5. **CAPI access token sourcing.** Meta Business Manager system user; NEVER `NEXT_PUBLIC_*`.
6. **og:image asset.** 1200×630, <200KB.
7. **Existing `whatsapp-landing-ar.html` interaction.** Scope new CSS under `page-ar-lp` class or dedicated file.

---

## Confidence Assessment

| Area | Confidence | Reasoning |
|------|------------|-----------|
| Stack | HIGH | Verified against `package.json`, `_sheets.js`, `affiliates.html`; Vercel + Meta docs |
| Architecture | HIGH | All claims verified by direct reads |
| Features | MEDIUM-HIGH | Triangulated multiple MA-focused sources |
| Pitfalls | HIGH | Named root cause + prevention + detection |
| MA market specifics | HIGH | Multiple sources converge + project GA data (95% mobile) |
| Content production | MEDIUM | Final copy needs native MA reviewer |
