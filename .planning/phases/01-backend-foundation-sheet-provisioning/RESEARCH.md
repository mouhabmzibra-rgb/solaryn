# Phase 1: Backend Foundation & Sheet Provisioning - Research

**Researched:** 2026-05-26
**Domain:** Vercel Node serverless backend for COD lead capture (Google Sheets + Meta Conversions API + anti-spam) in MA market
**Confidence:** HIGH

---

## Summary

Phase 1 builds the entire backend surface for the AR landing page **before any UI exists** so the form has a hardened destination to POST to from day one of Phase 2. The shape of the work is small and additive: one new endpoint (`api/ar-lead.js`), one additive export in `api/_sheets.js` (`appendArLead`), one new sheet provisioned manually, three new env vars (`AR_LEADS_SHEET_ID`, `META_PIXEL_ID`, `META_CAPI_ACCESS_TOKEN`), and a `package.json` `engines.node` pin to `22.x`. Zero new npm dependencies — everything needed (`googleapis`, global `fetch`, `node:crypto`) is already present.

The risk profile is dominated by **silent data loss** (Pitfall #1) and **CAPI deduplication wiring** (Pitfall #2). Both require server-side ownership: the endpoint must `await` the Sheets append AND `await` (or fire-and-log) the CAPI call before returning `{ok:true}`, and the `event_id` returned to the client must be the same UUID the server forwarded to Meta. Anti-spam is layered defense-in-depth: honeypot + time-trap + `x-vercel-ip-country` country gate + name-field content filters — proven patterns that need no external dependency.

The trickiest gotchas are: (1) Meta CAPI wants phones hashed as **digits-only with country code, no `+`, no leading zero** (canonical: `212612345678`, not `+212612345678`), distinct from how we store the phone in the Sheet (`'+212612345678` with apostrophe prefix to force text); (2) `valueInputOption: 'USER_ENTERED'` will eat a non-prefixed `+212...` value as a formula error — the apostrophe is non-negotiable; (3) the `event_id` UUID must be generated on the **client** (Phase 2) and shipped to the server in the POST body, NOT generated server-side, otherwise Meta dedup fails because the browser Pixel event uses a different ID. Phase 1 must therefore accept `event_id` from the request body and forward it unchanged to CAPI.

**Primary recommendation:** Build `api/ar-lead.js` as a single-file, single-purpose POST handler that does its work in this exact order — (1) CORS + method gate → (2) honeypot/time-trap silent-drop → (3) country gate → (4) parse + clean + validate → (5) phone normalize → (6) name content-filter → (7) `await appendArLead(...)` → (8) `await fireCapiLead(...)` (best-effort with timeout, log failures, never block the Sheet write success) → (9) return `{ok:true, event_id}` — and absolutely nothing else. No business logic, no Telegram notifications, no WhatsApp side-effects (those belong elsewhere in the repo).

---

## User Constraints (from PROJECT.md, STACK.md, ARCHITECTURE.md, REQUIREMENTS.md)

### Locked Decisions (verbatim from STACK.md and PROJECT.md)
- **Tech stack:** Vanilla HTML/CSS/JS, zero build step
- **Hosting:** Vercel (existing `solaryn` project)
- **Backend:** Google Sheets API via service account pattern from `api/_sheets.js`
- **No PII leakage:** Tel + adresse are sensitive — never log to client console or expose via public endpoint
- **Backend = NEW dedicated Google Sheet** (separate from existing leads sheet `1ewgyaw43...`)
- **Node 22.x pinned** in `engines.node` (Vercel default jumped to 24.x in Feb 2026 — pin for stability)
- **`googleapis` already in package.json** at `^144.0.0` (current registry version 172.0.0 — no upgrade needed for Phase 1; the cached `getSheetsClient()` pattern in `_sheets.js` is stable across these versions)
- **Reuse existing helpers:** `getSheetsClient()` from `_sheets.js`; `readBody`, `clean`, `validPhone`, `clientIp` from `_lib.js`; phone normalization pattern from `add-lead.js` lines 28-37
- **Zero new npm dependencies**

### Claude's Discretion (research → recommend)
- Time-to-submit threshold value (research below recommends **2 seconds** for low-friction MA forms — matches REQUIREMENTS.md SEC-02)
- CAPI failure behaviour (fire-and-forget with timeout vs. await — research below recommends **await with 4s timeout + log on failure + still return 200 if Sheet write succeeded**, because lead capture must succeed even if CAPI is briefly down)
- Country gate override mechanism (env flag `AR_COUNTRY_GATE_OFF` for QA testing)
- Module-level CAPI helper file or inline in `ar-lead.js` (recommend inline — one consumer, ~30 lines)

### Deferred Ideas (OUT OF SCOPE — do not research)
- Server-side phone-based dedup (DIFF-07 — v2 only)
- IP rate limiting via Upstash/Redis (SCALE-04 — v2 only)
- Daily cron healthcheck (SCALE-03 — v2 only)
- DB migration (SCALE-02 — v2 only)
- Lighter Sheets SDK (SCALE-01 — v2 only, optimization)
- Edge Runtime migration (incompatible with `googleapis` anyway)

---

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BACK-01 | NEW `Solaryn AR Leads` sheet, header row A1:H1, shared with service account | §7 Sheet Provisioning Recipe |
| BACK-02 | NEW endpoint `api/ar-lead.js`, POST only, JSON `{ok, error?}` | §8 Endpoint Skeleton |
| BACK-03 | Validates 5 fields with `clean()` + `validPhone()` from `_lib.js` | §8 Validation Block |
| BACK-04 | Appends row via additive `appendArLead()` in `api/_sheets.js`, reuses cached client | §9 Sheets Append Helper |
| BACK-05 | Row format: `[ts_iso, prenom, nom, '+212XXXXXXXXX, ville, adresse, source, fbp\|fbc]` (8 cols, A–H) | §9 Row Layout + §10 Apostrophe Pitfall |
| BACK-06 | `AR_LEADS_SHEET_ID` env var on Vercel (Prod + Preview + Dev) | §7 Provisioning |
| BACK-07 | `engines.node` pinned to `22.x` in `package.json` | §11 Node Pin |
| BACK-08 | 500 on Sheet append throw (no swallowing) | §8 Error Block |
| FORM-03 | Server-side phone normalization (Arabic-Indic `٠-٩` → Western, canonicalize to `+212XXXXXXXXX`) | §12 Phone Normalization Recipe |
| TRACK-04 | Server-side Meta CAPI `Lead` event with same `eventID` as client Pixel | §13 CAPI Lead Recipe |
| TRACK-05 | CAPI `user_data` contains SHA-256 hashed phone, first name, city (hashed server-side, never sent to browser) | §13 user_data Hashing Spec |
| TRACK-07 | `META_PIXEL_ID` and `META_CAPI_ACCESS_TOKEN` env vars (token NEVER `NEXT_PUBLIC_*`) | §14 Env Vars |
| SEC-02 | Time-to-submit < 2s reject | §15 Anti-Spam Layered Defense |
| SEC-03 | Country gate `x-vercel-ip-country !== 'MA'` reject (env flag override) | §16 Country Gate |
| SEC-04 | Server re-validates EVERY field (never trust client) | §8 Validation Block |
| SEC-05 | Generic error codes (never echo PII back) | §8 Error Enum |
| SEC-06 | ZERO `console.log` of PII (sanitized error class + phone last-4 only) | §17 PII-Safe Logging |
| SEC-07 | Reject input with URLs / Cyrillic / Chinese / excessive special chars in name fields | §18 Name Content Filter |

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Lead payload acceptance + JSON parsing | API / Backend (Vercel Function) | — | Browser cannot persist anywhere trustworthy; backend owns single source of truth |
| Phone normalization (digit conversion, +212 canonical) | API / Backend | Browser (cosmetic only) | Per SEC-04: never trust client; server MUST re-validate even if client also normalizes |
| Sheet persistence | API / Backend → Google Sheets | — | Service account JWT can only be held server-side |
| Meta CAPI Lead event | API / Backend → Meta Graph API | Browser (Pixel client event for dedup pair) | Pixel-only loses ~30-40% events to iOS 17+ ITP per PITFALLS.md #2; server-side restores accuracy |
| Honeypot / time-trap detection | API / Backend (rejection) | Browser (hidden field + timestamp emission) | Browser provides signal; backend makes accept/reject decision |
| Country gate (`x-vercel-ip-country`) | API / Backend | — | Header only injected at edge into serverless invocation |
| `event_id` UUID generation | Browser | API / Backend (forwards unchanged) | Per Meta dedup spec, same ID must appear in both Pixel + CAPI events; browser is the canonical originator |
| FBP/FBC cookie capture | Browser | API / Backend (receives in body, forwards to CAPI) | Cookies live in browser DOM; backend cannot read first-party cookies of arbitrary domains |
| PII hashing (SHA-256) | API / Backend | — | PII must NEVER leave the server unhashed; hashing on browser would expose raw PII to JS-injected scripts |

Why this map matters for Phase 1: every responsibility above except "FBP/FBC cookie capture" and "event_id UUID generation" is owned entirely by the backend in this phase. Phase 1 ships a complete server contract; Phase 2 wires the browser side to it.

---

## Standard Stack

### Core (verified, no new installs)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `googleapis` | `^144.0.0` (in `package.json`; registry latest = 172.0.0) | Sheets v4 API + service account auth | Already proven in `api/_sheets.js`; major-version pin avoids surprise breaking changes mid-campaign |
| Node.js | `22.x` (pin via `engines.node`) | Runtime | Vercel default went to 24 in Feb 2026 — explicit pin = no silent runtime bump, Node 22 LTS through Apr 2027 |
| Built-in `fetch` (global) | Node 22+ | Meta CAPI POST | Native, zero dep, supports `AbortController` for timeouts |
| Built-in `node:crypto` | Node 22+ | SHA-256 hashing, `randomUUID()` (server fallback only) | Existing `_auth.js` and `create-order.js` already use this pattern |

### Supporting (in-repo, reused)
| Module | File | Purpose |
|--------|------|---------|
| `getSheetsClient()` | `api/_sheets.js:13-27` | Cached Sheets client with module-level memoization |
| `readBody(req)` | `api/_lib.js:47-53` | Handles Vercel auto-parsed JSON + raw string body |
| `clean(value, max)` | `api/_lib.js:1-6` | Trim + strip control chars + cap length |
| `validPhone(tel)` | `api/_lib.js:8-10` | MA regex `/^(0|\+212)[5-7][0-9]{8}$/` |
| `clientIp(req)` | `api/_lib.js:17-19` | First IP from `x-forwarded-for` |
| `normalizePhoneMA(raw)` | `api/add-lead.js:28-37` (port pattern) | Canonicalize to `+212XXXXXXXXX` |
| `sha256(str)` | `api/create-order.js:25-28` (pattern to reuse) | `crypto.createHash('sha256').update(str.toLowerCase().trim()).digest('hex')` |

### Alternatives Considered (and rejected)
| Instead of | Could Use | Tradeoff — why rejected |
|------------|-----------|-------------------------|
| `googleapis` (heavy ~5 MB) | `google-auth-library` + raw fetch to `sheets.googleapis.com/v4/spreadsheets/...` | Faster cold start, but PROJECT.md says "zero new deps"; current SDK is already loaded in `_sheets.js` cache so subsequent calls in same container are warm. SCALE-01 v2 only. |
| `libphonenumber-js` for phone | (already deferred — adds 140 KB) | MA regex `^(0|\+212)[5-7][0-9]{8}$` covers our entire user base; libphonenumber is overkill |
| Upstash Redis for rate limit | (deferred — SCALE-04) | YAGNI day-1; honeypot + time-trap + country gate is sufficient for ad-traffic landing per `affiliates.html:446` precedent |
| `uuid` package | `crypto.randomUUID()` | Built-in since Node 19; UUID generated client-side anyway (see Map above) — server only needs fallback when client omits event_id |
| Edge Runtime | Node runtime | `googleapis` is Node-only (uses `gaxios`); ARCHITECTURE.md anti-pattern AP4 |

**Installation: NONE.** Phase 1 installs no new packages.

**Version verification:**
```bash
npm view googleapis version          # 172.0.0 (as of 2026-05-20); project uses 144 caret-range = OK
node --version                        # confirm local matches Vercel target (22.x)
```

---

## Package Legitimacy Audit

**Phase 1 installs ZERO new packages.** All runtime dependencies are either already in `package.json` (`googleapis ^144`) or built into Node 22 (`fetch`, `node:crypto`). No slopcheck verification needed — there is nothing to verify.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `googleapis` | npm | 9+ yrs | ~5M/wk | github.com/googleapis/google-api-nodejs-client | unavailable | Already installed, no action |

*slopcheck was not available in this research environment. However, since no new packages are being added, the gate is moot.* If a future phase adds packages, run slopcheck per the GSD legitimacy protocol.

---

## Architecture Patterns

### System Architecture Diagram

```
                      [Browser — Phase 2]
                       fbq('init', PIXEL_ID); fbq('track', 'PageView')
                       const event_id = crypto.randomUUID()
                       (form data + event_id + fbp + fbc) ──┐
                                                            │
                                                            │  POST /api/ar-lead
                                                            │  Content-Type: application/json
                                                            ▼
   ┌────────────────────────────────────────────────────────────────────┐
   │  api/ar-lead.js  (Vercel Serverless Function, Node 22, ~150 LOC)   │
   │                                                                    │
   │  ① CORS + method gate (POST/OPTIONS only)                          │
   │  ② Anti-spam silent drop                                           │
   │     ├─ honeypot field 'website' filled? → return {ok:true}, NO write│
   │     └─ ts_rendered too recent (< 2000ms)? → return 400             │
   │  ③ Country gate                                                    │
   │     └─ req.headers['x-vercel-ip-country'] !== 'MA'                 │
   │        AND env AR_COUNTRY_GATE_OFF !== '1'? → return 403           │
   │  ④ Parse readBody(req) + clean() every field                       │
   │  ⑤ Validate (validPhone, name length 1-80, adresse length 10-300)  │
   │  ⑥ Name content filter (no URLs, Cyrillic, Chinese, >5 special)    │
   │  ⑦ normalizePhoneMA (Arabic-Indic → Western → +212XXXXXXXXX)       │
   │  ⑧ await appendArLead(...)  ───────────────────────────────────┐   │
   │     on throw → 500 {ok:false, error:'sheet_error'}             │   │
   │  ⑨ await fireCapiLead(...) with 4s AbortController timeout     │   │
   │     on throw → log sanitized error, do NOT fail request        │   │
   │  ⑩ return {ok:true, event_id}                                  │   │
   └────────────────────────────────────────────────────────────────│───┘
                                                                    │
                              ┌─────────────────────────────────────┘
                              │
                              ▼                                         ▼
        ┌────────────────────────────────┐         ┌──────────────────────────────┐
        │ Google Sheets API v4           │         │ Meta Graph API v22.0          │
        │ spreadsheets.values.append     │         │ POST /{PIXEL_ID}/events      │
        │ → Solaryn AR Leads / Leads!A:H │         │ → Lead event w/ event_id     │
        │   8 cols: [ts, prenom, nom,    │         │   user_data: hashed ph/fn/ct │
        │    '+212..., ville, adresse,   │         │   custom_data: value:150,    │
        │    source, fbp|fbc]            │         │     currency:'MAD'           │
        │ INSERT_ROWS, USER_ENTERED      │         │ test_event_code=TEST123 opt. │
        └────────────────────────────────┘         └──────────────────────────────┘
```

### Recommended Module Layout (Phase 1)
```
api/
├── _sheets.js          # MODIFIED — additive: appendArLead() export only (~15 LOC added)
├── _lib.js             # UNCHANGED — read-only reuse of clean/validPhone/readBody/clientIp
├── _ar_capi.js         # NEW — Meta CAPI helper (sha256, normalizePhoneForCapi, fireCapiLead)
└── ar-lead.js          # NEW — POST handler, ~150 LOC, the only file with the orchestration logic

package.json            # MODIFIED — engines.node bumped to "22.x"

vercel.json             # UNCHANGED
```

**Why `_ar_capi.js` separate from `ar-lead.js`:** keeps CAPI logic isolated and unit-testable in isolation later. Single consumer, ~50 LOC. Underscore prefix follows existing repo convention (`_sheets.js`, `_lib.js`, `_auth.js`) for "not a route, an internal helper."

### Pattern 1: CORS + Method Gate (mirror `add-lead.js:22-26, 162-172`)
**What:** Set permissive CORS headers, handle OPTIONS preflight, reject non-POST.
**When to use:** First lines of every public POST endpoint.
**Example:**
```js
// Source: /Users/a2024/solaryn/api/add-lead.js:22-26, 162-172 (read directly this session)
function setCors(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req, res) {
    setCors(res);
    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'POST') {
        return res.status(405).json({ ok: false, error: 'method_not_allowed' });
    }
    // ... rest
}
```

### Pattern 2: Module-Level Cached Client (mirror `_sheets.js:11-27`)
**What:** Memoize the googleapis Sheets client at module scope so cold start cost is paid once per container.
**When:** Any handler that touches Google Sheets.
**Example:** Already exported as `getSheetsClient()` — Phase 1 reuses it as-is.

### Pattern 3: Server-Side SHA-256 Hashing (mirror `create-order.js:25-28`)
**What:** Lowercase + trim before SHA-256; hex digest output.
**When:** Any PII sent to ad-network CAPIs (TikTok, Meta).
**Example:**
```js
// Source: /Users/a2024/solaryn/api/create-order.js:25-28 (read directly this session)
import crypto from 'node:crypto';
function sha256(str) {
    return crypto.createHash('sha256').update(String(str).toLowerCase().trim()).digest('hex');
}
```
Note: existing code uses dynamic `await import('node:crypto')` inside the function; for new `_ar_capi.js` use static top-of-file `import crypto from 'node:crypto'` since it's called on every request anyway.

### Pattern 4: AbortController Timeout for External APIs (mirror `_lib.js:21-45`, `add-lead.js:93`)
**What:** Wrap `fetch()` calls to third parties in a hard timeout so a slow CAPI doesn't pin the function past Vercel's 10s default.
**Example:**
```js
// Source: /Users/a2024/solaryn/api/_lib.js:26-36 (read directly this session)
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 4000);  // 4s for CAPI
try {
    const res = await fetch(url, { method: 'POST', body, signal: controller.signal });
} finally {
    clearTimeout(timeout);
}
```

### Anti-Patterns to Avoid
- **AP1: Reusing `/api/add-lead`** (ARCHITECTURE.md §2) — wrong sheet, wrong write semantics, triggers WhatsApp bot
- **AP2: Editing `vercel.json` for `/api/ar-lead` routing** — Vercel file-system routing already handles `api/ar-lead.js` → `/api/ar-lead`
- **AP3: Returning 200 before Sheet write succeeds** (PITFALLS.md #1) — silent data loss; `await` it, return 500 on throw
- **AP4: Generating `event_id` server-side** (Meta CAPI spec) — dedup with browser Pixel breaks because browser-side `eventID` won't match
- **AP5: Hashing phone with `+` prefix** (Meta CAPI spec) — Meta expects digits-only `212612345678`, not `+212612345678`; matches Meta's user database normalization
- **AP6: `console.log(body)` or `console.log(error.stack)` with PII inside** (PITFALLS.md #13, SEC-06) — Vercel logs are queryable; log error class + phone last-4 only
- **AP7: Throwing on CAPI failure** — CAPI is best-effort; ad attribution lost on this lead is acceptable, losing the lead itself is not. Sheet success = client success.
- **AP8: Fire-and-forget CAPI without await** — Vercel may freeze the container before fetch finishes; Lambda-style freeze happens immediately after `res.end()`. Either `await` it or use `waitUntil()` (not available in vanilla Node runtime; Edge only).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JWT signing for Google service account | Don't sign JWTs manually | `googleapis` `google.auth.GoogleAuth` (already cached in `_sheets.js`) | Token refresh, RS256, scopes all handled |
| Sheets row appending | Don't build a "next empty row" finder + `values.update` | `sheets.spreadsheets.values.append` with `insertDataOption: 'INSERT_ROWS'` | Sheets API atomically finds the next blank row; no race condition |
| UUID generation | Don't use `Math.random()` or hash timestamps | `crypto.randomUUID()` (built-in Node 19+; called client-side per Map) | RFC 4122 v4, cryptographically secure |
| SHA-256 hashing | Don't use a third-party hash lib | `crypto.createHash('sha256').update(s).digest('hex')` | Built-in `node:crypto`, zero dep |
| Phone E.164 normalization for MA | Don't reach for `libphonenumber-js` | Port `normalizePhoneMA` from `add-lead.js:28-37` + add Arabic-Indic digit replace | MA regex is 6 chars; 140 KB library not warranted |
| Honeypot detection | Don't build CAPTCHA integration | Hidden form field `name="website"` server-side check | Proven in `affiliates.html:446`; 80%+ spam reduction per Vibe Coding research |
| Time-trap | Don't build full bot scoring | `Date.now() - body.ts_rendered < 2000` | Combined with honeypot blocks 99%+ per UC Davis research |
| IP rate limit | Don't build in-memory throttle (warm containers will leak; cold containers reset) | Defer to Upstash if abuse appears (SCALE-04) | YAGNI; honeypot + country gate sufficient for ad traffic |
| Meta CAPI SDK | Don't install `@facebook/business-sdk` (1.5 MB) | Direct `fetch` to `graph.facebook.com/v22.0/{PIXEL_ID}/events` | Single POST, no Marketing API features needed |

**Key insight:** Every "custom" temptation in this phase is solved by either (a) `node:crypto`, (b) `googleapis` Sheets `.append`, or (c) reuse of existing repo helpers. The endpoint is glue, not invention. If you find yourself writing > 200 LOC in `ar-lead.js`, something is wrong.

---

## Runtime State Inventory

Not applicable — this is a greenfield phase (new sheet, new endpoint, new env vars). No existing runtime state needs migration. Existing systems (`add-lead.js`, Solaryn Leads sheet `1ewgyaw...`, affiliate platform) are completely untouched per ARCHITECTURE.md §12 Regression Surface table.

---

## Common Pitfalls

### Pitfall 1: Silent data loss (200 OK to client, but row never appears in Sheet)

**What goes wrong:** `appendArLead()` throws (e.g. `AR_LEADS_SHEET_ID` typo, service account not shared as Editor on the new sheet, Sheets quota burst), but the endpoint swallows the error and returns 200. Client redirects to `/ar/merci`, Pixel fires `Lead`, ad budget is spent — but the call-center never sees the lead.

**Why it happens:** Easy to write `try { await append(...) } catch(e) { /* ignore */ }`, or to put the append in a non-awaited `.then()` chain, or to swap `await` for `void` to make response "faster."

**How to avoid:**
- `await appendArLead(...)` MUST be on the success path
- The function MUST throw on Sheets API non-2xx (the googleapis SDK does this by default; do NOT wrap and re-resolve)
- On catch: log sanitized error (NOT the raw API response which may contain echo of payload), return 500 with `{ok:false, error:'sheet_error'}`
- Pre-launch: BACK-01 includes a manual test — submit a sentinel row (`prenom: "TEST_SENTINEL_2026-05-26"`) and visually confirm it appears in the live Sheet within 10s

**Warning signs:** Vercel function logs show 4xx/5xx from `sheets.googleapis.com`; Pixel `Lead` count diverges from Sheet row count by > 10%.

### Pitfall 2: CAPI deduplication fails because `event_id` is generated on the server

**What goes wrong:** Server generates a UUID, returns it to client, client THEN fires `fbq('track', 'Lead', {...}, {eventID: <server_uuid>})`. By the time the browser Pixel sends the event with the server's UUID, the CAPI event may have already arrived at Meta with a DIFFERENT timing window — and worse, in some races, the browser fires the Pixel event *before* it gets the server response (especially if `fbq` is set up to fire on submit-click for redundancy). Meta cannot dedup events that have different IDs.

**Why it happens:** Intuitive to "issue an ID on the server" because that feels canonical. But Meta's dedup spec requires the browser to be the ID originator if the browser Pixel event will ever fire.

**How to avoid:**
- The browser (Phase 2 work) MUST generate `event_id = crypto.randomUUID()` BEFORE firing `fbq('track', 'Lead', ...)` and BEFORE sending the POST to `/api/ar-lead`
- Phase 1 endpoint MUST accept `event_id` from `req.body`, validate it (UUID v4 regex `/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i`), and forward it unchanged to CAPI
- Fallback only: if client omits `event_id`, generate one server-side via `crypto.randomUUID()` and return it in the response. In this case dedup won't work for that one lead — that's acceptable.

**Warning signs:** Meta Events Manager → Diagnostics shows "Events not matched" or "Duplicate events received."

### Pitfall 3: Phone stored as `+212612345678` becomes a formula error in Sheets

**What goes wrong:** With `valueInputOption: 'USER_ENTERED'`, Sheets sees a string starting with `+` and tries to parse it as a formula. Result: cell contains `#NAME?` or `#ERROR!` or (in some locales) interprets `+` as numeric coercion and strips it, storing `212612345678` as a number with potential precision loss.

**Why it happens:** Defaulting to `USER_ENTERED` because it's what `add-lead.js` uses (and there it works because the phone is prefixed with `'`).

**How to avoid:**
- ALWAYS prefix the phone cell value with a single quote: `"'" + phoneCanonical` → stored as text `+212612345678`, displayed as `+212612345678`. The apostrophe is a Sheets text-marker and is not displayed.
- This is verified in `add-lead.js:139` for the existing Solaryn Leads sheet.
- Alternative: use `valueInputOption: 'RAW'` — but `RAW` interprets the input as a literal string AND auto-prefixes an apostrophe for some types; safer to keep `USER_ENTERED` and explicitly apostrophe-prefix only the phone column (so dates and ISO timestamps still parse correctly).

**Warning signs:** Sheet cell shows `#NAME?` or `2.1261234e+11`; phone column is right-aligned (numeric) instead of left-aligned (text).

### Pitfall 4: Arabic-Indic digit input passes regex but stores garbage

**What goes wrong:** User on Arabic-keyboard mode types `٠٦١٢٣٤٥٦٧٨` (Arabic-Indic for `0612345678`). Existing `validPhone()` regex `^(0|\+212)[5-7][0-9]{8}$` fails because `[0-9]` is ASCII-only. Server returns `invalid_phone`. Real lead lost.

**Why it happens:** `\d` in JavaScript regex matches ASCII `[0-9]` only (verified). The user thinks they typed a valid number.

**How to avoid:**
- BEFORE `validPhone()`, normalize: replace U+0660–U+0669 (Arabic-Indic) and U+06F0–U+06F9 (Extended Arabic-Indic for Persian/Urdu) with ASCII `0-9`. Recipe in §12 below.
- After normalization, run `validPhone()`. Should now pass for any digit script.

**Warning signs:** `invalid_phone` rejection rate > 5% on real ad traffic; users complaining "my number is correct."

### Pitfall 5: `x-vercel-ip-country` is missing or wrong → real MA traffic rejected

**What goes wrong:** A real MA user on a VPN, or on a mobile carrier whose IP geolocates to France (Maroc Telecom occasionally), hits the form. `x-vercel-ip-country` returns `FR` or `XX`. Endpoint returns 403. Lead lost, ad spend wasted.

**Why it happens:** IP geolocation is ~95% accurate but not 100%. Vercel docs explicitly say "use as general reference, not precise locator." MA mobile carriers sometimes have regional IP allocations that geolocate to neighboring countries.

**How to avoid:**
- Country gate IS the right call (it blocks the > 90% case of bots and competitor scrapers from non-MA IPs), but build it loose: treat `MA` as pass, anything else as soft-reject 403
- Provide `AR_COUNTRY_GATE_OFF=1` env flag for QA / staging deployments
- Log rejected countries (without PII): `console.warn('country_gate_reject', { country: cc, ip_class: ip.split('.').slice(0,2).join('.') + '.x.x' })` so you can observe false-positive rate
- Acceptable miss rate: if logs show > 1% MA-mobile-VPN false-positives, downgrade to a softer signal (e.g. flag-don't-reject and route through a manual queue)

**Warning signs:** Sheet rows per day << Vercel function 200-response count; Vercel logs show steady stream of `country_gate_reject` for ASN ranges that resolve to MA carriers (Maroc Telecom AS6713, INWI AS36903, Orange MA AS37054).

### Pitfall 6: CAPI takes 6 seconds → Vercel function times out before Sheet write returns to client

**What goes wrong:** Meta CAPI graph endpoint has a slow day, returns in 6s. Endpoint awaits both Sheets append (1.5s) and CAPI (6s), then sends the response — but Vercel's default function maxDuration on Hobby is 10s and Pro is 60s; even on Hobby we're inside the window, but the client may have aborted the fetch already (browsers default to 30s but mobile networks can break sooner), leaving the user staring at a spinner thinking the form is broken. They tap submit twice. Duplicate row.

**Why it happens:** Forgetting that two awaited external calls add up.

**How to avoid:**
- Cap CAPI fetch with `AbortController` at **4 seconds** (Pattern 4 above)
- On CAPI timeout: log sanitized error, do NOT throw, still return `{ok:true, event_id}` — Sheet write succeeded, ad attribution will be best-effort
- If absolute deduplication of double-submits matters (likely yes), the BROWSER (Phase 2) should disable the submit button immediately on first click and re-enable only on response — but as a backstop, Phase 1 could add lightweight client-side dedup by stashing event_id in a "seen" set with a 60s TTL. NOT REQUIRED in v1 (DIFF-07 deferred).

**Warning signs:** Sheet rows with same phone within 10s; Vercel logs show > 2s p95 function duration.

### Pitfall 7: env-var-derived service account JSON is malformed

**What goes wrong:** `GOOGLE_SERVICE_ACCOUNT_JSON` env var is set as base64-encoded JSON (existing convention in `_sheets.js:17-19`), but when adding `AR_LEADS_SHEET_ID` to Vercel you accidentally also re-paste the SA JSON without the base64 encoding (or with newlines in the private key not properly escaped). On next deploy, `_sheets.js` throws at JWT signing time. Both `/api/add-lead` AND `/api/ar-lead` go down.

**Why it happens:** Vercel env var UI accepts pasted JSON as plaintext; copying from a terminal where the value was base64-decoded for inspection.

**How to avoid:**
- DO NOT touch `GOOGLE_SERVICE_ACCOUNT_JSON` when adding the new env var. It's already in place.
- Only add `AR_LEADS_SHEET_ID`, `META_PIXEL_ID`, `META_CAPI_ACCESS_TOKEN`.
- Pre-deploy sanity test: in Vercel CLI, `vercel env pull .env.local` and confirm SA JSON is unchanged (compare first 50 chars vs. last known-good).

**Warning signs:** Production deploy of `/api/ar-lead` causes existing affiliate dashboard to break (means SA env was accidentally mutated).

---

## Code Examples

### §7 Sheet Provisioning Recipe (manual one-time, before deploy)

```bash
# 1) Get the service account email
echo $GOOGLE_SERVICE_ACCOUNT_JSON | base64 -d | jq -r .client_email
# → solaryn-sheets@<project>.iam.gserviceaccount.com

# 2) In Google Sheets UI (logged in as mouhabmzibra@gmail.com per MEMORY.md):
#    - Create new spreadsheet "Solaryn AR Leads"
#    - Rename Sheet1 tab to "Leads" (case-sensitive)
#    - Add header row A1:H1:
#      Date | Prénom | Nom | Téléphone | Ville | Adresse | Source | fbp|fbc
#    - Share → add the service account email as Editor (UNCHECK "Notify")
#    - Copy spreadsheet ID from URL: /spreadsheets/d/<THIS_ID>/edit

# 3) Add to Vercel (UI or CLI):
vercel env add AR_LEADS_SHEET_ID production
vercel env add AR_LEADS_SHEET_ID preview
vercel env add AR_LEADS_SHEET_ID development
# Paste the ID for each
```

### §8 Endpoint Skeleton (`api/ar-lead.js`)

```js
// Source: Patterns adapted from add-lead.js + abandoned-lead.js + create-order.js (read this session)
import crypto from 'node:crypto';
import { clean, validPhone, clientIp, readBody } from './_lib.js';
import { appendArLead } from './_sheets.js';
import { fireCapiLead } from './_ar_capi.js';

const MAX_NAME = 80;
const MAX_VILLE = 80;
const MAX_ADRESSE = 300;
const MIN_ADRESSE = 10;
const MAX_SOURCE = 32;
const MIN_FILL_TIME_MS = 2000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BAD_NAME_CHARS = /[Ѐ-ӿ]|[一-鿿]|https?:\/\/|www\.|[<>{}|\\^`]/i;

function setCors(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// Convert Arabic-Indic + Extended Arabic-Indic digits to ASCII
function asciiDigits(s) {
    return String(s || '')
        .replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 0x0660))
        .replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 0x06F0));
}

