# Solaryn AR Landing Page

## What This Is

Mobile-first Arabic (darija) landing page that sells **Solaryn SPF 50 at 150 MAD livraison incluse**. Visitors come from Facebook/Instagram ads, see product benefits, and submit a lead-capture form (prénom + nom + tél WhatsApp + ville + adresse). Each lead lands in a new dedicated Google Sheet for follow-up by phone to confirm the COD order.

## Core Value

**Convert FB/IG ad clicks into qualified, callable leads.** If the form submission flow breaks, the entire campaign budget burns for nothing.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

(None yet — ship to validate)

### Active

<!-- Current scope. Building toward these. -->

- [ ] Mobile-first Arabic darija landing page (RTL layout)
- [ ] Above-the-fold: product hero + benefits + price 150 MAD livraison incluse
- [ ] Form with 5 required fields: prénom, nom, téléphone (WhatsApp), ville, adresse
- [ ] Form submits to NEW dedicated Google Sheet (not the existing leads sheet)
- [ ] Simple "merci" page after submission (no further CTA)
- [ ] Facebook Pixel installed for ad conversion tracking
- [ ] Page deployed to Vercel under existing solaryn project (likely `/ar` route)

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

- Multi-product catalog — this landing is SPF only, single offer = higher conversion
- Online payment (Stripe/CMI) — COD via phone confirmation is the MA standard for this audience
- Account creation / login — one-shot lead capture, no user state needed
- Multi-language (FR/EN) — Arabic darija only for this campaign, audience-specific
- Affiliate tracking / commissions — this is direct-to-consumer pub, not affilié driven
- Live chat widget — phone callback is the confirmation channel

## Context

- **Existing repo:** `/Users/a2024/solaryn` already hosts the Solaryn site, admin dashboard, affiliate platform (`/affiliates`, `/kit`, `/admin`), and Google Sheets integration via `api/_sheets.js`. The new landing page lives in this same Vercel project.
- **Traffic source:** Facebook/Instagram ads targeted at Moroccan women 25-45 interested in beauty/skincare. Audience speaks darija + reads Arabic; french/english landing would underperform.
- **GA history (16-25 mai):** Site already received ~13K visitors from a prior pub campaign with very low engagement (5.7s/user, 54% bounce). This new landing must do better via cleaner pitch + focused conversion path.
- **Affiliate channel separate:** This landing is independent from the affiliate program — affiliées continue using `/affiliates` + `/kit`. This page is for paid acquisition only.
- **Existing tech patterns:** Repo uses vanilla HTML/CSS/JS + Vercel API routes (Node). New landing should follow same conventions for consistency.

## Constraints

- **Tech stack**: Vanilla HTML/CSS/JS (no framework) — Match existing Solaryn repo style + zero build step on Vercel
- **Hosting**: Vercel (existing `solaryn` project) — Deploy via the same git push pipeline as the rest
- **Backend**: Google Sheets API via service account pattern from `api/_sheets.js` — Same auth, new sheet ID
- **Mobile-first**: 95 % of GA traffic is mobile (Android+iOS balanced) — Desktop is afterthought
- **RTL layout**: Arabic requires right-to-left CSS — Different from existing FR/AR mixed pages
- **No PII leakage**: Tel + adresse are sensitive — never log to client console or expose via public endpoint

## Key Decisions

<!-- Decisions that constrain future work. Add throughout project lifecycle. -->

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Language: darija écrite (not Fus'ha) | Style des pubs FB MA qui convertissent ; audience parle darija | — Pending |
| Backend: NEW dedicated Google Sheet | Séparer leads de cette campagne des leads WhatsApp existants pour analyse propre | — Pending |
| Confirmation: page merci simple, pas de CTA | Minimiser friction post-submit ; le suivi se fait par téléphone | — Pending |
| Form fields: 5 obligatoires (incl. tél) | Tél indispensable pour confirmer COD au Maroc | — Pending |
| Prix unique 150 MAD livraison incluse | Offre claire = meilleure conversion qu'un tier system | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-26 after initialization*
