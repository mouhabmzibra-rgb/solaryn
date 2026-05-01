import { clean, validPhone, validEmail, clientIp, forwardToSheets, readBody } from './_lib.js';

const VALID_TYPES = ['pharmacie', 'parapharmacie', 'cosmetique', 'grossiste', 'influenceur', 'autre'];
const VALID_QUANTITES = ['10-50', '50-100', '100-500', '500+'];

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ ok: false, message: 'Method not allowed' });
    }

    const body = readBody(req);

    if (body.website) {
        return res.status(200).json({ ok: true, message: 'تم.' });
    }

    const nom = clean(body.nom, 100);
    const tel = clean(body.tel, 20);
    const email = clean(body.email, 120);
    const type = clean(body.type, 30);
    const ville = clean(body.ville, 80);
    const quantite = clean(body.quantite, 20);
    const message = clean(body.message, 500);

    const errors = [];
    if (nom.length < 2) errors.push('الاسم قصير بزاف.');
    if (!validPhone(tel)) errors.push('رقم الهاتف ماشي صحيح.');
    if (!validEmail(email)) errors.push('البريد الإلكتروني ماشي صحيح.');
    if (!VALID_TYPES.includes(type)) errors.push('نوع النشاط مطلوب.');
    if (ville.length < 2) errors.push('المدينة مطلوبة.');
    if (!VALID_QUANTITES.includes(quantite)) errors.push('الكمية مطلوبة.');

    if (errors.length) {
        return res.status(400).json({ ok: false, message: errors.join(' ') });
    }

    await forwardToSheets({
        kind: 'bulk',
        date: new Date().toISOString(),
        nom,
        tel: tel.replace(/\s+/g, ''),
        email,
        type_activite: type,
        ville,
        quantite,
        message,
        ip: clientIp(req),
        ua: clean(req.headers['user-agent'] || '', 200),
    });

    return res.status(200).json({
        ok: true,
        message: 'شكرا ! توصلنا بطلب عرض السعر. غادي نتواصلو معاك قريب بالتفاصيل والأسعار الخاصة.',
    });
}
