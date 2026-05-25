# ARCHITECTURE — AR Landing Page Integration into Solaryn Repo

**Domain:** Brownfield static-site + Vercel serverless integration
**Researched:** 2026-05-26
**Confidence:** HIGH (all claims verified by direct reads of project files)

---

## 1. High-Level Diagram

```
                  Facebook / Instagram ad
                            │
                            ▼
   ┌────────────────────────────────────────────────────────┐
   │  Browser (mobile, RTL Arabic darija)                   │
   │  GET https://solaryn-five.vercel.app/ar                │
   │  → served as static file: /ar.html                     │
   │                                                        │
   │  ┌──────────────────────────────────────────────────┐  │
   │  │ ar.html  (HTML + inline <style> + inline <script>)│ │
   │  │  • Hero, benefits, price 150 MAD                  │ │
   │  │  • <form id="ar-form"> 5 fields                   │ │
   │  │  • FB Pixel snippet (PageView on load)            │ │
   │  │  • JS: POST fetch → /api/ar-lead                  │ │
   │  │  • On 200: fbq('track','Lead') + redirect /ar/merci│ │
   │  └──────────────────────────────────────────────────┘  │
   └────────────────────────┬───────────────────────────────┘
                            │ JSON POST
                            ▼
   ┌────────────────────────────────────────────────────────┐
   │  Vercel serverless function                            │
   │  /api/ar-lead.js  (NEW)                                │
   │   1. CORS + method gate (POST only)                    │
   │   2. Parse body via api/_lib.js → readBody             │
   │   3. Validate via api/_lib.js → validPhone, clean      │
   │   4. Normalise phone (reuse normalizePhoneMA pattern)  │
   │   5. Append row to NEW Google Sheet via                │
   │      api/_sheets.js → appendArLead()                   │
   │   6. Return { ok:true } or { ok:false, error }         │
   └────────────────────────┬───────────────────────────────┘
                            │ googleapis (service account)
                            ▼
   ┌────────────────────────────────────────────────────────┐
   │  NEW Google Sheet "Solaryn AR Leads"                   │
   │  (separate from existing LEADS_SHEET_ID and from       │
   │   the Affiliates/Sales sheet)                          │
   │  Tab: "Leads"  Columns A–H                             │
   └────────────────────────────────────────────────────────┘

                            │ on 2xx
                            ▼
   ┌────────────────────────────────────────────────────────┐
   │  /ar/merci  → static file ar/merci.html                │
   │  Simple thank-you, no further CTA                      │
   └────────────────────────────────────────────────────────┘
```

---

## 2. Component Boundaries (with exact file paths)

| Component | File path | Responsibility | Talks to |
|-----------|-----------|----------------|----------|
| Landing HTML | `/Users/a2024/solaryn/ar.html` | Render page, FB Pixel, form, client-side validation, fetch POST | `/api/ar-lead` |
| Thank-you HTML | `/Users/a2024/solaryn/ar/merci.html` | Static "merci" page, fires `fbq('track','CompleteRegistration')` (optional) | (none) |
| Serverless endpoint | `/Users/a2024/solaryn/api/ar-lead.js` | Validate, normalise, persist to NEW Sheet | `api/_lib.js`, `api/_sheets.js` (new helper), Google Sheets API |
| Sheets helper (extend existing) | `/Users/a2024/solaryn/api/_sheets.js` | Add `appendArLead(lead)` export that uses the same cached `getSheetsClient()` | Google Sheets API |
| Env config | Vercel project env vars | Hold `AR_LEADS_SHEET_ID` and (reuse) `GOOGLE_SERVICE_ACCOUNT_JSON` | (consumed by `_sheets.js`) |

**Critical boundary rule:** the landing page must NOT import or reference any affiliate / admin / shopify code. Self-contained funnel — `ar.html` + `/api/ar-lead` + new sheet. Zero blast radius on existing pages.

