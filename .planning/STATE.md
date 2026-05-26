# Project State: Solaryn AR Landing Page

**Created:** 2026-05-26
**Last updated:** 2026-05-26 after Phase 1 planning complete

## Project Reference

**Core Value:** Convert FB/IG ad clicks into qualified, callable leads (form submitted with valid phone + complete address) — each lead represents a 150 MAD COD pending order

**Current Focus:** Phase 1 planning complete — ready to execute Phase 1 (Backend Foundation & Sheet Provisioning)

**Tech Stack:** Vanilla HTML/CSS/JS + Vercel serverless Node 22.x + `googleapis` v144 (already installed) + Google Sheets API + Meta Pixel + Meta Conversions API. Zero new npm deps, zero build step.

**Repo location:** `/Users/a2024/solaryn` (brownfield — existing affiliate platform, admin, Shopify integration; AR landing is additive)

## Current Position

**Phase:** 1 (Backend Foundation & Sheet Provisioning) — **Planning Complete**
**Plan:** 3 plans created (01-prerequisites, 02-helpers, 03-endpoint)
**Status:** Awaiting execution — run `/gsd:execute-phase 1` to begin
**Progress:** 0/4 phases complete (0%) — Phase 1 planned, not yet executed

```
[░░░░░░░░░░░░░░░░░░░░] 0% — Phase 1 planned (3 plans), execution pending
```

## Performance Metrics

| Metric | Target | Current |
|--------|--------|---------|
| v1 requirements covered | 51/51 | 51/51 ✓ |
| Phases defined | 4 | 4 ✓ |
| Plans created (Phase 1) | 1-3 (coarse) | 3 ✓ |
| Plans complete | TBD | 0 |
| Phase 1 requirements planned | 18/18 | 18/18 ✓ |

## Accumulated Context

### Key Decisions (from PROJECT.md + research)

