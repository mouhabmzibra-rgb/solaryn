---
phase: 01-backend-foundation-sheet-provisioning
plan: 01
type: execute
wave: 1
depends_on: []
files_modified: []
autonomous: false
requirements:
  - BACK-01
  - BACK-06
  - TRACK-07
effort: S
must_haves:
  truths:
    - "New Google Sheet 'Solaryn AR Leads' exists with tab 'Leads' and header row A1:H1"
    - "Service account from GOOGLE_SERVICE_ACCOUNT_JSON is Editor on the new sheet"
    - "Three env vars (AR_LEADS_SHEET_ID, META_PIXEL_ID, META_CAPI_ACCESS_TOKEN) are set in Vercel across Production + Preview + Development"
    - "META_CAPI_ACCESS_TOKEN is server-only (never prefixed NEXT_PUBLIC_)"
  artifacts:
    - path: "https://docs.google.com/spreadsheets/d/<NEW_SHEET_ID>/edit"
      provides: "Lead persistence destination"
      contains: "Tab 'Leads', header row: Date | Prénom | Nom | Téléphone | Ville | Adresse | Source | fbp|fbc"
    - path: "Vercel project solaryn → Settings → Environment Variables"
      provides: "Runtime config for new endpoint"
      contains: "AR_LEADS_SHEET_ID, META_PIXEL_ID, META_CAPI_ACCESS_TOKEN (all three environments)"
  key_links:
    - from: "api/ar-lead.js (Plan 03)"
      to: "Vercel env vars"
      via: "process.env.AR_LEADS_SHEET_ID / META_PIXEL_ID / META_CAPI_ACCESS_TOKEN"
      pattern: "process\\.env\\.(AR_LEADS_SHEET_ID|META_PIXEL_ID|META_CAPI_ACCESS_TOKEN)"
    - from: "Service account JWT"
      to: "Google Sheets API for Solaryn AR Leads"
      via: "Editor share on the new sheet"
      pattern: "sheets.spreadsheets.values.append returns 200 (not 403)"
user_setup:
  - service: google_sheets
    why: "New dedicated sheet for AR campaign leads; must be created and shared with existing service account"
    env_vars:
      - name: AR_LEADS_SHEET_ID
        source: "URL of the new Google Sheet: /spreadsheets/d/<THIS_ID>/edit"
    dashboard_config:
      - task: "Create new sheet 'Solaryn AR Leads'"
        location: "https://sheets.google.com (logged in as mouhabmzibra@gmail.com)"
      - task: "Rename Sheet1 tab to 'Leads' (case-sensitive)"
        location: "Sheet tabs row at bottom of spreadsheet"
      - task: "Add header row A1:H1: Date | Prénom | Nom | Téléphone | Ville | Adresse | Source | fbp|fbc"
        location: "Row 1 of Leads tab"
      - task: "Share with service-account email (extract from GOOGLE_SERVICE_ACCOUNT_JSON.client_email) as Editor, UNCHECK 'Notify'"
        location: "Share button (top-right of sheet)"
  - service: meta_capi
    why: "Server-side Lead event mirror for FB ad attribution (recovers ~30-40% events lost to iOS 17+ ITP)"
    env_vars:
      - name: META_PIXEL_ID
        source: "Meta Business Manager → Events Manager → Pixel → Settings → Pixel ID"
      - name: META_CAPI_ACCESS_TOKEN
        source: "Meta Business Manager → Events Manager → Pixel → Settings → Conversions API → Generate access token (system user, NEVER personal token)"
    dashboard_config:
      - task: "Create system user in Meta Business Manager (if not present) with 'manage_pages' + Pixel access"
        location: "business.facebook.com → Business Settings → Users → System users"
      - task: "Generate CAPI access token scoped to the Pixel"
        location: "Events Manager → Pixel → Settings → Conversions API → Generate access token"
  - service: vercel
    why: "Runtime config for the new endpoint"
    env_vars:
      - name: AR_LEADS_SHEET_ID
        source: "Step 1 above (new sheet URL)"
      - name: META_PIXEL_ID
        source: "Step 2 above (Meta Events Manager)"
      - name: META_CAPI_ACCESS_TOKEN
        source: "Step 2 above (system user token)"
    dashboard_config:
      - task: "Add AR_LEADS_SHEET_ID to Production, Preview, Development environments"
        location: "vercel.com → solaryn project → Settings → Environment Variables (or `vercel env add ...`)"
      - task: "Add META_PIXEL_ID to Production, Preview, Development environments"
        location: "same as above"
      - task: "Add META_CAPI_ACCESS_TOKEN to Production, Preview, Development environments — DO NOT prefix with NEXT_PUBLIC_ or VITE_"
        location: "same as above"
