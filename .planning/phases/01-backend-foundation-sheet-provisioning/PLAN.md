---
phase: 01-backend-foundation-sheet-provisioning
phase_number: 1
granularity: coarse
mode: yolo
parallelization: true
plans:
  - 01-prerequisites
  - 02-helpers
  - 03-endpoint
requirements:
  - BACK-01
  - BACK-02
  - BACK-03
  - BACK-04
  - BACK-05
  - BACK-06
  - BACK-07
  - BACK-08
  - FORM-03
  - TRACK-04
  - TRACK-05
  - TRACK-07
  - SEC-02
  - SEC-03
  - SEC-04
  - SEC-05
  - SEC-06
  - SEC-07
---

# Phase 1 Plan: Backend Foundation & Sheet Provisioning

**Phase goal (from ROADMAP.md):**
A POST to `/api/ar-lead` with a valid MA lead payload writes exactly one canonical row to the new `Solaryn AR Leads` sheet, fires a deduplicated server-side CAPI `Lead`, and rejects bots/non-MA traffic — all before any user-facing surface is built.

**Source artifacts (read first):**
- `@.planning/PROJECT.md`
- `@.planning/REQUIREMENTS.md`
- `@.planning/ROADMAP.md`
- `@.planning/research/SUMMARY.md`
- `@.planning/research/STACK.md`
- `@.planning/research/ARCHITECTURE.md`
- `@.planning/research/PITFALLS.md`
- `@.planning/phases/01-backend-foundation-sheet-provisioning/RESEARCH.md`

---

## Sub-Plans (Wave Structure)

| Wave | Plan | Type | Autonomous | Depends on | Effort | Files touched |
|------|------|------|------------|------------|--------|---------------|
| 1 | [01-prerequisites](./PLANS/01-prerequisites.md) | checkpoint:human-action | **no** (user must do manual setup) | — | S | Vercel env (3 vars), new Google Sheet, Meta CAPI token |
| 2 | [02-helpers](./PLANS/02-helpers.md) | auto | yes | 01-prerequisites (needs env vars for verification) | M | `package.json`, `api/_sheets.js`, `api/_ar_capi.js` (NEW) |
| 3 | [03-endpoint](./PLANS/03-endpoint.md) | auto + checkpoint:human-verify | mixed | 02-helpers | M | `api/ar-lead.js` (NEW) |

**Parallelization note:** Plans 02 and 03 must run sequentially because Plan 03 imports symbols (`appendArLead`, `fireCapiLead`) that Plan 02 defines. Within Plan 02 the three tasks touch independent files and could run in parallel; the YOLO executor will sequence them by frontmatter order.

---

## Requirements Coverage Audit

| REQ-ID | Plan | Implemented by |
|--------|------|----------------|
| BACK-01 | 01-prerequisites | Manual: create sheet + header row + share with SA |
| BACK-02 | 03-endpoint | New file `api/ar-lead.js`, POST-only, JSON `{ok,error?}` |
| BACK-03 | 03-endpoint | `clean()` + `validPhone()` from `_lib.js` in handler |
| BACK-04 | 02-helpers + 03-endpoint | `appendArLead()` added to `_sheets.js`; called from `ar-lead.js` |
| BACK-05 | 03-endpoint | Row layout `[ts_iso, prenom, nom, "'+212...", ville, adresse, source, fbp\|fbc]` |
| BACK-06 | 01-prerequisites | Vercel env var `AR_LEADS_SHEET_ID` (Prod + Preview + Dev) |
| BACK-07 | 02-helpers | `engines.node = "22.x"` in `package.json` |
| BACK-08 | 03-endpoint | `try/catch` around `appendArLead` returns 500 on throw |
| FORM-03 | 03-endpoint | `asciiDigits()` + `normalizePhoneMA()` in handler |
| TRACK-04 | 02-helpers + 03-endpoint | `fireCapiLead()` in `_ar_capi.js`; called with body `event_id` |
| TRACK-05 | 02-helpers | `sha256()` of phone/first-name/city in `_ar_capi.js` `user_data` |
| TRACK-07 | 01-prerequisites | `META_PIXEL_ID` + `META_CAPI_ACCESS_TOKEN` env vars (token never `NEXT_PUBLIC_*`) |
| SEC-02 | 03-endpoint | `MIN_FILL_TIME_MS = 2000` check on `body.ts_rendered` |
| SEC-03 | 03-endpoint | `x-vercel-ip-country !== 'MA'` rejection with `AR_COUNTRY_GATE_OFF` override |
| SEC-04 | 03-endpoint | All 5 fields re-validated server-side; UUID re-validated |
| SEC-05 | 03-endpoint | Error enum: `invalid_phone`, `missing_field`, `invalid_address`, `invalid_name`, `sheet_error`, `country_not_allowed`, `too_fast`, `method_not_allowed` — no PII echoed |
| SEC-06 | 03-endpoint | `console.error('ar_lead_*', { cls, phone_last4 })` only |
| SEC-07 | 03-endpoint | `BAD_NAME_CHARS` regex + `>5` specials check via `badNameContent()` |

