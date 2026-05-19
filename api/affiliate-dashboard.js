import { forwardToSheets } from './_lib.js';
import { verifyToken, bearerToken } from './_auth.js';

export default async function handler(req, res) {
    if (req.method !== 'GET' && req.method !== 'POST') {
        res.setHeader('Allow', 'GET, POST');
        return res.status(405).json({ ok: false, message: 'Method not allowed' });
    }

    const session = verifyToken(bearerToken(req));
    if (!session) {
        return res.status(401).json({ ok: false, message: 'الجلسة انتهات. / Session expirée.' });
    }

    const sheetResult = await forwardToSheets({
        kind: 'affiliate_dashboard',
        affiliate_id: session.affiliateId,
    });

    if (!sheetResult.ok) {
        return res.status(500).json({ ok: false, message: 'خطأ ف السرفير. / Erreur serveur.' });
    }

    let parsed = {};
    try { parsed = JSON.parse(sheetResult.body); } catch {}

    if (!parsed || !parsed.ok) {
        return res.status(500).json({ ok: false, message: 'خطأ ف الجلب. / Erreur de chargement.' });
    }

    return res.status(200).json({
        ok: true,
        affiliate: parsed.affiliate || { id: session.affiliateId },
        sales: parsed.sales || [],
        stats: parsed.stats || { count: 0, total_mad: 0, commission_mad: 0, commission_paid: 0, commission_pending: 0 },
    });
}