---

<objective>
Provision all manual infrastructure required before any backend code can succeed: the new dedicated Google Sheet, the Meta CAPI access token, and the three new Vercel env vars.

Purpose: Plan 02 and Plan 03 cannot be validated end-to-end without these in place. Doing this first surfaces account/permission blockers (Meta system user creation, Sheets sharing typos, Vercel env scoping) BEFORE code is written, so executor time isn't wasted debugging missing infrastructure.

Output: Three checked-off prerequisites, recorded in SESSION.md (sheet ID stored as last-6-chars only per Rule 1 / SEC-06 in commits, full ID in local-only files).
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/execute-plan.md
@~/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/research/STACK.md
@.planning/research/ARCHITECTURE.md
@.planning/phases/01-backend-foundation-sheet-provisioning/RESEARCH.md
</context>

<prerequisites>

## Manual Prerequisites Checklist (user must complete)

Each item below is a discrete human action. The executor presents this checklist to the user, waits for explicit confirmation that each is done, then captures the resulting IDs/tokens in `SESSION.md` (locally) before unblocking Plan 02.

### [ ] 1. Create new Google Sheet `Solaryn AR Leads`

**Where:** https://sheets.google.com (logged in as `mouhabmzibra@gmail.com` per MEMORY.md)

**Steps:**
1. Click "Blank spreadsheet"
2. Rename to **`Solaryn AR Leads`** (top-left title cell)
3. Right-click the default tab → "Rename" → enter **`Leads`** (case-sensitive — the code expects exactly `Leads`)
4. In row 1, enter these 8 column headers (A1 through H1):
   - A1: `Date`
   - B1: `Prénom`
   - C1: `Nom`
   - D1: `Téléphone`
   - E1: `Ville`
   - F1: `Adresse`
   - G1: `Source`
   - H1: `fbp|fbc`
5. (Optional) Bold the header row and freeze it: View → Freeze → 1 row

**Capture:** Copy the spreadsheet ID from the URL — it's the long string between `/d/` and `/edit`:
`https://docs.google.com/spreadsheets/d/`**`1AbC...XYZ`**`/edit#gid=0`

### [ ] 2. Share the new sheet with the existing service account

**Why:** The same service account that already writes to the affiliates sheet must be granted Editor on this new sheet, OR the API call returns 403 and the endpoint dies silently.

**Steps:**
1. Locally, extract the service account email:
   ```bash
   echo "$GOOGLE_SERVICE_ACCOUNT_JSON" | base64 -d 2>/dev/null | grep client_email
   # OR if not base64:
   echo "$GOOGLE_SERVICE_ACCOUNT_JSON" | grep client_email
   # Expected output something like: "client_email": "solaryn-sheets@<project>.iam.gserviceaccount.com"
   ```
   If `GOOGLE_SERVICE_ACCOUNT_JSON` is not in your local shell, pull it from Vercel:
   ```bash
   vercel env pull .env.local --environment=production
   # Then run the grep above against .env.local
   ```
