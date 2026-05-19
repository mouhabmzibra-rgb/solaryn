import { clean, forwardToSheets, readBody } from './_lib.js';
import { signToken, verifyToken, bearerToken } from './_auth.js';

const ADMIN_ID = 'admin';
const VALID_STATUSES = ['pending', 'confirmed', 'delivered', 'paid', 'cancelled'];
const VALID_AFF_STATUSES = ['active', 'disabled'];

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

    // ── LOGIN ──────────────────────────────
    if (action === 'login') {
        const pwd = clean(body.password, 200);
        const expected = process.env.ADMIN_PASSWORD || '';
        if (!expected) {
            return res.status(500).json({ ok: false, message: 'ADMIN_PASSWORD env var not set' });
        }
        if (pwd !== expected) {
            return res.status(401).json({ ok: false, message: 'Mot de passe incorrect' });
        }
        const token = signToken(ADMIN_ID, 24 * 7); // 7 days
        return res.status(200).json({ ok: true, token });
    }

    // ── EVERYTHING ELSE NEEDS AUTH ─────────
    if (!isAdminSession(req)) {
        return res.status(401).json({ ok: false, message: 'Session expirée' });
    }

    // ── FETCH ALL DATA ─────────────────────
    if (action === 'data') {
        const r = await forwardToSheets({ kind: 'admin_data' });
        if (!r.ok) return res.status(500).json({ ok: false, message: 'Erreur webhook' });
        try {
            const parsed = JSON.parse(r.body);
            if (!parsed.ok) return res.status(500).json({ ok: false, message: 'Erreur lecture' });
            return res.status(200).json({
                ok: true,
                affiliates: parsed.affiliates || [],
                sales: parsed.sales || [],
                stats: parsed.stats || {},
            });
        } catch (e) {
            return res.status(500).json({ ok: false, message: 'Erreur parsing' });
        }
    }

    // ── UPDATE SALE STATUS ─────────────────
    if (action === 'update_sale') {
        const saleId = clean(body.sale_id, 100);
        const status = clean(body.status, 20);
        if (!saleId) return res.status(400).json({ ok: false, message: 'sale_id requis' });
        if (!VALID_STATUSES.includes(status)) return res.status(400).json({ ok: false, message: 'status invalide' });
        const r = await forwardToSheets({ kind: 'admin_update_sale', sale_id: saleId, status });
        if (!r.ok) return res.status(500).json({ ok: false, message: 'Erreur webhook' });
        try {
            const parsed = JSON.parse(r.body);
            if (!parsed.ok) return res.status(404).json({ ok: false, message: 'Vente introuvable' });
            return res.status(200).json({ ok: true });
        } catch (e) {
            return res.status(500).json({ ok: false, message: 'Erreur' });
        }
    }

    // ── TOGGLE AFFILIATE STATUS ────────────
    if (action === 'toggle_affiliate') {
        const phone = clean(body.affiliate_phone, 20);
        const status = clean(body.status, 20);
        if (!phone) return res.status(400).json({ ok: false, message: 'affiliate_phone requis' });
        if (!VALID_AFF_STATUSES.includes(status)) return res.status(400).json({ ok: false, message: 'status invalide' });
        const r = await forwardToSheets({ kind: 'admin_toggle_affiliate', affiliate_phone: phone, status });
        if (!r.ok) return res.status(500).json({ ok: false, message: 'Erreur webhook' });
        try {
            const parsed = JSON.parse(r.body);
            if (!parsed.ok) return res.status(404).json({ ok: false, message: 'Affiliée introuvable' });
            return res.status(200).json({ ok: true });
        } catch (e) {
            return res.status(500).json({ ok: false, message: 'Erreur' });
        }
    }

    return res.status(400).json({ ok: false, message: 'action inconnue' });
}
