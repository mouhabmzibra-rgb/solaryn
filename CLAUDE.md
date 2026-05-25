# Solaryn — Rules for Claude

These rules apply to every task in this repository. They override any default behavior. Read them at session start and check them before each significant action.

---

## Rule 1 — Never hallucinate. Verify everything verifiable.

Do NOT make claims about code, file contents, API responses, env vars, deployed state, third-party docs, or user history that you have not directly verified in this session.

Concrete:
- Before referring to a function, file path, or variable: **grep or read it**.
- Before claiming an endpoint works: **curl it**.
- Before saying "X is deployed": **check `git log`, `git status`, or hit the live URL**.
- If a memory says "X exists", treat it as a hypothesis to verify, not a fact.
- When something is not verifiable (user intent, future behavior, business reasoning): say so explicitly with words like "I'm assuming…" or "not verified".

The cost of saying "I don't know, let me check" is small. The cost of confidently lying is high — it erodes trust and creates bad downstream decisions.

---

## Rule 2 — Plan, then reflect. No coding without a plan.

For any task more complex than a 1-line edit:

1. **State the goal in one sentence.** What should the outcome be? What does "done" look like?
2. **List the steps** required to reach that outcome.
3. **Identify the risks** — what could go wrong? what could be wrong about my plan?
4. **Ask the user if the goal/plan is ambiguous.** Do not assume — clarify.
5. **Execute the plan.**
6. **Reflect after execution.** Does the result match the stated goal? If not, fix it before claiming "done". Do not ship trash and call it complete.

If after reflection you realize the approach was wrong, **say so** and propose a corrected plan. Do not paper over mistakes.

---

## Rule 3 — Always read files before modifying or reasoning about them.

If a task requires understanding what's already there:
- **Read the file** (or grep it). Don't infer from filename or memory.
- For multi-file changes: read all affected files first, then edit.
- For bug investigation: read the actual code path, don't speculate from symptoms.

Exception: trivial new-file creation where no prior context matters.

If a file is too large to read fully, read the relevant sections explicitly. Never pretend to have read something you skimmed.

---

## Rule 4 — Maintain `SESSION.md` continuously.

This project must always have an up-to-date `SESSION.md` at the repo root that captures the current session's state, so if the conversation drops the next session can resume without starting from scratch.

**Update `SESSION.md` after every meaningful action**, not just at the end. "Meaningful" = anything that changes project state (file edit, deploy, env var, decision made, blocker hit).

### `SESSION.md` structure

```
# Session — <date>

## Active goal
<1-2 lines: what we're trying to accomplish right now>

## Status
<active / blocked / awaiting user / done>

## Done this session
- <bullet 1>
- <bullet 2>

## In progress
- <what's mid-flight, with file paths>

## Blockers / pending decisions
- <thing waiting on user, or known bug>

## Next step
<what to do when picking back up>

## Context the next session needs
- <env vars, IDs, secrets refs (no secret values), urls, links to commits>
- <key decisions made (with reasoning)>

## Open follow-ups (not blocking)
- <small things noted but not yet done>
```

Update timestamp + relevant section. Keep it concise — `SESSION.md` is not a transcript, it's a handoff doc.

---

## Operational reminders

- Do not skip these rules for "quick" tasks. Quick tasks are where hallucinations slip in unnoticed.
- If a user message contradicts a rule (e.g., "just go ahead and code"), follow the rule anyway — write a 3-line plan in the response before coding.
- When unsure between two valid approaches, surface the choice; don't pick silently.

<!-- GSD:project-start source:PROJECT.md -->
## Project

**Solaryn AR Landing Page**

Mobile-first Arabic (darija) landing page that sells **Solaryn SPF 50 at 150 MAD livraison incluse**. Visitors come from Facebook/Instagram ads, see product benefits, and submit a lead-capture form (prénom + nom + tél WhatsApp + ville + adresse). Each lead lands in a new dedicated Google Sheet for follow-up by phone to confirm the COD order.

