import { clean, validPhone, forwardToSheets, readBody } from './_lib.js';
import { hashPin, signToken } from './_auth.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ ok: false, message: 'Method not allowed' });
    }

    const body = readBody(req);
    const tel = clean(body.tel, 20);
    const pin = clean(body.pin, 10);

    if (!validPhone(tel) || !/^[0-9]{4,6}$/.test(pin)) {
        return res.status(400).json({ ok: false, message: 'بيانات غير صحيحة. / Identifiants invalides.' });
    }

    const phoneNormalized = tel.replace(/\s+/g, '');
    const pinHash = hashPin(pin);

    const sheetResult = await forwardToSheets({
        kind: 'affiliate_login',
        tel: phoneNormalized,
        pin_hash: pinHash,
    });

    if (!sheetResult.ok) {
        return res.status(500).json({ ok: false, message: 'خطأ ف السرفير. / Erreur serveur.' });
    }

    let parsed = {};
    try { parsed = JSON.parse(sheetResult.body); } catch {}

    if (!parsed || !parsed.ok) {
        return res.status(401).json({ ok: false, message: 'رقم أو PIN غلط. / Tel ou PIN incorrect.' });
    }

    const affiliateId = parsed.affiliate_id || phoneNormalized;
    const token = signToken(affiliateId);
    return res.status(200).json({
        ok: true,
        token,
        affiliate: {
            id: affiliateId,
            nom: parsed.nom || '',
            ville: parsed.ville || '',
        },
    });
}
