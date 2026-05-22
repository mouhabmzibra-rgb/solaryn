import { clean, validPhone, clientIp, forwardToSheets, readBody } from './_lib.js';
import { verifyToken, bearerToken } from './_auth.js';

// 4 niveaux de prix — l'affiliée choisit selon profil client
// customer_pays = ce que le client paie au total (shipping inclus dans le chiffre)
const PRICE_TIERS = {
    A: { customer_pays: 199, commission: 50, label: '199 (livraison incluse)' },
    B: { customer_pays: 170, commission: 35, label: '150 + 20 livraison' },
    C: { customer_pays: 150, commission: 30, label: '150 (livraison incluse)' },
    D: { customer_pays: 140, commission: 20, label: '120 + 20 livraison' },
};

const LEGACY_TIER = 'A'; // pour ventes sans tier (backward compat)

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ ok: false, message: 'Method not allowed' });
    }

    const session = verifyToken(bearerToken(req));
    if (!session) {
        return res.status(401).json({ ok: false, message: 'الجلسة انتهات، دخلي من جديد. / Session expirée, reconnecte-toi.' });
    }

    const body = readBody(req);
    if (body.website) return res.status(200).json({ ok: true });

    const customerNom = clean(body.customer_nom, 100);
    const customerTel = clean(body.customer_tel, 20);
    const customerVille = clean(body.customer_ville, 80);
    const customerAdresse = clean(body.customer_adresse, 200);
    const quantite = clean(body.quantite, 5);
    const notes = clean(body.notes, 500);
    const priceTierRaw = clean(body.price_tier, 1).toUpperCase() || LEGACY_TIER;

    const errors = [];
    if (customerNom.length < 2) errors.push('سمية الزبون مطلوبة. / Nom client requis.');
    if (!validPhone(customerTel)) errors.push('رقم الزبون ماشي صحيح. / Tel client invalide.');
    if (customerVille.length < 2) errors.push('مدينة الزبون مطلوبة. / Ville requise.');

    const qty = parseInt(quantite, 10);
    if (!(qty >= 1 && qty <= 50)) errors.push('الكمية ماشي صحيحة (1-50). / Quantité invalide (1-50).');

    const tier = PRICE_TIERS[priceTierRaw];
    if (!tier) errors.push('Tier de prix invalide (A/B/C/D).');

    if (errors.length) {
        return res.status(400).json({ ok: false, message: errors.join(' ') });
    }

    const total = qty * tier.customer_pays;
    const commission = qty * tier.commission;

    const sheetResult = await forwardToSheets({
        kind: 'affiliate_sale',
        date: new Date().toISOString(),
        affiliate_id: session.affiliateId,
        customer_nom: customerNom,
        customer_tel: customerTel.replace(/\s+/g, ''),
        customer_ville: customerVille,
        customer_adresse: customerAdresse,
        quantite: qty,
        total,
        commission,
        price_tier: priceTierRaw,
        notes,
        status: 'pending',
        ip: clientIp(req),
    });

    if (!sheetResult.ok) {
        return res.status(500).json({ ok: false, message: 'خطأ ف التسجيل. / Erreur d\'enregistrement.' });
    }

    let parsed = {};
    try { parsed = JSON.parse(sheetResult.body); } catch {}

    return res.status(200).json({
        ok: true,
        message: 'تسجلات البيعة 🎉 / Vente enregistrée 🎉',
        sale_id: parsed.sale_id || null,
        commission,
        total,
        price_tier: priceTierRaw,
    });
}