**Why new endpoint, not reuse `/api/add-lead`:**
- `add-lead.js` writes to a different sheet (`LEADS_SHEET_ID = 1ewgyaw43...`), uses Composio (not googleapis), inserts at row 2 with HYPERLINK formulas, deduplicates by phone, triggers Baileys WhatsApp-group bot. That is a fundamentally different write pattern.
- AR campaign needs a clean, append-only sheet for analysis.
- Reusing would re-trigger the WhatsApp-group bot — undesirable for 150 MAD COD pipeline where callback-by-phone is the channel.

---

## 3. Data Flow (with payload shapes)

### 3.1 Client → Server

`POST /api/ar-lead` · `Content-Type: application/json`

```json
{
  "prenom": "Khadija",
  "nom": "El Fassi",
  "tel": "0612345678",
  "ville": "Casablanca",
  "adresse": "Rue X, Quartier Y",
  "source": "fb_ar",
  "fbp": "fb.1.1234.5678",
  "fbc": "fb.1.1234.AbcDe"
}
```

All strings → `clean()` from `api/_lib.js` (trims, strips control chars, caps length).

### 3.2 Server validation

- `validPhone(tel)` from `_lib.js` (regex `/^(0|\+212)[5-7][0-9]{8}$/`).
- Normalise phone → `+212XXXXXXXXX` canonical form (port `normalizePhoneMA` from `add-lead.js` lines 28-37).
- Required: `prenom`, `nom`, `tel`, `ville`, `adresse`. Reject 400 if missing/empty.
- Length caps: name 80, ville 80, adresse 300, source 32.

### 3.3 Server → Google Sheet

Use `sheets.spreadsheets.values.append` (NOT batchUpdate). Append-only matches goal.

Row written (USER_ENTERED), columns A–H of tab `Leads`:

| Col | Field | Example |
|-----|-------|---------|
| A | timestamp ISO Casablanca | `2026-05-26T19:42:10+01:00` |
| B | prenom | `Khadija` |
| C | nom | `El Fassi` |
| D | tel canonical | `'+212612345678` (apostrophe prefix to force text) |
| E | ville | `Casablanca` |
| F | adresse | `Rue X, Quartier Y` |
| G | source | `fb_ar` |
| H | fbp\|fbc | `fb.1...\|fb.1...` (for CAPI cross-check later) |

### 3.4 Server → Client

```json
{ "ok": true }
```
or
```json
{ "ok": false, "error": "invalid_phone" }
```

Error enum: `invalid_phone`, `missing_field`, `sheet_error`, `internal`.

### 3.5 Client post-submit

On 200: `fbq('track', 'Lead', { value: 150, currency: 'MAD' })` → `window.location.assign('/ar/merci')`.

On non-200: inline error in darija (ex: "كاين شي حاجة ما مشاتش، عاود المحاولة").

---

## 4. Routing (verified against `vercel.json`)

`vercel.json` uses `cleanUrls: true` and `trailingSlash: false`. So:

- `ar.html` at repo root → `/ar`
- `ar/merci.html` → `/ar/merci`
- `api/ar-lead.js` → `/api/ar-lead` (Vercel file-system routing)

**No changes to `vercel.json` required.** Modifying it risks breaking caching headers for the rest of the site.

`vercel.json` has zero `rewrites` and zero `routes`. The same pattern already drives `/affiliates` from `affiliates.html`.

---

## 5. Facebook Pixel Placement

Inline in `ar.html` `<head>` only. Do NOT add globally.

Events to fire:
- `PageView` — on load
- `Lead` — after successful POST (value 150, currency MAD)
- `ViewContent` — optional, on load with `content_name: 'Solaryn SPF 50'`

Server-side CAPI is out of scope v1 but `fbp`/`fbc` cookies captured in col H allow adding later without schema migration.

---

## 6. Integration with Existing Helpers

