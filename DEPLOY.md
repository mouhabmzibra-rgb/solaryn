# Solaryn — Deploy l Vercel + Google Sheets

Had l guide ghadi yedik step-by-step bach tdir l site live, m3a leads kay-tssjlou f Google Sheets automatiquement. **Ma kat-khles walou.**

---

## 📋 Chno khassek qbel ma tbda

- [ ] Compte **Google** (3andek déjà ila kayna 3andek Gmail)
- [ ] Compte **GitHub** ✓
- [ ] Compte **Vercel** ✓
- [ ] **Git** installed 3la l ordinateur (`git --version` bach tcheck)

---

## 🟢 Étape 1 — Sayyeb Google Sheet + Apps Script

### 1.1 Sayyeb Sheet jdid

1. Ru7 l [sheets.google.com](https://sheets.google.com)
2. Cliki **+ Blank** bach tsayyeb sheet jdid
3. Smih: `Solaryn Leads`
4. Khalli les onglets ghadi y-créaw automatiquement (Commandes, Bulk)

### 1.2 7at l Apps Script

1. F nafs Sheet, cliki **Extensions → Apps Script**
2. Ghadi tfta7 onglet jdid f browser m3a editor dyal Apps Script
3. Mse7 kolchi li f l editor (`function myFunction() {}`)
4. Fta7 l fichier **`google-apps-script.gs`** mn l projet, copy kolchi w paste-h f l editor
5. Cliki **💾 Save** (Ctrl+S / Cmd+S)
6. Smi l projet: `Solaryn Webhook`

### 1.3 Deploy l Apps Script

1. F editor ta3 Apps Script, cliki **Deploy → New deployment**
2. F **Select type** (icône ⚙️ haut-droite), khtar **Web app**
3. Settings:
   - **Description**: `Solaryn leads webhook`
   - **Execute as**: **Me** (l email dyalek)
   - **Who has access**: **Anyone** ⚠️ (mhim! sinon Vercel ma yqderch yssayfet)
4. Cliki **Deploy**
5. Awal mra ghadi ytalbek **Authorize access** → cliki, khtar compte dyalek, w accepti l permissions
6. Ghadi tjik **Web app URL** — kay-bda b `https://script.google.com/macros/s/...`
https://script.google.com/macros/s/AKfycbymaFg0j1DdSfvULk_xd_C9i36_xb1ul9QFUotKeP6BhlFixfNBCuXl2vejcFR-XBEKOQ/exec
> 💡 Test wakha: open URL f browser, khass tjik message `Solaryn webhook is alive.`

---

## 🟢 Étape 2 — Push l projet l GitHub

F terminal, men dakhel `/Users/a2024/solaryn`:

```bash
cd /Users/a2024/solaryn
git init
git add .
git commit -m "Initial Solaryn site"
```

Daba sayyeb repo f GitHub:

1. Ru7 l [github.com/new](https://github.com/new)
2. **Repository name**: `solaryn`
3. **Private** (recommended) ola Public — wach bghiti
4. **Ma t-checkitch** "Add a README" wala ".gitignore" (3andna déjà)
5. Cliki **Create repository**

Daba GitHub kay-3tik 2 sutur dyal commands. Copy w shabbeh hadi (`USERNAME` bdelh b dyalek):

```bash
git branch -M main
git remote add origin https://github.com/USERNAME/solaryn.git
git push -u origin main
```

---

## 🟢 Étape 3 — Deploy l Vercel

1. Ru7 l [vercel.com/new](https://vercel.com/new)
2. **Import Git Repository** → khtar `solaryn`
3. F page dyal **Configure Project**:
   - **Framework Preset**: Other (ola ghadi tdouwwa Vercel automatiquement)
   - **Root Directory**: `./` (default)
   - **Build Command**: khaliha empty
   - **Output Directory**: khaliha empty
4. Fta7 **Environment Variables** w zid:
   - **Key**: `SHEETS_WEBHOOK_URL`
   - **Value**: ḥot fih l URL li copyiti men Apps Script (étape 1.3)
   - Cliki **Add**
5. Cliki **Deploy**
6. Stenna ~30 thaniya. Vercel ghadi y3tik URL bhal: `solaryn-xyz.vercel.app`

---

## 🟢 Étape 4 — Test l site

1. Fta7 l URL dyal Vercel
2. Sayyeb wahed test commande f l form (sma "Test", numéro vrai dyalek)
3. Ru7 l Google Sheet — khassek tlqa l ligne jdida f onglet **Commandes** 🎉

---

## 🟢 Étape 5 — Domain dyalek (solaryn.ma)

Mli tcheri domain (fya parg [genious.ma](https://genious.ma) wla [hostinger.com](https://hostinger.com)):

1. F Vercel project → **Settings → Domains**
2. Cliki **Add** → kteb `solaryn.ma`
3. Vercel ghadi y3tik DNS records (A record + CNAME)
4. Ru7 l registrar dyalek (fin chriti l domain) → DNS settings
5. Zid les records li 3tak Vercel
6. Stenna 5-30 dqayeq → l domain ghadi y-link automatiquement m3a HTTPS

---

## 🔄 Bach tbeddel chi 7aja men ba3d

Kol mra t-modifii fichier:

```bash
git add .
git commit -m "Wsf l bidalat"
git push
```

Vercel kay-redeploy automatiquement f ~30 thaniya. ✨

---

## 🔧 Troubleshooting

**Form kay-jib error "ماشي صحيح"**
→ Vérifi l numéro: khass ybda b `0` ola `+212`, w ykoun 10 chiffres total.

**Lead ma kay-zad f Sheet**
→ F Vercel → Project → **Logs**, chuf wach kayn error.
→ Vérifi l env var `SHEETS_WEBHOOK_URL` — khass tkun bla espaces.
→ Vérifi Apps Script: **Deploy → Manage deployments** w 3awd test l URL f browser.

**3awdt deploy l Apps Script o l URL bdelat**
→ Ghir update `SHEETS_WEBHOOK_URL` f Vercel → Settings → Environment Variables → Edit → save → Redeploy.

---

## 💰 Total tkalfa

| Element | Thaman |
|---|---|
| Hébergement (Vercel) | **0 DH** (free hobby plan) |
| Storage leads (Google Sheets) | **0 DH** |
| Apps Script | **0 DH** |
| Domain `.com` | ~150 DH/sana |
| Domain `.ma` | ~250 DH/sana |
| **Total mensuel** | **0 DH/chhar** ✨ |

---

## 🔒 Sécurité

- Honeypot anti-bot ✓
- Validation côté serveur (Vercel function) ✓
- HTTPS automatique ✓
- Apps Script URL: ma kayexposach men frontend (mahbous f env var)
- Google Sheet privée: ghir t li 3andek access dyal compte
