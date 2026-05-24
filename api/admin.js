import { clean, readBody } from './_lib.js';
import { signToken, verifyToken, bearerToken } from './_auth.js';
import { readAdminData, updateSaleStatus, toggleAffiliateStatus, setTrackingUrl } from './_sheets.js';

const ADMIN_ID = 'admin';
const VALID_STATUSES = ['pending', 'confirmed', 'delivered', 'paid', 'cancelled'];
const VALID_AFF_STATUSES = ['active', 'disabled'];
const MAX_URL_LEN = 1000;

function isAdminSession(req) {
    const s = verifyToken(bearerToken(req));
    return s && s.affiliateId === ADMIN_ID;
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ ok: false, message: 'Method not allowed' });
    }

    const body = readBody(req);
    const action = clean(body.action, 40);

    if (action === 'login') {
        const pwd = clean(body.password, 200);
        const expected = process.env.ADMIN_PASSWORD || '';
        if (!expected) {
            return res.status(500).json({ ok: false, message: 'ADMIN_PASSWORD env var not set' });
        }
        if (pwd !== expected) {
            return res.status(401).json({ ok: false, message: 'Mot de passe incorrect' });
        }
        const token = signToken(ADMIN_ID, 24 * 7);
        return res.status(200).json({ ok: true, token });
    }

    if (!isAdminSession(req)) {
        return res.status(401).json({ ok: false, message: 'Session expirée' });
    }

    try {
        if (action === 'data') {
            const data = await readAdminData();
            return res.status(200).json({ ok: true, ...data });
        }

        if (action === 'update_sale') {
            const saleId = clean(body.sale_id, 100);
            const status = clean(body.status, 20);
            if (!saleId) return res.status(400).json({ ok: false, message: 'sale_id requis' });
            if (!VALID_STATUSES.includes(status)) return res.status(400).json({ ok: false, message: 'status invalide' });
            const r = await updateSaleStatus(saleId, status);
            if (!r.ok) return res.status(404).json({ ok: false, message: 'Vente introuvable' });
            return res.status(200).json({ ok: true });
        }

        if (action === 'toggle_affiliate') {
            const phone = clean(body.affiliate_phone, 20);
            const status = clean(body.status, 20);
            if (!phone) return res.status(400).json({ ok: false, message: 'affiliate_phone requis' });
            if (!VALID_AFF_STATUSES.includes(status)) return res.status(400).json({ ok: false, message: 'status invalide' });
            const r = await toggleAffiliateStatus(phone, status);
            if (!r.ok) return res.status(404).json({ ok: false, message: 'Affiliée introuvable' });
            return res.status(200).json({ ok: true });
        }

        if (action === 'set_tracking') {
            const saleId = clean(body.sale_id, 100);
            const rawUrl = clean(body.tracking_url, MAX_URL_LEN);
            if (!saleId) return res.status(400).json({ ok: false, message: 'sale_id requis' });
            let url = '';
            if (rawUrl) {
                if (!/^https?:\/\//i.test(rawUrl)) {
                    return res.status(400).json({ ok: false, message: 'URL doit commencer par http:// ou https://' });
                }
                url = rawUrl;
            }
            const r = await setTrackingUrl(saleId, url);
            if (!r.ok) return res.status(404).json({ ok: false, message: 'Vente introuvable' });
            return res.status(200).json({ ok: true, tracking_url: r.url });
        }

        return res.status(400).json({ ok: false, message: 'action inconnue' });
    } catch (err) {
        return res.status(500).json({ ok: false, message: 'Erreur: ' + (err.message || 'inconnue') });
    }
}
