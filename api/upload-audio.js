// POST /api/upload-audio — téléconseillère uploads call recording.
// Stores file on Vercel Blob, returns public URL, writes URL into column K
// of the matching phone row in the Solaryn leads Google Sheet.
//
// GET /api/upload-audio → simple HTML upload form for the téléconseillère
// POST multipart/form-data: { phone, audio (file), notes? }

import { put } from '@vercel/blob';
import formidable from 'formidable';
import { readFile } from 'node:fs/promises';

const COMPOSIO_API = 'https://backend.composio.dev/api/v3';
const SHEET_ID = process.env.LEADS_SHEET_ID || '1uyItM4b7XLPbo2xgTbOrS99MWEz6Ls16MKtVBb1F6hA';
const COMPOSIO_KEY = process.env.COMPOSIO_API_KEY || 'ak_R9c7r97htFBcxtnsCASU';
const COMPOSIO_ACCOUNT_ID = process.env.COMPOSIO_ACCOUNT_ID || 'ca_x66oW70jpGO6';
const COMPOSIO_USER_ID = process.env.COMPOSIO_USER_ID || 'solaryn-default';
const SHEET_NAME = "'Feuille 1'";

export const config = {
    api: { bodyParser: false },
};

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

async function findRowForPhone(phone) {
    const resp = await callComposio('GOOGLESHEETS_BATCH_GET', {
        spreadsheet_id: SHEET_ID,
        ranges: [`${SHEET_NAME}!B2:B500`],
        valueRenderOption: 'FORMATTED_VALUE',
    });
    const rows = resp?.data?.valueRanges?.[0]?.values || [];
    const phoneDigits = phone.replace(/[^\d]/g, '');
    for (let i = 0; i < rows.length; i++) {
        const cell = String(rows[i]?.[0] || '').replace(/[^\d]/g, '');
        if (!cell) continue;
        if (cell === phoneDigits || cell.endsWith(phoneDigits.slice(-9))) return i + 2;
    }
    return null;
}

async function setColumnKValue(rowIndex, value) {
    return callComposio('GOOGLESHEETS_VALUES_UPDATE', {
        spreadsheet_id: SHEET_ID,
        range: `${SHEET_NAME}!K${rowIndex}`,
        value_input_option: 'USER_ENTERED',
        values: [[value]],
    });
}

async function appendNoteToCell(rowIndex, additionalNote) {
    // Read current note in column H, append to it
    const resp = await callComposio('GOOGLESHEETS_BATCH_GET', {
        spreadsheet_id: SHEET_ID,
        ranges: [`${SHEET_NAME}!H${rowIndex}`],
        valueRenderOption: 'FORMATTED_VALUE',
    });
    const current = resp?.data?.valueRanges?.[0]?.values?.[0]?.[0] || '';
    const newNote = current ? `${current} | ${additionalNote}` : additionalNote;
    return callComposio('GOOGLESHEETS_VALUES_UPDATE', {
        spreadsheet_id: SHEET_ID,
        range: `${SHEET_NAME}!H${rowIndex}`,
        value_input_option: 'USER_ENTERED',
        values: [[newNote]],
    });
}