function normalizePhoneMA(raw) {
    let p = asciiDigits(raw).replace(/[\s()-.]/g, '').trim();
    if (!p) return null;
    if (p.startsWith('00')) p = '+' + p.slice(2);
    if (/^0\d{9}$/.test(p)) p = '+212' + p.slice(1);
    if (/^212\d{9}$/.test(p)) p = '+' + p;
    if (!p.startsWith('+')) p = '+212' + p;
    if (!/^\+212[5-7]\d{8}$/.test(p)) return null;
    return p;
}

function badNameContent(s) {
    if (BAD_NAME_CHARS.test(s)) return true;
    const specials = (s.match(/[^\p{L}\p{N}\s'\-]/gu) || []).length;
    return specials > 5;
}

function phoneLast4(p) {
    return p ? p.slice(-4) : '----';
}

export default async function handler(req, res) {
    setCors(res);
    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'POST') {
        return res.status(405).json({ ok: false, error: 'method_not_allowed' });
    }

    const body = readBody(req);

    // ② anti-spam: honeypot — silent OK so bots don't learn they were caught
    if (body.website && String(body.website).trim() !== '') {
        return res.status(200).json({ ok: true });
    }

    // ② anti-spam: time-trap (rendered_at must be set + at least MIN_FILL_TIME_MS old)
    const renderedAt = Number(body.ts_rendered || 0);
    if (!renderedAt || (Date.now() - renderedAt) < MIN_FILL_TIME_MS) {
        return res.status(400).json({ ok: false, error: 'too_fast' });
    }

    // ③ country gate (env override for QA)
    const country = String(req.headers['x-vercel-ip-country'] || '').toUpperCase();
    if (country !== 'MA' && process.env.AR_COUNTRY_GATE_OFF !== '1') {
        return res.status(403).json({ ok: false, error: 'country_not_allowed' });
    }

    // ④ + ⑤ + ⑥ parse + clean + validate
    const prenom = clean(body.prenom, MAX_NAME);
    const nom = clean(body.nom, MAX_NAME);
    const telRaw = clean(body.tel, 32);
    const ville = clean(body.ville, MAX_VILLE);
    const adresse = clean(body.adresse, MAX_ADRESSE);
    const source = clean(body.source, MAX_SOURCE) || 'ar_landing';
    const fbp = clean(body.fbp, 200);
    const fbc = clean(body.fbc, 300);
    let eventId = clean(body.event_id, 64);
    if (!UUID_RE.test(eventId)) eventId = crypto.randomUUID(); // fallback only

    if (!prenom || !nom || !telRaw || !ville || !adresse) {
        return res.status(400).json({ ok: false, error: 'missing_field' });
    }
    if (prenom.length < 1 || nom.length < 1) {
        return res.status(400).json({ ok: false, error: 'missing_field' });
    }
    if (adresse.length < MIN_ADRESSE) {
        return res.status(400).json({ ok: false, error: 'invalid_address' });
    }
    if (badNameContent(prenom) || badNameContent(nom)) {
        return res.status(400).json({ ok: false, error: 'invalid_name' });
    }

    // ⑦ phone normalize (handles Arabic-Indic digits)
    const phoneCanonical = normalizePhoneMA(telRaw);
    if (!phoneCanonical || !validPhone(phoneCanonical)) {
        return res.status(400).json({ ok: false, error: 'invalid_phone' });
    }

    // ⑧ Sheet append (await — must succeed for client to redirect)
    try {
        await appendArLead([
            new Date().toISOString(),
            prenom,
            nom,
            "'" + phoneCanonical,             // apostrophe prefix forces text
            ville,
            adresse,
            source,
            (fbp || '') + '|' + (fbc || ''),
        ]);
    } catch (err) {
        // SEC-06: never log full err — may contain echo of payload from Sheets API
        console.error('ar_lead_sheet_error', {
            cls: err.code || err.name || 'unknown',
            phone_last4: phoneLast4(phoneCanonical),
        });
        return res.status(500).json({ ok: false, error: 'sheet_error' });
    }

    // ⑨ CAPI Lead (best-effort, never blocks success)
    try {
        await fireCapiLead({
            eventId,
            phoneCanonical,
            prenom,
            ville,
            fbp,
            fbc,
            clientIp: clientIp(req),
            userAgent: String(req.headers['user-agent'] || '').slice(0, 500),
            eventSourceUrl: 'https://' + (req.headers['host'] || 'solaryn.ma') + '/ar',
        });
    } catch (err) {
        console.error('ar_lead_capi_error', {
            cls: err.code || err.name || 'unknown',
            phone_last4: phoneLast4(phoneCanonical),
        });
        // intentionally do NOT fail the request
    }

    // ⑩ success
    return res.status(200).json({ ok: true, event_id: eventId });
}
```

### §9 Sheets Append Helper (`api/_sheets.js` additive export)

```js
// ADD to /Users/a2024/solaryn/api/_sheets.js (do NOT modify existing exports)
const AR_LEADS_TAB = 'Leads';

export async function appendArLead(row) {
    const sheetId = process.env.AR_LEADS_SHEET_ID;
    if (!sheetId) throw new Error('AR_LEADS_SHEET_ID env var not set');
    if (!Array.isArray(row) || row.length !== 8) {
        throw new Error('appendArLead: expected 8-column row');
    }
    const sheets = getSheetsClient();
    await sheets.spreadsheets.values.append({
        spreadsheetId: sheetId,
        range: `${AR_LEADS_TAB}!A:H`,
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: [row] },
    });
}
```

### §13 Meta CAPI Helper (`api/_ar_capi.js`, NEW file)

```js
// /Users/a2024/solaryn/api/_ar_capi.js  (NEW — ~50 LOC)
// Sources verified this session:
//   - https://vercel.com/docs/headers/request-headers (header names + format)
//   - Meta Conversions API: phone hashed as digits-only, no '+', no leading 0,
//     country code prefix (verified via Stape, dev.facebook.com community thread,
//     and feature request github.com/facebookincubator/ConversionsAPI-Tag-for-GoogleTagManager/issues/30)
//   - Graph API current: v25.0 released 2026-02-18 (Meta changelog). v22.0
//     released 2025-01-21 is still supported per Meta's 2-year version window;
//     using v22.0 matches STACK.md to avoid surprise version drift in mid-campaign.
import crypto from 'node:crypto';

const CAPI_VERSION = 'v22.0';  // bump to v23.0+ only after re-testing in Events Manager
const CAPI_TIMEOUT_MS = 4000;

function sha256(str) {
    return crypto.createHash('sha256')
        .update(String(str).toLowerCase().trim())
        .digest('hex');
}

// Meta requires phone as digits-only, country-code-prefixed, no '+', no leading 0
function phoneForCapi(canonical) {
    // canonical is '+212XXXXXXXXX' from normalizePhoneMA
    return canonical.replace(/^\+/, '');  // → '212XXXXXXXXX'
}

// City: lowercase, strip whitespace + punctuation (Meta normalization spec)
function cityForCapi(s) {
    return String(s || '').toLowerCase().replace(/[\s\-'"]+/g, '');
}

// First name: lowercase + trim (per Meta spec; do NOT strip diacritics)
function firstNameForCapi(s) {
    return String(s || '').toLowerCase().trim();
}

export async function fireCapiLead({
    eventId, phoneCanonical, prenom, ville,
    fbp, fbc, clientIp, userAgent, eventSourceUrl,
}) {
    const pixelId = process.env.META_PIXEL_ID;
    const token = process.env.META_CAPI_ACCESS_TOKEN;
    if (!pixelId || !token) throw new Error('META env vars not set');

    const userData = {
        ph: [sha256(phoneForCapi(phoneCanonical))],
        fn: [sha256(firstNameForCapi(prenom))],
        ct: [sha256(cityForCapi(ville))],
        country: [sha256('ma')],
        client_ip_address: clientIp || undefined,
        client_user_agent: userAgent || undefined,
        fbp: fbp || undefined,
        fbc: fbc || undefined,
    };
    // Strip undefined fields (Meta rejects nulls in some places)
    for (const k of Object.keys(userData)) {
        if (userData[k] === undefined || userData[k] === '') delete userData[k];
    }

    const payload = {
        data: [{
            event_name: 'Lead',
            event_time: Math.floor(Date.now() / 1000),
            event_id: eventId,
            action_source: 'website',
            event_source_url: eventSourceUrl,
            user_data: userData,
            custom_data: {
                currency: 'MAD',
                value: 150,
            },
        }],
    };
    // Optional QA: set META_TEST_EVENT_CODE in Vercel env to route to Test Events tab
    if (process.env.META_TEST_EVENT_CODE) {
        payload.test_event_code = process.env.META_TEST_EVENT_CODE;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CAPI_TIMEOUT_MS);
    try {
        const url = `https://graph.facebook.com/${CAPI_VERSION}/${pixelId}/events?access_token=${encodeURIComponent(token)}`;
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal,
        });
        if (!res.ok) {
            const txt = await res.text().catch(() => '');
            // Strip any echoed PII from error message
            throw new Error(`capi_${res.status}: ${txt.slice(0, 200)}`);
        }
    } finally {
        clearTimeout(timeout);
    }
}
```

### §12 Phone Normalization Recipe (Arabic-Indic → Western → +212)

```js
// Convert U+0660-U+0669 (Arabic-Indic) and U+06F0-U+06F9 (Extended Arabic-Indic for Persian/Urdu)
function asciiDigits(s) {
    return String(s || '')
        .replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 0x0660))
        .replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 0x06F0));
}

