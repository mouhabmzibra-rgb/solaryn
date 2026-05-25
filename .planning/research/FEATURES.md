# Feature Landscape

**Domain:** Moroccan FB/IG cash-on-delivery single-product landing page (Arabic darija, women 25-45, beauty/skincare)
**Researched:** 2026-05-26
**Overall confidence:** MEDIUM-HIGH (most claims triangulated across 2-3 industry sources; some MA-specific intuitions marked LOW)

---

## Domain Context

Three structural facts shape every feature decision below; cite them when re-evaluating scope:

1. **COD is dominant and fragile.** 54-80% of MA e-commerce transactions are COD; 20-40% of COD orders from FB/IG ads are fake/abandoned/no-intent. [Confidence: HIGH — codrocket + myleaddone] The landing page's job is not "close the sale" — it's "capture enough quality signal that a human caller can confirm in 2 hours." Every feature is judged against this lens.
2. **Mobile is the only platform that matters.** 80-95% of MA e-commerce + FB/IG traffic is mobile; 95% of GA traffic on the existing Solaryn site is mobile. [Confidence: HIGH — codrocket, german-cpoc, project PROJECT.md GA data] Desktop is afterthought; tablet is rounding error.
3. **Language is gating.** Without darija, ~70% of the audience disengages immediately. [Confidence: MEDIUM — german-cpoc] Fus'ha-only or French-only would underperform vs darija-written (Arabic script, colloquial vocabulary). Code-switching FR/AR is acceptable but spine must be darija.

---

## Table Stakes

Features users expect. Missing = conversion craters (>30% relative loss). Build all of these in Phase 1.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Above-the-fold hero with product image + price 150 MAD livraison incluse + primary CTA** | Standard MA pub-FB pattern; visitor decides "scroll or bounce" in <3s. CTA above fold is the #1 conversion lever per Shopify 2025 LP guide. | Low | Hero image must be product photo (not lifestyle abstract). Price + "livraison incluse" together — never split. Primary CTA is a scroll-to-form (or anchor) labeled in darija e.g. "اطلب دابا" / "كمل طلبك". |
| **5-field COD form: prénom, nom, téléphone (WhatsApp), ville, adresse** | Already validated in PROJECT.md decisions. Form-field studies: 3 fields ≈ 25% CR, 6 fields ≈ 15% CR; each extra field -5-10% completion. 5 fields is the MA COD minimum (téléphone non-négociable pour confirmer; adresse + ville requis par transporteur). | Low | Tel field: numeric keyboard (`inputmode="tel"`), Moroccan format validation (`06xxxxxxxx` / `07xxxxxxxx`). Address: free-text, but enforce min length (e.g. 10 chars) to reject "Casablanca" / "Maroc" alone — myleaddone identifies single-word addresses as #1 fake-order signal. No email field (not used in MA COD pipeline; adds friction). |
| **Mobile-first RTL layout, Arabic script, darija copy** | 80-95% mobile traffic. Without RTL+darija the audience won't engage. Landingi/Purrweb data: aligning RTL+language correctly drove 13% retention lift in case studies. | Medium | `dir="rtl"` on `<html>`, logical CSS properties (`margin-inline-start` not `margin-left`), right-aligned text, mirrored visual hierarchy. Numerals: prefer Western (0-9) for prices since darija speakers read both fluently and Western are unambiguous for currency. |
| **"Paiement à la livraison" trust badge / explicit COD callout** | MA shoppers default to COD precisely because they distrust paying before receiving. Hiding this signal = appearing like a card-only foreign scam. Per codrocket: showing COD is mandatory trust signal. | Low | Dedicated badge/icon near price AND near form submit. Darija label e.g. "خلص فاش توصلك السلعة" (pay when you receive it). |
| **Phone confirmation expectation set on page** | MA buyers expect a human call. Setting expectation reduces "ghost" leads (impulse fills with no intent to answer). Codrocket: confirmation call within 2h is the operational backbone. | Low | One line near the form: "غادي نعيطو ليك باش نأكدو الطلب" (we will call you to confirm). This both informs and self-selects committed leads. |
| **Product benefits in 3-5 scannable bullets (darija)** | Mobile reading = skimming. SPF benefits must be expressed in everyday darija terms (protection soleil, anti-taches, leger, etc.), not pharma jargon. | Low | Use icons + short phrases. Avoid the disallowed claims from feedback_solaryn_product_claims (no pregnancy/baby/Argan-Aloe/zero-chemicals claims). |
| **Social proof: reviews/testimonials block** | Convertcart + Shopify 2025: testimonials lift conversions ~34%. For MA beauty, social proof is the #2 trust mechanism after COD. | Low-Medium | At minimum: 3-5 written testimonials with first name + city (e.g. "نادية، الدار البيضاء"). Darija text. If real reviews don't exist yet, mark this as Phase 2 enhancement and ship Phase 1 with a generic trust strip ("+ X clientes satisfaites"). |
| **Facebook Pixel (PageView + Lead events)** | Already in PROJECT.md requirements. Without Pixel + Lead event, FB ad optimization is blind = budget waste. | Low | Lead event fires on form submission success. Use Conversions API server-side if feasible to bypass iOS 14+ Pixel decay (Phase 2 enhancement). |
| **Loading speed <3s on Moroccan 4G** | Bounce rate doubles past 3s; MA mobile networks are 4G-dominant but variable. Per codrocket: <2s target. | Medium | Vanilla HTML/CSS/JS (per PROJECT.md stack constraint) helps. Optimize hero image (WebP, ≤80KB), inline critical CSS, defer Pixel. |
| **Thank-you / "merci" page with confirmation message** | Per PROJECT.md decision. Confirms submission worked, sets expectation about callback. | Low | Darija: "تسجل طلبك. غادي نتواصلو معاك قريب." No further CTA. Fires FB Lead event. |

