// POST /api/upload-audio — téléconseillère uploads call recording.
//
// Architecture: client uploads file DIRECTLY to Vercel Blob (bypasses 4.5 MB
// function body limit). This endpoint handles 2 phases:
//   1. Client requests signed upload URL (POST with payload from @vercel/blob/client)
//   2. After upload completes, Vercel webhooks back here → we link to sheet
//
// GET /api/upload-audio → HTML form using @vercel/blob/client to upload direct.

import { handleUpload } from '@vercel/blob/client';

const COMPOSIO_API = 'https://backend.composio.dev/api/v3';
const SHEET_ID = process.env.LEADS_SHEET_ID || '1uyItM4b7XLPbo2xgTbOrS99MWEz6Ls16MKtVBb1F6hA';
const COMPOSIO_KEY = process.env.COMPOSIO_API_KEY || 'ak_R9c7r97htFBcxtnsCASU';
const COMPOSIO_ACCOUNT_ID = process.env.COMPOSIO_ACCOUNT_ID || 'ca_x66oW70jpGO6';
const COMPOSIO_USER_ID = process.env.COMPOSIO_USER_ID || 'solaryn-default';
const SHEET_NAME = "'Feuille 1'";

function normalizePhoneMA(raw) {
    if (raw === undefined || raw === null) return null;
    let p = String(raw).replace(/[^\d+]/g, '');
    if (!p) return null;
    if (p.indexOf('+') > 0) p = p.replace(/\+/g, '');
    if (p.startsWith('00')) p = '+' + p.slice(2);
    else if (/^0\d{9}$/.test(p)) p = '+212' + p.slice(1);
    else if (/^212\d{9}$/.test(p)) p = '+' + p;
    else if (!p.startsWith('+')) p = '+212' + p;
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

function htmlForm() {
    return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Solaryn — Upload audio</title><style>*{box-sizing:border-box}body{margin:0;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;background:#FFFAF0;min-height:100vh;display:grid;place-items:center;padding:20px;color:#1B2D4D}.card{background:#fff;border-radius:18px;padding:28px 22px;max-width:420px;width:100%;box-shadow:0 12px 32px rgba(27,45,77,.12)}h1{margin:0 0 6px;font-size:22px;text-align:center}.sub{margin:0 0 18px;color:#64748b;font-size:13px;text-align:center}label{display:block;font-size:13px;font-weight:700;margin-top:14px;color:#475569}input,textarea,button{width:100%;font-size:16px;padding:13px 14px;border-radius:12px;border:2px solid #e2e8f0;margin-top:6px;box-sizing:border-box;font-family:inherit}input:focus,textarea:focus{outline:none;border-color:#FBC32B;box-shadow:0 0 0 3px rgba(251,195,43,.18)}input[type="file"]{padding:9px;background:#fafafa}button{width:100%;background:#1B2D4D;color:#fff;border:none;font-weight:800;cursor:pointer;letter-spacing:.02em;margin-top:18px;font-size:17px;padding:14px;border-radius:12px}button:hover{background:#0F1A30}button:disabled{opacity:.6;cursor:not-allowed}.ok{background:#dcfce7;color:#166534;padding:14px;border-radius:10px;font-size:14px;margin-bottom:14px;text-align:center;word-break:break-all}.err{background:#fee2e2;color:#991b1b;padding:12px;border-radius:10px;font-size:14px;margin-bottom:14px;text-align:center}.hint{color:#94a3b8;font-size:12px;margin-top:4px}.spinner{display:inline-block;width:16px;height:16px;border:2px solid rgba(255,255,255,.4);border-top-color:#fff;border-radius:50%;animation:s .7s linear infinite;vertical-align:middle;margin-right:8px}@keyframes s{to{transform:rotate(360deg)}}.progress{margin-top:8px;height:6px;background:#e2e8f0;border-radius:3px;overflow:hidden}.progress-bar{height:100%;background:#FBC32B;width:0%;transition:width .2s}.sheet{display:block;text-align:center;margin-top:14px;font-size:13px;color:#1B2D4D}</style></head><body><div class="card" id="card"><h1>🎙️ Upload audio appel</h1><p class="sub">Solaryn — direct upload jusqu'à 100 MB</p><div id="banner"></div><form id="f"><label for="phone">📞 Numéro du lead appelé</label><input type="tel" name="phone" id="phone" placeholder="06XXXXXXXX ou +212XXXXXXXXX" required inputmode="tel" autocomplete="tel"><div class="hint">Format MA: 06XX, +212XXX ou 00212XXX</div><label for="audio">🎵 Fichier audio</label><input type="file" name="audio" id="audio" accept="audio/*,.m4a,.mp3,.wav,.ogg,.amr,.opus,.aac" required><div class="hint">Max 100 MB · .m4a .mp3 .wav .ogg .amr .opus .aac</div><label for="notes">📝 Note rapide (optionnel)</label><textarea name="notes" id="notes" rows="2" placeholder="Ex: Commande confirmée, Lead pas intéressé..."></textarea><div class="progress" id="progress" style="display:none"><div class="progress-bar" id="progress-bar"></div></div><button type="submit" id="btn">📤 Uploader & lier au sheet</button></form><a class="sheet" href="https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit" target="_blank">📊 Ouvrir le sheet</a></div><script type="module">
import { upload } from 'https://esm.sh/@vercel/blob@0.27.0/client';

const form = document.getElementById('f');
const btn = document.getElementById('btn');
const banner = document.getElementById('banner');
const progress = document.getElementById('progress');
const progressBar = document.getElementById('progress-bar');

function showError(msg) {
    banner.innerHTML = '<div class="err">❌ ' + msg + '</div>';
    btn.disabled = false;
    btn.textContent = '📤 Réessayer';
    progress.style.display = 'none';
}

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    banner.innerHTML = '';
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>Upload en cours…';
    progress.style.display = 'block';
    progressBar.style.width = '0%';

    const phone = document.getElementById('phone').value.trim();
    const notes = document.getElementById('notes').value.trim();
    const fileEl = document.getElementById('audio');
    const file = fileEl.files[0];
    if (!phone || !file) { showError('Phone + fichier obligatoires'); return; }

    const phoneDigits = phone.replace(/[^\\d+]/g, '');
    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_').slice(0, 40);
    const blobPath = 'solaryn-calls/' + phoneDigits + '_' + Date.now() + '_' + safeName;

    try {
        const blob = await upload(blobPath, file, {
            access: 'public',
            handleUploadUrl: '/api/upload-audio',
            clientPayload: JSON.stringify({ phone, notes }),
            onUploadProgress: (p) => {
                const pct = Math.round((p.loaded / p.total) * 100);
                progressBar.style.width = pct + '%';
                btn.innerHTML = '<span class="spinner"></span>Upload ' + pct + '%';
            },
        });

        document.getElementById('card').innerHTML =
            '<h1>✅ Upload terminé</h1>' +
            '<p class="sub">Audio uploadé. Le sheet sera mis à jour dans 1-2 sec.</p>' +
            '<div class="ok">📞 Lead: ' + phone + '<br><br>' +
            '<a href="' + blob.url + '" target="_blank">▶️ Écouter l\\'audio</a></div>' +
            '<button onclick="location.reload()">↩️ Uploader un autre</button>' +
            '<a class="sheet" href="https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit" target="_blank">📊 Ouvrir le sheet</a>';
    } catch (err) {
        showError(err.message || 'Upload failed');
    }
});
</script></body></html>`;
}

// Vercel default body parser parses JSON automatically
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(204).end();

    if (req.method === 'GET' || req.method === 'HEAD') {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.status(200).send(req.method === 'HEAD' ? '' : htmlForm());
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const jsonResponse = await handleUpload({
            body: req.body,
            request: req,
            onBeforeGenerateToken: async (pathname, clientPayload) => {
                const payload = JSON.parse(clientPayload || '{}');
                const phone = normalizePhoneMA(payload.phone);
                if (!phone) throw new Error('Numéro marocain invalide');
                return {
                    allowedContentTypes: [
                        'audio/*', 'audio/mpeg', 'audio/mp3', 'audio/m4a',
                        'audio/x-m4a', 'audio/wav', 'audio/ogg', 'audio/amr',
                        'audio/aac', 'audio/opus', 'audio/3gpp',
                        'application/octet-stream',
                    ],
                    maximumSizeInBytes: 100 * 1024 * 1024, // 100 MB
                    tokenPayload: JSON.stringify({ phone, notes: payload.notes || '' }),
                };
            },
            onUploadCompleted: async ({ blob, tokenPayload }) => {
                try {
                    const { phone, notes } = JSON.parse(tokenPayload);
                    const rowIndex = await findRowForPhone(phone);
                    if (!rowIndex) {
                        console.warn('upload_audio_no_row', phone, blob.url);
                        return;
                    }
                    const dateLabel = new Date().toLocaleDateString('fr-FR');
                    const linkFormula = `=HYPERLINK("${blob.url}","🎙️ Écouter (${dateLabel})")`;
                    await setColumnKValue(rowIndex, linkFormula);
                    if (notes && notes.trim()) {
                        await appendNoteToCell(rowIndex, notes.trim().slice(0, 200));
                    }
                    console.log('upload_audio_linked', phone, rowIndex, blob.url);
                } catch (e) {
                    console.error('onUploadCompleted_error', e.message);
                    throw e;
                }
            },
        });
        return res.status(200).json(jsonResponse);
    } catch (error) {
        console.error('upload_audio_handler_error', error.message);
        return res.status(400).json({ error: error.message });
    }
}
