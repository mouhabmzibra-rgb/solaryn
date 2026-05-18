// POST /api/add-lead — prepend a WhatsApp lead row at the top of the Solaryn
// Google Sheet (row 2, just under header) via Composio API. Dedupes by phone
// (reads column B first). Also serves a simple HTML form on GET (bookmark on
// phone home screen).
// Body: { phone, name?, message?, city?, address?, notes? }
// JSON or x-www-form-urlencoded both accepted.

const COMPOSIO_API = 'https://backend.composio.dev/api/v3';
const SHEET_ID = process.env.LEADS_SHEET_ID || '1uyItM4b7XLPbo2xgTbOrS99MWEz6Ls16MKtVBb1F6hA';
const COMPOSIO_KEY = process.env.COMPOSIO_API_KEY || 'ak_R9c7r97htFBcxtnsCASU';
const COMPOSIO_ACCOUNT_ID = process.env.COMPOSIO_ACCOUNT_ID || 'ca_x66oW70jpGO6';
const COMPOSIO_USER_ID = process.env.COMPOSIO_USER_ID || 'solaryn-default';
const SHEET_NAME = "'Feuille 1'";

function setCors(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function normalizePhoneMA(raw) {
    let p = String(raw || '').replace(/[\s()-]/g, '').trim();
    if (!p) return null;
    if (p.startsWith('00')) p = '+' + p.slice(2);
    if (/^0\d{9}$/.test(p)) p = '+212' + p.slice(1);
    if (/^212\d{9}$/.test(p)) p = '+' + p;
    if (!p.startsWith('+')) p = '+212' + p;
    if (!/^\+212\d{9}$/.test(p)) return null;
    return p;
}

async function callComposio(toolSlug, args) {
    const res = await fetch(`${COMPOSIO_API}/tools/execute/${toolSlug}`, {
        method: 'POST',
        headers: {
            'x-api-key': COMPOSIO_KEY,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            user_id: COMPOSIO_USER_ID,
            connected_account_id: COMPOSIO_ACCOUNT_ID,
            arguments: args,
        }),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`Composio ${toolSlug} ${res.status}: ${text.slice(0, 300)}`);
    return JSON.parse(text);
}

async function findDuplicateRow(phone) {
    const resp = await callComposio('GOOGLESHEETS_BATCH_GET', {
        spreadsheet_id: SHEET_ID,
        ranges: [`${SHEET_NAME}!B2:B500`],
        valueRenderOption: 'FORMATTED_VALUE',
    });
    const rows = resp?.data?.valueRanges?.[0]?.values || [];
    const phoneDigits = phone.replace(/[^\d]/g, '');
    for (let i = 0; i < rows.length; i++) {
        const cell = String(rows[i]?.[0] || '');
        if (!cell || cell === '#ERROR!') continue;
        const cellDigits = cell.replace(/[^\d]/g, '');
        if (!cellDigits) continue;
        if (cellDigits === phoneDigits || cellDigits.endsWith(phoneDigits.slice(-9))) {
            return i + 2;
        }
    }
    return null;
}

async function prependLeadRow(lead) {
    // New leads go to row 2 (just under header), so the most recent is always visible at top.
    // 1) Insert a blank row at row index 1 (= sheet row 2), pushing existing rows down.
    // 2) Write A2:N2 with the lead data + HYPERLINK formulas for upload/WhatsApp/Call.
    // Phone is prefixed with "'" so '+212...' is stored as text (not parsed as a formula).
    // French locale: use ';' as HYPERLINK arg separator, not ','.
    const now = new Date().toLocaleString('fr-FR', { timeZone: 'Africa/Casablanca' });
    const message = (lead.message || '').slice(0, 300);
    const phoneNoPlus = lead.phone.replace(/^\+/, '');
    const uploadLink = `=HYPERLINK("https://solaryn-five.vercel.app/api/upload-audio?phone=${encodeURIComponent(lead.phone)}";"📤 Uploader")`;
    const waLink = `=HYPERLINK("https://wa.me/${phoneNoPlus}";"💬 WhatsApp")`;
    const callLink = `=HYPERLINK("tel:${lead.phone}";"📞 Call")`;

    await callComposio('GOOGLESHEETS_INSERT_DIMENSION', {
        spreadsheet_id: SHEET_ID,
        insert_dimension: {
            range: { sheet_id: 0, dimension: 'ROWS', start_index: 1, end_index: 2 },
            inherit_from_before: false,
        },
    });

    await callComposio('GOOGLESHEETS_UPDATE_VALUES_BATCH', {
        spreadsheet_id: SHEET_ID,
        valueInputOption: 'USER_ENTERED',
        data: [{
            range: `${SHEET_NAME}!A2:N2`,
            majorDimension: 'ROWS',
            values: [[
                now,                              // A: Date
                "'" + lead.phone,                 // B: Téléphone (text)
                message,                          // C: Dernier WhatsApp
                false,                            // D: Commandé?
                lead.name || '',                  // E: Prénom
                lead.city || '',                  // F: Ville
                lead.address || '',               // G: Adresse expédition
                lead.notes || '🟢 Solaryn lead',  // H: Notes
                false,                            // I: Appelé?
                message,                          // J: Message client
                '',                               // K: Audio appel
                uploadLink,                       // L: Upload audio
                waLink,                           // M: WhatsApp
                callLink,                         // N: Call
            ]],
        }],
    });
}

function htmlForm(banner = '') {
    return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Solaryn — Add Lead</title><style>*{box-sizing:border-box}body{margin:0;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;background:#FFFAF0;min-height:100vh;display:grid;place-items:center;padding:20px;color:#1B2D4D}.card{background:#fff;border-radius:18px;padding:28px 22px;max-width:380px;width:100%;box-shadow:0 12px 32px rgba(27,45,77,.12)}h1{margin:0 0 6px;font-size:22px;text-align:center}.sub{margin:0 0 18px;color:#64748b;font-size:13px;text-align:center}label{display:block;font-size:13px;font-weight:700;margin-top:12px;color:#475569}input,textarea,button{width:100%;font-size:16px;padding:13px 14px;border-radius:12px;border:2px solid #e2e8f0;margin-top:6px;box-sizing:border-box;font-family:inherit}input:focus,textarea:focus{outline:none;border-color:#FBC32B;box-shadow:0 0 0 3px rgba(251,195,43,.18)}button{background:#25D366;color:#fff;border:none;font-weight:800;cursor:pointer;letter-spacing:.02em;margin-top:18px;font-size:17px}button:hover{background:#1ebf5b}button:disabled{opacity:.6;cursor:not-allowed}.ok{background:#dcfce7;color:#166534;padding:12px;border-radius:10px;font-size:14px;margin-bottom:14px;text-align:center}.err{background:#fee2e2;color:#991b1b;padding:12px;border-radius:10px;font-size:14px;margin-bottom:14px;text-align:center}.sheet{display:block;text-align:center;margin-top:14px;font-size:13px;color:#1B2D4D}</style></head><body><div class="card"><h1>📋 Solaryn Lead</h1><p class="sub">Ajouter un lead WhatsApp au sheet</p>${banner}<form method="POST" action="/api/add-lead"><label for="phone">📞 Téléphone</label><input type="tel" name="phone" id="phone" placeholder="06XXXXXXXX" required autofocus inputmode="tel" autocomplete="tel"><label for="name">👤 Prénom</label><input type="text" name="name" id="name" placeholder="Optionnel"><label for="message">💬 Message</label><textarea name="message" id="message" rows="2" placeholder="Optionnel — ce que le client a écrit"></textarea><button type="submit">➕ Ajouter au sheet</button></form><a class="sheet" href="https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit" target="_blank">📊 Voir le sheet</a></div></body></html>`;
}

export default async function handler(req, res) {
    setCors(res);
    if (req.method === 'OPTIONS') return res.status(204).end();

    if (req.method === 'GET' || req.method === 'HEAD') {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.status(200).send(req.method === 'HEAD' ? '' : htmlForm());
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ ok: false, error: 'Method not allowed' });
    }

    // Parse body (Vercel auto-parses JSON; for form-urlencoded also auto-parses)
    let body = req.body;
    if (typeof body === 'string') {
        try { body = JSON.parse(body); }
        catch { body = Object.fromEntries(new URLSearchParams(body)); }
    }
    body = body || {};

    const isForm = (req.headers['content-type'] || '').includes('form');
    const phone = normalizePhoneMA(body.phone);

    if (!phone) {
        if (isForm) {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            return res.status(400).send(htmlForm('<div class="err">❌ Numéro marocain invalide (ex: 0612345678)</div>'));
        }
        return res.status(400).json({ ok: false, error: 'Invalid Moroccan phone number' });
    }

    try {
        const dupRow = await findDuplicateRow(phone);
        if (dupRow) {
            if (isForm) {
                res.setHeader('Content-Type', 'text/html; charset=utf-8');
                return res.status(200).send(htmlForm(`<div class="err">⚠️ Ce numéro existe déjà (ligne ${dupRow})</div>`));
            }
            return res.status(200).json({ ok: true, skipped: true, existingRow: dupRow });
        }

        await prependLeadRow({
            phone,
            name: body.name || '',
            message: body.message || '',
            city: body.city || '',
            address: body.address || '',
            notes: body.notes || '',
        });

        if (isForm) {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            return res.status(200).send(htmlForm(`<div class="ok">✅ Lead <strong>${phone}</strong> ajouté</div>`));
        }
        return res.status(200).json({ ok: true, phone });
    } catch (err) {
        console.error('add_lead_error', err.message);
        if (isForm) {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            return res.status(500).send(htmlForm(`<div class="err">❌ Erreur: ${err.message.slice(0, 200)}</div>`));
        }
        return res.status(500).json({ ok: false, error: err.message });
    }
}