| Existing module | How AR uses it |
|-----------------|----------------|
| `api/_lib.js → readBody(req)` | Parse JSON body |
| `api/_lib.js → clean(value, max)` | Sanitise every string field |
| `api/_lib.js → validPhone(tel)` | Phone gate |
| `api/_lib.js → clientIp(req)` | Optional fraud column (defer v1) |
| `api/_sheets.js → getSheetsClient()` | Reuse cached googleapis client |
| `api/_auth.js` | Not used — AR has no auth |
| `api/add-lead.js` | Not used — different sheet, different semantics |

**Addition to `api/_sheets.js`** (~15 lines):

```js
const AR_LEADS_SHEET_ID = process.env.AR_LEADS_SHEET_ID;
const AR_LEADS_TAB = 'Leads';

export async function appendArLead(row) {
    if (!AR_LEADS_SHEET_ID) throw new Error('AR_LEADS_SHEET_ID env var not set');
    const sheets = getSheetsClient();
    await sheets.spreadsheets.values.append({
        spreadsheetId: AR_LEADS_SHEET_ID,
        range: `${AR_LEADS_TAB}!A:H`,
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: [row] },
    });
}
```

Isolated, no shared state with existing exports beyond `getSheetsClient()` cache (read-only sharing).

---

## 7. NEW Google Sheet Provisioning (manual, one-time)

Service account already exists (`GOOGLE_SERVICE_ACCOUNT_JSON` env var). Steps:

1. **Get service account email** from `client_email` in `GOOGLE_SERVICE_ACCOUNT_JSON`.
2. **Create new Google Sheet** as `mouhabmzibra@gmail.com`. Name: `Solaryn AR Leads`.
3. **Rename first tab** to `Leads` (case-sensitive match).
4. **Add header row** (A1:H1): `Date | Prénom | Nom | Téléphone | Ville | Adresse | Source | fbp_fbc`
5. **Share with service account email as Editor** (skip "Notify").
6. **Copy spreadsheet ID** from URL.
7. **Add Vercel env var** (Prod + Preview + Dev): `AR_LEADS_SHEET_ID = <id>`
8. **Redeploy** (git push).

**Why new sheet (not new tab):**
- Affiliates sheet (`1uyItM4b...`) has commission/PII for affiliate program.
- Solaryn Leads sheet (`1ewgyaw...`) used by `add-lead.js` is WhatsApp-inbound with 15-col HYPERLINK schema.
- Separate sheet = clean access control + schema independence + clean analytics.

---

## 8. Suggested Build Order

1. **Provision new sheet** (Section 7, steps 1–7)
2. **Add `AR_LEADS_SHEET_ID`** to Vercel env, pull locally
3. **Extend `api/_sheets.js`** with `appendArLead()`
4. **Create `api/ar-lead.js`** — endpoint with validation
5. **Create `ar/merci.html`** — minimal static page
6. **Create `ar.html`** — HTML + RTL CSS + Pixel placeholder + form + fetch
7. **Insert real FB Pixel ID** into both pages
8. **Deploy** (`git push`)
9. **Smoke-check existing pages** — `/`, `/affiliates`, `/kit`, `/admin` all still load

