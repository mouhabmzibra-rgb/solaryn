---
phase: 01-backend-foundation-sheet-provisioning
plan: 03
type: execute
wave: 3
depends_on:
  - 01-prerequisites
  - 02-helpers
files_modified:
  - api/ar-lead.js
autonomous: false
requirements:
  - BACK-02
  - BACK-03
  - BACK-05
  - BACK-08
  - FORM-03
  - TRACK-04
  - SEC-02
  - SEC-03
  - SEC-04
  - SEC-05
  - SEC-06
  - SEC-07
effort: M
must_haves:
  truths:
    - "POST /api/ar-lead with valid MA payload returns {ok:true, event_id:<uuid>} within ~2s and produces one new row in Solaryn AR Leads sheet"
    - "Honeypot 'website' field non-empty → return {ok:true} with NO sheet row and NO CAPI event"
    - "ts_rendered < 2000ms ago → 400 {ok:false, error:'too_fast'}"
    - "x-vercel-ip-country !== 'MA' (unless AR_COUNTRY_GATE_OFF=1) → 403 {ok:false, error:'country_not_allowed'}"
    - "Phone field with Arabic-Indic digits ٠٦١٢٣٤٥٦٧٨ is normalized to +212612345678 and accepted"
    - "Sheet append throw (e.g. wrong sheet ID, 403 from API) → 500 {ok:false, error:'sheet_error'}"
    - "CAPI failure (timeout, 4xx, 5xx) does NOT fail the request — sheet success returns 200"
    - "All log statements use {cls, phone_last4} sanitized form — zero PII in Vercel logs"
    - "Error responses use generic enum codes only — never echo submitted values"
  artifacts:
    - path: "api/ar-lead.js"
      provides: "POST /api/ar-lead handler"
      exports: ["default"]
      min_lines: 130
      contains: "import { appendArLead } from './_sheets.js'; import { fireCapiLead } from './_ar_capi.js';"
  key_links:
    - from: "api/ar-lead.js handler"
      to: "api/_sheets.js::appendArLead"
      via: "await appendArLead(row)"
      pattern: "await appendArLead\\("
    - from: "api/ar-lead.js handler"
      to: "api/_ar_capi.js::fireCapiLead"
      via: "await fireCapiLead({...})"
      pattern: "await fireCapiLead\\("
    - from: "api/ar-lead.js handler"
      to: "api/_lib.js (clean, validPhone, clientIp, readBody)"
      via: "import"
      pattern: "from ['\\\"]\\./_lib\\.js['\\\"]"
    - from: "api/ar-lead.js handler"
      to: "Vercel x-vercel-ip-country header"
      via: "req.headers['x-vercel-ip-country']"
      pattern: "x-vercel-ip-country"
    - from: "Browser POST"
      to: "Vercel function /api/ar-lead"
      via: "Vercel file-system routing (no vercel.json change)"
      pattern: "file api/ar-lead.js exists"
---

<objective>
Build the single-file POST handler that ties together everything Plans 01 and 02 produced: parse JSON body → anti-spam silent-drop → country gate → validate + clean → normalize phone → await Sheet append → await CAPI fire (best-effort) → return `{ok, event_id}`. This is the canonical lead-capture surface for the AR campaign.

Purpose: This endpoint IS the contract that Phase 2's `ar.html` form posts to. After this plan completes and verifies, the backend is "feature-complete" for the AR campaign — Phase 2 is a pure consumer.

Output: One new file `api/ar-lead.js` (~150 LOC), automatically routed by Vercel to `/api/ar-lead`. Validated via sentinel + 8 negative-test cases.
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/execute-plan.md
@~/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/research/ARCHITECTURE.md
@.planning/research/PITFALLS.md
@.planning/phases/01-backend-foundation-sheet-provisioning/RESEARCH.md
@.planning/phases/01-backend-foundation-sheet-provisioning/01-01-SUMMARY.md
@.planning/phases/01-backend-foundation-sheet-provisioning/01-02-SUMMARY.md

# Source files the executor must read before editing
@/Users/a2024/solaryn/api/_lib.js
@/Users/a2024/solaryn/api/_sheets.js
@/Users/a2024/solaryn/api/_ar_capi.js
@/Users/a2024/solaryn/api/add-lead.js

<interfaces>
<!-- Key signatures the executor needs. Extracted from codebase. -->
<!-- No codebase exploration required — use these directly. -->

From `api/_lib.js` (existing, do not modify):
```js
export function clean(value, max = 500): string
  // trims, strips \r and \0, caps length

export function validPhone(tel): boolean
  // regex: /^(0|\+212)[5-7][0-9]{8}$/.test(String(tel||'').replace(/\s+/g, ''))

export function clientIp(req): string
  // first IP from x-forwarded-for header

export function readBody(req): object
  // handles Vercel auto-parsed JSON, raw string body, or {}
```