function htmlForm(banner = '') {
    return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Solaryn — Upload audio</title><style>*{box-sizing:border-box}body{margin:0;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;background:#FFFAF0;min-height:100vh;display:grid;place-items:center;padding:20px;color:#1B2D4D}.card{background:#fff;border-radius:18px;padding:28px 22px;max-width:420px;width:100%;box-shadow:0 12px 32px rgba(27,45,77,.12)}h1{margin:0 0 6px;font-size:22px;text-align:center}.sub{margin:0 0 18px;color:#64748b;font-size:13px;text-align:center}label{display:block;font-size:13px;font-weight:700;margin-top:14px;color:#475569}input,textarea,button{width:100%;font-size:16px;padding:13px 14px;border-radius:12px;border:2px solid #e2e8f0;margin-top:6px;box-sizing:border-box;font-family:inherit}input:focus,textarea:focus{outline:none;border-color:#FBC32B;box-shadow:0 0 0 3px rgba(251,195,43,.18)}input[type="file"]{padding:9px;background:#fafafa}button{background:#1B2D4D;color:#fff;border:none;font-weight:800;cursor:pointer;letter-spacing:.02em;margin-top:18px;font-size:17px}button:hover{background:#0F1A30}button:disabled{opacity:.6;cursor:not-allowed}.ok{background:#dcfce7;color:#166534;padding:12px;border-radius:10px;font-size:14px;margin-bottom:14px;text-align:center;word-break:break-all}.err{background:#fee2e2;color:#991b1b;padding:12px;border-radius:10px;font-size:14px;margin-bottom:14px;text-align:center}.hint{color:#94a3b8;font-size:12px;margin-top:4px}.spinner{display:inline-block;width:16px;height:16px;border:2px solid rgba(255,255,255,.4);border-top-color:#fff;border-radius:50%;animation:s .7s linear infinite;vertical-align:middle;margin-right:8px}@keyframes s{to{transform:rotate(360deg)}}.sheet{display:block;text-align:center;margin-top:14px;font-size:13px;color:#1B2D4D}</style></head><body><div class="card"><h1>🎙️ Upload audio appel</h1><p class="sub">Solaryn — enregistrement de mission télévente</p>${banner}<form method="POST" action="/api/upload-audio" enctype="multipart/form-data" id="f"><label for="phone">📞 Numéro du lead appelé</label><input type="tel" name="phone" id="phone" placeholder="06XXXXXXXX ou +212XXXXXXXXX" required inputmode="tel" autocomplete="tel"><div class="hint">Format MA: 06XX, +212XXX ou 00212XXX (auto-normalisé)</div><label for="audio">🎵 Fichier audio (.m4a, .mp3, .wav, .ogg)</label><input type="file" name="audio" id="audio" accept="audio/*,.m4a,.mp3,.wav,.ogg,.amr" required><div class="hint">Max 4 MB par fichier — utiliser audio compressé</div><label for="notes">📝 Note rapide (optionnel)</label><textarea name="notes" id="notes" rows="2" placeholder="Ex: Commande confirmée, ou Lead pas intéressé"></textarea><button type="submit" id="btn">📤 Uploader & lier au sheet</button></form><a class="sheet" href="https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit" target="_blank">📊 Ouvrir le sheet</a></div><script>document.getElementById('f').addEventListener('submit',function(){var b=document.getElementById('btn');b.disabled=true;b.innerHTML='<span class="spinner"></span> Upload en cours…';});</script></body></html>`;
}

async function parseForm(req) {
    const form = formidable({
        maxFileSize: 4 * 1024 * 1024, // 4 MB
        keepExtensions: true,
    });
    return new Promise((resolve, reject) => {
        form.parse(req, (err, fields, files) => {
            if (err) reject(err);
            else resolve({ fields, files });
        });
    });
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

    let phone, fileEntry, notes, originalName;
    try {
        const { fields, files } = await parseForm(req);
        const rawPhone = Array.isArray(fields.phone) ? fields.phone[0] : fields.phone;
        notes = (Array.isArray(fields.notes) ? fields.notes[0] : fields.notes) || '';
        phone = normalizePhoneMA(rawPhone);
        if (!phone) {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            return res.status(400).send(htmlForm('<div class="err">❌ Numéro marocain invalide</div>'));
        }
        const audioField = files.audio;
        fileEntry = Array.isArray(audioField) ? audioField[0] : audioField;
        if (!fileEntry) {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            return res.status(400).send(htmlForm('<div class="err">❌ Fichier audio manquant</div>'));
        }
        originalName = fileEntry.originalFilename || 'recording.m4a';
    } catch (e) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.status(400).send(htmlForm(`<div class="err">❌ Parse error: ${e.message.slice(0, 150)}</div>`));
    }

    try {
        // Read file from temp storage
        const buffer = await readFile(fileEntry.filepath);
        const ext = (originalName.split('.').pop() || 'm4a').toLowerCase();
        const phoneDigits = phone.replace(/[^\d]/g, '');
        const datePart = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
        const blobPath = `solaryn-calls/${phoneDigits}_${datePart}.${ext}`;

        const blob = await put(blobPath, buffer, {
            access: 'public',
            contentType: fileEntry.mimetype || 'audio/m4a',
        });

        // Find the lead row
        const rowIndex = await findRowForPhone(phone);
        if (!rowIndex) {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            return res.status(200).send(htmlForm(
                `<div class="err">⚠️ Audio uploadé mais lead introuvable dans le sheet pour ${phone}.<br><br>` +
                `Lien direct: <a href="${blob.url}" target="_blank">${blob.url}</a></div>`
            ));
        }

        // Build hyperlink formula for cell
        const fileLabel = `🎙️ Écouter (${new Date().toLocaleDateString('fr-FR')})`;
        const linkFormula = `=HYPERLINK("${blob.url}","${fileLabel}")`;
        await setColumnKValue(rowIndex, linkFormula);

        // Optionally also add the note to column H
        if (notes && notes.trim()) {
            await appendNoteToCell(rowIndex, notes.trim().slice(0, 200));
        }

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.status(200).send(htmlForm(
            `<div class="ok">✅ Audio lié au lead <strong>${phone}</strong> (ligne ${rowIndex})<br><br>` +
            `<a href="${blob.url}" target="_blank">▶️ Écouter</a></div>`
        ));
    } catch (err) {
        console.error('upload_audio_error', err.message);
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.status(500).send(htmlForm(
            `<div class="err">❌ Erreur upload: ${err.message.slice(0, 200)}</div>`
        ));
    }
}
