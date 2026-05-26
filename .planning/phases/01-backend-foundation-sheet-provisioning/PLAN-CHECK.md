# Phase 1 Plan Pre-Execution Check

**Checked:** 2026-05-26
**Phase:** 01-backend-foundation-sheet-provisioning
**Plans reviewed:** 01-prerequisites.md, 02-helpers.md, 03-endpoint.md (+ PLAN.md rollup)
**Reviewer stance:** Adversarial / goal-backward — assume plans fail until evidence proves otherwise.

---

## VERDICT: PASS_WITH_NOTES

The three plans, as written, **will achieve all five Phase 1 success criteria** and cover all 18 requirements with concrete, executable tasks. Constraints (zero new npm deps, vanilla Node 22, additive-only edits to existing endpoints) are respected. Risk coverage is explicit and traceable. The only findings are minor (4 WARNINGs, zero BLOCKERs).

Execution is safe to begin once Plan 01's manual checkpoints clear.

---

## Goal Achievement (per Success Criterion)

| # | Success Criterion | Delivered By | Verdict |
|---|------|------|------|
| 1 | NEW Sheet `Solaryn AR Leads` exists, A1:H1 header, SA-shared, `AR_LEADS_SHEET_ID` in Vercel Prod+Preview+Dev | Plan 01 Tasks 1+3 (checkpoint:human-action; `vercel env ls` confirms 9 entries) | ✅ Will be true |
| 2 | Valid `curl POST` returns `{ok:true}` AND appends one canonical row within ~2s | Plan 02 Task 2 (`appendArLead` export, `Leads!A:H`, `USER_ENTERED`/`INSERT_ROWS`) + Plan 03 Task 1 step 12 (`await appendArLead(row)` with apostrophe-prefixed phone) + Plan 03 Task 5 sentinel | ✅ Will be true |
| 3 | Invalid submissions rejected with generic enum codes; sheet write fails → 500 | Plan 03 Task 1 steps 6-12 (error enum: `invalid_phone`, `missing_field`, `invalid_address`, `invalid_name`, `sheet_error`, `country_not_allowed`, `too_fast`, `method_not_allowed`) + Plan 03 Task 6 cases 2,3,6,7,8,9 verify behavior live | ✅ Will be true |
| 4 | Anti-spam: honeypot 200/no-write, time<2s reject, non-MA reject, URL/Cyrillic/Chinese in name reject | Plan 03 Task 1 steps 3 (honeypot silent OK), 4 (time-trap), 5 (country gate w/ `AR_COUNTRY_GATE_OFF` override), 10 (`BAD_NAME_CHARS` regex covering Cyrillic `[Ѐ-ӿ]`, CJK `[一-鿿]`, `https?://`, `www.`, special chars) + Plan 03 Task 6 cases 1,2,4,6 verify live | ✅ Will be true |
| 5 | Server CAPI `Lead` with SHA-256-hashed ph/fn/ct + shared `event_id`; `META_CAPI_ACCESS_TOKEN` server-only; zero PII in `console.log` | Plan 01 Task 3 (env var added with NO `NEXT_PUBLIC_` prefix — automated grep checks this) + Plan 02 Task 3 (`_ar_capi.js` SHA-256 helper, `phoneForCapi` strips `+`, AbortController 4s timeout, throws on env missing) + Plan 03 Task 1 step 13 (`fireCapiLead({...eventId from body...})`) + Plan 03 Task 2 (PII-audit grep on `console.*` calls) | ✅ Will be true |

**Walk-through verdict:** If executed exactly as written, each of the 5 criteria becomes observably true via the corresponding sentinel/negative test in Plan 03. No criterion is left to "happens automatically" — each has a named owner task.

---

## Requirement Coverage (18 REQ-IDs)

