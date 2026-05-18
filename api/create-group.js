// GET /api/create-group?phone=+212XXXXXXXXX
// Triggered by clicking "➕ Créer groupe" in column O of the sheet.
// Looks up the row by phone, calls the Baileys bot to create a 3-way group
// [user, lead, assistant], then updates column O of that row with the invite link.
// Shows an HTML confirmation page in the browser.

const COMPOSIO_API = 'https://backend.composio.dev/api/v3';
const SHEET_ID = process.env.LEADS_SHEET_ID || '1uyItM4b7XLPbo2xgTbOrS99MWEz6Ls16MKtVBb1F6hA';
const COMPOSIO_KEY = process.env.COMPOSIO_API_KEY || 'ak_R9c7r97htFBcxtnsCASU';
const COMPOSIO_ACCOUNT_ID = process.env.COMPOSIO_ACCOUNT_ID || 'ca_x66oW70jpGO6';
const COMPOSIO_USER_ID = process.env.COMPOSIO_USER_ID || 'solaryn-default';
const SHEET_NAME = "'Feuille 1'";

const BOT_URL = process.env.BOT_URL || '';
const BOT_TOKEN = process.env.BOT_TOKEN || '';
const ASSISTANT_WHATSAPP = process.env.ASSISTANT_WHATSAPP || '+212626168410';

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
        headers: { 'x-api-key': COMPOSIO_KEY, 'Content-Type': 'application/json' },
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

async function findRowByPhone(phone) {
    const resp = await callComposio('GOOGLESHEETS_BATCH_GET', {
        spreadsheet_id: SHEET_ID,
        ranges: [`${SHEET_NAME}!B2:E500`],
        valueRenderOption: 'FORMATTED_VALUE',
    });
    const rows = resp?.data?.valueRanges?.[0]?.values || [];
    const phoneDigits = phone.replace(/[^\d]/g, '');
    for (let i = 0; i < rows.length; i++) {
        const cell = String(rows[i]?.[0] || '');
        const cellDigits = cell.replace(/[^\d]/g, '');
        if (!cellDigits) continue;
        if (cellDigits === phoneDigits || cellDigits.endsWith(phoneDigits.slice(-9))) {
            return { row: i + 2, name: String(rows[i]?.[3] || '') };
        }
    }
    return null;
}

async function createGroup(phone, name) {
    const res = await fetch(`${BOT_URL}/create-group`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${BOT_TOKEN}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            groupName: `Solaryn — ${name || phone}`,
            members: [phone, ASSISTANT_WHATSAPP],
        }),
        signal: AbortSignal.timeout(25000),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`Bot ${res.status}: ${text.slice(0, 200)}`);
    const data = JSON.parse(text);
    if (!data.ok) throw new Error(data.error || 'Bot returned not-ok');
    return data;
}

async function updateColumnO(row, inviteLink) {
    const formula = `=HYPERLINK("${inviteLink}";"👥 Groupe")`;
    await callComposio('GOOGLESHEETS_BATCH_UPDATE', {
        spreadsheet_id: SHEET_ID,
        sheet_name: 'Feuille 1',
        first_cell_location: `O${row}`,
        value_input_option: 'USER_ENTERED',
        values: [[formula]],
    });
}

function htmlPage({ title, body, color = '#1B2D4D' }) {
    return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>*{box-sizing:border-box}body{margin:0;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;background:#FFFAF0;min-height:100vh;display:grid;place-items:center;padding:20px;color:#1B2D4D}.card{background:#fff;border-radius:18px;padding:32px 24px;max-width:420px;width:100%;text-align:center;box-shadow:0 12px 32px rgba(27,45,77,.12)}h1{margin:0 0 12px;font-size:22px;color:${color}}p{margin:8px 0;color:#475569;line-height:1.5}.btn{display:inline-block;margin-top:18px;padding:14px 22px;background:#25D366;color:#fff;text-decoration:none;border-radius:12px;font-weight:700;font-size:16px}.btn:hover{background:#1ebf5b}.sheet{display:block;margin-top:14px;font-size:13px;color:#64748b;text-decoration:none}.err{background:#fee2e2;color:#991b1b;padding:12px;border-radius:10px;font-size:14px;margin:14px 0;text-align:left;word-break:break-word}</style></head><body><div class="card">${body}<a class="sheet" href="https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit" target="_blank">📊 Retour au sheet</a></div></body></html>`;
}

export default async function handler(req, res) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    const phone = normalizePhoneMA(req.query.phone);
    if (!phone) {
        return res.status(400).send(htmlPage({
            title: 'Erreur',
            body: `<h1>❌ Numéro invalide</h1><p>Format attendu: +212XXXXXXXXX</p>`,
        }));
    }

    if (!BOT_URL || !BOT_TOKEN) {
        return res.status(500).send(htmlPage({
            title: 'Erreur config',
            body: `<h1>⚙️ Bot non configuré</h1><p>BOT_URL ou BOT_TOKEN manquant dans Vercel.</p>`,
            color: '#991b1b',
        }));
    }

    try {
        const found = await findRowByPhone(phone);
        if (!found) {
            return res.status(404).send(htmlPage({
                title: 'Lead introuvable',
                body: `<h1>❌ Lead introuvable</h1><p>${phone} n'est pas dans le sheet.</p>`,
                color: '#991b1b',
            }));
        }

        const group = await createGroup(phone, found.name);
        await updateColumnO(found.row, group.inviteLink);

        return res.status(200).send(htmlPage({
            title: 'Groupe créé',
            body: `<h1>✅ Groupe créé</h1><p><strong>${group.groupName}</strong></p><p>Membres: toi + ${phone} + assistante</p><a class="btn" href="${group.inviteLink}" target="_blank">👥 Ouvrir le groupe</a>`,
        }));
    } catch (err) {
        console.error('create_group_error', err.message);
        return res.status(500).send(htmlPage({
            title: 'Erreur',
            body: `<h1>❌ Échec création groupe</h1><div class="err">${err.message.slice(0, 300)}</div><p>Vérifie que le bot Fly.io est UP: <code>fly status -a solaryn-bot</code></p>`,
            color: '#991b1b',
        }));
    }
}