---

## Differentiators

Features that lift conversion 10-30% beyond baseline. Not strictly expected, but valued by audience. Layer in Phase 2 after Phase 1 validates.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Sticky bottom-bar CTA (mobile)** | Convertica + GrowthRock A/B tests: +5-8% completed orders with sticky add-to-cart. On long mobile LPs the form is offscreen most of the scroll; sticky CTA = persistent path. | Low | Bottom bar: price reminder + "اطلب دابا" button anchoring to form. Hide on form-in-viewport to avoid double-CTA noise. |
| **Countdown timer / urgency element** | Adoric + GetResponse: countdown can lift sales up to 30% via FOMO. Common in MA dropshipping LPs. | Low-Medium | Use evergreen (per-visitor) timer, not fake fixed-date — credibility risk if user revisits and timer reset is obvious. Frame as "Offre limitée — العرض محدود". Caveat: overused countdowns trigger scam-radar; pair with real social proof or skip. [Confidence MEDIUM — universal e-com data, not MA-specific tested by us] |
| **Before/after skin imagery** | Smytten + skincare ad benchmarks: B/A is the strongest visual proof for skincare. Conversion lift 20-30% when authentic. | Medium | Compliance risk — for SPF specifically, B/A is about tan prevention / anti-taches, not medical claims. Must respect the user's product-claims feedback rules (no pregnancy/baby claims; no "zero chemicals"). If authentic B/A photos not yet available, defer — fake B/A is illegal under MA consumer protection + corrosive to trust. |
| **Short UGC video testimonial (darija, vertical)** | UGC creators in darija are now an established Upwork category; FB feed favors video; "real Moroccan woman talking" = strongest social proof. | Medium-High | 15-30s vertical clip, native player (or autoplay-muted), captions burned in (audio-off browsing dominant). Phase 2-3 — needs production. |
| **WhatsApp click-to-chat fallback button** | MA users massively prefer WhatsApp for clarifications. Acts as escape valve for hesitant leads who'd otherwise bounce. | Low | Floating WhatsApp button (`https://wa.me/212XXXXXXXXX?text=...`) with pre-filled darija message. Tradeoff: shifts some form-fillers to chat (slower to qualify) — recommend Phase 2 only after baseline form CR is measured. [Confidence: MEDIUM — anecdotal in MA market, not formal study] |
| **Stock counter / "il reste X unités"** | Scarcity tactic, works on impulse buyers. | Low | High scam-association risk in MA market if number is obviously fake or decrements visibly. Use static "stock limité" copy without live counter, OR skip. [Confidence: LOW — split evidence] |
| **FAQ accordion (3-5 darija questions)** | Preempts objections ("هل المنتج أصلي؟", "أشحال تستنا التوصيل؟", "واش كاين خلاص قبل التوصيل؟"). Per clevermkt: objection preemption in first 300 words lifted CR. | Low | Static accordion below benefits, above form. |
| **Delivery time specificity** | "Livraison 2-4 jours" beats "livraison rapide". Mobiloud: specific dates reduced abandonment. | Low | Darija: "التوصيل فـ 2-4 ايام لجميع المدن". Avoid vague "bientôt" / "rapidement". |
| **Local trust authority references (CGEM, Bank Al-Maghrib, etc. — only if legitimate)** | Clevermkt: real MA-institution name-drops drove +112% in their case. | Low | DO NOT fake. Use only if Solaryn brand actually has such certifications. Otherwise rely on photo+name testimonials. |