| REQ-ID | Plan | Task(s) | Coverage Status |
|--------|------|---------|-----------------|
| BACK-01 | 01 | T1 (sheet + header) + T2 (SA share) | ✅ Direct |
| BACK-02 | 03 | T1 (POST-only, JSON `{ok,error?}`, step 1 method gate) | ✅ Direct |
| BACK-03 | 03 | T1 imports `clean, validPhone` from `_lib.js`; step 11 calls `validPhone(phoneCanonical)` | ✅ Direct |
| BACK-04 | 02 + 03 | 02-T2 adds `appendArLead`; 03-T1 step 12 `await appendArLead(row)` | ✅ Direct |
| BACK-05 | 03 | T1 step 12 row literal: `[new Date().toISOString(), prenom, nom, "'" + phoneCanonical, ville, adresse, source, (fbp||'')+'|'+(fbc||'')]` — exactly 8 cols, apostrophe-prefixed phone | ✅ Direct |
| BACK-06 | 01 | T3 (3 env × 3 envs = 9 entries; automated `vercel env ls | wc -l` ≥ 9) | ✅ Direct |
| BACK-07 | 02 | T1 (`engines.node = "22.x"`; automated `node -e` check) | ✅ Direct |
| BACK-08 | 03 | T1 step 12 (try/catch around `appendArLead`, on throw → 500 `sheet_error`) | ✅ Direct |
| FORM-03 | 03 | T1 step 11 (`asciiDigits()` for `[٠-٩]` U+0660 and `[۰-۹]` U+06F0; `normalizePhoneMA` canonical `+212XXXXXXXXX`); verified live by 03-T6 Case 5 | ✅ Direct |
| TRACK-04 | 02 + 03 | 02-T3 (`fireCapiLead` POST to Graph v22.0 with `event_id` from caller); 03-T1 step 13 forwards `eventId` unchanged | ✅ Direct |
| TRACK-05 | 02 | T3 (internal `sha256()`, `phoneForCapi` strips `+`, `firstNameForCapi`, `cityForCapi`; hashed fields `ph/fn/ct/country` in `user_data`) | ✅ Direct |
| TRACK-07 | 01 | T3 (both env vars × 3 envs; automated check forbids `NEXT_PUBLIC_*`/`VITE_*` prefix) | ✅ Direct |
| SEC-02 | 03 | T1 constants `MIN_FILL_TIME_MS = 2000`; step 4 rejects with `too_fast`; 03-T6 Case 2 verifies live | ✅ Direct |
| SEC-03 | 03 | T1 step 5 country gate w/ `AR_COUNTRY_GATE_OFF` override; 03-T6 Case 4 verifies live | ✅ Direct |
| SEC-04 | 03 | T1 steps 6-11 re-validate every field server-side; UUID re-validated step 7 | ✅ Direct |
| SEC-05 | 03 | T1 generic enum codes only; 03-T6 explicit "PII echo check" against every 4xx body | ✅ Direct |
| SEC-06 | 03 | T1 logs `{cls, phone_last4}` only; T2 grep-audit `console.*` calls; 03-T6 also requires user to grep Vercel dashboard logs | ✅ Direct (defence in depth) |
| SEC-07 | 03 | T1 step 10 `BAD_NAME_CHARS = /[Ѐ-ӿ]|[一-鿿]|https?:\/\/|www\.|[<>{}|\\^`+"`"+`]/i` + special-char count > 5; 03-T6 Case 6 verifies live | ✅ Direct |

**Coverage:** 18 / 18 requirements covered. **Zero orphans. Zero duplicates** (each REQ has a designated primary plan, with cross-plan REQs explicitly noted as such). **Zero silent deferrals** to a later phase.

---

## Gaps Found

### Zero blockers.

### 4 minor warnings (non-blocking):

**W1 — `fbp|fbc` column header literal contains the pipe character used as the value separator.**
- Where: Plan 01 Task 1 step 4, header H1 = `fbp|fbc`
- Concern: Header text contains the same character (`|`) used by Plan 03 step 12 as the data-join separator (`(fbp || '') + '|' + (fbc || '')`). This is purely a human-readability convention, not a parse risk (the spreadsheet stores the header as plain text). But future ops scripts that try to split column H on `|` to recover fbp/fbc separately may not realize the header is ALSO literally `fbp|fbc`. Document this in Phase 2's frontend payload spec so future maintainers don't read the header as a delimiter spec.
- Severity: WARNING (cosmetic/operational, not functional)
- Fix hint: Acceptable as-is; optionally rename to `fbp_pipe_fbc` or split into two columns I1=`fbp` + J1=`fbc` and update `appendArLead` row width to 9. The current plan keeps the 8-column contract, which is fine — just note the convention in `01-SUMMARY.md`.