From `api/_sheets.js` (Plan 02 added, do not modify further):
```js
export async function appendArLead(row): Promise<void>
  // row MUST be Array of length 8: [ts_iso, prenom, nom, "'+212XXXXXXXXX", ville, adresse, source, fbp|fbc]
  // throws if AR_LEADS_SHEET_ID env unset, throws on Sheets API non-2xx
```

From `api/_ar_capi.js` (Plan 02 created, do not modify):
```js
export async function fireCapiLead({
  eventId,           // UUID v4 from req.body, or server-generated fallback
  phoneCanonical,    // '+212XXXXXXXXX' — _ar_capi strips '+' internally for Meta
  prenom,            // raw (will be lowercased+trimmed+hashed inside)
  ville,             // raw (will be normalized+hashed inside)
  fbp, fbc,          // optional, sent plaintext
  clientIp,          // optional, sent plaintext
  userAgent,         // optional, sent plaintext (cap 500 chars)
  eventSourceUrl,    // 'https://<host>/ar' style
}): Promise<void>
  // throws on missing META env vars, throws on Meta non-2xx, throws on AbortController timeout (4s)
```

Pattern reference — CORS + method gate (verified in `api/add-lead.js:22-26, 162-172`):
```js
function setCors(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}
```

</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Create api/ar-lead.js POST handler</name>
  <files>api/ar-lead.js</files>
  <behavior>
    The handler MUST execute steps in this exact order (per RESEARCH.md §8 — order is load-bearing):

    1. **CORS + method gate.** Set CORS headers; `OPTIONS` → 204; non-POST → 405 `{ok:false, error:'method_not_allowed'}`.

    2. **Parse body** via `readBody(req)`.

    3. **Honeypot silent drop.** If `body.website` is non-empty (trimmed) → 200 `{ok:true}` with NO further processing. Bots must not learn they were detected (no error code).

    4. **Time-trap.** Read `Number(body.ts_rendered)`. If `0`/missing OR `Date.now() - ts_rendered < 2000` → 400 `{ok:false, error:'too_fast'}`.

    5. **Country gate.** Read `String(req.headers['x-vercel-ip-country'] || '').toUpperCase()`. If `!== 'MA'` AND `process.env.AR_COUNTRY_GATE_OFF !== '1'` → 403 `{ok:false, error:'country_not_allowed'}`.

    6. **Clean all string fields.** `prenom`, `nom` capped 80; `telRaw` capped 32; `ville` capped 80; `adresse` capped 300; `source` capped 32 (default `'ar_landing'`); `fbp` capped 200; `fbc` capped 300; `event_id` capped 64.

    7. **UUID v4 validation for event_id.** Regex `/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i`. On mismatch → fallback `crypto.randomUUID()` (Pitfall #2: server-generated id breaks Pixel dedup, but is acceptable when client omits — log via `console.warn` with `phone_last4` only).

    8. **Required-field check.** `!prenom || !nom || !telRaw || !ville || !adresse` → 400 `{ok:false, error:'missing_field'}`.

    9. **Address min-length.** `adresse.length < 10` → 400 `{ok:false, error:'invalid_address'}`.

    10. **Name content filter.** Per SEC-07: reject if name contains Cyrillic (`[Ѐ-ӿ]`), CJK (`[一-鿿]`), `https?://`, `www.`, special chars `[<>{}|\\^`+"`"+`]`, OR more than 5 punctuation/special (`(s.match(/[^\p{L}\p{N}\s'\-]/gu) || []).length > 5`). → 400 `{ok:false, error:'invalid_name'}`.

    11. **Phone normalize.** Apply `asciiDigits()` (convert U+0660-U+0669 and U+06F0-U+06F9 to ASCII) then `normalizePhoneMA()` (strip spaces/punct, handle `00`/`0`/`212` prefixes, canonicalize to `+212XXXXXXXXX`). If result is `null` or `validPhone(phoneCanonical)` is false → 400 `{ok:false, error:'invalid_phone'}`.

    12. **Sheet append (REQUIRED).** Build row exactly: `[new Date().toISOString(), prenom, nom, "'" + phoneCanonical, ville, adresse, source, (fbp || '') + '|' + (fbc || '')]`. Note: 8 columns, phone has apostrophe prefix (Pitfall #3). `await appendArLead(row)`. On throw: `console.error('ar_lead_sheet_error', { cls: err.code || err.name || 'unknown', phone_last4: phoneCanonical.slice(-4) })` THEN return 500 `{ok:false, error:'sheet_error'}`. Do NOT log `err.message` (may echo Sheets API payload echo).

    13. **CAPI fire (best-effort).** `await fireCapiLead({ eventId, phoneCanonical, prenom, ville, fbp, fbc, clientIp: clientIp(req), userAgent: String(req.headers['user-agent'] || '').slice(0, 500), eventSourceUrl: 'https://' + (req.headers['host'] || 'solaryn-five.vercel.app') + '/ar' })`. On throw: `console.error('ar_lead_capi_error', { cls: err.code || err.name || 'unknown', phone_last4: phoneCanonical.slice(-4) })` BUT DO NOT fail the request (Pitfall #6 / AP7).

    14. **Success.** Return 200 `{ok:true, event_id: eventId}`.
  </behavior>
  <action>
    Create new file `api/ar-lead.js` per RESEARCH.md §8 skeleton (~150 LOC). Use ES module syntax (`"type": "module"` in package.json).

    Imports at top:
    ```js
    import crypto from 'node:crypto';
    import { clean, validPhone, clientIp, readBody } from './_lib.js';
    import { appendArLead } from './_sheets.js';
    import { fireCapiLead } from './_ar_capi.js';
    ```

    Module-level constants:
    - `MAX_NAME = 80`, `MAX_VILLE = 80`, `MAX_ADRESSE = 300`, `MIN_ADRESSE = 10`, `MAX_SOURCE = 32`
    - `MIN_FILL_TIME_MS = 2000`
    - `UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i`
    - `BAD_NAME_CHARS = /[Ѐ-ӿ]|[一-鿿]|https?:\/\/|www\.|[<>{}|\\^`+"`"+`]/i`

    Module-level helper functions (not exported):
    - `setCors(res)` — sets 3 CORS headers (mirror `add-lead.js:22-26`)
    - `asciiDigits(s)` — replaces `[٠-٩]` → ASCII 0-9 (subtract 0x0660), and `[۰-۹]` → ASCII 0-9 (subtract 0x06F0)
    - `normalizePhoneMA(raw)` — applies asciiDigits, strips `[\s()-.]`, handles `00`/`0`/`212` prefixes, returns `+212XXXXXXXXX` or `null` if final form fails `/^\+212[5-7]\d{8}$/`
    - `badNameContent(s)` — returns true if BAD_NAME_CHARS matches OR special-char count > 5
    - `phoneLast4(p)` — returns `p ? p.slice(-4) : '----'`

    Default export `async function handler(req, res)` that executes the 14-step pipeline above in order.

    DO NOT:
    - Add any GET handler (POST only — no debug form like `add-lead.js` has)
    - Log full request body or full error stack
    - Call any WhatsApp bot, Telegram, or other notification
    - Modify `vercel.json` (file-system routing works automatically)
    - Add a `config.runtime` export (default Node runtime is correct — `googleapis` cannot run on Edge per RESEARCH.md AP4)
    - Use `void` or fire-and-forget for `appendArLead` (Pitfall #1 / AP3)
    - Generate `event_id` server-side as the primary path (Pitfall #2 / AP4: must accept from body, fallback only)
  </action>
  <verify>
    <automated>node --input-type=module -e "import('./api/ar-lead.js').then(m => { if (typeof m.default !== 'function') { console.error('FAIL: default export not a function'); process.exit(1); } if (m.default.length !== 2) { console.error('FAIL: handler should take (req, res), got arity', m.default.length); process.exit(1); } console.log('OK: default export handler(req,res) present'); }).catch(e => { console.error('FAIL import error:', e.message); process.exit(1); })" && grep -c "appendArLead\|fireCapiLead\|x-vercel-ip-country\|MIN_FILL_TIME_MS\|asciiDigits\|normalizePhoneMA\|BAD_NAME_CHARS\|UUID_RE" api/ar-lead.js</automated>
  </verify>
  <done>api/ar-lead.js exists; default export is async handler(req,res); imports all four helper modules; contains all 8 grep tokens (appendArLead, fireCapiLead, x-vercel-ip-country, MIN_FILL_TIME_MS, asciiDigits, normalizePhoneMA, BAD_NAME_CHARS, UUID_RE)</done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: PII-audit grep on new files</name>
  <files>api/ar-lead.js, api/_ar_capi.js</files>
  <action>
    Run grep audit per SEC-06: confirm no `console.log` or `console.error` line in `api/ar-lead.js` or `api/_ar_capi.js` contains the substrings that would indicate PII leakage (`prenom`, `nom`, `adresse`, `+212`, `tel`, or direct variable interpolation like `${body}` or `${err.message}` referencing user input).

    If any match is found, surface the specific line and FAIL the task. Do not attempt automatic repair — the executor should review and resubmit (the sanitized logging pattern is `console.error('ar_lead_*', { cls, phone_last4 })`).
  </action>
  <verify>
    <automated>! grep -nE '^[^/]*console\.(log|error|warn).*(prenom|nom|adresse|\+212|telRaw|body\.tel|err\.message|err\.stack)' api/ar-lead.js api/_ar_capi.js</automated>
  </verify>
  <done>Zero PII-leaking console statements found in the two new files. (`!` inverts grep — exit 0 means no match found, which is the desired outcome.)</done>
</task>

<task type="auto" tdd="false">
  <name>Task 3: Local dev smoke test with mock env</name>
  <files></files>
  <action>
    Verify the module loads without runtime error using mock env values. Run a one-shot Node invocation that imports the handler, fabricates minimal req/res mocks, and confirms basic path flow (CORS + method gate at minimum).

    This proves the imports resolve, the regexes compile, and the handler function shape is correct. It does NOT attempt to hit live Sheets/CAPI (that's the deploy-time sentinel test in Task 5).
  </action>
  <verify>
    <automated>AR_LEADS_SHEET_ID=mock META_PIXEL_ID=mock META_CAPI_ACCESS_TOKEN=mock node --input-type=module -e "import('./api/ar-lead.js').then(async m => { const handler = m.default; let status, body, headers = {}; const req = { method: 'OPTIONS', headers: {}, body: {} }; const res = { setHeader: (k,v) => headers[k] = v, status: (s) => { status = s; return res; }, end: () => { console.log('OPTIONS status:', status); if (status !== 204) { console.error('FAIL: expected 204 for OPTIONS, got', status); process.exit(1); } if (headers['Access-Control-Allow-Origin'] !== '*') { console.error('FAIL: CORS header missing'); process.exit(1); } console.log('OK: OPTIONS preflight returns 204 with CORS'); }, json: (b) => { body = b; res.end(); } }; await handler(req, res); }).catch(e => { console.error('FAIL:', e.message); process.exit(1); })"</automated>
  </verify>
  <done>Handler imports and runs against OPTIONS preflight, returning 204 with CORS headers set. Confirms module is loadable, no top-level errors, regexes valid.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 4: Deploy to Vercel</name>
  <files></files>
  <action>
    Stage and commit the changes from this plan + Plan 02:
    ```bash
    git add package.json api/_sheets.js api/_ar_capi.js api/ar-lead.js
    git commit -m "feat(01): backend foundation — appendArLead + _ar_capi + ar-lead endpoint"
    git push origin <current-branch>
    ```
    (Per CLAUDE.md: do NOT skip hooks, do NOT amend, do NOT touch other files.)

    Vercel auto-deploys on push. Wait for the deploy to complete via:
    ```bash
    vercel ls solaryn --scope <team> 2>&1 | head -5
    # OR poll the deployment URL until /api/ar-lead OPTIONS returns 204 (not 404)
    ```

    If the executor lacks Vercel CLI auth, surface the deploy URL and ask the user to confirm Vercel dashboard shows green build.
  </action>
  <verify>
    <automated>curl -sI -X OPTIONS https://solaryn-five.vercel.app/api/ar-lead -H 'Origin: https://example.com' | head -1 | grep -E "HTTP/[12](\.[01])? (204|200)"</automated>
  </verify>
  <done>OPTIONS preflight to deployed /api/ar-lead returns 204 (or 200) with CORS headers — endpoint is live</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 5: Sentinel positive test (verify live sheet write + CAPI fire)</name>
  <files>(external: live deployed /api/ar-lead, Solaryn AR Leads sheet, Meta Events Manager)</files>
  <action>
    Run the sentinel curl below from the executor terminal. Pause and ask the user to: (a) open the Solaryn AR Leads sheet and confirm the new row, (b) optionally check Meta Events Manager Test Events panel for the matching event_id (if META_TEST_EVENT_CODE is set in Preview env). This is a human-verify gate because sheet contents + Meta Events Manager state are not directly inspectable by Claude.
  </action>
  <verify>
    <automated>echo 'Human-verify checkpoint — verified via user reply: sentinel pass'</automated>
  </verify>
  <done>User confirms sentinel curl returned {ok:true,event_id:&lt;uuid&gt;} AND new row visible in Solaryn AR Leads sheet within 10s</done>
  <what-built>The full `/api/ar-lead` POST handler is deployed and live. This checkpoint verifies the happy path end-to-end against the live Google Sheet and Meta CAPI Test Events panel.</what-built>
  <how-to-verify>
    Run the sentinel curl from your terminal (substitutes ts_rendered to 3s in the past, generates a UUID v4):
    ```bash
    TS=$(($(date +%s)000 - 3000))
    UUID=$(uuidgen | tr A-Z a-z)
    curl -sX POST https://solaryn-five.vercel.app/api/ar-lead \
      -H 'Content-Type: application/json' \
      -H 'x-vercel-ip-country: MA' \
      -d "{\"prenom\":\"TEST_SENTINEL_$(date +%Y-%m-%d)\",\"nom\":\"QA\",\"tel\":\"0612345678\",\"ville\":\"Casablanca\",\"adresse\":\"Rue de Test, Quartier Z numero 12\",\"source\":\"qa_sentinel\",\"ts_rendered\":${TS},\"event_id\":\"${UUID}\"}"
    ```

    Verify three things:

    **1. HTTP response.** Should be exactly:
    ```json
    {"ok":true,"event_id":"<same-uuid-as-sent>"}
    ```

    **2. Live Sheet row.** Open `Solaryn AR Leads` → `Leads` tab. A new row should appear at the bottom within 10 seconds with:
    - Col A: ISO timestamp (e.g. `2026-05-26T19:42:10.123Z`)
    - Col B: `TEST_SENTINEL_2026-05-26`
    - Col C: `QA`
    - Col D: `+212612345678` (LEFT-aligned, displayed without leading apostrophe but stored as text — confirm by clicking the cell and checking the formula bar shows `'+212612345678`)
    - Col E: `Casablanca`
    - Col F: `Rue de Test, Quartier Z numero 12`
    - Col G: `qa_sentinel`
    - Col H: `|` (empty fbp + empty fbc joined by pipe)

    **3. Meta Events Manager.** If you set `META_TEST_EVENT_CODE` in Vercel Preview env (optional Step 6 in Plan 01), go to Events Manager → Test Events tab. The matching `Lead` event with the same `event_id` as the curl response should appear within ~30s. Confirm: `event_name = Lead`, `currency = MAD`, `value = 150`, `event_id = <uuid>`.

    If Meta CAPI fails silently (no event in Test Events) but the Sheet row appears, that is acceptable per AP7 — the Sheet write is the success criterion; CAPI is best-effort. Check Vercel function logs for `ar_lead_capi_error` entries.
  </how-to-verify>
  <resume-signal>Type "sentinel pass" if all three verifications pass. If sheet row missing → describe the curl response body + check Vercel logs for `ar_lead_sheet_error`. If response not 200 → paste exact response.</resume-signal>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 6: Negative test pass (8 cases — all rejection paths)</name>
  <files>(external: live deployed /api/ar-lead + Vercel function logs)</files>
  <action>
    Run the 9 negative-test curls below from the executor terminal, recording each response code + body. After all 9 are complete, pause and ask the user to open the Vercel Dashboard log viewer and grep visually for PII leakage (matches for +212, TEST_SENTINEL, Quartier, http://spam.com). This is a human-verify gate because Vercel logs are not exposed via SDK to Claude.
  </action>
  <verify>
    <automated>echo 'Human-verify checkpoint — verified via user reply: negative tests pass'</automated>
  </verify>
  <done>All 9 cases produce documented enum codes; response bodies contain no PII echoes; Vercel logs PII-free per user inspection</done>
  <what-built>The handler implements layered defense per requirements SEC-02, SEC-03, SEC-04, SEC-05, SEC-07 and pitfalls #1, #2, #4, #5, #6. This checkpoint verifies each rejection path produces the documented generic error code with no PII echo.</what-built>
  <how-to-verify>
    Run each curl below and confirm the listed response. Do NOT vary the headers/payload beyond what's specified — the assertions depend on it. After running all 8, confirm the Sheet has ZERO new rows from these calls (only the honeypot may have appeared to succeed with a 200 — verify the row count did not grow).

    **Case 1 — honeypot filled (silent OK, no sheet row):**
    ```bash
    TS=$(($(date +%s)000 - 3000))
    curl -sX POST https://solaryn-five.vercel.app/api/ar-lead \
      -H 'Content-Type: application/json' -H 'x-vercel-ip-country: MA' \
      -d "{\"prenom\":\"X\",\"nom\":\"Y\",\"tel\":\"0612345678\",\"ville\":\"Casa\",\"adresse\":\"abcdefghij\",\"website\":\"http://spam\",\"ts_rendered\":${TS}}"
    # Expect: {"ok":true}
    # Sheet: NO new row (verify in browser)
    ```

    **Case 2 — too_fast (ts_rendered < 2s ago):**
    ```bash
    TS=$(($(date +%s)000 - 500))  # only 500ms ago
    curl -sX POST https://solaryn-five.vercel.app/api/ar-lead \
      -H 'Content-Type: application/json' -H 'x-vercel-ip-country: MA' \
      -d "{\"prenom\":\"X\",\"nom\":\"Y\",\"tel\":\"0612345678\",\"ville\":\"Casa\",\"adresse\":\"abcdefghij\",\"ts_rendered\":${TS}}"
    # Expect: HTTP 400, {"ok":false,"error":"too_fast"}
    ```

    **Case 3 — missing ts_rendered:**
    ```bash
    curl -sX POST https://solaryn-five.vercel.app/api/ar-lead \
      -H 'Content-Type: application/json' -H 'x-vercel-ip-country: MA' \
      -d '{"prenom":"X","nom":"Y","tel":"0612345678","ville":"Casa","adresse":"abcdefghij"}'
    # Expect: HTTP 400, {"ok":false,"error":"too_fast"}
    ```

    **Case 4 — country gate (non-MA header):**
    ```bash
    TS=$(($(date +%s)000 - 3000))
    curl -sX POST https://solaryn-five.vercel.app/api/ar-lead \
      -H 'Content-Type: application/json' -H 'x-vercel-ip-country: FR' \
      -d "{\"prenom\":\"X\",\"nom\":\"Y\",\"tel\":\"0612345678\",\"ville\":\"Casa\",\"adresse\":\"abcdefghij\",\"ts_rendered\":${TS}}"
    # Expect: HTTP 403, {"ok":false,"error":"country_not_allowed"}
    ```

    **Case 5 — Arabic-Indic digits (POSITIVE — should succeed and produce sheet row):**
    ```bash
    TS=$(($(date +%s)000 - 3000))
    UUID=$(uuidgen | tr A-Z a-z)
    curl -sX POST https://solaryn-five.vercel.app/api/ar-lead \
      -H 'Content-Type: application/json' -H 'x-vercel-ip-country: MA' \
      -d "{\"prenom\":\"TEST_AR_DIGITS\",\"nom\":\"QA\",\"tel\":\"٠٦١٢٣٤٥٦٧٨\",\"ville\":\"Casablanca\",\"adresse\":\"Rue Test 12345\",\"ts_rendered\":${TS},\"event_id\":\"${UUID}\"}"
    # Expect: {"ok":true,"event_id":"..."}
    # Sheet: new row with phone D = +212612345678 (NORMALIZED FROM ARABIC-INDIC)
    ```

    **Case 6 — invalid_name (URL in prenom):**
    ```bash
    TS=$(($(date +%s)000 - 3000))
    curl -sX POST https://solaryn-five.vercel.app/api/ar-lead \
      -H 'Content-Type: application/json' -H 'x-vercel-ip-country: MA' \
      -d "{\"prenom\":\"http://spam.com\",\"nom\":\"Y\",\"tel\":\"0612345678\",\"ville\":\"Casa\",\"adresse\":\"abcdefghij\",\"ts_rendered\":${TS}}"
    # Expect: HTTP 400, {"ok":false,"error":"invalid_name"}
    ```

    **Case 7 — invalid_address (too short):**
    ```bash
    TS=$(($(date +%s)000 - 3000))
    curl -sX POST https://solaryn-five.vercel.app/api/ar-lead \
      -H 'Content-Type: application/json' -H 'x-vercel-ip-country: MA' \
      -d "{\"prenom\":\"X\",\"nom\":\"Y\",\"tel\":\"0612345678\",\"ville\":\"Casa\",\"adresse\":\"Casa\",\"ts_rendered\":${TS}}"
    # Expect: HTTP 400, {"ok":false,"error":"invalid_address"}
    ```

    **Case 8 — invalid_phone (prefix 4 not in [5-7]):**
    ```bash
    TS=$(($(date +%s)000 - 3000))
    curl -sX POST https://solaryn-five.vercel.app/api/ar-lead \
      -H 'Content-Type: application/json' -H 'x-vercel-ip-country: MA' \
      -d "{\"prenom\":\"X\",\"nom\":\"Y\",\"tel\":\"0412345678\",\"ville\":\"Casa\",\"adresse\":\"abcdefghij\",\"ts_rendered\":${TS}}"
    # Expect: HTTP 400, {"ok":false,"error":"invalid_phone"}
    ```

    **Case 9 — missing_field (no prenom):**
    ```bash
    TS=$(($(date +%s)000 - 3000))
    curl -sX POST https://solaryn-five.vercel.app/api/ar-lead \
      -H 'Content-Type: application/json' -H 'x-vercel-ip-country: MA' \
      -d "{\"nom\":\"Y\",\"tel\":\"0612345678\",\"ville\":\"Casa\",\"adresse\":\"abcdefghij\",\"ts_rendered\":${TS}}"
    # Expect: HTTP 400, {"ok":false,"error":"missing_field"}
    ```

    **PII echo check:** For every 4xx response above, confirm the JSON body does NOT contain any of: `prenom`, `nom`, `tel`, `ville`, `adresse`, `+212`, `http`, the actual submitted values. Body should be strictly `{"ok":false,"error":"<enum_code>"}`.

    **Vercel logs check:** Open Vercel Dashboard → solaryn → Logs (last 1 hour) and grep visually for any line containing `+212`, `TEST_SENTINEL`, `Quartier`, or `http://spam.com`. Expected: ZERO matches. If matches found → SEC-06 violated → FAIL.
  </how-to-verify>
  <resume-signal>Type "negative tests pass" after all 9 cases match expected behavior AND Vercel logs show zero PII. Otherwise describe which case failed with exact response body received.</resume-signal>
</task>

<task type="auto" tdd="false">
  <name>Task 7: Regression smoke test on existing endpoints</name>
  <files></files>
  <action>
    Verify Phase 1 changes did not break any existing endpoint. Run:
    ```bash
    for url in / /affiliates /kit /admin; do
      code=$(curl -s -o /dev/null -w "%{http_code}" "https://solaryn-five.vercel.app${url}")
      echo "${url} → ${code}"
    done
    curl -sI https://solaryn-five.vercel.app/api/add-lead | head -1
    ```
    All static pages must return 200. `/api/add-lead` GET must return 200 (the existing form page) — confirms `_sheets.js` additive edit didn't break the affiliate-related path either.
  </action>
  <verify>
    <automated>for url in / /affiliates /kit /admin; do code=$(curl -s -o /dev/null -w "%{http_code}" "https://solaryn-five.vercel.app${url}"); if [ "$code" != "200" ]; then echo "FAIL: $url returned $code"; exit 1; fi; done; addlead=$(curl -s -o /dev/null -w "%{http_code}" https://solaryn-five.vercel.app/api/add-lead); if [ "$addlead" != "200" ]; then echo "FAIL: /api/add-lead returned $addlead"; exit 1; fi; echo "OK: all existing endpoints still 200"</automated>
  </verify>
  <done>All 4 static pages return 200; /api/add-lead GET returns 200; no regression introduced by Phase 1 changes</done>
</task>

<task type="auto">
  <name>Task 8: Update STATE.md and write phase SUMMARY.md</name>
  <files>.planning/STATE.md, .planning/phases/01-backend-foundation-sheet-provisioning/SUMMARY.md, SESSION.md</files>
  <action>
    1. Update `.planning/STATE.md`:
       - "Current Position → Phase" → `1 (Backend Foundation & Sheet Provisioning) — COMPLETE`
       - "Status" → `Phase 1 done — ready to begin Phase 2 (Landing Page Build)`
       - "Progress" → `1/4 phases complete (25%)`
       - Update progress bar accordingly
       - Add a `### Done Phase 1` block under "Accumulated Context" with the sentinel test timestamp, last-6 of sheet ID, list of files created/modified

    2. Create `.planning/phases/01-backend-foundation-sheet-provisioning/SUMMARY.md`:
       - **Date completed**
       - **Files created:** `api/_ar_capi.js`, `api/ar-lead.js`
       - **Files modified:** `package.json` (engines.node), `api/_sheets.js` (+appendArLead)
       - **External infrastructure provisioned:** new sheet `Solaryn AR Leads` (last-6: `XXXXXX`), 3 env vars in Vercel
       - **Sentinel test evidence:** timestamp + response (no PII)
       - **Negative test cases pass:** 9/9
       - **Carries into Phase 2:**
         - Frontend `ar.html` must POST JSON to `/api/ar-lead` with body fields: `prenom, nom, tel, ville, adresse, source?, fbp?, fbc?, website (honeypot), ts_rendered, event_id`
         - `event_id` MUST be generated by browser via `crypto.randomUUID()` BEFORE the POST (per Pitfall #2 / AP4)
         - `ts_rendered` MUST be set to `Date.now()` at form render time (NOT submit time)
         - Browser MUST fire `fbq('track', 'Lead', {value:150, currency:'MAD'}, {eventID: event_id})` AFTER receiving `{ok:true}` to enable Pixel+CAPI dedup
         - Phase 2 frontend must NOT add CAPI logic (already server-side)
       - **Known limitations / deferred:** server-side dedup (DIFF-07 v2), rate limiting (SCALE-04 v2), retry-with-backoff for 429s (deferred — quota is 60/min, current expected v1 traffic ~100/day)

    3. Update `SESSION.md` per CLAUDE.md Rule 4 with completion of Phase 1.
  </action>
  <verify>
    <automated>test -f .planning/phases/01-backend-foundation-sheet-provisioning/SUMMARY.md && grep -q "COMPLETE\|Complete\|complete" .planning/STATE.md && grep -q "Phase 1" SESSION.md && echo "OK: state + summary + session updated"</automated>
  </verify>
  <done>STATE.md reflects Phase 1 complete; SUMMARY.md exists with all required sections; SESSION.md updated</done>
</task>

</tasks>

<threat_model>

## Trust Boundaries
| Boundary | Description |
|----------|-------------|
| Internet → `/api/ar-lead` | Untrusted POST body crosses; must be parsed, cleaned, validated server-side (no client trust) |
| `/api/ar-lead` → `appendArLead` → Google Sheets | PII written to managed storage; row shape must be exactly 8 columns |
| `/api/ar-lead` → `fireCapiLead` → Meta Graph API | Hashed PII transmitted with server-only token |
| `/api/ar-lead` → Vercel function logs | NO PII may cross this boundary (SEC-06) — only sanitized `{cls, phone_last4}` |
| `/api/ar-lead` → error response body | NO submitted values may be echoed (SEC-05) — only enum codes |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-01-13 | Spoofing | Bot submitting with valid-looking fields | mitigate | Honeypot `website` (Step 3) + time-trap 2s (Step 4) + country gate (Step 5) + name content filter (Step 10) — layered |
| T-01-14 | Tampering | Phone garbage / Arabic-Indic digits | mitigate | `asciiDigits` + `normalizePhoneMA` + `validPhone` (Steps 11) — server re-validates regardless of client format |
| T-01-15 | Information Disclosure | Error response echoes submitted PII | mitigate | All 4xx returns hardcoded enum: `method_not_allowed`, `too_fast`, `country_not_allowed`, `missing_field`, `invalid_address`, `invalid_name`, `invalid_phone`, `sheet_error` — verified in negative tests Case 6+ (PII echo check) |
| T-01-16 | Information Disclosure | `console.error(err)` dumps raw Sheets/CAPI response | mitigate | All `console.error` calls use sanitized object `{cls, phone_last4}` only — never `err.message` or `err.stack` (PII audit task) |
| T-01-17 | Information Disclosure | Phase 2 forgets to set `event_id` client-side → CAPI dedup fails | accept | Server fallback generates UUID; logs `evt_id_invalid` cls so monitoring can detect; Phase 2 plan will include explicit reminder per SUMMARY carry-forward |
| T-01-18 | DoS | Slow CAPI pins function past Vercel timeout → client retries → duplicate row | mitigate | 4s AbortController in `fireCapiLead`; client-side double-submit prevention is Phase 2 work (disable button on click) |
| T-01-19 | Tampering | Phone written without apostrophe prefix → Sheets parses as formula `#NAME?` | mitigate | Hardcoded `"'" + phoneCanonical` in row construction (Step 12); verified in sentinel test Case 5 (Arabic-Indic) — phone displays as text |
| T-01-20 | Elevation of Privilege | Forgotten `fireCapiLead` await → Lambda freezes container before fetch completes → silent CAPI miss | mitigate | All external calls explicitly `await`-ed (AP8); CAPI failure doesn't fail request but is awaited so timeout/throw is captured |
| T-01-SC | Tampering | npm/pip/cargo installs | N/A | Phase 1 installs ZERO new packages. No `npm install` runs in this plan. |

</threat_model>

<verification>
Combined verification from all tasks:

1. Module loads (Task 3): handler imports without runtime error using mock env.
2. PII audit (Task 2): no `console.*` line in new files references PII variables.
3. Deploy live (Task 4): OPTIONS preflight returns 204 + CORS headers.
4. Sentinel pass (Task 5): live curl produces sheet row + (optionally) CAPI Test Event within 10s.
5. Negative tests pass (Task 6): 9 cases produce expected codes; ZERO PII in response bodies; ZERO PII in Vercel logs.
6. Regression smoke (Task 7): all 4 existing static pages + `/api/add-lead` still return 200.
7. State + Summary (Task 8): `.planning/STATE.md`, phase `SUMMARY.md`, and `SESSION.md` all updated.

End-to-end criterion (per ROADMAP.md Phase 1 success criteria): a valid POST writes one canonical row + fires CAPI Lead with shared `event_id`; invalid inputs are rejected with generic codes; anti-spam silently drops bots; no PII in logs.
</verification>

<success_criteria>
- Task 1-3 automated verifies all return exit 0
- Task 4 deploy succeeds (OPTIONS preflight 204)
- Task 5 sentinel: sheet row appears in `Solaryn AR Leads` within 10s; response is `{ok:true, event_id:<uuid>}`
- Task 6 negative: all 9 cases produce documented enum codes; Vercel logs PII-free
- Task 7 regression: all existing endpoints unchanged
- Task 8: planning state files reflect completion

After this plan: Phase 1 is COMPLETE. Phase 2 (`/ar` HTML + form + Pixel) can begin with a working backend contract.
</success_criteria>

<output>
Create `.planning/phases/01-backend-foundation-sheet-provisioning/01-03-SUMMARY.md` AND the rolled-up phase `.planning/phases/01-backend-foundation-sheet-provisioning/SUMMARY.md` per Task 8.

The phase SUMMARY.md is the primary handoff doc for Phase 2 — it must include the explicit list of frontend-side responsibilities for `event_id` generation, `ts_rendered` timing, honeypot field name, and Pixel dedup wiring.
</output>