---

## Anti-Features

Features to explicitly NOT build. Many would feel "professional" by US/EU standards but actively harm MA COD conversion.

| Anti-Feature | Why Avoid (MA audience lens) | What to Do Instead |
|--------------|------------------------------|-------------------|
| **Long form (>5 fields), date pickers, dropdowns for city** | Each extra field -5-10% completion. City dropdown is friction without payoff (transporteur can interpret free text; spell variants of "Casablanca" / "كازا" all fine). Date pickers on mobile are notorious UX failures. | Free-text city field, 5 required fields total, no optional fields above the fold. |
| **Multi-step / wizard checkout** | MA COD buyers expect ONE form on ONE screen. Multi-step implies "complex purchase" and triggers abandonment. Used by foreign Shopify themes but mismatched here. | Single form, all fields visible at once, single submit. |
| **Account creation / login / password** | Already excluded in PROJECT.md. Account = friction without value for one-shot lead capture. Audience has no expectation of account state. | One-shot guest submission, no account, no password, no email verification. |
| **English copy (anywhere meaningful)** | Already excluded in PROJECT.md. Even mixed EN labels (e.g. "Submit", "Order Now") read as "foreign scam site" to non-French-speaking audience. | Darija for all user-facing strings. French OK as secondary for some terms (livraison, COD) since universally understood, but not as primary CTA language. |
| **Online payment (Stripe / CMI / card form)** | Already excluded in PROJECT.md. Card-only signals scam; COD-only signals trust in this market. Even offering card as alternative dilutes the COD trust message. | COD-only, prominently labeled. |
| **Live chat widget (Intercom/Tawk-style)** | Already excluded in PROJECT.md. Adds page weight, often broken in RTL, requires staffing. WhatsApp deep-link covers same need without page bloat. | WhatsApp click-to-chat (differentiator, Phase 2) instead. |
| **Cookie banner / GDPR-style consent modal** | Visual clutter, blocks above-the-fold real estate, irrelevant in MA legal context (loi 09-08 has lighter consent UX requirements than GDPR). | If legally needed, a thin dismissible bottom strip, never a modal. |
| **Newsletter signup modal / exit-intent popup** | Already implied by PROJECT.md exclusions (no further CTA after submit). Modals are mobile UX poison and read as spammy. | No popups. The lead form IS the conversion. |
| **Complex animations, parallax, lazy reveals** | Slow Moroccan 4G + low-end Android devices = janky animations = perceived broken site. Modern minimal aesthetic ≠ animation-heavy. | Static layout, minimal transitions (button hover/active only). |
| **Hero image with foreign / non-MA model** | Trust evaporates when imagery clearly targets EU/US audience. | Moroccan-presenting model OR product-only hero. Skin tone, styling, setting should be recognizable. |
| **Pricing tiers / "starter/pro/premium" packages** | PROJECT.md decided single offer 150 MAD. Tiering on a darija COD page triggers analysis paralysis and abandonment. | One offer, one price, one CTA. |
| **Logo wall of "as seen in" Western publications** | Trust signal arbitrage that doesn't transfer to MA audience. | Local testimonials with names + cities; MA institution references only if real. |
| **Modal video lightboxes for product demo** | Mobile modal UX is poor; autoplay-muted inline video is better. | Inline vertical video player (Phase 2 differentiator). |
| **Stock counter that visibly decrements during the session** | Scam-association risk. MA users have learned to distrust "5 left!" decrementing fakery. | Static "stock limité" or omit. |
| **Email field on form** | Email is not used in the MA COD operational pipeline (confirmation is phone/WhatsApp). Extra field that doesn't serve confirmation = pure friction cost. | Phone only — already the plan. |
| **Required terms-of-service checkbox** | Extra friction; legally not required for a lead capture in MA. | TOS link in footer (small), no checkbox. |
| **Fus'ha-only Arabic** | Reads as formal/news-broadcast tone; doesn't match FB ad voice. Audience may understand it but feels distant. | Darija written in Arabic script. |
| **Pure French copy** | Excludes ~70% of paid-traffic audience per german-cpoc. Even FR-comfortable MA shoppers expect darija pubs/LPs for consumer goods. | Darija primary; FR only for universally-understood terms or footnotes. |

