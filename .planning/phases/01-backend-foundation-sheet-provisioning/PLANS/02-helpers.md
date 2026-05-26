---
phase: 01-backend-foundation-sheet-provisioning
plan: 02
type: execute
wave: 2
depends_on:
  - 01-prerequisites
files_modified:
  - package.json
  - api/_sheets.js
  - api/_ar_capi.js
autonomous: true
requirements:
  - BACK-04
  - BACK-07
  - TRACK-04
  - TRACK-05
effort: M
must_haves:
  truths:
    - "package.json engines.node is pinned to '22.x' (was '>=20')"
    - "api/_sheets.js exports new symbol appendArLead, all existing exports unchanged"
    - "api/_ar_capi.js exists and exports fireCapiLead (default unused — named export only)"
    - "fireCapiLead applies Meta CAPI phone normalization (digits-only, no '+', no leading 0) DISTINCT from sheet storage format (with '+')"
    - "fireCapiLead hashes ph/fn/ct via SHA-256 with .toLowerCase().trim() before transmission"
    - "fireCapiLead wraps fetch in AbortController with 4000ms timeout"
    - "Zero new npm dependencies added"
  artifacts:
    - path: "package.json"
      provides: "Node 22.x pin"
      contains: '"node": "22.x"'
    - path: "api/_sheets.js"
      provides: "appendArLead named export"
      exports: ["appendArLead"]
    - path: "api/_ar_capi.js"
      provides: "Meta CAPI Lead event firing"
      exports: ["fireCapiLead"]
      min_lines: 60
  key_links:
    - from: "api/_sheets.js::appendArLead"
      to: "getSheetsClient (existing internal function)"
      via: "function call within same module"
      pattern: "getSheetsClient\\(\\)"
    - from: "api/_sheets.js::appendArLead"
      to: "process.env.AR_LEADS_SHEET_ID"
      via: "throw if unset"
      pattern: "process\\.env\\.AR_LEADS_SHEET_ID"
    - from: "api/_ar_capi.js::fireCapiLead"
      to: "Meta Graph API v22.0"
      via: "fetch with timeout"
      pattern: "graph\\.facebook\\.com/v22\\.0"
    - from: "api/_ar_capi.js"
      to: "node:crypto"
      via: "import crypto from 'node:crypto'"
      pattern: "import crypto from ['\\\"]node:crypto"
---

<objective>
Add the three additive building blocks that Plan 03's endpoint will import and orchestrate: (1) Node 22 pin in `package.json`, (2) `appendArLead()` export in `api/_sheets.js`, (3) new `api/_ar_capi.js` module with SHA-256 hashing and Meta CAPI POST.

Purpose: Isolating helper concerns from orchestration concerns means Plan 03 can be a thin (~150 LOC) handler that wires inputs to these helpers. It also keeps `_ar_capi.js` separately readable + future-testable.

Output: 1 edited file (`package.json`), 1 edited file additively (`api/_sheets.js`), 1 new file (`api/_ar_capi.js`). Zero new npm dependencies.
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/execute-plan.md
@~/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/research/STACK.md
@.planning/research/ARCHITECTURE.md
@.planning/research/PITFALLS.md
@.planning/phases/01-backend-foundation-sheet-provisioning/RESEARCH.md
@.planning/phases/01-backend-foundation-sheet-provisioning/01-01-SUMMARY.md

# Source files the executor must read before editing
@/Users/a2024/solaryn/api/_sheets.js
@/Users/a2024/solaryn/api/_lib.js
@/Users/a2024/solaryn/package.json

<interfaces>
<!-- Key signatures the executor needs. Extracted from codebase. -->
<!-- Use these directly — no codebase exploration needed. -->

From `api/_sheets.js` (existing, do not modify):
```js
// Module-level cached client. Reuse — do NOT instantiate a second auth client.
function getSheetsClient() {
    // Returns google.sheets({ version: 'v4', auth }) — memoized
}
```

Existing exports in `api/_sheets.js` (must NOT be modified):
- `readAdminData()`
- `getAffiliateDashboard(affiliateId)`
- `updateSaleStatus(saleId, status)`
- `updateLastActive(phone)`
- `toggleAffiliateStatus(phone, status)`
- `setTrackingUrl(saleId, url)`

