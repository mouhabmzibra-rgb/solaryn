# Solaryn — Site web

Lead-gen site (Arabe / Darija, RTL) pour la crème solaire **Solaryn SPF 50** (marché Maroc).

**Stack:** HTML/CSS/JS statique + Vercel Serverless Functions (Node.js) + Google Sheets pour le stockage des leads.

## Structure

```
solaryn/
├── index.html              # Landing page
├── css/style.css           # Styles
├── js/script.js            # Validation + AJAX
├── api/
│   ├── _lib.js             # Helpers (validation, Sheets webhook)
│   ├── submit.js           # Endpoint commandes clients
│   └── bulk.js             # Endpoint commandes en gros
├── assets/images/          # Logo + photos produit
├── google-apps-script.gs   # À coller dans Google Apps Script
├── vercel.json             # Config Vercel
├── package.json            # Node ES modules
└── DEPLOY.md               # Guide de déploiement complet
```

## Quick start

Pour déployer le site, suivre **[DEPLOY.md](./DEPLOY.md)**.

Résumé:
1. Créer un Google Sheet, coller `google-apps-script.gs` dans Apps Script, déployer en Web App
2. Push le code sur GitHub
3. Importer le repo dans Vercel, ajouter `SHEETS_WEBHOOK_URL` dans les env vars
4. Deploy

## Test local (optionnel)

```bash
npm i -g vercel
vercel dev
```

Puis ouvrir http://localhost:3000

Si tu veux tester sans Vercel CLI, n'importe quel serveur statique marche pour la partie front (mais les forms ne pourront pas valider). Exemple :

```bash
python3 -m http.server 8000
```

## Coût

**0 DH/mois** — Vercel hobby plan gratuit + Google Sheets gratuit.
Seul coût : domain (~150-250 DH/an).