---

## Feature Dependencies

```
Mobile-first RTL layout
  └── enables → Arabic script darija copy
       └── enables → All trust/social-proof features (they only work in user's language)

5-field COD form
  └── depends on → Tel + ville + adresse validation (data quality for callback)
       └── enables → Phone confirmation pipeline (operational backbone)
            └── enables → FB Pixel Lead event accuracy (real leads, not garbage)

Hero with price + CTA above fold
  └── depends on → Mobile-first layout + <3s load
       └── enables → Sticky CTA effectiveness (anchor target exists)

Social proof / testimonials
  └── depends on → Authentic content (names, cities, ideally photos)
       └── alternatively → defer to Phase 2 if not yet collected

Before/after imagery
  └── depends on → Compliance with product-claims rules (no medical claims)
       └── depends on → Real photo assets (never fake)

UGC video testimonial
  └── depends on → UGC creator production (Upwork or in-house)
       └── Phase 2-3 only

Countdown timer
  └── depends on → Evergreen per-visitor logic (not fake fixed date)
       └── if undecided → skip Phase 1 (low-risk omission)

WhatsApp click-to-chat
  └── depends on → Staffed WhatsApp number with response SLA
       └── Phase 2 only

FB Pixel
  └── depends on → Pixel ID + Lead event firing on /merci page
       └── enables → FB ad optimization, look-alike audiences
```

---

## MVP Recommendation

**Phase 1 (ship-to-validate, ~5-7 days work):**

1. Mobile-first RTL darija layout (table stake)
2. Hero: product image + 150 MAD livraison incluse + CTA-to-form (table stake)
3. 3-5 bullet benefits in darija with icons (table stake)
4. 5-field COD form with MA phone validation + address min-length (table stake)
5. "Paiement à la livraison" trust badge (table stake)
6. Phone confirmation expectation copy near form (table stake)
7. FAQ accordion, 3-5 darija questions (differentiator, cheap)
8. Delivery time specificity "2-4 jours" (table stake-adjacent, cheap)
9. /merci thank-you page (table stake)
10. FB Pixel + Lead event (table stake)
11. Static social-proof strip ("+X clientes satisfaites" or 2-3 written testimonials if available) (table stake)
12. Sticky bottom CTA bar on mobile (differentiator, cheap, high-ROI)

**Phase 2 (after first ad campaign data lands, ~3-5 days work):**

13. Real testimonials with first names + cities (authenticity upgrade)
14. WhatsApp click-to-chat fallback button (differentiator)
15. Before/after imagery — only if authentic photos exist and compliance-cleared (differentiator)
16. Evergreen countdown timer — only if A/B test data supports it (differentiator)
17. CAPI server-side (Pixel reinforcement)

**Defer indefinitely (validate need first):**

- UGC video testimonial (production cost; validate with photo testimonials first)
- Stock counter (scam-risk > lift in MA market)
- MA-institution trust badges (only if Solaryn has real ones)

**Explicitly never:**

- Everything in the Anti-Features table.

---

## Implications for Roadmap

- **Single phase for MVP is realistic.** The Phase 1 list is 12 features, but most are content + layout, not engineering complexity. Vanilla HTML/CSS/JS stack (per PROJECT.md) means no build step, no framework setup. Estimate: 5-7 days for one engineer.
- **Form integrity is the highest-stakes engineering work.** Phone validation, address quality check, Google Sheets API submission, error handling, success page transition — these are where bugs burn ad budget. Allocate disproportionate testing here.
- **Content production is on the critical path.** Darija copy (hero, benefits, FAQ, testimonials, CTA, thank-you, error messages) needs a native writer or close review. Engineering can scaffold with placeholders but copy-quality gates the launch.
- **Phase 2 should be data-driven.** Measure baseline form CR first. Don't pre-commit to countdown/UGC/B-A without seeing where Phase 1 leaks.