**Core Value:** **Convert FB/IG ad clicks into qualified, callable leads.** If the form submission flow breaks, the entire campaign budget burns for nothing.

### Constraints

- **Tech stack**: Vanilla HTML/CSS/JS (no framework) — Match existing Solaryn repo style + zero build step on Vercel
- **Hosting**: Vercel (existing `solaryn` project) — Deploy via the same git push pipeline as the rest
- **Backend**: Google Sheets API via service account pattern from `api/_sheets.js` — Same auth, new sheet ID
- **Mobile-first**: 95 % of GA traffic is mobile (Android+iOS balanced) — Desktop is afterthought
- **RTL layout**: Arabic requires right-to-left CSS — Different from existing FR/AR mixed pages
- **No PII leakage**: Tel + adresse are sensitive — never log to client console or expose via public endpoint
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

## TL;DR
## Recommended Stack
### Frontend (browser runtime)
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Vanilla HTML5 | living standard | Page markup | Matches `affiliates.html` / repo convention; zero build constraint in PROJECT.md |
| Vanilla CSS3 | living standard | Mobile-first RTL styling | Same reason; CSS variables already used in `affiliates.html` |
| Vanilla JS (ES2022, no modules) | ES2022 | Form validation + submission | Single `<script>` block, no bundler; pattern from `affiliates.html` |
| `<html lang="ar" dir="rtl">` | — | RTL layout root | Browser-native RTL inheritance; already proven in `affiliates.html:2` |
| Google Fonts — Cairo | latest (variable font, weights 400/600/700/800/900) | Arabic + Latin display | Already loaded in `affiliates.html:20`; best-in-class for darija mobile UI (open counters, generous x-height) |
| Meta Pixel base code | current 2026 snippet from Events Manager | FB/IG ad conversion attribution | Mandatory: PROJECT.md requirement; place in `<head>` |
### Backend (Vercel Function — one new file)
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Vercel Functions (Node.js runtime) | 22.x or 24.x | `POST /api/ar-lead` handler | Existing repo uses `api/*.js` ESM pattern; same deploy pipeline |
| Node.js | **22.x** (pin via `package.json engines`) | Runtime | Current `package.json` already has `"node": ">=20"`; Vercel default jumped to 24.x in 2026 — pin explicitly to 22.x for stability + matches existing prod (avoid silent runtime bump). Plan upgrade to 24.x before Node 22 EOL (Apr 2027). |
| `googleapis` | `^144.0.0` (already installed) | Sheets v4 write | Reuse exact pattern from `api/_sheets.js:21-26` |
| Service account auth via `GOOGLE_SERVICE_ACCOUNT_JSON` env var | — | Sheets API auth | Already proven in `_sheets.js`; new sheet ID just needs share with the same service account email |
| Built-in `fetch` (Node 22+) | — | CAPI POST to `graph.facebook.com/v22.0` | No new dep needed — Node ≥18 ships global `fetch` |
| Built-in `crypto` (`node:crypto`) | — | SHA-256 hashing of PII for CAPI + `event_id` UUID | Required by Meta CAPI spec (hash email/phone before transmission) |
### Infrastructure
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Vercel (existing `solaryn` project) | — | Hosting + serverless | PROJECT.md constraint; same git-push pipeline |
| Google Sheets API v4 | — | Lead destination | PROJECT.md decision: NEW dedicated Sheet (separate from existing leads sheet ID `1uyItM4b7XLPbo2xgTbOrS99MWEz6Ls16MKtVBb1F6hA`) |
| Meta Pixel + Conversions API | Graph API v22.0+ | Client + server-side ad attribution | Browser Pixel alone is now degraded by iOS ITP/Safari/ad-blockers — CAPI restores accuracy. Required for FB ad budget efficiency. |
| Existing GA4 tag (`G-C2C8ZJP45L`) | — | Funnel analysis | Already site-wide via existing pages — page-view auto-tracked. Add a `lead_submit` custom event from the form success path. |
### Supporting "Libraries" (deliberately minimal)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **None added.** | — | — | Stick to what's in `package.json`: `formidable`, `googleapis`. The form is JSON (`Content-Type: application/json`) → `formidable` not needed. |
| `crypto.randomUUID()` | built-in | Generate `event_id` shared between Pixel & CAPI | Native since Node 19 / all evergreen browsers |
## Why NOT… (AVOID list, with reasoning)
| Avoid | Why |
|-------|-----|
| **Next.js / React / Vue / Svelte** | Violates PROJECT.md "zero build step" + "vanilla HTML/CSS/JS" constraint. SSR/RSC offers zero benefit for a 1-page lead form. Loads 80–200 KB of JS for a form a `<form>` already handles. |
| **Tailwind / Bootstrap / any CSS framework** | Repo style is hand-rolled CSS variables (see `affiliates.html:23-42`). Tailwind needs a build step. Bootstrap is LTR-first and bloats payload (>200 KB) — fatal on Moroccan 3G/4G mobile. |
| **TypeScript** | No build step allowed; adds compile/type-check overhead for a 1-page project. `_sheets.js` is plain JS — stay consistent. |
| **Form library (React Hook Form, Formik, etc.)** | Native HTML5 form validation (`required`, `pattern`, `inputmode`) covers all 5 fields. See `affiliates.html:449,452,471,478` for proven pattern. |
| **`formidable`** | Already in `package.json` but only needed for `multipart/form-data` (file uploads). This form is plain JSON — use `req.body` directly or `await new Response(req.body).json()` per Vercel Node 22 conventions. |
| **`axios` / `node-fetch`** | Node 22 ships global `fetch`. Adding axios = wasted 50 KB cold-start weight. |
| **`uuid` package** | `crypto.randomUUID()` is built-in. |
| **Vercel KV / Redis / Upstash for rate limiting** | YAGNI for a single ad-funnel landing. Use simple in-memory throttle by IP + honeypot field (already proven in `affiliates.html:446` `<input class="hp">`). If abuse appears post-launch, add Vercel WAF Rate Limiting (free on Pro). |
| **Web fonts beyond Cairo** | Tajawal / Noto Kufi are fine alternatives, but Cairo is already loaded site-wide → reuse browser cache, zero extra payload. |
| **GTM (Google Tag Manager)** | Adds 50–80 KB of JS + extra request to load Pixel through it. Hard-code Pixel snippet directly = faster + fewer ad-blocker false positives. |
| **Edge Runtime for `/api/ar-lead`** | `googleapis` SDK is Node-only (uses `googleapis-common` + `gaxios` w/ Node APIs). Use Node runtime explicitly. |
| **Multi-language toggle (FR/AR)** | PROJECT.md explicitly out-of-scope — Arabic darija only. Removes ~30% of `applyLang()` complexity from `affiliates.html`. |
| **Service worker / PWA** | One-shot lead capture, user leaves after submit. No offline value. |
## Alternatives Considered
| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Arabic font | **Cairo** | Tajawal, Noto Sans Arabic, Almarai | All viable; Cairo wins on cache reuse from existing pages + proven legibility at 16–18px mobile |
| Form submission | **fetch() → JSON → Vercel Function** | `<form action="/api/ar-lead" method="POST">` (no JS) | No-JS form works but breaks Meta Pixel `Lead` event firing + UX (no inline error msgs); JSON path matches `affiliates.html:797-806` |
| FB tracking | **Pixel + CAPI (dual)** | Pixel only | Pixel-only loses ~30–40% events to iOS 17+ ITP, Safari, ad-blockers in 2026; CAPI is now table stakes for paid acquisition |
| Lead destination | **Sheets API direct via service account** | Zapier webhook, Make.com, Airtable | Adds latency, monthly cost, and an external failure mode. Existing pattern works. |
| Phone validation | **Regex `^(0|\+212)[5-7][0-9]{8}$`** (matches affiliates.html:449) | libphonenumber-js | libphonenumber adds 140 KB+. Regex matches Solaryn's existing convention exactly. |
| Hosting | **Vercel (existing project)** | New separate Vercel project, Netlify | PROJECT.md explicit: same `solaryn` Vercel project, `/ar` route |
| Rate limiting | **Honeypot + naive IP throttle in-memory** | Vercel WAF, Upstash Redis | YAGNI day-1. WAF available if abuse appears. Honeypot proven in `affiliates.html:446`. |
## Concrete File Structure (Proposed)
- `https://solaryn.ma/ar/` → landing (form)
- `https://solaryn.ma/ar/merci` → thank-you page (Pixel `Lead` already fired before redirect; this page fires PageView only)
- `POST https://solaryn.ma/api/ar-lead` → JSON `{prenom, nom, tel, ville, adresse, event_id, fbp, fbc, website}` → returns `{ok:true, event_id}`
- `GOOGLE_SERVICE_ACCOUNT_JSON` — REUSE existing (same SA must be shared as Editor on the NEW sheet)
- `AR_LEADS_SHEET_ID` — NEW, the dedicated Sheet ID for this campaign
- `META_PIXEL_ID` — NEW, the FB Pixel ID (also hard-coded in `<head>` of `ar/index.html`)
- `META_CAPI_ACCESS_TOKEN` — NEW, system-user token from Meta Events Manager (server-side only, never exposed to client)
## Installation / Setup Steps
# 1. No npm install needed — googleapis already in package.json
# 2. Pin Node version explicitly (one-line edit to package.json)
#    "engines": { "node": "22.x" }   ← change from ">=20"
# 3. Add env vars in Vercel Dashboard → solaryn project → Settings → Environment Variables:
#    AR_LEADS_SHEET_ID            (production + preview)
#    META_PIXEL_ID                (production + preview, also fine in client code)
#    META_CAPI_ACCESS_TOKEN       (production + preview, NEVER NEXT_PUBLIC_*)
# 4. Create the dedicated Google Sheet, share it as Editor with the service account email
#    (same SA already used by api/_sheets.js — find email inside GOOGLE_SERVICE_ACCOUNT_JSON.client_email)
# 5. Header row in the new sheet (Sheet1!A1:J1):
#    timestamp_iso | prenom | nom | tel_normalized | ville | adresse | source | event_id | fbp | fbc
# 6. Deploy: git push → Vercel auto-deploys via existing pipeline
## Mobile-First / RTL Implementation Notes
| Concern | Recommendation | Rationale |
|---------|---------------|-----------|
| Viewport | `<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">` | Matches `affiliates.html:5`; prevents iOS zoom on input focus |
| Body font-size | `16px` minimum (Cairo 18px-equivalent visual weight) | Avoids iOS auto-zoom on input focus + research confirms +10–15% for Arabic legibility |
| Line-height | `1.7` for body Arabic, `1.5` for buttons | Arabic descenders need more breathing room than Latin |
| Form input height | ≥44 px tappable | Apple HIG / Android Material — thumb target |
| `inputmode="tel"` on phone field | yes | Triggers numeric keypad on mobile |
| `autocomplete` attrs | `given-name`, `family-name`, `tel`, `address-level2` (ville), `street-address` | Lets browsers offer Google Pay / autofill — major COD conversion lift |
| Logical CSS properties | `margin-inline-start` / `padding-inline-end` instead of `left`/`right` | Cleanly handles RTL without per-direction overrides |
| `dir="rtl"` on root | mandatory | Inherits to all children; flips flexbox + scrollbars correctly |
## Meta Pixel + CAPI Pattern (single source of truth — `event_id`)
## Confidence Assessment
| Area | Level | Reason |
|------|-------|--------|
| Vercel Node runtime (22.x pin) | HIGH | Verified via Vercel docs (updated 2026-02-27) — 24 is default, 22 still LTS-supported through Apr 2027 |
| googleapis pattern reuse | HIGH | Read `api/_sheets.js` directly; pattern is identical for the new file |
| Cairo font | HIGH | Already loaded in `affiliates.html:20`; Google Fonts catalog confirms variable-weight version available |
| Meta Pixel snippet | HIGH | Official Meta developer docs unchanged in core API since 2021; CAPI is current best practice in 2026 |
| Meta CAPI dual setup with shared `event_id` | HIGH | Multiple 2026 implementation guides confirm; matches Meta's official deduplication spec |
| MA phone regex `^(0|\+212)[5-7][0-9]{8}$` | HIGH | Already in production in `affiliates.html:449` — proven against real Solaryn affiliates' phones |
| Honeypot anti-spam | MEDIUM | Proven in repo (`hp` class in `affiliates.html`); won't stop sophisticated bots but is sufficient for ad-traffic landing day-1 |
| Skipping Vercel WAF / Edge rate-limiting day-1 | MEDIUM | YAGNI judgment call — easy to add later if abuse is observed |
## Quality Gate Checklist (per output instructions)
- [x] Versions current (Vercel docs 2026-02-27, googleapis 144 in package.json verified)
- [x] Rationale tied to PROJECT.md constraints (zero build, vanilla, mobile-first, RTL, COD MA, dedicated sheet)
- [x] Confidence levels per recommendation
- [x] Explicit AVOID list with reasoning
- [x] Concrete file structure proposed (`/ar/index.html`, `api/ar-lead.js`)
## Sources
- [Vercel — Supported Node.js versions (last updated 2026-02-27)](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions) — HIGH
- [Vercel changelog — Node.js 24 LTS GA for builds and functions](https://vercel.com/changelog/node-js-24-lts-is-now-generally-available-for-builds-and-functions) — HIGH
- [PkgPulse — Node 22 vs Node 24 in 2026 LTS upgrade guide](https://www.pkgpulse.com/guides/nodejs-22-vs-nodejs-24-2026) — MEDIUM (corroborates EOL dates)
- [Meta for Developers — Get Started with Meta Pixel](https://developers.facebook.com/docs/meta-pixel/get-started/) — HIGH
- [Ingest Labs — Meta CAPI Setup Guide 2026 (server-side + deduplication)](https://ingestlabs.com/blogs/meta-capi-setup-complete-implementation-guide-for-facebook-conversion-api-2026/) — MEDIUM
- [Analyzify — Deduplication in Meta Pixel + CAPI](https://analyzify.com/hub/event-deduplication-for-meta-conversions) — MEDIUM
- [Google Fonts — Cairo (Arabic + Latin variable font)](https://arabic-calligraphy-generator.com/fonts/cairo) — MEDIUM (also verified by presence in `affiliates.html:20`)
- [DTP Labs — RTL Typography Complete Guide](https://www.dtplabs.com/blog/rtl-typography-complete-guide-arabic-hebrew-farsi) — MEDIUM (Arabic +10–15% size, 1.7–1.8 line-height)
- [npm — @googleapis/sheets v12 (verifies API surface is stable)](https://www.npmjs.com/package/@googleapis/sheets) — HIGH
- [RegExr — Moroccan phone number pattern](https://regexr.com/399n8) — MEDIUM (also verified live in `affiliates.html:449`)
- [Vercel — WAF Rate Limiting (for future scaling)](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting) — HIGH
- Internal: `/Users/a2024/solaryn/api/_sheets.js`, `/Users/a2024/solaryn/affiliates.html`, `/Users/a2024/solaryn/package.json`, `/Users/a2024/solaryn/.planning/PROJECT.md` — HIGH (read directly this session)
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