Backend before frontend (so frontend has working dependency). FB Pixel last (QA submissions don't pollute pixel data).

---

## 9. Patterns to Follow

**Pattern 1: Vanilla static HTML + sibling serverless endpoint**
One `.html` at root for routing, one `.js` in `api/` for action. Both deployed by Vercel file-system convention. Mirror `affiliates.html` + `api/affiliate-*.js`.

**Pattern 2: Reuse cached googleapis client**
Always via `getSheetsClient()`. Don't instantiate `google.auth.GoogleAuth` in new endpoint. Module-level `_sheetsClient` cache prevents re-parsing on every invocation (matters for cold starts).

**Pattern 3: CORS + method gate at top of every endpoint**
Copy `setCors(res)` + `OPTIONS` handler + `method !== 'POST'` from `add-lead.js`. FB in-app browsers occasionally preflight.

**Pattern 4: Phone as text in Sheets**
Prefix with `'` (matches `add-lead.js` line 139). Else Sheets parses `+212...` as formula or strips `+`.

---

## 10. Anti-Patterns to Avoid

**AP1: Editing `vercel.json` for new route** — `cleanUrls: true` already does it. Rely on file-system.
**AP2: Reusing `/api/add-lead`** — wrong sheet, triggers WA-group bot, dedup-by-phone would silently 200-skip legitimate AR leads.
**AP3: Bundling CSS/JS framework** — violates "vanilla, zero build" constraint, increases LCP on mobile (95% of traffic).
**AP4: Global FB Pixel via shared header** — `vercel.json` headers cannot inject HTML; would contaminate `/affiliates`, `/admin` analytics.
**AP5: Logging PII to console** — violates "no PII leakage" constraint. Vercel logs queryable by project access.
**AP6: Synchronous webhook calls before responding** — adds latency, increases bounce. No Baileys bot call from this endpoint.

---

## 11. Scalability

| Concern | 100 leads/day (v1) | 1k/day | 10k/day |
|---------|--------|--------|---------|
| Sheet writes | append fine | append fine | Move to DB; sheet as mirror |
| Sheets API quota | 60 write/min/user — plenty | Approaching; batch | Off Sheets API |
| Vercel cold starts | Negligible | Negligible | Edge runtime |
| Duplicate submits | Not deduped v1 (manual) | Server-side dedup | DB unique constraint |
| FB Pixel limits | None | None | Add CAPI |

V1 target ~100/day — `values.append` is the right tool. Don't pre-optimise.

---

## 12. Regression Surface

| Existing surface | Touched? | Risk |
|------------------|---------|------|
| `index.html`, `affiliates.html`, `kit.html`, `admin.html` | No | None |
| `api/add-lead.js` | No | None |
| `api/_sheets.js` | **Yes — additive only** (1 new export + 2 new constants). Existing untouched | Low |
| `api/_lib.js`, `api/_auth.js` | No (consumed read-only) | None |
| `vercel.json` | No | None |
| Existing env vars | No (only NEW `AR_LEADS_SHEET_ID`) | None |
| Existing Sheets (Affiliates, Solaryn Leads) | No (new sheet only) | None |

**Test plan post-deploy:**
1. `curl -I /` → 200
2. `curl -I /affiliates` → 200
3. `curl -I /admin` → 200
4. POST `/api/add-lead` → row in existing Solaryn Leads sheet
5. POST `/api/ar-lead` → row in NEW AR Leads sheet
6. GET `/ar` → 200, renders RTL
7. GET `/ar/merci` → 200

---

## 13. Sources

| Claim | Source | Confidence |
|-------|--------|------------|
| `cleanUrls: true` enables `/ar` from `ar.html` | Direct read `vercel.json` line 3 | HIGH |
| Service account auth pattern via `GOOGLE_SERVICE_ACCOUNT_JSON` | Direct read `api/_sheets.js` lines 13-27 | HIGH |
| `validPhone`, `clean`, `readBody` available | Direct read `api/_lib.js` | HIGH |
| `add-lead.js` uses Composio + different sheet + bot | Direct read `api/add-lead.js` | HIGH |
| `normalizePhoneMA` regex | Direct read `add-lead.js` lines 28-37 | HIGH |
| `_auth.js` is HMAC affiliate auth (not for AR) | Direct read `api/_auth.js` | HIGH |
| Sheets API `values.append` semantics | Google Sheets API docs | MEDIUM |
| FB Pixel `Lead` event standard for lead-gen | Meta Pixel docs | MEDIUM |

---

## Quality Gate

- [x] Components defined with file paths (§2)
- [x] Data flow explicit with payloads (§3)
- [x] Build order noted (§8)
- [x] Integration points mapped (§6)
- [x] Google Sheet provisioning documented (§7)
