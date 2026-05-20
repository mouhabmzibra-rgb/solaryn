# Session — 2026-05-20

## Active goal
Solaryn affiliate platform — currently blocked on WhatsApp bot session corruption preventing DM delivery to affiliates.

## Status
**Blocked** — awaiting user confirmation to wipe `solaryn-bot` auth state on Fly and re-pair via QR scan.

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

## In progress
- Diagnosing bot DM delivery. Logs show Signal session corruption: `PreKeyError: Invalid PreKey ID`, `No session found to decrypt message`, `unexpected error in 'init queries' — Timed Out`. Conclusion: bot's encryption sessions are stale → it generates fake messageIds without actually shipping messages.

## Blockers / pending decisions
- Need user OK to wipe `/data/auth` on `solaryn-bot` Fly app, restart machine, present new QR for user to scan with their WhatsApp.

## Next step
1. Wipe Fly bot auth dir.
2. Restart machine; verify bot enters `qr` state.
3. Get new QR URL: `https://solaryn-bot.fly.dev/qr?token=<BOT_TOKEN>` — user scans with their WhatsApp (Settings → Linked Devices).
4. Once `state=connected`, re-run `/tmp/send_invites.py` to DM the 19 affiliates with group invite + kit link.
5. Verify user sees DMs in their WhatsApp before declaring success.

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
- 🤖 Once bot is re-paired, automate: on `/api/affiliate-register` success, fire-and-forget POST to bot `/send-message` with welcome + group invite + kit link.
- 🎨 No customer testimonials in `/kit` yet — placeholder "à venir" section. Add when first happy customers send reviews.
- 📦 Plugins to install (user's choice): `marketing-skills`, `business-growth-skills`, `landing`, `product-skills`, `executive-mentor` from `alirezarezvani/claude-skills`. Commands prepared but not yet run.
