# Domain Pitfalls

**Domain:** Arabic RTL mobile landing page with COD lead form (Morocco)
**Researched:** 2026-05-26
**Project:** Solaryn AR Landing Page (FB/IG ads → 5-field form → Google Sheet)

These pitfalls are scoped to the specific build: vanilla HTML/CSS/JS on Vercel, Google Sheets backend, Arabic darija audience on mobile + 3G, FB-driven traffic, COD model. They are ordered by ad-budget impact (a critical pitfall = wasted ad spend or untrackable conversions).

---

## Critical Pitfalls

These cause silent campaign failure: budget burns, leads are lost or wrong, or trust collapses on first scroll.

### Pitfall 1: Form submits succeed in browser but never reach the Sheet (silent data loss)

**What goes wrong:** The fetch returns 200 (or no error surfaced), the user sees the "merci" page, but the row never appears in the Sheet. Common causes on this stack:
- Google service-account credentials missing/wrong in Vercel env (`GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`) — the function logs the error server-side but the client gets a generic success because we redirect optimistically.
- New dedicated Sheet ID not yet shared with the service account email → 403 from Sheets API.
- `\n` characters in the private key env var weren't unescaped (`key.replace(/\\n/g, '\n')`) — JWT sign fails.
- Sheets API quota burst (60 writes/min/user) during an ad spike → 429s dropped on the floor.

**Why it happens:** The existing `api/_sheets.js` pattern works for the affiliate dashboard, but a *new* Sheet ID requires explicit re-sharing with the service account, and nothing in the app warns about that. Optimistic redirects (showing "merci" before confirming write) are a frequent shortcut on lead-gen pages.

**Consequences:** Ad money spent, leads invisible, no callbacks, no orders. Worse: you only notice 2-3 days in when sales stay flat.

**Prevention:**
- Server-side: `await` the Sheet append, return 500 to client if it fails, log the full error (status + Sheets API message) to Vercel logs.
- Client-side: only navigate to `/merci` on `res.ok && body.success === true`. On failure show an inline error in Arabic (e.g. "وقع مشكل، عاود حاول") and surface a fallback (e.g. WhatsApp deep-link `wa.me/212...`).
- Pre-launch checklist: send 1 test submission, **then open the live Sheet and visually confirm the row**. Do this with the production env vars, not local.
- Add a `__healthcheck` query param to the submit endpoint that does a no-op `values.get` against the target Sheet ID; ping it from a Vercel cron daily.
- Mirror every submission to a second sink (Vercel KV / Upstash, a backup Sheet, or a webhook) so a Sheets outage does not lose leads.

**Detection (warning signs):**
- Vercel function logs show 4xx/5xx from `sheets.googleapis.com`.
- FB Pixel reports `Lead` events at a higher rate than rows in the Sheet.
- A test submission with a sentinel value (`prénom = "TEST_<timestamp>"`) does not appear within 10 seconds.

**Phase:** Backend (Sheets integration) + Pre-launch QA.

---

### Pitfall 2: Facebook Pixel fires but is undercounting conversions (iOS 14+ ATT)

**What goes wrong:** The browser-side `fbq('track', 'Lead')` works in Pixel Helper, but a large slice of Moroccan iPhone users (~25-35% of MA mobile traffic) opted out of ATT, so Meta drops those events. Campaign optimization model has insufficient signal, ad delivery degrades, CPL climbs.

**Why it happens:** Default Pixel-only setup with no Conversions API (CAPI) mirror. Also common: firing `Lead` on form *submit click* (before the server confirms) instead of after a confirmed write, inflating Pixel counts vs. real leads.

**Consequences:** FB algorithm misoptimizes (wrong audience), CPL increases 30-50%, reported leads in Ads Manager diverge from rows in the Sheet, ROAS reporting becomes useless.

**Prevention:**
- Install Pixel base code in `<head>` on every page (`/ar`, `/merci`). One pixel ID, not multiple installs (duplicates inflate `PageView`).
- Fire `Lead` event **from the server** via Conversions API after the Sheet write succeeds, using the same `event_id` as the browser-side event for deduplication.
- Hash phone (E.164: `+212...`) + first name + last name + city with SHA-256 server-side and pass as `user_data` to CAPI — improves match quality on opted-out users.
- Test with Meta Events Manager → "Test Events" tab using a `test_event_code` before going live.
- Never fire `Lead` on a redirect target page (e.g. `/merci`) without a guard — if the user reloads `/merci` directly, you get a phantom Lead.