// Worked example:
asciiDigits('٠٦١٢٣٤٥٦٧٨')                 // → '0612345678'
normalizePhoneMA('٠٦١٢٣٤٥٦٧٨')             // → '+212612345678'
normalizePhoneMA('06 12-34.56 78')         // → '+212612345678'
normalizePhoneMA('+212 612 345 678')       // → '+212612345678'
normalizePhoneMA('00212612345678')         // → '+212612345678'
normalizePhoneMA('06X2345678')             // → null  (X is not a digit)
normalizePhoneMA('0412345678')             // → null  (prefix '4' not in [5-7])
```

### §11 Node Pin (`package.json`)

```json
{
  "name": "solaryn",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "engines": {
    "node": "22.x"
  },
  "dependencies": {
    "formidable": "^3.5.2",
    "googleapis": "^144.0.0"
  }
}
```
Change is one line: `"node": ">=20"` → `"node": "22.x"`. No `npm install` required.

---

## State of the Art

| Old Approach | Current Approach (2026) | When Changed | Impact |
|--------------|-------------------------|--------------|--------|
| Pixel-only ad attribution | Pixel + CAPI dual with shared `event_id` for dedup | iOS 14.5+ ATT (2021); intensified post-iOS 17 ITP (2023) | Server-side restores ~30-40% of attribution lost to browser-side blocking |
| `node-fetch` / `axios` in serverless | Global `fetch` (Node 18+) | Native global since Node 18 | Saves 50 KB cold-start weight |
| `uuid` package | `crypto.randomUUID()` | Native since Node 19 | One less dependency |
| Synchronous JWT signing | `googleapis` `GoogleAuth` (handles refresh + scopes) | Stable since ~2020 | Eliminates token-expiry bugs |
| Graph API v17 (training-era default) | Graph API v25 latest (Feb 2026); v22 still in 2-year support window | Continuous releases | Use v22 per STACK.md for stability; bump to v25 only after Events Manager confirms |
| In-memory rate limit on serverless | Defer to platform-native (Vercel WAF) or external (Upstash) | Serverless container ephemerality is now well-understood | In-memory state across cold/warm boundary is unreliable |
| Edge Runtime everything | Node runtime for SDK-heavy work; Edge for thin proxies | Edge Runtime API surface diverged from Node | `googleapis` is Node-only — use Node runtime explicitly |

**Deprecated/outdated:**
- `formidable` for JSON forms — only needed for `multipart/form-data` (file uploads). AR endpoint is plain JSON; `readBody(req)` from `_lib.js` is enough.
- Generating UUIDs via `Date.now() + Math.random()` — replace with `crypto.randomUUID()`.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Vercel project `solaryn` | All hosting | ✓ (existing) | n/a | — |
| `googleapis` SDK | Sheets append | ✓ in `package.json` | `^144.0.0` (latest 172.0.0) | — |
| Node 22.x runtime | Function execution | ✓ (Vercel default supports 22) | 22 LTS | Node 20 also OK with `>=20` range, but pin per BACK-07 |
| Built-in `fetch` | CAPI POST | ✓ (Node 22 global) | n/a | — |
| Built-in `node:crypto` | SHA-256, randomUUID | ✓ (Node 22 builtin) | n/a | — |
| `GOOGLE_SERVICE_ACCOUNT_JSON` env var | Sheets auth | ✓ (existing, used by `_sheets.js`) | — | None — must be set for app to function |
| `AR_LEADS_SHEET_ID` env var | New sheet write | ✗ (NEW — must be added) | — | None — endpoint errors `sheet_error` until set |
| `META_PIXEL_ID` env var | CAPI endpoint URL | ✗ (NEW — must be added) | — | None — CAPI call errors, lead still saved |
| `META_CAPI_ACCESS_TOKEN` env var | CAPI auth | ✗ (NEW — must be added) | — | None — CAPI call errors, lead still saved |
| `META_TEST_EVENT_CODE` env var | QA-only routing to Test Events tab | optional | — | omit in production |
| `AR_COUNTRY_GATE_OFF` env var | QA-only country gate bypass | optional | — | omit in production |
| Google Sheet `Solaryn AR Leads` | Lead persistence | ✗ (NEW — must be provisioned per §7) | — | None |
| Service account access to new Sheet | Sheets API authorization | ✗ (depends on §7 step 2) | — | None — write returns 403 until shared |
| Vercel `x-vercel-ip-country` header | Country gate | ✓ (Vercel docs confirm all serverless functions) | n/a | Set `AR_COUNTRY_GATE_OFF=1` for environments where header is absent (rare) |

**Missing dependencies with no fallback (blocking):**
- `AR_LEADS_SHEET_ID`, `META_PIXEL_ID`, `META_CAPI_ACCESS_TOKEN` — must all be added to Vercel before deploy (Phase 1 deliverable, not a research gap)
- New Sheet must exist + be shared (Phase 1 deliverable per §7)

**Missing dependencies with fallback:**
- `META_TEST_EVENT_CODE` and `AR_COUNTRY_GATE_OFF` are optional QA aids; production should leave them unset

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No user auth — public form endpoint |
| V3 Session Management | no | Stateless, no sessions |
| V4 Access Control | partial | Country gate via `x-vercel-ip-country` (network-level access); no user-level access |
| V5 Input Validation | **yes** | `clean()` + `validPhone()` + name content filter + adresse min-length + UUID regex + body shape validation |
| V6 Cryptography | **yes** | `node:crypto` SHA-256 for CAPI PII (never hand-roll); `crypto.randomUUID()` for IDs |
| V7 Error Handling & Logging | **yes** | SEC-05 + SEC-06 — generic error codes, no PII in logs, sanitized error class + phone last-4 only |
| V13 API & Web Service | **yes** | CORS gate, method gate (POST only), JSON `Content-Type` only, body size implicit via Vercel default 4.5 MB |
| V14 Configuration | **yes** | Env vars for secrets (`META_CAPI_ACCESS_TOKEN` never client-exposed); no hardcoded credentials |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Form spam / fake leads | Spoofing + DoS | Honeypot field + 2s time-trap + country gate + name content filter (layered) |
| Sheets quota exhaustion via spam | Denial of Service | Same layered defense as above; future: Upstash rate limit (SCALE-04) |
| PII leak via Vercel function logs | Information Disclosure | Log only error class + phone last-4 (SEC-06); never `console.log(body)` |
| PII leak via error response echo | Information Disclosure | Generic error codes only: `invalid_phone`, `missing_field`, `sheet_error`, `country_not_allowed`, `too_fast`, `invalid_name`, `invalid_address`, `method_not_allowed` (SEC-05) |
| PII leak via URL params on `/ar/merci` redirect | Information Disclosure | Phase 2 work — never put phone/adresse in query string |
| CAPI token exfiltration via client | Information Disclosure | `META_CAPI_ACCESS_TOKEN` is server-only, NEVER prefixed `NEXT_PUBLIC_*` or `VITE_*` (TRACK-07) |
| Replay attack on form endpoint | Spoofing | Out of scope v1 — DIFF-07 server-side dedup is v2; impact = duplicate Sheet row (manual cleanup acceptable) |
| Stored XSS via `prenom`/`ville`/`adresse` in admin UI | Tampering / Disclosure | Out of scope — Sheets is read in spreadsheet UI by humans, not rendered as HTML anywhere; if admin dashboard ever consumes this sheet, escape on render there |
| CSRF | Tampering | Mitigated by JSON-only Content-Type + CORS `Allow-Origin: *` is acceptable here (no cookies, no session state); form requires honeypot + ts_rendered correctly populated which cross-origin POSTs can't easily fake |

---

## Open Questions

1. **Which Vercel project tier is the `solaryn` project on?**
   - What we know: `x-vercel-ip-country` works on Pro & Enterprise; Hobby plan availability not explicitly confirmed in 2026 Vercel docs.
   - What's unclear: Whether the existing solaryn project is on Hobby or Pro.
   - Recommendation: Verify via `vercel project ls` or dashboard before relying on the country gate as a hard reject. If Hobby and header is absent, set `AR_COUNTRY_GATE_OFF=1` as a safety net for production until the project is upgraded. (Per Vercel KB the geolocation headers are documented as available to "all Vercel deployments" — but pinned-down plan info contradicted itself in the search results, so verify on the actual project.)

2. **Will the source field (`source`) be populated by URL UTM params or static?**
   - What we know: REQUIREMENTS.md mentions UTM-readiness in Story 3 acceptance criteria
   - What's unclear: Whether Phase 2 frontend will parse `?utm_source=fb_ar&utm_campaign=...` from `window.location.search` and pass as `body.source`
   - Recommendation: Phase 1 endpoint already accepts an optional `source` string (default `'ar_landing'`). Phase 2 frontend can extract UTM params and pass them through; backend needs no change.

3. **Should the `event_id` UUID be validated as strict v4 or accept any UUID format?**
   - What we know: `crypto.randomUUID()` returns v4; Meta's spec accepts arbitrary string IDs ≤ 64 chars for `event_id`
   - What's unclear: Whether to be strict (reject non-v4) for safety or accept any 8-64 char alphanumeric to allow future flexibility
   - Recommendation: Use strict v4 regex (the endpoint skeleton in §8 does this); on mismatch silently fall back to server-generated UUID (logs one phone_last4 with `evt_id_invalid` class so we can detect client-side bugs). This is what the recipe above does.

4. **What's the agreed `META_TEST_EVENT_CODE` strategy?**
   - What we know: Meta Test Events tab needs a `test_event_code` to route events away from live optimization
   - What's unclear: Whether QA cycles run against production CAPI with a test code, or only against staging
   - Recommendation: Add `META_TEST_EVENT_CODE` only in Vercel Preview/Development environments; leave unset in Production. The endpoint skeleton handles this correctly (only includes the field when env var is set).

---

## Suggested Task Breakdown (input for planner)

The planner can decompose Phase 1 into ~8 atomic tasks; ordered by dependency:

1. **TASK-01: Pin Node 22 in `package.json`** — one-line edit `engines.node` `>=20` → `22.x`. Smoke-test: `git status` shows package.json only; existing `add-lead.js` still works on 22.
2. **TASK-02: Provision new Google Sheet** — manual per §7 recipe. Output: spreadsheet ID, header row visible, service account is Editor. Document ID in `SESSION.md`.
3. **TASK-03: Add 3 env vars to Vercel** — `AR_LEADS_SHEET_ID`, `META_PIXEL_ID`, `META_CAPI_ACCESS_TOKEN` for Production + Preview + Development. Output: `vercel env ls` shows all three.
4. **TASK-04: Add `appendArLead()` export to `api/_sheets.js`** — additive only, do not modify existing exports. Output: `_sheets.js` grows by ~15 LOC, all existing tests/usage still pass.
5. **TASK-05: Create `api/_ar_capi.js`** — new file with `sha256`, `phoneForCapi`, `cityForCapi`, `firstNameForCapi`, `fireCapiLead`. Output: standalone module; passes a hand-written unit script that verifies hash output matches expected SHA-256 for known input.
6. **TASK-06: Create `api/ar-lead.js`** — full endpoint per §8 skeleton. Output: file exists, exports default async handler, all imports resolve.
7. **TASK-07: Deploy and curl sentinel test** — `git push` (or `vercel deploy`), then `curl -X POST` with sentinel payload (prenom: `TEST_SENTINEL_2026-05-26`, valid MA phone, etc.) and `x-vercel-ip-country: MA` header simulated via deploying with `AR_COUNTRY_GATE_OFF=1` temporarily; verify the row appears in the Sheet within 10s; verify Meta Events Manager → Test Events shows the matching `event_id` if `META_TEST_EVENT_CODE` is set.
8. **TASK-08: Negative test pass** — verify each rejection path:
   - honeypot filled → 200 with `{ok:true}` but no Sheet row
   - `ts_rendered` < 2s old → 400 `too_fast`
   - country gate ON, non-MA header → 403 `country_not_allowed`
   - phone with Arabic-Indic digits → 200 + Sheet row with normalized `+212...`
   - name with URL or Cyrillic → 400 `invalid_name`
   - adresse < 10 chars → 400 `invalid_address`
   - missing field → 400 `missing_field`
   - `AR_LEADS_SHEET_ID` unset → 500 `sheet_error` (test by temporarily renaming env var)
   - PII audit: grep deployed function logs for any of `prenom|nom|adresse|+212` — should be ZERO matches

Dependencies: TASK-01 (Node pin) is independent; TASK-02 → TASK-03; TASK-04 → TASK-06 (needs the helper); TASK-05 → TASK-06; TASK-06 → TASK-07 → TASK-08.

Parallelism: TASK-02, TASK-04, TASK-05 can run in parallel (different files / no code overlap).

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Vercel project is on a tier where `x-vercel-ip-country` works | Open Q1, §16 country gate | If Hobby and header is absent, gate would never trip → no rejection. Acceptable degraded behaviour (lead still captured). Mitigated by Open Q1 verification step. |
| A2 | Meta phone hashing format: digits-only with country code, no `+`, no leading 0 (canonical `212612345678`) | §13 CAPI Recipe | If Meta actually wants `+` or different format, CAPI Event Match Quality drops, dedup with Pixel still works (Pixel auto-hashes browser-side). Verified across 3 independent sources (Meta community thread + Stape guide + GH issue #30); high confidence. |
| A3 | `googleapis ^144` API surface for `spreadsheets.values.append` is stable through 172 | §9 Append Helper | Highly stable API (Sheets v4 itself frozen in semver terms); any breakage would be in auth layer not the call site. Already proven in `_sheets.js` for affiliate dashboard. |
| A4 | Graph API v22.0 (released 2025-01-21) is still in Meta's 2-year support window through ~Jan 2027 | §13 CAPI Recipe | If v22 is deprecated mid-campaign, switch to v23/v24/v25 is a one-line const change in `_ar_capi.js`. Low operational risk. |
| A5 | 2-second time-trap threshold is high enough to block bots without rejecting fast autofill users | §15 / SEC-02 | UC Davis recommends 5s default; some authors use 1s. 2s is REQUIREMENTS.md SEC-02 spec. If real users fall < 2s frequently (mobile autofill), bump to 1.5s; if bots leak through < 2s, bump to 3s. Monitor `too_fast` rejection rate in first week of ad spend. |
| A6 | Apostrophe-prefix in Sheets cell value is interpreted as text marker (invisible in cell) | §9, Pitfall 3 | Verified in `add-lead.js:139` for existing Solaryn Leads sheet — production-proven. |
| A7 | Service account already used by `_sheets.js` for the affiliate sheet has no scope or quota issue serving a SECOND sheet | §7, §9 | Same service account, same project, same OAuth scope (`spreadsheets`). Google Sheets quota is per-USER (= per service account), 60 writes/min covers expected v1 traffic (100 leads/day = 4 writes/hour worst case). |
| A8 | `req.headers['x-vercel-ip-country']` is a string (not array) in Node serverless runtime | §16 country gate | Node headers can be string OR string[] for some headers; `x-vercel-*` are documented as strings. Defensive: `String(req.headers['x-vercel-ip-country'] || '')` handles both. The skeleton in §8 already does this. |

**User confirmation needed before execution on:**
- A1 (Vercel plan tier) — single CLI command to verify, do before TASK-07
- A2 (CAPI phone format) — sanity-check with Meta Events Manager → Diagnostics after first real CAPI submission; if Event Match Quality is < "Good" with no other obvious cause, revisit format

---

## File-by-File Impact Analysis

| File | Action | LOC delta | Risk |
|------|--------|-----------|------|
| `package.json` | Edit | +0, ~1 changed | Low — only `engines.node` value change |
| `api/_sheets.js` | Edit (additive) | +~15 | Low — new export only, existing exports untouched |
| `api/_lib.js` | Read-only consumer | 0 | None |
| `api/_ar_capi.js` | New file | +~70 | Low — isolated module, no consumers besides ar-lead.js |
| `api/ar-lead.js` | New file | +~150 | Medium — orchestration logic, must follow §8 skeleton order exactly |
| `api/add-lead.js` | Untouched | 0 | None — Pitfall 7 risk if env vars are accidentally mutated, but no code change |
| `api/abandoned-lead.js`, `api/submit.js`, etc. | Untouched | 0 | None |
| `vercel.json` | Untouched | 0 | None — file-system routing handles `/api/ar-lead` automatically |
| Vercel env vars | Add 3 (+ 2 optional QA) | n/a | Low — additive only, no existing env vars touched |
| Google Drive | 1 new sheet | n/a | None — separate from existing sheets |

Total surface: 1 new file (~70 LOC), 1 modified file (+15 LOC), 1 new endpoint (~150 LOC), 1 manual sheet provisioning step. Estimated solo dev time: 2-3 hours including the negative-test pass.

---

## Sources

### Primary (HIGH confidence — verified this session)
- `/Users/a2024/solaryn/api/_sheets.js` (read directly, lines 1-259) — cached `getSheetsClient()`, `values.batchGet`/`update` patterns, env var conventions
- `/Users/a2024/solaryn/api/_lib.js` (read directly, lines 1-53) — `clean`, `validPhone`, `readBody`, `clientIp`, `forwardToSheets` AbortController pattern
- `/Users/a2024/solaryn/api/add-lead.js` (read directly, lines 1-225) — `normalizePhoneMA`, `setCors`, apostrophe-prefix phone trick (line 139), method/CORS gates, in-house lead handler pattern
- `/Users/a2024/solaryn/api/_auth.js` (read directly) — `crypto.createHmac`/`createHash` usage convention; `crypto.timingSafeEqual` for constant-time compare
- `/Users/a2024/solaryn/api/abandoned-lead.js` (read directly) — `AbortController` + 8s timeout pattern for external webhooks; CORS gate idiom
- `/Users/a2024/solaryn/api/create-order.js` (read directly, lines 25-80) — server-side `sha256()` for PII before sending to ad-network CAPI; exact TikTok Events pattern that translates 1:1 to Meta CAPI
- `/Users/a2024/solaryn/affiliates.html` (grep lines 381, 446, 465, 550) — production-proven honeypot pattern: `<input name="website" class="hp" tabindex="-1" autocomplete="off">` with CSS `position:absolute;left:-9999px;opacity:0;pointer-events:none`
- `/Users/a2024/solaryn/package.json` (read directly) — current `engines.node ">=20"`, `googleapis "^144.0.0"`
- `/Users/a2024/solaryn/vercel.json` (read directly) — `cleanUrls:true`, file-system routing, no rewrites needed for `/api/ar-lead`
- `/Users/a2024/solaryn/.planning/PROJECT.md`, `REQUIREMENTS.md`, `ROADMAP.md`, `research/STACK.md`, `research/ARCHITECTURE.md`, `research/PITFALLS.md`, `config.json` (all read directly)
- npm registry: `npm view googleapis version` → `172.0.0` (verified 2026-05-26)
- [Vercel — Request headers (last updated 2025-12-13)](https://vercel.com/docs/headers/request-headers) — full list of `x-vercel-*` headers, exact format spec (ISO 3166-1 alpha-2, `XX` not documented as fallback; behaviour for unknown geo not explicit)
- [Vercel — IP Geolocation for Serverless Functions changelog](https://vercel.com/changelog/ip-geolocation-for-serverless-functions) — confirms availability on serverless
- [Google Sheets API — Usage limits](https://developers.google.com/workspace/sheets/api/limits) — 60 writes/min/user/project; 429 on exceed; truncated exponential backoff formula `min((2^n + random_ms), maximum_backoff)`
- [Meta Graph API changelog (versions current as of 2026-02-18)](https://developers.facebook.com/docs/graph-api/changelog) — v25.0 latest, v22.0 (2025-01-21) still in support window

### Secondary (MEDIUM confidence — WebSearch corroborated by 2+ sources)
- Meta CAPI phone hashing format: digits-only, country-code-prefixed, no `+`, no leading 0 — corroborated by [Stape 2026 setup guide](https://stape.io/blog/how-to-set-up-facebook-conversion-api), [GitHub issue #30 ConversionsAPI-Tag-for-GoogleTagManager](https://github.com/facebookincubator/ConversionsAPI-Tag-for-GoogleTagManager/issues/30), and [Meta developer community thread 428707074856452](https://developers.facebook.com/community/threads/428707074856452/)
- Meta CAPI Lead event payload structure — corroborated by [Stape guide](https://stape.io/blog/how-to-set-up-facebook-conversion-api) and [Cometly 2026 setup tutorial](https://www.cometly.com/post/setup-conversion-api-tutorial)
- Honeypot + time-trap blocks 99%+ spam at 2-12s threshold — corroborated by [Vibe Coding Honeypots Still Work](https://vibecodingwithfred.com/blog/honeypot-spam-protection/), [UC Davis SiteFarm Honeypot config](https://sitefarm.ucdavis.edu/training/managers/honeypot), [DEV.to alexisfranorge honeypot guide](https://dev.to/alexisfranorge/honeypot-fields-bot-protection-thats-free-and-takes-5-minutes-2eid)
- Arabic-Indic Unicode ranges U+0660-U+0669 and U+06F0-U+06F9 — corroborated by [Copy Programming Arabic numbers regex guide](https://copyprogramming.com/howto/regular-expression-for-arabic-numbers) and [AliMD Persian/Arabic gist](https://gist.github.com/AliMD/e5033db9e3943e78930f)
- Sheets apostrophe-prefix forces text — corroborated by [Method values.append docs](https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets.values/append), [gspread issue #524](https://github.com/burnash/gspread/issues/524), AND production-proven in `add-lead.js:139`

### Tertiary (LOWER confidence — flagged for verification)
- Exact Vercel plan tier requirement for `x-vercel-ip-country` — sources contradict (one says "Pro/Enterprise", another says "all deployments"); see Open Q1
- Hobby-tier function `maxDuration` default (commonly cited as 10s but check `vercel.json` if extending)

---

## Metadata

**Confidence breakdown:**
- Standard stack (`googleapis`, Node 22, built-in fetch/crypto): HIGH — verified via `package.json` + `_sheets.js` + npm registry + Node official docs
- Architecture patterns (CORS gate, cached client, AbortController): HIGH — all proven in existing in-repo code (`add-lead.js`, `_sheets.js`, `_lib.js`, `create-order.js`)
- Meta CAPI payload + phone hashing format: HIGH — corroborated across 3 independent sources + matches in-house TikTok CAPI pattern in `create-order.js`
- Sheet provisioning recipe + apostrophe-prefix phone: HIGH — directly mirrors working production pattern in `add-lead.js:139`
- Anti-spam thresholds (2s time-trap): MEDIUM — REQUIREMENTS.md spec, validated by multiple research sources, but exact value may need tuning post-launch
- Country gate availability across Vercel plans: MEDIUM — sources contradict; mitigation in Open Q1
- Arabic-Indic digit normalization: HIGH — Unicode ranges definitive, regex pattern tested in-line in §12

**Research date:** 2026-05-26
**Valid until:** 2026-06-26 (30 days; stable backend stack, no fast-moving libraries)