2. In the new sheet, click **Share** (top-right)
3. Paste the service account email
4. Set role to **Editor**
5. **UNCHECK** "Notify people" (service accounts don't have inboxes — checking this throws a notification error)
6. Click **Share**

### [ ] 3. Create / locate the Meta Pixel ID

**Where:** https://business.facebook.com → Events Manager → Data Sources → Pixel

**If a pixel already exists for solaryn:** Copy its 15-16 digit Pixel ID.

**If no pixel exists yet:**
1. Events Manager → "+ Connect Data" → Web → "Meta Pixel"
2. Name: `Solaryn AR Pixel`
3. Domain: `solaryn-five.vercel.app` (or the campaign domain)
4. Skip the "Add code to site" step (Phase 2 wires it manually)
5. Copy the Pixel ID

### [ ] 4. Generate Meta CAPI access token (system user, NOT personal)

**Why personal tokens are forbidden:** Personal tokens expire when the user logs out / changes password / leaves the business; system-user tokens are long-lived and not tied to a human account.

**Where:** Events Manager → Pixel → Settings tab → Conversions API → "Generate access token"

**Steps:**
1. In Business Settings → Users → System users, create a system user if one doesn't exist (name e.g. `solaryn-capi-bot`)
2. Assign the new pixel to the system user with "Manage Pixel" permission
3. Back in Events Manager → Pixel → Settings → Conversions API → "Generate access token"
4. Select the system user when prompted
5. Copy the generated token (long alphanumeric string starting with `EAA...`)
6. **CRITICAL:** This is shown ONCE. If you close the dialog without copying, regenerate.

### [ ] 5. Add the three env vars to Vercel

**Where:** https://vercel.com/<your-team>/solaryn/settings/environment-variables — OR Vercel CLI:

```bash
# AR_LEADS_SHEET_ID — for all three environments
vercel env add AR_LEADS_SHEET_ID production
# Paste sheet ID from Step 1, press Enter
vercel env add AR_LEADS_SHEET_ID preview
vercel env add AR_LEADS_SHEET_ID development

# META_PIXEL_ID — for all three environments
vercel env add META_PIXEL_ID production
vercel env add META_PIXEL_ID preview
vercel env add META_PIXEL_ID development

# META_CAPI_ACCESS_TOKEN — for all three environments (mark "Sensitive" in UI)
vercel env add META_CAPI_ACCESS_TOKEN production
vercel env add META_CAPI_ACCESS_TOKEN preview
vercel env add META_CAPI_ACCESS_TOKEN development
```

**CRITICAL — do NOT touch `GOOGLE_SERVICE_ACCOUNT_JSON`** (Pitfall #7). It's already set. Re-pasting it can corrupt the base64 encoding or newlines in the private key and break BOTH `/api/add-lead` AND the new `/api/ar-lead`.

**Verify:**
```bash
vercel env ls | grep -E "AR_LEADS_SHEET_ID|META_PIXEL_ID|META_CAPI_ACCESS_TOKEN"
# Expect 9 lines: each var × 3 environments
```

### [ ] 6. (Optional QA aid) Add `META_TEST_EVENT_CODE` to Preview only

Skip in Production. In Preview environment only, add `META_TEST_EVENT_CODE = TEST<your-code>` from Events Manager → Test Events tab. This routes Plan 03's sentinel CAPI events to the Test Events panel instead of polluting live optimization data.

</prerequisites>

<tasks>

<task type="checkpoint:human-action" gate="blocking">
  <name>Task 1: Confirm new Google Sheet exists, header row set, service account is Editor</name>
  <files>(external: new Google Sheet "Solaryn AR Leads")</files>
  <action>
    Present steps 1 and 2 of the prerequisites checklist above to the user, then wait for confirmation. Claude cannot create Google Sheets, share files, or browse the user's Google Drive UI — these are unavoidable manual steps. After the user replies, capture the spreadsheet ID locally (in SESSION.md, last-6-chars only in any committed file per SEC-06).
  </action>
  <what-needed>The user must complete steps 1 and 2 in the prerequisites checklist above. Claude cannot create Google Sheets, share files, or browse the user's Google Drive UI.</what-needed>
  <how-to-verify>
    User confirms:
    1. New sheet `Solaryn AR Leads` exists at a URL of the form `https://docs.google.com/spreadsheets/d/<ID>/edit`
    2. First tab is named exactly `Leads` (case-sensitive — code expects `Leads`)
    3. Header row A1:H1 contains: `Date | Prénom | Nom | Téléphone | Ville | Adresse | Source | fbp|fbc`
    4. Service account email (extracted from `GOOGLE_SERVICE_ACCOUNT_JSON.client_email`) appears in the Share dialog with `Editor` role
    5. User pastes the new sheet ID into the response
  </how-to-verify>
  <verify>
    <automated>echo "Human-action checkpoint — verified via user reply containing 'sheet ready: &lt;id&gt;'"</automated>
  </verify>
  <done>User has typed "sheet ready: &lt;sheet_id&gt;" and the sheet ID has been stored locally (last-6-chars only in committed files)</done>
  <resume-signal>Type "sheet ready: &lt;sheet_id&gt;" with the actual spreadsheet ID, OR describe blocker</resume-signal>
</task>

<task type="checkpoint:human-action" gate="blocking">
  <name>Task 2: Confirm Meta Pixel + CAPI system-user token exist</name>
  <files>(external: Meta Business Manager → Events Manager)</files>
  <action>
    Present steps 3 and 4 of the prerequisites checklist above to the user, then wait for confirmation. Claude cannot create Meta system users or generate CAPI tokens (these require Meta Business Manager UI interaction). The token must NOT be pasted into chat — only the last 4 chars optionally, for cross-reference.
  </action>
  <what-needed>The user must complete steps 3 and 4 in the prerequisites checklist above. Claude cannot create Meta system users or generate CAPI tokens (these require Meta Business Manager UI interaction).</what-needed>
  <how-to-verify>
    User confirms:
    1. Meta Pixel ID is in hand (15-16 digit number)
    2. CAPI access token was generated against a SYSTEM USER (not a personal account)
    3. Token starts with `EAA...` (Meta system-user tokens have this prefix)
    4. User confirms the token has been copied somewhere safe (Vercel env or password manager) — Meta shows it ONCE
  </how-to-verify>
  <verify>
    <automated>echo "Human-action checkpoint — verified via user reply 'meta ready'"</automated>
  </verify>
  <done>User has typed "meta ready" confirming Pixel ID + system-user CAPI token in hand</done>
  <resume-signal>Type "meta ready" (do NOT paste the token in chat — keep it secret). Optionally share the last 4 chars of the token for cross-reference, or describe blocker.</resume-signal>
</task>

<task type="checkpoint:human-action" gate="blocking">
  <name>Task 3: Confirm three env vars added to Vercel (all three environments)</name>
  <files>(external: Vercel project solaryn → Settings → Environment Variables)</files>
  <action>
    Present step 5 of the prerequisites checklist above to the user. If the executor has Vercel CLI authenticated, run `vercel env add` commands and prompt user to paste values (Claude must NOT see token values). Then run `vercel env ls` to verify all 9 entries (3 vars × 3 environments). Fail the task if any var is prefixed `NEXT_PUBLIC_` or `VITE_` (token would be client-exposed → SEC-06 violation).
  </action>
  <what-needed>The user must complete step 5 in the prerequisites checklist above. Vercel env vars require either authenticated dashboard access or `vercel` CLI `login`. If the executor has the CLI authenticated, it MAY automate the add commands — but the user must paste/confirm the secret values.</what-needed>
  <how-to-verify>
    Run (executor):
    ```bash
    vercel env ls 2>&1 | grep -E "AR_LEADS_SHEET_ID|META_PIXEL_ID|META_CAPI_ACCESS_TOKEN" | wc -l
    ```
    Expected: `9` (each of 3 vars × 3 environments = 9 lines). If lower, surface which env/var is missing.

    Also verify NONE of them is prefixed `NEXT_PUBLIC_` or `VITE_`:
    ```bash
    vercel env ls 2>&1 | grep -E "NEXT_PUBLIC_META_CAPI|VITE_META_CAPI"
    ```
    Expected: zero lines (empty output). If any match, FAIL the task — token is client-exposed which violates TRACK-07 + Threat T-01-06.

    Confirm `GOOGLE_SERVICE_ACCOUNT_JSON` is untouched (Pitfall #7):
    ```bash
    vercel env ls 2>&1 | grep GOOGLE_SERVICE_ACCOUNT_JSON
    ```
    Expected: one or more lines (env still present); user confirms they did NOT re-paste it during this session.
  </how-to-verify>
  <verify>
    <automated>vercel env ls 2>&1 | grep -E "AR_LEADS_SHEET_ID|META_PIXEL_ID|META_CAPI_ACCESS_TOKEN" | wc -l | awk '{if($1>=9){print "OK: "$1" env entries"} else {print "FAIL: only "$1" entries (expected 9)"; exit 1}}'</automated>
  </verify>
  <done>Nine env entries present (3 vars × 3 environments); no NEXT_PUBLIC_/VITE_ prefix; GOOGLE_SERVICE_ACCOUNT_JSON untouched</done>
  <resume-signal>Type "env ready" after the `vercel env ls` checks pass, or describe blocker</resume-signal>
</task>

<task type="auto">
  <name>Task 4: Record prerequisites completion in SESSION.md</name>
  <files>SESSION.md</files>
  <action>
    Append a "Phase 1 — Prerequisites complete" entry to `SESSION.md` per CLAUDE.md Rule 4. Include:
    - Timestamp (ISO)
    - Sheet ID last 6 chars only (e.g. `Sheet ID: ...XYZ123` — never full ID in committed files per SEC-06)
    - Confirmation that META_PIXEL_ID + META_CAPI_ACCESS_TOKEN are set in Vercel across 3 environments (do NOT paste values)
    - Confirmation that GOOGLE_SERVICE_ACCOUNT_JSON was NOT modified
    - Next step: "Plan 02 unblocked — proceed to helpers."

    Do NOT commit the full sheet ID anywhere. The full ID lives ONLY in Vercel env + the user's local `.env.local` (gitignored).
  </action>
  <verify>
    <automated>grep -c "Phase 1 — Prerequisites complete" SESSION.md</automated>
  </verify>
  <done>SESSION.md updated with completion entry, no PII/secrets exposed</done>
</task>

</tasks>

<verification>
1. Sheet `Solaryn AR Leads` is reachable by the executor user account.
2. `vercel env ls` shows all three vars × three environments (9 lines).
3. No `NEXT_PUBLIC_*` or `VITE_*` prefix on `META_CAPI_ACCESS_TOKEN`.
4. `GOOGLE_SERVICE_ACCOUNT_JSON` env var unchanged (no entry in `vercel env ls` whose `Updated` timestamp is from this session).
5. `SESSION.md` has the completion entry.
</verification>

<success_criteria>
- All four task gates pass without blocker
- User has captured sheet ID locally (not committed)
- Vercel env vars verifiably present across Production, Preview, Development
- Plan 02 can proceed (it relies on `process.env.AR_LEADS_SHEET_ID` resolving at runtime)
</success_criteria>

<output>
Create `.planning/phases/01-backend-foundation-sheet-provisioning/01-01-SUMMARY.md` documenting:
- Date/time completed
- Last-6-chars of sheet ID (for cross-reference in future debugging — full ID stays out of git)
- Confirmation timestamps for each of the three checkpoint gates
- No follow-ups expected (this is purely setup)
</output>
