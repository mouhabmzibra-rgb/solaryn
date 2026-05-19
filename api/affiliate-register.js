import { clean, validPhone, clientIp, forwardToSheets, readBody } from './_lib.js';
import { hashPin, signToken } from './_auth.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ ok: false, message: 'Method not allowed' });
    }

    const body = readBody(req);
    if (body.website) return res.status(200).json({ ok: true });

    const nom = clean(body.nom, 100);
    const tel = clean(body.tel, 20);
    const ville = clean(body.ville, 80);
    const pin = clean(body.pin, 10);

    const errors = [];
    if (nom.length < 2) errors.push('الاسم قصير. / Nom trop court.');
    if (!validPhone(tel)) errors.push('رقم الهاتف ماشي صحيح. / Numéro invalide.');
    if (ville.length < 2) errors.push('المدينة مطلوبة. / Ville requise.');
    if (!/^[0-9]{4,6}$/.test(pin)) errors.push('PIN خاصو من 4 ل 6 أرقام. / PIN entre 4 et 6 chiffres.');

    if (errors.length) {
        return res.status(400).json({ ok: false, message: errors.join(' ') });
    }

    const phoneNormalized = tel.replace(/\s+/g, '');
    const pinHash = hashPin(pin);

    const sheetResult = await forwardToSheets({
        kind: 'affiliate_register',
        date: new Date().toISOString(),
        nom,
        tel: phoneNormalized,
        ville,
        pin_hash: pinHash,
        ip: clientIp(req),
        ua: clean(req.headers['user-agent'] || '', 200),
    });

    if (!sheetResult.ok) {
        return res.status(500).json({ ok: false, message: 'خطأ ف السرفير. / Erreur serveur.' });
    }

    let parsed = {};
    try { parsed = JSON.parse(sheetResult.body); } catch {}

    if (parsed && parsed.error === 'phone_exists') {
        return res.status(409).json({ ok: false, message: 'هاد الرقم مسجل من قبل، دخلي بPIN. / Numéro déjà inscrit, connecte-toi.' });
    }

    if (!parsed || !parsed.ok) {
        return res.status(500).json({ ok: false, message: 'خطأ ف التسجيل. / Erreur d\'inscription.' });
    }

    const affiliateId = parsed.affiliate_id || phoneNormalized;
    const token = signToken(affiliateId);

    return res.status(200).json({
        ok: true,
        message: 'مرحبا بيك ف Solaryn 🌞 / Bienvenue chez Solaryn 🌞',
        token,
        affiliate: { id: affiliateId, nom, tel: phoneNormalized, ville },
    });
}
