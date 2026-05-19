import { verifyToken, bearerToken } from './_auth.js';
import { getAffiliateDashboard, updateLastActive } from './_sheets.js';

export default async function handler(req, res) {
    if (req.method !== 'GET' && req.method !== 'POST') {
        res.setHeader('Allow', 'GET, POST');
        return res.status(405).json({ ok: false, message: 'Method not allowed' });
    }

    const session = verifyToken(bearerToken(req));
    if (!session) {
        return res.status(401).json({ ok: false, message: 'الجلسة انتهات. / Session expirée.' });
    }

    try {
        const r = await getAffiliateDashboard(session.affiliateId);
        if (!r.ok) {
            return res.status(404).json({ ok: false, message: 'الحساب ماشي موجود. / Compte introuvable.' });
        }
        updateLastActive(session.affiliateId).catch(() => {});
        return res.status(200).json({
            ok: true,
            affiliate: r.affiliate,
            sales: r.sales,
            stats: r.stats,
        });
    } catch (err) {
        return res.status(500).json({ ok: false, message: 'خطأ ف الجلب. / Erreur: ' + (err.message || 'inconnue') });
    }
}