**Coverage:** 18/18 requirements covered. Zero unplanned items. Zero items deferred to a later phase silently.

---

## Goal-Backward Must-Haves

### Observable truths (verified end-of-phase by Plan 03 sentinel test)

1. `curl -X POST https://solaryn-five.vercel.app/api/ar-lead` with valid 5-field MA payload (incl. `x-vercel-ip-country: MA` and `ts_rendered` ≥ 2s old) returns `{ok:true, event_id:"<uuid>"}` within ~2s.
2. The same POST produces exactly one new row in `Solaryn AR Leads → Leads` sheet, columns A-H populated, phone stored as text `+212XXXXXXXXX`.
3. The same POST fires a Meta CAPI `Lead` event visible in Meta Events Manager → Test Events (when `META_TEST_EVENT_CODE` is set) with matching `event_id`.
4. Honeypot-filled POST returns `{ok:true}` with NO sheet row and NO CAPI event.
5. POSTs with bad phone / missing field / Cyrillic name / short address / `<2s` fill time / non-MA country return appropriate 4xx with generic error code (no PII echo).
6. Sheet append throw (e.g. wrong sheet ID) returns 500 — never 200.
7. `grep -r 'console\.log\|console\.error' api/ar-lead.js api/_ar_capi.js | grep -E '(prenom|nom|adresse|\+212|tel)'` returns ZERO matches.

### Required artifacts

| Path | Provides | Min lines / Contains |
|------|----------|----------------------|
| `package.json` | Node 22.x pin | `"node": "22.x"` |
| `api/_sheets.js` | `appendArLead` export | new export, existing exports untouched |
| `api/_ar_capi.js` | `fireCapiLead` export, CAPI helpers | ~70 LOC, exports `fireCapiLead` |
| `api/ar-lead.js` | POST handler | ~150 LOC, default export `handler` |
| New Google Sheet `Solaryn AR Leads` | Lead persistence | Tab `Leads`, header row A1:H1, SA Editor |
| Vercel env vars | Runtime config | `AR_LEADS_SHEET_ID`, `META_PIXEL_ID`, `META_CAPI_ACCESS_TOKEN` in Prod+Preview+Dev |

### Key links (where breakage cascades)

| From | To | Via | Smoke check |
|------|-----|-----|-------------|
| `api/ar-lead.js` | `api/_sheets.js::appendArLead` | `import { appendArLead } from './_sheets.js'` | `grep "import.*appendArLead.*_sheets" api/ar-lead.js` |
| `api/ar-lead.js` | `api/_ar_capi.js::fireCapiLead` | `import { fireCapiLead } from './_ar_capi.js'` | `grep "import.*fireCapiLead.*_ar_capi" api/ar-lead.js` |
| `api/_sheets.js::appendArLead` | Google Sheets API | `sheets.spreadsheets.values.append` with `process.env.AR_LEADS_SHEET_ID` | `curl POST` sentinel test |
| `api/_ar_capi.js::fireCapiLead` | Meta Graph API v22.0 | `fetch('https://graph.facebook.com/v22.0/{PIXEL_ID}/events?access_token=...')` | Meta Events Manager → Test Events |
| `api/ar-lead.js` handler | Vercel request header | `req.headers['x-vercel-ip-country']` | Manual header simulation |

---

## Threat Model

### Trust boundaries
| Boundary | Description |
|----------|-------------|
| Internet → `/api/ar-lead` | Untrusted user input (browser, scrapers, bots) crosses here |
| `/api/ar-lead` → Google Sheets API | Trusted service-account JWT, but PII written to Google-managed storage |
| `/api/ar-lead` → Meta Graph API | Trusted CAPI token (server-only), hashed PII transmitted |
| `/api/ar-lead` → Vercel function logs | PII MUST NOT cross this boundary (SEC-06) |

### STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-01-01 | Spoofing | `/api/ar-lead` | mitigate | Honeypot field `website`, time-trap `ts_rendered < 2000ms`, country gate on `x-vercel-ip-country` (Plan 03) |
| T-01-02 | Tampering | Phone field (Arabic-Indic digits, junk separators) | mitigate | `asciiDigits()` + `normalizePhoneMA()` + `validPhone()` server re-validation (Plan 03) |
| T-01-03 | Repudiation | Sheet row provenance | accept | Out of scope; v1 traffic is small, manual review acceptable |
| T-01-04 | Information Disclosure | PII in function logs | mitigate | Log only `{ cls, phone_last4 }` — never raw body/error.stack (SEC-06, Plan 03) |
| T-01-05 | Information Disclosure | Error response echo | mitigate | Generic enum codes only, never echo submitted values (SEC-05, Plan 03) |
| T-01-06 | Information Disclosure | CAPI access token | mitigate | Env var `META_CAPI_ACCESS_TOKEN` server-only, NEVER `NEXT_PUBLIC_*` (TRACK-07, Plan 01) |
| T-01-07 | DoS | Sheets quota (60 writes/min/user) via spam burst | accept | Honeypot + time-trap + country gate sufficient for v1 ad traffic; SCALE-04 (Upstash rate limit) deferred to v2 |
| T-01-08 | Elevation of Privilege | Service account scope mutation | mitigate | DO NOT modify `GOOGLE_SERVICE_ACCOUNT_JSON` env var; only ADD three new env vars (Pitfall #7, Plan 01) |
| T-01-SC | Tampering | npm/pip/cargo installs | mitigate | **N/A — Phase 1 installs ZERO new packages.** All deps already in `package.json` or built into Node 22. Package legitimacy gate moot. |

---

## Risk Notes (from PITFALLS.md)

| Pitfall | Where addressed | Mitigation |
|---------|-----------------|------------|
| #1 Silent data loss (form 200, no Sheet row) | Plan 03 | `await appendArLead()`; throw → 500; sentinel test verifies row appears live within 10s |
| #2 CAPI dedup fails (event_id origin mismatch) | Plan 03 + Phase 2 | Phase 1 endpoint accepts `event_id` from `req.body` and forwards UNCHANGED to CAPI; server-side fallback only when client omits |
| #3 Phone `+212...` becomes Sheets formula error | Plan 03 | Apostrophe prefix `"'" + phoneCanonical` in row D (verified pattern in `add-lead.js:139`) |
| #4 Arabic-Indic digits fail regex | Plan 03 | `asciiDigits()` converts `٠-٩` and `۰-۹` to `0-9` BEFORE `validPhone()` |
| #5 `x-vercel-ip-country` wrong for real MA users on VPN | Plan 03 | `AR_COUNTRY_GATE_OFF` env flag for testing/recovery |
| #6 CAPI 6s timeout pins function | Plan 02 | `AbortController` 4s in `fireCapiLead()`; failure logs but does NOT fail request |
| #7 SA env var accidentally mutated → both endpoints break | Plan 01 | DO NOT touch `GOOGLE_SERVICE_ACCOUNT_JSON`; only ADD three new env vars |

---

## Verification (phase-level)

After all three plans complete, run the Plan 03 sentinel + negative tests. All must pass before Phase 1 is considered DONE and `STATE.md` is flipped to "Phase 1: Complete".

```bash
# Sentinel positive test (replace HOST + TS)
TS=$(($(date +%s%3N) - 3000))  # 3s in the past
curl -sX POST https://solaryn-five.vercel.app/api/ar-lead \
  -H 'Content-Type: application/json' \
  -H 'x-vercel-ip-country: MA' \
  -d "{\"prenom\":\"TEST_SENTINEL_2026-05-26\",\"nom\":\"QA\",\"tel\":\"0612345678\",\"ville\":\"Casablanca\",\"adresse\":\"Rue de Test, Quartier Z\",\"source\":\"qa\",\"ts_rendered\":${TS},\"event_id\":\"$(uuidgen | tr A-Z a-z)\"}"
# Expect: {"ok":true,"event_id":"..."}
# Then: open Solaryn AR Leads sheet → confirm row appears within 10s
```

See Plan 03 `<verify>` block for the full negative-test suite (honeypot, too_fast, country gate, invalid_name, invalid_address, missing_field, invalid_phone, sheet_error).

---

## Success Criteria (phase-level)

1. All 18 requirements covered by sub-plan tasks execute without error.
2. Sentinel `curl` produces exactly one new row in the live `Solaryn AR Leads` sheet within 10s.
3. Meta Events Manager → Test Events shows the matching `Lead` event with the same `event_id`.
4. All 8 negative-test cases in Plan 03 verification produce the documented response codes/bodies.
5. PII audit `grep` produces zero matches for `prenom|nom|adresse|\+212|tel` in `api/ar-lead.js` and `api/_ar_capi.js` `console.*` calls.
6. Existing endpoints (`/api/add-lead`, `/affiliates`, `/admin`, `/kit`, `/`) still return 200 post-deploy (regression smoke test).
7. `STATE.md` updated to "Phase 1: Complete" with sentinel test evidence.

---

## Output

After Plan 03 completes:
- Update `.planning/STATE.md` → "Phase 1: Complete"
- Create `.planning/phases/01-backend-foundation-sheet-provisioning/SUMMARY.md` documenting: new sheet ID (last 6 chars only — never full ID in committed files), env vars added, sentinel test evidence (timestamp + response), known limitations carried into Phase 2.
- Commit message: `feat(01): backend foundation + sheet provisioning complete`
