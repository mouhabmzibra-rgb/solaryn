import { clean, validPhone, clientIp, forwardToSheets, readBody } from './_lib.js';

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
    const ville = clean(body.ville, 80);
    const quantite = clean(body.quantite, 5);
    const message = clean(body.message, 500);

    const errors = [];
    if (nom.length < 2) errors.push('الاسم قصير بزاف.');
    if (!validPhone(tel)) errors.push('رقم الهاتف ماشي صحيح.');
    if (ville.length < 2) errors.push('المدينة مطلوبة.');

    if (errors.length) {
        return res.status(400).json({ ok: false, message: errors.join(' ') });
    }

    const validQty = ['1', '2', '3'].includes(quantite) ? quantite : '1';

    const sheetsResult = await forwardToSheets({
        kind: 'lead',
        date: new Date().toISOString(),
        nom,
        tel: tel.replace(/\s+/g, ''),
        ville,
        quantite: validQty,
        message,
        ip: clientIp(req),
        ua: clean(req.headers['user-agent'] || '', 200),
    });

    const debug = req.query?.debug === '1' || (typeof req.url === 'string' && req.url.includes('debug=1'));

    return res.status(200).json({
        ok: true,
        message: `شكرا ${nom} ! توصلنا بطلبيتك. غادي نعيطو ليك في أقرب وقت لتأكيد الطلبية.`,
        sheets: sheetsResult,
        version: 'v3',
    });
}
