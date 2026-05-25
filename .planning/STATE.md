# Project State: Solaryn AR Landing Page

**Created:** 2026-05-26
**Last updated:** 2026-05-26 after roadmap creation

## Project Reference

**Core Value:** Convert FB/IG ad clicks into qualified, callable leads (form submitted with valid phone + complete address) — each lead represents a 150 MAD COD pending order

**Current Focus:** Planning complete — ready to begin Phase 1 (Backend Foundation & Sheet Provisioning)

**Tech Stack:** Vanilla HTML/CSS/JS + Vercel serverless Node 22.x + `googleapis` v144 (already installed) + Google Sheets API + Meta Pixel + Meta Conversions API. Zero new npm deps, zero build step.

**Repo location:** `/Users/a2024/solaryn` (brownfield — existing affiliate platform, admin, Shopify integration; AR landing is additive)

## Current Position

**Phase:** 1 (Backend Foundation & Sheet Provisioning) — not started
**Plan:** N/A (no plans yet — run `/gsd:plan-phase 1` to decompose)
**Status:** Awaiting plan decomposition
**Progress:** 0/4 phases complete (0%)

```
[░░░░░░░░░░░░░░░░░░░░] 0% — Phase 1 of 4 not started
```

## Performance Metrics

| Metric | Target | Current |
|--------|--------|---------|
| v1 requirements covered | 51/51 | 51/51 ✓ |
| Phases defined | 4 | 4 ✓ |
| Plans created | TBD | 0 |
| Plans complete | TBD | 0 |

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

### Todos / Open Questions (from research SUMMARY.md)

1. **City field free text vs `<select>`** — PROJECT.md says free text. Pitfall research recommends dropdown for routing. Default: free text per PROJECT.md.
2. **Real testimonials available or fallback strip?** — Phase 3 decision point.
3. **Courier partner identity** (Sendit / Speedaf / Amana / other) — affects which logo + name to use.
4. **WhatsApp fallback staffing** — staffed WA number with SLA for `/merci` deep-link, or omit (deferred to v2 DIFF-03 either way).
5. **CAPI access token sourcing** — Meta Business Manager system user; NEVER `NEXT_PUBLIC_*`.
6. **og:image asset** — 1200×630, < 200KB; must be produced.
7. **Existing `whatsapp-landing-ar.html` interaction** — scope new CSS to avoid bleed (already addressed via `page-ar` prefix decision).

### Blockers

None yet. Phase 1 can start immediately.

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

NEW (to add in Phase 1):
- `AR_LEADS_SHEET_ID` — the new dedicated sheet ID (Production + Preview + Development)
- `META_PIXEL_ID` — FB Pixel ID (also hard-coded inline in `<head>` of `ar.html`)
- `META_CAPI_ACCESS_TOKEN` — Meta Business Manager system-user token (server-only, NEVER `NEXT_PUBLIC_*`)

## Session Continuity

### Last Session

- **Date:** 2026-05-26
- **Action:** Roadmap created and validated. 4 phases derived from requirements (matches research SUMMARY.md proposed structure); 51/51 v1 requirements mapped; success criteria written per phase.

### Next Session

- **Action:** Run `/gsd:plan-phase 1` to decompose Phase 1 (Backend Foundation & Sheet Provisioning) into executable plans.

### Files Touched This Session

- `/Users/a2024/solaryn/.planning/ROADMAP.md` (created)
- `/Users/a2024/solaryn/.planning/STATE.md` (created)
- `/Users/a2024/solaryn/.planning/REQUIREMENTS.md` (Traceability table updated to exact REQ-ID → phase mapping)

### Files Referenced (Not Modified)

- `/Users/a2024/solaryn/.planning/PROJECT.md`
- `/Users/a2024/solaryn/.planning/research/SUMMARY.md`
- `/Users/a2024/solaryn/.planning/research/STACK.md`
- `/Users/a2024/solaryn/.planning/research/FEATURES.md`
- `/Users/a2024/solaryn/.planning/research/ARCHITECTURE.md`
- `/Users/a2024/solaryn/.planning/research/PITFALLS.md`
- `/Users/a2024/solaryn/.planning/config.json`

---
*State initialized: 2026-05-26 after roadmap creation*
