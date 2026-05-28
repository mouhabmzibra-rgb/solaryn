# Session — 2026-05-28

## Active goal
Booster conversion `/ar` : form 3 champs au-dessus du fold + duplication au milieu, sans `nom` ni champ `ville` séparé. Cause : funnel à 0.1% conversion (1019 view_item → 7 typers → 1 vente form en 3j). 48h sans vente.

## Status
**Done localement** — à déployer (`vercel --prod` ou git push si auto-deploy).

## Done this session
- `ar.html` :
  - **Hero compressé** : suppression de `hero-img`, `cta-hero` link, `cod-badge`. h1 condensé (1 ligne). Sub raccourci. Tout au-dessus du fold (≈ 594px sur mobile typique).
  - **Form #1 inséré dans le hero** (`#ar-form-hero`) : 3 champs uniquement — prenom, tel, adresse (combiné ville+rue, textarea, min 10 chars). Submit "طلبي دابا — 150 درهم". Source = `fb_ar_hero`.
  - **Form #2 conservé au milieu** (`#ar-form-main`) inchangé en position mais réduit aux mêmes 3 champs. Source = `fb_ar_main`.
  - **CSS** : nouveau bloc `.hero-form-wrap`, inputs forcés à `font-size:16px` (anti-zoom iOS), `scroll-margin-top:90px` (champ reste visible quand clavier ouvre).
  - **JS refactorisé** : itère sur `form.ar-form` ; flags `bcFired`/`icFired`/`typingFired` partagés entre les 2 forms (pas de double fire) ; submit handler unique factorisé ; selector pour error global mappe vers `formErrorHero` ou `formError` selon le form.
- `api/ar-lead.js` :
  - `nom` et `ville` rendus optionnels (anciens clients cachés compatibles).
  - Validation requise réduite à `prenom + adresse + tel`. Adresse min 10 chars (unchanged). Max length adresse passé de 300 → 400 (texte combiné ville+rue plus long).
  - `looksClean(nom)` skip si nom absent.
- Tracking conservé tel quel :
  - `view_item` (GA4) + `ViewContent` (FB) au page load
  - `begin_checkout` (GA4) au focus premier champ ou click sticky CTA
  - `InitiateCheckout` (FB) + `form_start` (GA4) au premier focusin form
  - `AddToCart` (FB) + `form_typing_start` (GA4) au premier keystroke
  - `Purchase` (FB + GA4) après submit success, partagé `event_id` pour dedup CAPI
- Sheet schema unchanged : la colonne `nom` recevra une chaîne vide pour les leads new-form, la colonne `ville` aussi. La colonne `adresse` contient désormais le texte combiné.

## In progress
- Aucun. Prêt à déployer.

## Blockers / pending decisions
- Aucun blocker. **À tester en prod après deploy** : remplir form hero sur mobile → vérifier purchase event GA4 + Meta Events Manager + nouvelle ligne dans sheet "Solaryn AR Leads".

## Next step
1. Deploy : `cd /Users/a2024/solaryn && git add -A && git commit -m "..."  && git push` (ou `vercel --prod` direct).
2. Test mobile en conditions réelles : Safari iOS + Chrome Android, FB in-app browser, TikTok in-app browser.
3. Surveiller GA4 24h : ratio `view_item → form_start → form_typing_start → purchase`.
4. Surveiller Meta Events Manager : Purchase events reçus + via Pixel + via CAPI.
5. Si conversion > 1% : reactiver budget Advantage+ Sales. Sinon analyser quelle étape leak.

## Context the next session needs
- GA4 property : `538056045` (solaryn pop)
- Sheet AR Leads : ID dans Vercel env `AR_LEADS_SHEET_ID`
- Meta Pixel : `1424942896066929`
- Meta CAPI : `META_CAPI_ACCESS_TOKEN` (à vérifier présent dans Vercel env — si absent, Purchase ne fire que client-side)
- Brand colors : navy `#1B2D4D`, gold `#C89860`, orange `#FF8C42`, gradient-sun
- Form selectors : `form.ar-form` (deux instances : `#ar-form-hero`, `#ar-form-main`)
- Funnel data 26-28 mai : 1019 view_item users → 17 form_start → 7 form_typing_start → 1 vente form GA4 (+ 2 ventes WhatsApp non-trackées). Conversion 0.1% sur view_item — donc tout autre levier (offre, social proof, pack 2 unités) reste à explorer si nouveau form ne suffit pas.

## Open follow-ups (not blocking)
- ⏸️ **AirDroid SMS bulk** (54 affiliées) — paused.
- 🌐 `solaryn.co/affiliates` et `/kit` → 404 (domaine pointe Shopify, app Vercel sur autre URL).
- 📅 Google Calendar non-autorisé Composio.
- ⚠️ Rotate leaked service account key `670f854a...`.
- 🐛 `api/affiliate-sale.js` rejects `quantite` as JS number.
- 🐛 Customer `customer_tel` loses leading `0` in Sheets.
- 🎨 Pas de témoignages clients dans `/kit`.
- 💡 **Tester offre Pack 2 unités à 250 MAD** si conversion form 3-champs reste < 1%.
- 💡 **Ajouter WhatsApp click tracking** (`Contact` FB event + `whatsapp_click` GA4) — Mouhab doit fournir le numéro WA Business à mettre.
- 💡 **A/B test** : hero form vs hero classique (par split URL `/ar?v=a` vs `/ar?v=b`) pour mesurer le lift exact.
- 🔧 Vérifier que `META_CAPI_ACCESS_TOKEN` est bien défini dans Vercel env (sinon Purchase ne fire que côté browser, fragile sur in-app browsers).