Pattern reference — apostrophe-prefix for phone storage (verified in `api/add-lead.js:139`):
```js
"'" + phoneCanonical   // → "'+212612345678" stored as text in Sheets
```

</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Pin Node 22 in package.json</name>
  <files>package.json</files>
  <action>
    Edit `package.json` ONLY at the `engines.node` field. Change `"node": ">=20"` to `"node": "22.x"` per BACK-07 + STACK.md decision.

    Do NOT touch `dependencies`, `name`, `version`, `private`, `type`, or any other field. Do NOT run `npm install` (no dependency change). Do NOT add `engines.npm`.

    Rationale (per RESEARCH.md §11 + STACK.md): Vercel default jumped to Node 24 in Feb 2026; explicit `22.x` pin avoids silent runtime bump mid-campaign. Node 22 LTS through Apr 2027.

    Final `engines` block must read exactly:
    ```json
    "engines": {
      "node": "22.x"
    }
    ```
  </action>
  <verify>
    <automated>node -e "const p=require('./package.json'); if(p.engines.node !== '22.x') { console.error('FAIL: engines.node =', p.engines.node); process.exit(1); } console.log('OK: engines.node = 22.x')"</automated>
  </verify>
  <done>package.json engines.node === "22.x"; dependencies block untouched; no npm install run</done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Add appendArLead() export to api/_sheets.js (additive)</name>
  <files>api/_sheets.js</files>
  <behavior>
    - Calling `appendArLead([ts, p, n, "'+212...", v, a, src, fbpfbc])` invokes `sheets.spreadsheets.values.append` against `process.env.AR_LEADS_SHEET_ID`, range `Leads!A:H`, with `valueInputOption: 'USER_ENTERED'` and `insertDataOption: 'INSERT_ROWS'`.
    - If `process.env.AR_LEADS_SHEET_ID` is unset, throws `Error('AR_LEADS_SHEET_ID env var not set')` BEFORE making any network call.
    - If `row` is not an Array, or has length !== 8, throws `Error('appendArLead: expected 8-column row')`.
    - Reuses the existing module-level `getSheetsClient()` — does NOT instantiate a second `google.auth.GoogleAuth`.
    - On Sheets API non-2xx, the underlying `googleapis` SDK throws — propagate (do NOT swallow).
    - Existing exports in `_sheets.js` (`readAdminData`, `getAffiliateDashboard`, `updateSaleStatus`, `updateLastActive`, `toggleAffiliateStatus`, `setTrackingUrl`) remain functional and bitwise identical.
  </behavior>
  <action>
    Append the new code to `api/_sheets.js` at the end of the file (after the last existing export). Do NOT reorder, modify, or remove any existing code. Do NOT touch the top-of-file `AFFILIATES_TAB`, `SALES_TAB`, `SHEET_ID` constants — those are for the affiliates sheet and must stay scoped to their existing exports.

    Add a new constant `AR_LEADS_TAB = 'Leads'` near the bottom (just before the new export), distinct from `AFFILIATES_TAB` / `SALES_TAB`. Do NOT pull `AR_LEADS_SHEET_ID` into a module-level constant — read `process.env.AR_LEADS_SHEET_ID` inside the function so that env-var-not-set is a runtime error per request (matching the existing module's `getSheetsClient()` lazy-read pattern in `_sheets.js:15`).

    The implementation should match the RESEARCH.md §9 skeleton exactly:
    - Named export `async function appendArLead(row)`
    - Throw if env var unset
    - Throw if row shape wrong
    - Call `getSheetsClient()` (already in scope, same module)
    - Await `sheets.spreadsheets.values.append({ spreadsheetId, range: 'Leads!A:H', valueInputOption: 'USER_ENTERED', insertDataOption: 'INSERT_ROWS', requestBody: { values: [row] } })`
    - No return value (Promise&lt;void&gt;)
  </action>
  <verify>
    <automated>node --input-type=module -e "import('./api/_sheets.js').then(m => { const names = Object.keys(m); const required = ['readAdminData','getAffiliateDashboard','updateSaleStatus','updateLastActive','toggleAffiliateStatus','setTrackingUrl','appendArLead']; const missing = required.filter(n => !names.includes(n)); if (missing.length) { console.error('FAIL missing exports:', missing); process.exit(1); } if (typeof m.appendArLead !== 'function') { console.error('FAIL appendArLead not a function'); process.exit(1); } console.log('OK: all 7 exports present incl. appendArLead'); }).catch(e => { console.error('FAIL import error:', e.message); process.exit(1); })"</automated>
  </verify>
  <done>api/_sheets.js exports appendArLead (new) + 6 existing exports; appendArLead throws synchronously on missing env var or wrong row shape; existing exports byte-identical to pre-edit (verify via `git diff api/_sheets.js` showing only additions at end)</done>
</task>

<task type="auto" tdd="false">
  <name>Task 3: Create api/_ar_capi.js with fireCapiLead</name>
  <files>api/_ar_capi.js</files>
  <behavior>
    - Module exports named function `fireCapiLead({ eventId, phoneCanonical, prenom, ville, fbp, fbc, clientIp, userAgent, eventSourceUrl })`.
    - `phoneCanonical` arrives as `+212XXXXXXXXX` (from `normalizePhoneMA` in Plan 03); `fireCapiLead` internally converts to `212XXXXXXXXX` (digits-only, no `+`, no leading 0) per Meta CAPI spec (Pitfall AP5 in RESEARCH.md).
    - PII is SHA-256 hashed with `.toLowerCase().trim()` normalization BEFORE inclusion in `user_data` (TRACK-05). Field map: `ph` (hashed phone digits-only), `fn` (hashed first name), `ct` (hashed city, also strip whitespace + punctuation), `country` (hashed `'ma'`).
    - Plaintext `fbp`, `fbc`, `client_ip_address`, `client_user_agent` ARE sent (Meta accepts these unhashed per spec).
    - Undefined/empty `user_data` keys are deleted before send.
    - POST to `https://graph.facebook.com/v22.0/{PIXEL_ID}/events?access_token={TOKEN}` with JSON body containing one event: `event_name: 'Lead'`, `event_time: Math.floor(Date.now()/1000)`, `event_id: <as passed>`, `action_source: 'website'`, `event_source_url: <as passed>`, `user_data: <as above>`, `custom_data: { currency: 'MAD', value: 150 }`.
    - When `process.env.META_TEST_EVENT_CODE` is set, includes it in the payload root as `test_event_code` (QA aid).
    - Fetch is wrapped in `AbortController` with 4000ms timeout (Pitfall #6, RESEARCH.md §13).
    - On Meta non-2xx: throws `Error('capi_<status>: <body slice 200 chars>')` — the body slice is for diagnostics; the throw propagates to caller which logs sanitized error (per Plan 03 handler).
    - If `META_PIXEL_ID` or `META_CAPI_ACCESS_TOKEN` env var is missing, throws `Error('META env vars not set')` BEFORE network call.
  </behavior>
  <action>
    Create new file `api/_ar_capi.js` containing the module described in RESEARCH.md §13 verbatim (~70 LOC). Use ES module syntax matching the repo convention (`package.json` has `"type": "module"`). Imports must be:
    ```js
    import crypto from 'node:crypto';
    ```

    Constants near top:
    - `CAPI_VERSION = 'v22.0'` — Graph API version; do NOT bump without re-validating Test Events
    - `CAPI_TIMEOUT_MS = 4000` — AbortController hard cap

    Internal helper functions (not exported):
    - `sha256(str)` — `crypto.createHash('sha256').update(String(str).toLowerCase().trim()).digest('hex')`
    - `phoneForCapi(canonical)` — strips leading `+`: `canonical.replace(/^\+/, '')` → `212XXXXXXXXX`. NOTE the input is already `+212...` canonical from `normalizePhoneMA`; the function's only job is to drop the `+`. Do NOT mutate or re-normalize digits.
    - `cityForCapi(s)` — `String(s).toLowerCase().replace(/[\s\-'"]+/g, '')`
    - `firstNameForCapi(s)` — `String(s).toLowerCase().trim()` (do NOT strip diacritics; Meta spec preserves them)

    Single named export:
    - `export async function fireCapiLead({...})` per behavior block above

    Place the file at `api/_ar_capi.js` (underscore prefix matches `_sheets.js` / `_lib.js` / `_auth.js` convention: internal helper, not an HTTP route).

    DO NOT add a default export. DO NOT install `@facebook/business-sdk` or any other Meta package — direct `fetch` only.
  </action>
  <verify>
    <automated>node --input-type=module -e "import('./api/_ar_capi.js').then(m => { if (typeof m.fireCapiLead !== 'function') { console.error('FAIL: fireCapiLead missing or not a function'); process.exit(1); } if (m.default) { console.error('FAIL: should not have default export'); process.exit(1); } console.log('OK: fireCapiLead exported, no default'); }).catch(e => { console.error('FAIL import error:', e.message); process.exit(1); })" && grep -v '^//' api/_ar_capi.js | grep -c "graph.facebook.com/v22.0" && grep -v '^//' api/_ar_capi.js | grep -c "AbortController"</automated>
  </verify>
  <done>api/_ar_capi.js exists; exports fireCapiLead; uses v22.0 Graph API; uses AbortController; SHA-256 hashes ph/fn/ct; strips leading + from phone before sending; throws on missing env vars; throws on non-2xx; zero new npm deps</done>
</task>

</tasks>

<threat_model>

## Trust Boundaries
| Boundary | Description |
|----------|-------------|
| `api/_sheets.js::appendArLead` → Google Sheets API | Service-account JWT crosses; PII (phone + adresse) written to Google-managed storage |
| `api/_ar_capi.js::fireCapiLead` → Meta Graph API | CAPI token crosses; hashed PII transmitted |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-01-09 | Tampering | `appendArLead` row shape | mitigate | Synchronous length-8 + isArray check throws before network call |
| T-01-10 | Information Disclosure | CAPI error body may echo PII | mitigate | Error message slices first 200 chars only; Plan 03 catches and logs sanitized {cls, phone_last4} — never re-throws the raw `err.message` |
| T-01-11 | Tampering | Sheet apostrophe-prefix forgotten → phone becomes `#NAME?` formula error | mitigate | Plan 03 hardcodes `"'" + phoneCanonical` in row[3]; this plan's `appendArLead` is row-agnostic (caller's responsibility) — but RESEARCH.md §10 documents the rule |
| T-01-12 | Information Disclosure | SHA-256 input not lowercased → Meta match quality drops | mitigate | `sha256()` helper always `.toLowerCase().trim()` before hashing |
| T-01-SC | Tampering | npm/pip installs | N/A | Phase 1 installs ZERO new packages. No `npm install` runs in this plan. |

</threat_model>

<verification>
1. `git diff api/_sheets.js` shows ONLY additions at the end of file (zero changes to existing lines). All existing exports still importable.
2. `git status` shows three modified/new files: `package.json` (modified), `api/_sheets.js` (modified), `api/_ar_capi.js` (new).
3. `git diff package.json` shows only the `engines.node` line change.
4. `node --input-type=module -e "import('./api/_sheets.js').then(m => console.log(Object.keys(m)))"` lists all 7 exports.
5. `node --input-type=module -e "import('./api/_ar_capi.js').then(m => console.log(Object.keys(m)))"` lists `[ 'fireCapiLead' ]` only.
6. `grep -c '"googleapis"' package.json` returns `1` (existing dep, no duplicate).
7. `git diff package.json` shows NO additions to `dependencies` or `devDependencies`.
</verification>

<success_criteria>
- All three Task `<automated>` verify commands return exit 0
- Existing endpoints unaffected: `node --input-type=module -e "import('./api/add-lead.js').then(()=>console.log('OK'))"` succeeds (proves no import-time regression)
- Zero new npm packages: `git diff package.json | grep -E '"(dependencies|devDependencies)"' | wc -l` returns `0`
- Plan 03 can now `import { appendArLead } from './_sheets.js'` and `import { fireCapiLead } from './_ar_capi.js'` without error
</success_criteria>

<output>
Create `.planning/phases/01-backend-foundation-sheet-provisioning/01-02-SUMMARY.md` documenting:
- Files modified (with LOC delta)
- Confirmation that no npm deps were added
- Brief note on the `getSheetsClient()` cache reuse pattern (so the next session understands why we don't instantiate a second auth client)
- Plan 03 unblocked
</output>