**W2 — Inconsistency in Task 6 name vs. case count.**
- Where: Plan 03 Task 6 title says "8 cases" but enumerates Cases 1-9 (one of which, Case 5, is a positive "Arabic-Indic digits" test, not a rejection).
- Concern: An executor reading only the task header may stop at 8. The body lists 9 numbered curls.
- Severity: WARNING (executor-confusion risk)
- Fix hint: Rename the task to "Negative + boundary test pass (9 cases)" OR re-number Case 5 as Case 5a (positive boundary).

**W3 — `event_id` UUID validation falls through to server-side `crypto.randomUUID()` fallback silently.**
- Where: Plan 03 Task 1 step 7: `On mismatch → fallback crypto.randomUUID() (Pitfall #2: server-generated id breaks Pixel dedup, but is acceptable when client omits — log via console.warn with phone_last4 only)`
- Concern: This is the correct behavior for Phase 1 (the endpoint must work when called via raw curl with no `event_id`), but the `console.warn` is the ONLY signal that Pixel↔CAPI dedup is broken for this lead. There's no test that asserts "valid client-side UUID flows through unchanged" beyond Task 5 (sentinel). When Phase 2 wires the form, a forgotten `crypto.randomUUID()` call will silently degrade dedup with only log evidence.
- Severity: WARNING (carries into Phase 2)
- Fix hint: The phase SUMMARY.md already plans to call this out ("event_id MUST be generated by browser via crypto.randomUUID() BEFORE the POST") — that mitigation is sufficient. Optionally add a monitoring follow-up in Phase 4 to grep Vercel logs for `evt_id_invalid` rate.

**W4 — No explicit cleanup step if Plan 01 Task 3's `META_CAPI_ACCESS_TOKEN` is added but later steps fail.**
- Where: Plan 01 has no rollback note for partial completion.
- Concern: If the user adds the CAPI token to Vercel Production but then aborts the phase, the token sits unused. Not a security risk per se (token is scoped to the Pixel), but worth a SESSION.md note for recovery.
- Severity: WARNING (operational hygiene)
- Fix hint: Add a "rollback if aborted" note to Plan 01 instructing the user to `vercel env rm` the three vars if the phase is permanently abandoned. Acceptable to defer.

---

## Risks

