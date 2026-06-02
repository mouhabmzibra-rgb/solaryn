# Session — 2026-06-02

## Active goal
TikTok Pixel installé sur `/ar` avec event CompletePayment (équivalent purchase pour TikTok Ads).

## Status
**Done localement** — à déployer.

## Done this session
- `ar.html` :
  - **TikTok Pixel base code** ajouté après le `<noscript>` Meta Pixel
  - Pixel ID : `D8FLN0JC77UDKLRNE1C0`
  - `ttq.load()`, `ttq.page()` au load (default base events)
  - `ttq.track('ViewContent')` au page load (parité Meta `ViewContent`)
  - `ttq.track('CompletePayment')` dans le success block du form submit (parité fbq Purchase ligne 1249), avec `event_id` partagé pour dedup CAPI futur
  - Schéma payload TikTok :
    ```js
    {
      contents: [{ content_id, content_name, content_category, content_type, price, quantity }],
      value, currency, event_id
    }
    ```

## Background context (depuis précédentes sessions)
- Solaryn POP property GA4 (`538056045`) : 30 jours = $228 revenue / $13 spend = ROAS 17.6x brut
- 14 purchases GA4 vs 8 Shopify : delta = 6 tests Kenitra (user lui-même)
- VPS Hetzner + Asterisk setup (45.152.162.221) — fonctionnel pour SIP signaling, blocker outbound MA mobile non résolu

## In progress
- Aucun. Prêt à déployer.

## Blockers / pending decisions
- Aucun blocker. **À tester après deploy** :
  1. Charger `/ar` → vérifier `ttq.page()` et `ttq.track('ViewContent')` dans TikTok Events Manager
  2. Soumettre form → vérifier `CompletePayment` event reçu côté TikTok
- Optionnel : ajouter `InitiateCheckout` + `AddToCart` TikTok events en parité avec Meta Pixel (pas demandé par user mais utile pour campagnes TikTok Ads)

## Next step
1. `cd /Users/a2024/solaryn && git add ar.html SESSION.md && git commit -m "Add TikTok Pixel + CompletePayment event on /ar" && git push`
2. Vercel auto-deploy (~30 sec)
3. Tester sur prod : ouvrir `/ar` + soumettre form test → vérifier TikTok Events Manager
4. Configurer TikTok Conversions API (server-side) si besoin de dedup robuste — pas encore fait

## Context the next session needs
- TikTok Pixel ID : `D8FLN0JC77UDKLRNE1C0`
- Events firés : `page`, `ViewContent`, `CompletePayment`
- GA4 property (Solaryn POP) : `properties/538056045`
- Filter Kenitra à ajouter dans GA4 admin pour exclure user tests

## Open follow-ups (not blocking)
- Ajouter TikTok events `InitiateCheckout` + `AddToCart` pour parité Meta
- Configurer TikTok CAPI (Conversions API server-side) via `/api/ar-lead.js`
- Filtre internal traffic Kenitra dans GA4 (admin → data filters)