---

## Confidence Assessment

| Claim Category | Confidence | Reason |
|----------------|-----------|--------|
| COD dominance + fake-order rates in MA | HIGH | codrocket + myleaddone agree on 54-80% COD and 20-40% fake-order ranges |
| Mobile-first imperative | HIGH | Multiple sources + project's own GA data |
| Darija language gating | MEDIUM-HIGH | german-cpoc + clevermkt + user's project context |
| Form-field count → CR relationship | HIGH | Industry-standard 3-vs-6 field studies cited across multiple LP guides |
| Sticky CTA lift | HIGH | Convertica + GrowthRock A/B test data |
| Countdown timer lift | MEDIUM | Universal e-com data; MA-specific effect not isolated; scam-risk caveat |
| Before/after imagery lift for skincare | MEDIUM | Strong in beauty category broadly; MA-specific not measured |
| WhatsApp click-to-chat as escape valve | LOW-MEDIUM | Anecdotal in MA market; no formal study found |
| Anti-feature rationale (foreign models, English copy, multi-step) | MEDIUM | Inferred from MA market characteristics + trust-signal literature; not all directly A/B tested |
| Stock-counter scam-association in MA | LOW | Personal inference from MA dropshipping landscape; not formally sourced |

---

## Sources

- [COD E-Commerce Morocco 2025: Ultimate Seller's Guide — codrocket](https://codrocket.com/blog/complete-guide-cod-ecommerce-morocco-2025)
- [Landing Page Morocco 2025: Triple Your Leads — clevermkt](https://clevermkt.com/landing-page-morocco-2025-triple-your-leads-now/)
- [Fake Orders in Moroccan E-commerce — myleaddone](https://www.myleaddone.com/blog/fake-orders-ecommerce-morocco)
- [Meta Ads Maroc 2026 — german-cpoc](https://german-cpoc.com/en/meta-ads-complete-guide/)
- [Meta Ads Benchmarks Morocco — xyzlab](https://www.xyzlab.com/meta-ads-benchmarks/morocco)
- [Lancer un Business COD au Maroc — codrocket FR](https://codrocket.com/fr/blog/how-to-start-cod-ecommerce-business)
- [High-Converting Landing Pages 2025 — Shopify](https://www.shopify.com/blog/high-converting-landing-pages)
- [Landing Page Conversion Rate Benchmarks 2025 — Shopify](https://www.shopify.com/blog/landing-page-conversion-rate)
- [Sticky CTA case study — Convertica](https://convertica.org/ecommerce-case-study-sticky-cta/)
- [Sticky add-to-cart A/B test results — GrowthRock](https://growthrock.co/sticky-add-to-cart-button-example/)
- [Countdown timers e-commerce — Convertcart](https://www.convertcart.com/blog/countdown-timer-ecommerce)
- [Countdown timer landing page — GetResponse](https://www.getresponse.com/blog/landing-page-countdown-timer)
- [RTL Landing Page examples — Landingi](https://landingi.com/landing-page/rtl-examples/)
- [Arabic RTL design guide — Purrweb](https://www.purrweb.com/blog/halal-design-how-to-make-an-app-in-arabic/)
- [Arabic UX fixes — Mak it Solutions](https://makitsol.com/arabic-ux-design-fixes-for-gcc-rtl-websites/)
- [Trust signals reduce checkout abandonment — Mobiloud](https://www.mobiloud.com/blog/trust-signals-cart-abandonment)
- [Sunscreen before/after — Smytten](https://smytten.com/blogs/skincare/7-shocking-sunscreen-before-and-after-transformations)
- [UGC creator darija MA — Upwork project](https://www.upwork.com/services/product/video-audio-ugc-content-creator-in-darija-moroccan-arabic-tiktok-instagram-shopify-1775339091434786816)
- [YouCan Confirm order confirmation — YouCan](https://youcan.shop/en/help/blog/confirm)
- Project PROJECT.md (constraints + decisions baseline)
- User memory: feedback_solaryn_product_claims (claims compliance gate)
