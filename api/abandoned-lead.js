import { clean, validPhone, clientIp, readBody } from './_lib.js';

// Hardcoded — points to the redeployed Apps Script that knows kind=abandoned.
// (Bypasses SHEETS_WEBHOOK_URL env var which still targets the old deployment.)
const ABANDONED_WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbx0fKlThu1rj35H2ekIVP6HllnPrxxzlQXV2aNnZnIGzJDKVgdzat-mBfW1iDwEPZt_4Q/exec';

async function forwardToAbandonedSheet(payload) {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        const res = await fetch(ABANDONED_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal,
            redirect: 'follow',
        });
        clearTimeout(timeout);
        const text = await res.text().catch(() => '');
        if (!res.ok) return { ok: false, status: res.status, body: text.slice(0, 200) };
        return { ok: true, body: text.slice(0, 200) };
    } catch (err) {
        return { ok: false, error: err.message };
    }
}

async function notifyTelegram(text) {
    const tgToken = process.env.TELEGRAM_BOT_TOKEN || '8719409348:AAGob_39mSvd1NeYo6LhLZXZ-Tu7_ur6ccI';
    const tgChat = process.env.TELEGRAM_CHAT_ID || '8113442719';
    if (!tgToken || !tgChat) return;
    try {
        await fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: tgChat,
                text,
                parse_mode: 'HTML',
                disable_web_page_preview: true,
            }),
        });
    } catch { /* ignore */ }
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
    }
    if (req.method !== 'POST') {
        res.status(405).json({ ok: false, error: 'Method not allowed' });
        return;
    }

    const body = readBody(req);
    const tel = clean(body.phone || body.tel, 20).replace(/\s+/g, '');
    const ville = clean(body.city || body.ville, 80) || 'Non renseignée';
    const page = clean(body.page, 200);

    if (!validPhone(tel)) {
        return res.status(400).json({ ok: false, error: 'Invalid phone' });
    }

    const cleanTel = tel.startsWith('+212') ? '0' + tel.slice(4) : tel;
    const intlTel = tel.startsWith('+212') ? tel : ('+212' + tel.slice(1));
    const waNum = intlTel.replace('+', '');

    const sheetsResult = await forwardToAbandonedSheet({
        kind: 'abandoned',
        date: new Date().toISOString(),
        tel: cleanTel,
        ville,
        page,
        ip: clientIp(req),
        ua: clean(req.headers['user-agent'] || '', 200),
    });

    notifyTelegram(
        `⚠️ <b>LEAD ABANDONNÉ</b>\n` +
        `\n📱 <b>${cleanTel}</b>\n` +
        `📍 ${ville}\n` +
        `\nA tapé son numéro mais n'a pas validé.\nÀ rappeler rapidement.\n\n` +
        `📞 <a href="tel:${intlTel}">Appeler</a>\n` +
        `💬 <a href="https://wa.me/${waNum}">WhatsApp</a>`
    ).catch(() => {});

    return res.status(200).json({ ok: true, sheets: sheetsResult });
}
