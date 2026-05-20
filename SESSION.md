# Session — 2026-05-20

## Active goal
Auto-add new affiliates to the Solaryn WhatsApp group on registration.

## Status
**Awaiting user** — needs Vercel env vars added before the new code does anything in production.

## Done this session
- Migrated `/api/admin` from Apps Script webhook to direct Google Sheets API (commit `07e6d9c`).
- Added tracking screenshots feature for sales (Vercel Blob upload, displayed to affiliate). Reused `/api/admin` action `upload_tracking` (base64 in JSON) to stay under 12-function Hobby limit. Commit `729bd1f`.
- Added `online_now` counter in admin (Last_Active col I on Affiliates sheet, 15-min window) + green pulsing dot. Commit `5d323e2`.
- Made customer name in admin sales table clickable → full sale details modal showing customer address + notes + affiliate info. Commit `1e971da`.
- Fixed GA4: site was sending events to `G-TQSQQBT50G` (foreign property). Replaced everywhere with `G-C2C8ZJP45L` (own property "solaryn pop" in account `395029314`). Commit `84335cb`.
- Created `/kit` onboarding page in Darija (Arabic script): welcome, 5 ready-to-copy WhatsApp message templates, 9-question FAQ, 3-hour activation plan. Commit `17adc1d`.
- Removed unverified product claims from kit (pregnancy/baby safety, specific ingredients, "no chemicals"). Commit `9cbcdf8`.
- Added real product photos + Status visuals + video player + 5-slide Instagram carousel (download buttons + GA events). Commit `db2dde4`.
- Swapped video to one without price overlay (149 DH was outdated). Commit `92bc0ee`.
- Wiped all 4 test sales from `Affiliate_Sales` sheet (Composio API). 19 real affiliates registered.
- Connected Google Analytics via Composio; identified `G-C2C8ZJP45L` as the correct measurement ID.
- Created Solaryn WhatsApp group via Baileys bot on Fly. Chat ID `120363426897628087@g.us`, invite link `https://chat.whatsapp.com/BabdgzeNwwL8K7ApZhCzZQ`. Only 13/20 actually joined (others have privacy restrictions).
- Added `/send-message` + `/check-phone` endpoints to bot (`solaryn-bot/server.js`, deployed on Fly).
- Sent 19 DMs via bot — Baileys returned success with `messageId` but messages **don't appear in user's WhatsApp** and likely weren't delivered.
- Bot session corruption appears resolved after machine cold-start: `state=connected` confirmed via `/health` 2026-05-20.
- Added `POST /add-to-group` to `solaryn-bot/server.js` (Baileys `groupParticipantsUpdate`, parses status 200/403/408/409). Deployed to Fly.
- Set Fly secrets: `WHATSAPP_GROUP_JID=120363426897628087@g.us`, `WHATSAPP_GROUP_INVITE=https://chat.whatsapp.com/BabdgzeNwwL8K7ApZhCzZQ`.
- Smoke-tested `/add-to-group` with fake number → returns `{ok:false, status:"not_on_whatsapp"}` as expected.
- `api/affiliate-register.js` now calls bot `/add-to-group` after successful registration (non-blocking, 4s timeout, errors swallowed). Commit `3e80cc4` pushed.

## In progress
- Awaiting user to set `WHATSAPP_BOT_URL` + `WHATSAPP_BOT_TOKEN` env vars on Vercel before code becomes active.
- End-to-end test pending: register a fresh affiliate and verify they appear in the group (or that bot logs privacy block).

## Blockers / pending decisions
- User must add 2 env vars on Vercel dashboard (Project → Settings → Environment Variables → Production):
  - `WHATSAPP_BOT_URL=https://solaryn-bot.fly.dev`
  - `WHATSAPP_BOT_TOKEN=<value from `flyctl ssh console -a solaryn-bot -C 'printenv BOT_TOKEN'`>`

## Next step
1. User adds the 2 Vercel env vars (Production scope).
2. Vercel auto-deploys (already pushed commit `3e80cc4` to main).
3. Register a test affiliate via `https://solaryn-five.vercel.app/affiliates`.
4. Verify in WhatsApp group OR check bot logs (`flyctl logs -a solaryn-bot`) for `add-to-group result` entry.
5. If privacy block is common (likely), add fallback later: DM invite link to the affiliate.

## Context the next session needs
- **Repo:** `/Users/a2024/solaryn`, GitHub `mouhabmzibra-rgb/solaryn`, main branch.
- **Vercel:** project `solaryn`, prod URL `https://solaryn-five.vercel.app`. 12/12 Hobby function quota used.
- **Bot:** `solaryn-bot.fly.dev` (Fly.io), Baileys WhatsApp client, env `BOT_TOKEN` (read via `flyctl ssh console -a solaryn-bot -C 'printenv BOT_TOKEN'`). Paired to user's `+212668111173`.
- **Sheet:** `1uyItM4b7XLPbo2xgTbOrS99MWEz6Ls16MKtVBb1F6hA`. Tabs: `Affiliates` (cols A-I, I=`Last_Active`), `Affiliate_Sales` (cols A-O, O=`Tracking_URLs` as JSON array). Both #ERROR! columns G/H/M/N are broken HYPERLINK formulas, ignored by backend.
- **Vercel env:** `GOOGLE_SERVICE_ACCOUNT_JSON` (service account, base64 or raw JSON), `ADMIN_PASSWORD`, `AFFILIATE_HMAC_SECRET`, `BLOB_READ_WRITE_TOKEN`, `SHEETS_WEBHOOK_URL`.
- **Pricing/commission:** product 199 MAD, commission 50 MAD per unit (was 35 originally).
- **GA4 measurement ID:** `G-C2C8ZJP45L` (property "solaryn pop", account `395029314`).
- **Composio connections active:** `googlesheets` (mouhabmzibra@gmail.com), `google_analytics` (same), `googleads`, `metaads`, `shopify`.
- **WhatsApp group:** `Solaryn — Equipe 🇲🇦`, invite `https://chat.whatsapp.com/BabdgzeNwwL8K7ApZhCzZQ`.

## Open follow-ups (not blocking)
- ⚠️ **Rotate the leaked service account key** `670f854a...` (user pasted full private_key in chat earlier this session). Memory: `feedback_solaryn_product_claims.md`. Action: GCP Console → IAM → Service Accounts → `solaryn-admin-sheets` → KEYS → delete that key → create new → update `GOOGLE_SERVICE_ACCOUNT_JSON` on Vercel.
- 🐛 `api/affiliate-sale.js` rejects `quantite` as a JS number (validation accepts only strings). Frontend likely sends a number → silent failure mode. Add `Number(quantite)` parsing on backend.
- 🐛 Customer `customer_tel` loses leading `0` because Google Sheets treats it as number. Prefix with `'` in Apps Script writer, or store as text formatted column.
- 🤖 (Optional next step) On `/api/affiliate-register` success, *also* DM the new affiliate with welcome + kit link (currently only the silent group-add is wired). Use bot `/send-message`.
- 🎨 No customer testimonials in `/kit` yet — placeholder "à venir" section. Add when first happy customers send reviews.
- 📦 Plugins to install (user's choice): `marketing-skills`, `business-growth-skills`, `landing`, `product-skills`, `executive-mentor` from `alirezarezvani/claude-skills`. Commands prepared but not yet run.