**Detection:**
- Events Manager "Diagnostics" tab flags missing CAPI events.
- Meta "Aggregated Event Measurement" shows event-quality < "Good".
- Browser-Pixel `Lead` count > Sheet rows × 1.2 → likely missing dedup or double-firing.

**Phase:** Tracking & analytics (post-form-backend, before paid traffic).

---

### Pitfall 3: Trust signals copy-pasted from US/EU templates → Moroccans bounce

**What goes wrong:** Generic "SSL Secured", Stripe badges, "Verified by Visa", or AI-generated testimonials with names like "Sarah, New York" — none of these mean anything to a Moroccan 30-year-old considering a 150 MAD COD purchase. She has been scammed before by FB ads; she needs *local* proof.

**Why it happens:** Designer reaches for familiar trust patterns. Templates ship with English testimonials. Stock photos of non-Moroccan women.

**Consequences:** 27%+ lower conversion vs. pages with localised trust signals (CleverMKT MA case study). Form gets visits but no submits.

**Prevention:** Include, above the fold or just below the form:
- **"الدفع عند الاستلام"** (Cash on Delivery) prominently — 67% of MA online shoppers prefer COD; hiding it kills the offer.
- **Local courier logo** (Sendit, Speedaf, Amana, or whoever delivers) with "توصيل لجميع المدن المغربية".
- **Real Moroccan first names + cities** in testimonials (Fatima – Casablanca, Khadija – Marrakech) with realistic photos (avoid obvious AI/stock — Moroccan women's WhatsApp meme aesthetic, not glossy Western product shots).
- **Moroccan phone number** (+212 6XX XXX XXX, ideally a WhatsApp-business number) visible as fallback. Even users who fill the form trust the page more when a callable number exists.
- **Price clarity in MAD**: "150 درهم — التوصيل مجاني" (or "ثمن التوصيل داخل"). Never show prices in € or $.
- **Guarantee in darija**: "إيلا ما عجبكش، ترجعو" or similar money-back-on-delivery promise.

**Detection:**
- A/B test or 5-second test with 3-5 Moroccan friends: ask "ash kayban lik f had l-page?" (what do you see?) — if first reaction is suspicion or "shi haja meskina" (something sketchy), trust signals are wrong.
- High bounce rate on the form section specifically (track scroll depth + form-focus events).

**Phase:** Content & UX (during page build, before paid traffic).

---

### Pitfall 4: Phone field accepts garbage data, breaking COD callback workflow

**What goes wrong:** User types "+212 6.12-34 56 78" or "0612345678" or "212612345678" or pastes a French number, or types the number in Arabic-Indic digits (٠٦١٢٣٤٥٦٧٨). The Sheet ends up with a mix of formats; the call-center can't autodial; some entries are unreachable.

**Why it happens:** Free-text input with no normalisation. RTL phone fields often render numbers reversed visually (see Pitfall 8). Mobile keyboards on Android show alpha when input type is wrong.

**Consequences:** 10-20% of leads are unreachable or require manual cleanup. Wasted ad spend on leads you can't call.

**Prevention:**
- HTML: `<input type="tel" inputmode="numeric" autocomplete="tel-national" pattern="0?[567][0-9]{8}" required dir="ltr" maxlength="13">`.
  - `inputmode="numeric"` forces numeric keypad on Android (`type="tel"` alone doesn't always).
  - `dir="ltr"` on the input prevents bidi reversal of the number on RTL pages.
  - `pattern` accepts MA mobile prefixes (05, 06, 07) with optional leading 0.
- Server-side normalisation: strip everything non-digit, convert Arabic-Indic digits (`٠-٩`) to Latin (`0-9`), prepend `212` if number starts with `0`, reject if final form is not `212[567]XXXXXXXX` (12 digits).
- Reject obvious test/junk: all same digit (`0600000000`), sequential (`0612345678` is a common test — flag but don't auto-reject), too short.
- Show a placeholder in the field: `06 12 34 56 78` so users know what's expected. Use spaces visually but don't enforce them.
- Add a one-line helper in Arabic under the field: "ندخل الرقم باش نعيطو ليك نأكدو الطلب".

**Detection:** Validate sample of 20 leads from the first day — count how many are valid MA mobile numbers in E.164. < 90% means input rules need tightening.

**Phase:** Form build (HTML + server validation).

---

### Pitfall 5: LCP > 4s on 3G → page abandoned before form renders

**What goes wrong:** Hero image is 1.5MB JPG, Arabic font is 400KB woff2, FB Pixel script blocks render, and the user on a Maroc Telecom 3G connection (median ~1-3 Mbps in semi-urban areas) sees a white screen for 5-8 seconds. They bounce. Ad money wasted.

**Why it happens:** Desktop dev/preview shows the page in 800ms; nobody tested on throttled mobile. Google Fonts pulls Noto Sans Arabic synchronously. Hero image is uncompressed.

**Consequences:** Good mobile LCP ≤ 2.5s, poor > 4s. Every 1s of LCP delay = ~7% conversion drop. On 3G with bad LCP, the form is gone before it loads.

**Prevention:**
- **Hero image**: serve WebP or AVIF (50-70% smaller than JPG at same quality). Use `<img loading="eager" fetchpriority="high" width="..." height="..." sizes="100vw" srcset="hero-480.webp 480w, hero-768.webp 768w, hero-1080.webp 1080w">`. Target the hero ≤ 80KB for the 480w variant.
- **Arabic font**: self-host Noto Sans Arabic (one weight, e.g. 500) subsetted to Arabic + Latin digits + punctuation. Use `font-display: swap` so text renders in fallback (system Arabic font) immediately. Preload: `<link rel="preload" href="/fonts/noto-arabic-500.woff2" as="font" type="font/woff2" crossorigin>`. Stop at one or two weights — every weight is a separate file.
- **Above-the-fold CSS inline**, rest loaded async (`media="print" onload="this.media='all'"`).
- **FB Pixel base code**: load with `async` after main content. Pixel script does not need to block render to capture `PageView` reliably.
- **No JS framework, no jQuery** — vanilla only (matches existing repo convention).
- **Test on throttled connections**: Chrome DevTools → Network → "Slow 4G" or "3G", CPU 4× slowdown. Lighthouse mobile score target ≥ 85 perf.
- **Test on a real Maroc Telecom SIM** if accessible (or use WebPageTest with a Morocco location proxy).

**Detection:**
- Lighthouse mobile LCP > 2.5s on staging URL.
- GA "Page Load Time" (or Real User Monitoring) shows p75 > 4s on mobile.
- High bounce rate on `/ar` (>70%) compared to engagement on the form section.

**Phase:** Page build + Performance pass before paid traffic.

---

### Pitfall 6: Open form endpoint → bot spam fills the Sheet, breaks Sheets quota, costs nothing to attackers

**What goes wrong:** Within hours of going live (often within an hour of the first FB ad impression), automated scanners hit `/api/submit` with garbage. Hundreds of rows of "John Doe 555-1234 New York" appear in the Sheet. Worse: the call center starts dialling fake numbers, or a coordinated submission flood blows past the 60 writes/min Sheets quota — *real* leads from real ads get 429 errors and are lost.

**Why it happens:** Public endpoint, no auth, no rate limit, no bot detection. Vercel doesn't ship form spam protection out of the box.

**Consequences:** Sheet pollution, wasted call-center time, lost real leads during the spike, possible service-account quota lock.

**Prevention (layered — use all of them, each is cheap):**
1. **Honeypot field**: add a `<input type="text" name="website" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px;opacity:0">` (hidden visually + from a11y). If `website` is non-empty on the server, return 200 OK silently and drop the submission. Don't let bots learn they were caught.
2. **Time-to-submit check**: render a `data-rendered-at` timestamp on the page, send it back with the form, reject if elapsed < 2s (bots are fast).
3. **Country gate**: read `request.headers['x-vercel-ip-country']` — if not `MA`, either reject or flag the row. The audience is 100% Moroccan via FB ad targeting; non-MA traffic on this page is almost certainly bots, scrapers, or competitors.
4. **IP rate limit**: Upstash Redis (free tier, Vercel-native integration) + `@upstash/ratelimit`, sliding window — e.g. 5 submissions per IP per hour. The Sheet writes are limited too; this protects upstream.
5. **Reject submissions with suspicious patterns**: name fields containing URLs, Cyrillic / Chinese text, > 100 chars; addresses with no Arabic / Latin letters.
6. **Server validates *all* fields again** — never trust client validation alone.

**Detection:**
- Sheet rows appearing at >1/minute when ads are paused.
- Sudden spike in rejected submissions (track in Vercel logs).
- Vercel function invocation count >> Pixel `Lead` count.

**Phase:** Backend + pre-launch hardening.

---

## Moderate Pitfalls

These hurt conversion but don't kill the campaign.

### Pitfall 7: Using only CSS `direction: rtl` without HTML `dir="rtl"`

**What goes wrong:** Layout flips visually but accessibility tools, form controls, and bidi text processing treat the doc as LTR. Screen readers mispronounce. Mixed Arabic + French/numbers render in wrong order in some text nodes.

**Prevention:** Always set `<html lang="ar" dir="rtl">` at the document root. Use HTML `dir` for base direction, CSS for styling only. Use CSS *logical properties* throughout (`margin-inline-start`, `padding-inline-end`, `border-inline-start`, `text-align: start`) — these auto-flip with direction, eliminating the need to maintain two CSS files. Never write `margin-left` / `padding-right` in a page that may be reused in RTL.

**Phase:** Page scaffolding (do this on day one — retrofitting logical properties later is painful).

---

### Pitfall 8: Phone field and prices render reversed visually under RTL

**What goes wrong:** Page is RTL but the phone input shows `8765 4321 60 212+` (reversed), and "150 MAD" displays as "MAD 150" in unexpected places. Numbers in Arabic *are* read LTR, but the surrounding RTL context can break their order when mixed with text.

**Prevention:**
- On the phone `<input>`: `dir="ltr"` and `text-align: start` (input visually left-aligned in its bidi context, but the digits flow correctly).
- For inline numbers in Arabic prose, wrap with `<bdi>`: `<bdi>150</bdi> درهم` — `<bdi>` isolates the number from the surrounding bidi context.
- Use Latin digits (`0-9`) not Arabic-Indic (`٠-٩`) for prices and phone numbers — Moroccans use Latin digits in everyday writing and they sort/copy/paste better.
- Test rendering in Chrome + Safari iOS + Android Chrome (the three browsers ~99% of MA traffic uses).

**Phase:** Form build + content polish.

---

### Pitfall 9: Darija script choice mismatched to audience expectations on FB

**What goes wrong:** Writing the entire page in formal Modern Standard Arabic (Fus'ha) when FB ads use darija — the scent-match breaks. Or going pure Arabizi (Latin Darija like "Solaryn 7it kayhmik mn chems") on a landing page when the audience expects polished Arabic script for a *product* page (Arabizi reads casual/chat-like).

**Why it happens:** Whoever writes the page copies the *ad caption tone* into the *landing page* without adjusting register.

**Consequences:** Either too formal (feels like a pharmacy leaflet, no emotional pull) or too casual (feels like a scam DM). Conversion drops.

**Prevention:**
- **Hero headline + benefits**: Arabic script, darija register, short sentences. Example: "كريم الشمس ديال Solaryn — SPF 50 يحمي من حروق الشمس و البقع".
- **CTAs and microcopy**: action-oriented darija ("سيفطو ليا دابا" / "خدميه دابا").
- **Form labels**: simple Arabic ("الإسم", "النوم", "رقم الواتساب", "المدينة", "العنوان").
- **Testimonials**: keep darija conversational, Arabic script.
- **Never use Arabizi on the landing itself** — keep that for FB ad creative if needed. Landing page is a "trust" surface, not a chat.
- Get a native Moroccan female (target demographic) to read the page out loud — anything that sounds wrong, fix it.

**Phase:** Content writing pass.

---

### Pitfall 10: Vercel function cold-start adds 2-3s before the user sees "merci"

**What goes wrong:** First submission after a quiet period: cold start of `/api/submit`, plus Google JWT signing, plus Sheets append = 2-3s of spinning. User taps "submit" twice (creating duplicate row) or backs out.

**Why it happens:** Node serverless function loads the `googleapis` SDK (heavy), signs a JWT, makes the API call — all on cold invoke. The `googleapis` package alone is ~5MB and slow to import.

**Prevention:**
- **Lighter SDK**: use the `google-auth-library` directly with `JWT` + `fetch` to Sheets REST endpoint, or use `jose` + raw fetch. Drop `googleapis`. Reduces cold start significantly.
- **Disable submit button immediately on click**, show a localized "كنشحنو طلبك..." (sending) state. Re-enable only on error response.
- **Don't navigate to `/merci` until the response comes back** — keep the user on the form with a clear "submitting" state. This also prevents the double-submit problem.
- **Consider Vercel Fluid Compute / Edge runtime** if cold starts are still painful — but only after measuring. Note: `googleapis` doesn't run on Edge; would need the lighter rewrite first.
- **Pre-warm** isn't free on the Hobby tier; instead, consider a cron ping every 5 minutes if cold starts are unacceptable.

**Detection:** Vercel function logs show p95 invocation > 2s. Real-user submissions show duplicate rows < 10s apart with same phone.

**Phase:** Backend optimisation (after MVP works, before paid traffic scales).

---

### Pitfall 11: "Merci" page is generic → wasted re-engagement opportunity + no Pixel conversion event

**What goes wrong:** `/merci` shows "Thank you" in English, no Pixel event, no expectation-setting ("we'll call within 24h"), no fallback contact. User wonders if it worked.

**Why it happens:** Treated as throwaway page.

**Prevention:**
- Arabic darija only: "شكرا، طلبك توصل! غادي نعيطو ليك ف 24 سا باش نأكدو".
- Set expectation: callback time + courier name + price reminder.
- Fire Pixel `Lead` and CAPI `Lead` here (deduplicated with submit-side event_id).
- Provide a WhatsApp deep-link as fallback ("إيلا ما عيطنا ش ليك، صيفط لنا واتساب") — many MA users prefer WA to phone.
- Block direct access: redirect to `/ar` if no `?ok=<token>` query param signed server-side; prevents phantom Pixel fires on reloads/bookmarks.

**Phase:** Page build + tracking.

---

### Pitfall 12: Sheets quota hit during ad spike (60 writes/min/user)

**What goes wrong:** A viral creative pushes 200 form submissions in 2 minutes; the 61st-onward each minute returns 429 from Sheets API. Without retry logic, those leads are lost.

**Why it happens:** Per-user-per-project write quota is 60/min. A single service account = "one user". Exponential backoff is the official recommendation but most starter code doesn't implement it.

**Prevention:**
- **Exponential backoff retry** with jitter: on 429, wait 1s + random(0-500ms), retry; double on each failure, up to 5 retries (~30s max).
- **Queue submissions**: instead of writing each submission directly, push to Upstash Redis list / Vercel KV, then drain to Sheets via a background cron at controlled rate. Adds complexity — only if traffic warrants.
- **Use `values.append` with `valueInputOption=RAW`** (cheapest in quota terms) rather than `batchUpdate` for single-row appends.
- **Monitor**: log 429s explicitly, alert via webhook if > 5 per minute.

**Phase:** Backend (start with retry-with-backoff at MVP; add queue only if spikes prove it necessary).

---

### Pitfall 13: PII (phone + address) leaked via client console, error messages, or URL params

**What goes wrong:** Debugging code `console.log(formData)` ships to prod. Or the form submits via GET so phone numbers end up in Vercel access logs / GA referrer chain. Or a generic error message returns the submitted address back to the page (XSS risk + privacy).

**Why it happens:** Carryover from dev. CLAUDE.md flagged this constraint — easy to forget under time pressure.

**Prevention:**
- Strip all `console.log` on the client (use a build flag or just remove them — vanilla JS, simple).
- `<form method="POST">` only; never GET for PII.
- Server-side error responses: return generic codes (`{"error":"validation_failed"}`), never echo back submitted values.
- Don't send PII to FB Pixel browser event (only to CAPI server-side, hashed).
- Vercel's `x-forwarded-for` and `x-real-ip` headers may contain user IPs in logs — that's fine for rate limiting, but don't print full PII in `console.error` either (Vercel logs are not designed as a PII store).
- No URL fragments / query params containing PII (e.g. don't `redirect('/merci?phone=' + phone)`).

**Phase:** Pre-launch security pass + code review.

---

## Minor Pitfalls

### Pitfall 14: Form layout breaks on small Android screens (<360px wide)

**What goes wrong:** Many cheap Android devices in MA are 320-360px wide. Buttons get clipped, labels wrap weirdly.

**Prevention:** Test at 320px viewport in DevTools. Use `min-width: 0` on flex children. Avoid fixed widths in px. Submit button: `width: 100%`, generous tap target (min 44x44px).

**Phase:** Page build.

---

### Pitfall 15: City field is free text → "Casa", "casablanca", "كازا", "Dar Bida" all valid → unusable for routing

**What goes wrong:** Call center / courier can't filter by city efficiently.

**Prevention:** Use a `<select>` with a curated list of MA cities (Casablanca, Rabat, Marrakech, Fès, Tanger, Agadir, Meknès, Oujda, Kénitra, Tétouan, Salé, Mohammedia, ~20-30 total). Add "أخرى" with a free-text fallback. Localise option labels in Arabic.

**Phase:** Form build.

---

### Pitfall 16: No autocomplete attributes → mobile browsers don't offer saved values

**What goes wrong:** Returning visitors retype everything because autocomplete isn't wired.

**Prevention:** `autocomplete="given-name" | "family-name" | "tel" | "address-level2" | "street-address"` on the matching fields. Massive UX win on mobile, zero cost.

**Phase:** Form build.

---

### Pitfall 17: Page title, meta description, og:image not localised → bad SEO + bad social previews

**What goes wrong:** Default Vercel title or English meta — looks unprofessional when the URL is shared on WhatsApp.

**Prevention:** Set `<title>` in Arabic, `<meta name="description">` in Arabic, `<meta property="og:title|description|image">` for WhatsApp/Messenger sharing. og:image should be the product hero (1200x630, < 200KB).

**Phase:** Page build.

---

### Pitfall 18: Existing `whatsapp-landing-ar.html` and new `/ar` page share assets/styles and one breaks the other

**What goes wrong:** Re-using global CSS or shared `assets/` files, one page's RTL rules leak into another, or a deploy of the new page breaks the existing WA landing.

**Prevention:** Scope new page's CSS to `/ar` only (e.g. body class `page-ar-lp`) or put it in a dedicated `css/ar-landing.css`. Don't modify existing shared files; create new ones. Smoke-test `whatsapp-landing-ar.html` after each deploy of the new page.

**Phase:** Page build + deploy QA.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Page scaffolding (HTML/CSS RTL) | #7 (CSS-only direction), #18 (CSS bleed into existing pages) | `<html dir="rtl" lang="ar">` + logical properties from line 1; scoped CSS file |
| Content writing (darija) | #9 (script mismatch), #3 (trust signals) | Native MA reviewer; localised testimonials with real names; COD/courier badges |
| Form build (5 fields) | #4 (phone garbage), #8 (RTL bidi), #15 (city free text), #16 (autocomplete) | `inputmode`+`pattern`+`dir="ltr"` on phone; `<select>` for city; `autocomplete=*` everywhere |
| Backend (Sheets integration) | #1 (silent data loss), #12 (quota), #6 (spam) | Confirm-then-redirect, exponential backoff, honeypot + IP rate limit + country gate |
| Tracking (FB Pixel + CAPI) | #2 (iOS 14 ATT undercount), #11 (phantom Lead events) | Pixel + CAPI deduplicated; fire only on confirmed write; guard `/merci` |
| Performance pass | #5 (LCP > 4s on 3G), #10 (cold start) | WebP hero, font-display swap, subset font, lighter SDK, disable submit on click |
| Pre-launch QA | #1 (test the live Sheet), #2 (Events Manager test), #6 (spam test), #13 (PII leak audit) | Test submission → verify row appears; Meta Test Events; submit honeypot manually; grep for `console.log` |
| Post-launch monitoring | #1, #2, #12 | Daily diff: FB Lead count vs Sheet rows vs Vercel function invocations |

---

## Sources

### Critical references (HIGH confidence)
- [Google Sheets API Usage Limits](https://developers.google.com/workspace/sheets/api/limits) — official quota: 60 writes/min/user/project, 429 on exceed, exponential backoff recommended.
- [Vercel Cold Start Knowledge Base](https://vercel.com/kb/guide/how-can-i-improve-serverless-function-lambda-cold-start-performance-on-vercel) — official cold start guidance.
- [W3C: Structural markup and right-to-left text in HTML](https://www.w3.org/International/questions/qa-html-dir) — use HTML `dir`, not CSS, for base direction.

### MA-specific commerce & UX (MEDIUM confidence — verified across multiple MA sources)
- [Landing Page Morocco 2025 (CleverMKT)](https://clevermkt.com/landing-page-morocco-2025-triple-your-leads-now/) — 27% conversion lift with local trust badges; 112% form-submission lift after localising testimonials.
- [COD E-Commerce Morocco 2025 (Codrocket)](https://codrocket.com/blog/complete-guide-cod-ecommerce-morocco-2025) — 67% of MA online shoppers prefer COD.
- [What Drives Moroccan E-commerce Purchase Decisions (Shuaikumedia)](https://shuaikumedia.com/what-makes-moroccan-consumers-click-buy-now/) — local courier logos, MA phone numbers, real names as trust signals.
- [Sendit.ma](https://www.sendit.ma/) and [Speedaf Maroc](https://www.facebook.com/SpeedafExpressMorocco/) — the two main COD couriers; logos are recognisable trust signals.

### RTL & Arabic web (HIGH confidence — converged across sources)
- [Right to Left Styling 101 (rtlstyling.com)](https://rtlstyling.com/posts/rtl-styling/) — logical properties, common CSS pitfalls.
- [Stop fixing Numbers — RTL in a web platform (dev.to)](https://dev.to/pffigueiredo/stop-fixing-numbers-rtl-in-a-web-platform-6-6-29ne) — LRM and `<bdi>` for number rendering.
- [RTL design guide for developers (SimpleLocalize)](https://simplelocalize.io/blog/posts/rtl-design-guide-developers/) — phone field `dir="ltr"` pattern.

### Form UX & phone fields (HIGH confidence)
- [Optimizing the phone number field on forms (Zuko)](https://www.zuko.io/blog/optimizing-the-phone-number-field-on-forms) — 89% of users enter differently from asked format.
- [Phone inputs and you (Evil Martians)](https://evilmartians.com/chronicles/phone-inputs-and-you-the-designers-essential-ui-guide) — `tel` + `inputmode="numeric"` + `autocomplete="tel"`.
- [Better Form Inputs for Better Mobile UX (CSS-Tricks)](https://css-tricks.com/better-form-inputs-for-better-mobile-user-experiences/).

### FB Pixel + Conversions API (HIGH confidence)
- [How To Fix Facebook Pixel Issues (Cometly, 2026)](https://www.cometly.com/post/how-to-fix-facebook-pixel-issues) — head placement, single install, redirect timing.
- [iOS 14 Impact on Facebook Ads (Adnabu)](https://blog.adnabu.com/shopify/ios-14-impact-on-facebook-ads/) — ATT impact, CAPI as remediation.
- [Facebook Conversions API guide (Ingest Labs)](https://ingestlabs.com/facebook-conversions-api-guide/) — server-side event dedup with `event_id`.

### Performance on 3G (HIGH confidence)
- [Mobile LCP Optimization Guide](https://gwaa.net/mobile-lcp-optimization-best-practices) — 2.5s good / 4s poor thresholds, mobile 20-30% slower than desktop.
- [Morocco Mobile Network Experience Report (Opensignal)](https://www.opensignal.com/reports/2024/03/morocco/mobile-network-experience) — MA users still spend significant time on 3G/2G.
- [3G/4G coverage in Morocco (nPerf)](https://www.nperf.com/en/map/MA/-/-/signal) — real coverage map; semi-urban areas frequently 3G.

### Spam protection on Vercel (MEDIUM confidence)
- [Prevent AI bots with honeypots (Nikolai Lehbrink)](https://www.nikolailehbr.ink/blog/prevent-form-spamming-honeypot/) — honeypot best practice: respond OK silently.
- [Rate Limiting with Vercel Edge + Upstash](https://upstash.com/blog/edge-rate-limiting) — official pattern for serverless rate limit.
- [Submit forms without re-captcha (dev.to)](https://dev.to/iamcherta/submit-forms-without-using-re-captcha-2o8p) — honeypot + time-trap layering.

### Darija writing register (MEDIUM confidence)
- [Written Moroccan Darija — Arabic and Arabizi (learnmoroccan.com)](https://www.learnmoroccan.com/blog/written-moroccan-darija-arabic-and-arabizi) — register split between Arabic script (formal) and Arabizi (chat).