### Properly covered by plan:
- **R1 (Pitfall #1 — silent data loss):** Plan 03 step 12 `await appendArLead`; throw → 500; sentinel verifies live row appears. ✅
- **R2 (Pitfall #2 — CAPI dedup wiring):** Plan 03 step 7 accepts `event_id` from body; step 13 forwards unchanged. Phase 2 reminder in SUMMARY.md. ✅
- **R3 (Pitfall #3 — phone formula injection via `+212...`):** Plan 03 step 12 hardcodes `"'" + phoneCanonical`; Plan 02 documents the rule. Pattern is verified-existing in `add-lead.js:139`. ✅
- **R4 (Pitfall #4 — Arabic-Indic digits):** Plan 03 step 11 `asciiDigits()` runs BEFORE `validPhone()`; Plan 03 Task 6 Case 5 verifies live with `٠٦١٢٣٤٥٦٧٨`. ✅
- **R5 (Pitfall #5 — `x-vercel-ip-country` wrong for VPN MA users):** `AR_COUNTRY_GATE_OFF=1` env flag override documented in Plan 03 step 5 and listed in PLAN.md threat model. ✅
- **R6 (Pitfall #6 — CAPI timeout cascading):** Plan 02 Task 3 enforces `AbortController` 4000ms; Plan 03 step 13 wraps in try/catch that LOGS but does NOT throw. ✅
- **R7 (Pitfall #7 — `GOOGLE_SERVICE_ACCOUNT_JSON` mutation):** Plan 01 Task 3 explicitly forbids re-pasting it; automated verify checks the env still exists. Threat T-01-08 in PLAN.md threat register. ✅

### Residual risks (acknowledged in plans, accepted for v1):
- **DoS via Sheets quota burst (T-01-07):** Honeypot+time-trap+country-gate deemed sufficient for v1 traffic (~100/day per SUMMARY's "Carries into Phase 2"). Upstash rate-limit deferred to SCALE-04 v2.
- **Repudiation of sheet rows (T-01-03):** Out of scope for v1; manual review acceptable at current traffic.
- **CAPI failure silently degrading FB attribution (T-01-17):** Server-side fallback `event_id` keeps the lead intact but breaks dedup; mitigated by Phase 2 client-side UUID gen reminder.

### Risk NOT addressed (acceptable):
- **`+212` phone digits in error response bodies via `err.message` echo from `_ar_capi.js`:** Plan 02 Task 3 has `fireCapiLead` throw `'capi_<status>: <body slice 200 chars>'` — the body slice from Meta could theoretically contain echoed hashed `ph` or `event_id`. But: (a) those are already hashes, not PII; (b) Plan 03 step 13's catch uses `{cls, phone_last4}` ONLY (never `err.message`) so the slice never reaches Vercel logs anyway. Defense-in-depth holds.

---

## Recommendations

Plans are ready to execute. Optional refinements before execution:

1. **(W2 — recommend)** Rename Plan 03 Task 6 to "Negative + boundary test pass (9 cases)" to avoid executor confusion.
2. **(W4 — nice-to-have)** Add a one-line "rollback if aborted" note to Plan 01 footer.
3. **(W1, W3 — defer)** Acknowledge in Plan 01's eventual SUMMARY.md, no plan changes required pre-execution.

---

## Constraint Compliance

- **Zero new npm deps:** ✅ Plan 02 Task 1 explicitly forbids `npm install`; Task 3 forbids `@facebook/business-sdk`; success criterion `git diff package.json | grep -E '"(dependencies|devDependencies)"' | wc -l → 0`.
- **Vanilla Node 22:** ✅ Plan 02 Task 1 pins `engines.node = "22.x"`; all helpers use built-in `node:crypto` + global `fetch`.
- **Additive only to existing endpoints:** ✅ Plan 02 Task 2 appends `appendArLead` at end of `_sheets.js`, explicitly forbids touching existing exports / `AFFILIATES_TAB` / `SALES_TAB` / `SHEET_ID` constants. Verification: `git diff api/_sheets.js` shows ONLY end-of-file additions; `import('./api/add-lead.js')` succeeds post-edit (Plan 02 success criteria); Plan 03 Task 7 regression smoke-tests `/api/add-lead`, `/`, `/affiliates`, `/kit`, `/admin`.
- **No edits to `vercel.json`:** ✅ Plan 03 explicitly forbids; file-system routing handles `api/ar-lead.js` → `/api/ar-lead` automatically.
- **No scope creep into Phase 2/3/4:** ✅ Plans address only the 18 P1 REQ-IDs; frontend (`ar.html`), Pixel client snippet, content polish, performance work, sentinel-in-CI all explicitly carried forward to later phases via SUMMARY.md.
- **No silent scope reduction:** ✅ No "v1 stub", "placeholder", "TODO later", or "future enhancement" language found in any task action. Every REQ is delivered in full.

---

## Confidence: HIGH

**Reasoning:**
- All upstream artifacts (PROJECT, REQUIREMENTS, ROADMAP, RESEARCH, SUMMARY) read directly this session and cross-referenced.
- All implementation patterns (`getSheetsClient`, `setCors`, `normalizePhoneMA`, apostrophe-prefix phone storage) verified against the actual existing source code in `api/_sheets.js`, `api/_lib.js`, and `api/add-lead.js`.
- Every task in every plan has a concrete `<action>`, runnable `<verify>` (automated grep/curl/node-import), and observable `<done>`.
- Dependency graph is correct (Plan 02 wave 2 depends on env vars from wave 1 Plan 01; Plan 03 wave 3 imports symbols from wave 2).
- Both `truths` and `key_links` in each plan's must_haves are user-observable (sheet row visible, curl returns specific body, env vars present in Vercel UI) rather than implementation-detail.
- The phase rollup PLAN.md threat register (T-01-01 through T-01-20) is comprehensive and each threat is traced to the mitigating task.

**No degradation of confidence** introduced by skimming — every load-bearing file was read in full (PLAN files, prerequisites checklist, source helpers) or in directly-relevant excerpts (RESEARCH.md §1-§14, REQUIREMENTS.md §traceability).

---

*Pre-execution check complete: 2026-05-26*