| Decision | Rationale | Phase |
|----------|-----------|-------|
| Language: darija written in Arabic script (not Fus'ha, not Arabizi) | Style des pubs FB MA qui convertissent; audience parle darija; Arabizi reads as chat/scam on a product page | Phase 3 |
| Backend: NEW dedicated Google Sheet (`Solaryn AR Leads`), NOT reuse `/api/add-lead` | Existing endpoint dedupes by phone (would silently drop AR leads), triggers WA bot, writes to wrong sheet; AR campaign needs clean append-only sheet | Phase 1 |
| Confirmation: page merci simple, pas de CTA | Minimiser friction post-submit; suivi se fait par téléphone | Phase 2 |
| Form fields: 5 obligatoires (prénom, nom, tél, ville, adresse) | Tél indispensable pour COD MA; 5 fields is the MA COD form sweet spot | Phase 2 |
| Prix unique 150 MAD livraison incluse | Single offer = higher conversion than tier system | Phase 2 |
| Dual FB Pixel + CAPI with shared `event_id` | Pixel-only loses 25-40% events to iOS 17+ ATT + Safari ITP + ad-blockers in 2026; CAPI is table stakes | Phase 1 (server) + Phase 2 (client) |
| Node 22.x pin (not 24.x default) | `package.json` already has `>=20`; pin explicitly to match existing prod runtime; plan upgrade before Apr 2027 Node 22 EOL | Phase 1 |
| Scope new CSS under `page-ar` prefix | Zero bleed to existing `affiliates.html`, `kit.html`, `admin.html`, `index.html` | Phase 2 |
| Country gate: `x-vercel-ip-country === 'MA'` (with testing override) | Audience is 100% MA via FB targeting; non-MA traffic is bots/scrapers/competitors | Phase 1 |
| `event_id` originates on BROWSER (Phase 2), forwarded unchanged to server | Meta CAPI dedup requires Pixel + CAPI events to share the same ID; server-generated ID would race with browser Pixel | Phase 1 + Phase 2 |
| Apostrophe-prefix on phone cell in Sheets (`"'" + phoneCanonical`) | Without apostrophe, `+212...` is parsed as formula → `#NAME?`; verified pattern in `add-lead.js:139` | Phase 1 |
| Meta CAPI phone format: digits-only with country code, no `+`, no leading 0 (`212612345678`) | Meta CAPI spec; DISTINCT from sheet storage format which keeps the `+` for human readability | Phase 1 |

### Todos / Open Questions (from research SUMMARY.md)

1. **City field free text vs `<select>`** — PROJECT.md says free text. Pitfall research recommends dropdown for routing. Default: free text per PROJECT.md.
2. **Real testimonials available or fallback strip?** — Phase 3 decision point.
3. **Courier partner identity** (Sendit / Speedaf / Amana / other) — affects which logo + name to use.
4. **WhatsApp fallback staffing** — staffed WA number with SLA for `/merci` deep-link, or omit (deferred to v2 DIFF-03 either way).
5. **CAPI access token sourcing** — Meta Business Manager system user; NEVER `NEXT_PUBLIC_*`. (Plan 01 prerequisite checklist.)
6. **og:image asset** — 1200×630, < 200KB; must be produced. (Phase 2.)
7. **Existing `whatsapp-landing-ar.html` interaction** — scope new CSS to avoid bleed (already addressed via `page-ar` prefix decision).
8. **Vercel project tier** (Hobby vs Pro) — affects `x-vercel-ip-country` reliability. Plan 01 verifies via `vercel project ls` before Plan 03 sentinel.

### Blockers

None for planning. Plan 03 execution is gated on Plan 01 (manual sheet + Vercel env + Meta CAPI token setup) completing.

### Constraints (from PROJECT.md)

- Tech stack: Vanilla HTML/CSS/JS (no framework, no build step)
- Hosting: Vercel (existing `solaryn` project)
- Backend: Google Sheets API via existing service-account pattern (`api/_sheets.js`)
- Mobile-first: 95% of GA traffic is mobile
- RTL layout: Arabic requires right-to-left CSS
- No PII leakage: tel + adresse are sensitive; never log to client console or expose via public endpoint

### Environment Variables (Vercel project `solaryn`)

REUSED:
- `GOOGLE_SERVICE_ACCOUNT_JSON` — existing service account (must be shared as Editor on the NEW sheet)

NEW (to add in Phase 1 / Plan 01):
- `AR_LEADS_SHEET_ID` — the new dedicated sheet ID (Production + Preview + Development)
- `META_PIXEL_ID` — FB Pixel ID (also hard-coded inline in `<head>` of `ar.html` in Phase 2)
- `META_CAPI_ACCESS_TOKEN` — Meta Business Manager system-user token (server-only, NEVER `NEXT_PUBLIC_*`)

OPTIONAL (QA only):
- `META_TEST_EVENT_CODE` — Preview env only, routes CAPI events to Test Events panel
- `AR_COUNTRY_GATE_OFF=1` — Preview env only, bypasses MA country gate for testing

### Phase 1 Plan Structure (created this session)

| Wave | Plan | Files | Autonomous | Effort |
|------|------|-------|------------|--------|
| 1 | `PLANS/01-prerequisites.md` | (manual: new sheet, 3 env vars, CAPI token) | no (4 human-action checkpoints) | S |
| 2 | `PLANS/02-helpers.md` | `package.json`, `api/_sheets.js`, `api/_ar_capi.js` (NEW) | yes | M |
| 3 | `PLANS/03-endpoint.md` | `api/ar-lead.js` (NEW) | mixed (sentinel + negative tests are human-verify checkpoints) | M |

## Session Continuity

### Last Session

- **Date:** 2026-05-26
- **Action:** Phase 1 planning complete. 3 sub-plans created decomposing the 8 atomic tasks from RESEARCH.md into:
  - Plan 01 (Prerequisites): 4 human-action checkpoints for sheet, env vars, CAPI token
  - Plan 02 (Helpers): 3 auto tasks for Node pin + `appendArLead()` additive export + new `_ar_capi.js` module
  - Plan 03 (Endpoint): 8 tasks combining auto handler creation, automated grep audits, deploy, sentinel + 9-case negative test checkpoints, regression smoke, state update
- All 18 Phase 1 requirements covered by sub-plan tasks (BACK-01..08, FORM-03, TRACK-04, TRACK-05, TRACK-07, SEC-02..07).

### Next Session

- **Action:** Run `/gsd:execute-phase 1` to execute Plan 01 (prerequisites checkpoints) → Plan 02 (helpers) → Plan 03 (endpoint + sentinel verification).
- **Pre-execution sanity:** Have ready: Google Sheets access (mouhabmzibra@gmail.com), Meta Business Manager admin access, Vercel CLI authenticated.

### Files Touched This Session

- `/Users/a2024/solaryn/.planning/STATE.md` (updated — Phase 1 planning complete)
- `/Users/a2024/solaryn/.planning/phases/01-backend-foundation-sheet-provisioning/PLAN.md` (created — phase-level orchestrator)
- `/Users/a2024/solaryn/.planning/phases/01-backend-foundation-sheet-provisioning/PLANS/01-prerequisites.md` (created)
- `/Users/a2024/solaryn/.planning/phases/01-backend-foundation-sheet-provisioning/PLANS/02-helpers.md` (created)
- `/Users/a2024/solaryn/.planning/phases/01-backend-foundation-sheet-provisioning/PLANS/03-endpoint.md` (created)

### Files Referenced (Not Modified)

- `/Users/a2024/solaryn/.planning/PROJECT.md`
- `/Users/a2024/solaryn/.planning/REQUIREMENTS.md`
- `/Users/a2024/solaryn/.planning/ROADMAP.md`
- `/Users/a2024/solaryn/.planning/research/SUMMARY.md`
- `/Users/a2024/solaryn/.planning/research/STACK.md`
- `/Users/a2024/solaryn/.planning/research/ARCHITECTURE.md`
- `/Users/a2024/solaryn/.planning/research/PITFALLS.md`
- `/Users/a2024/solaryn/.planning/phases/01-backend-foundation-sheet-provisioning/RESEARCH.md`
- `/Users/a2024/solaryn/.planning/config.json`
- `/Users/a2024/solaryn/api/_sheets.js`
- `/Users/a2024/solaryn/api/_lib.js`
- `/Users/a2024/solaryn/api/add-lead.js`
- `/Users/a2024/solaryn/package.json`

---
*State updated: 2026-05-26 after Phase 1 planning complete (3 sub-plans, 18 requirements covered)*
