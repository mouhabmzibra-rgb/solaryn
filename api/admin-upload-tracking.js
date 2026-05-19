import { put } from '@vercel/blob';
import formidable from 'formidable';
import fs from 'fs';
import { verifyToken, bearerToken } from './_auth.js';
import { appendTrackingUrl } from './_sheets.js';

export const config = {
    api: { bodyParser: false },
};

const ADMIN_ID = 'admin';
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MAX_BYTES = 4 * 1024 * 1024;

function isAdminSession(req) {
    const s = verifyToken(bearerToken(req));
    return s && s.affiliateId === ADMIN_ID;
}

function extFor(mime, originalName) {
    if (mime === 'image/jpeg') return 'jpg';
    if (mime === 'image/png') return 'png';
    if (mime === 'image/webp') return 'webp';
    if (mime === 'image/gif') return 'gif';
    const m = String(originalName || '').match(/\.([a-z0-9]+)$/i);
    return m ? m[1].toLowerCase() : 'bin';
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ ok: false, message: 'Method not allowed' });
    }

    if (!isAdminSession(req)) {
        return res.status(401).json({ ok: false, message: 'Session expirée' });
    }

    let fields, files;
    try {
        const form = formidable({ maxFileSize: MAX_BYTES, keepExtensions: true });
        [fields, files] = await form.parse(req);
    } catch (err) {
        const tooBig = err && err.code === 1009;
        return res.status(tooBig ? 413 : 400).json({
            ok: false,
            message: tooBig ? 'Fichier trop lourd (max 4 MB)' : 'Erreur upload: ' + (err.message || 'inconnue'),
        });
    }

    const saleId = String((fields.sale_id && fields.sale_id[0]) || '').trim();
    const file = files.file && files.file[0];

    if (!saleId) return res.status(400).json({ ok: false, message: 'sale_id requis' });
    if (!file) return res.status(400).json({ ok: false, message: 'fichier requis' });
    if (!ALLOWED_MIME.has(file.mimetype)) {
        return res.status(400).json({ ok: false, message: 'Format non supporté (JPG/PNG/WEBP/GIF uniquement)' });
    }

    let buffer;
    try {
        buffer = fs.readFileSync(file.filepath);
    } catch (err) {
        return res.status(500).json({ ok: false, message: 'Erreur lecture fichier' });
    }

    const ext = extFor(file.mimetype, file.originalFilename);
    const safeSaleId = saleId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const blobPath = `tracking/${safeSaleId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    let blob;
    try {
        blob = await put(blobPath, buffer, {
            access: 'public',
            contentType: file.mimetype,
            addRandomSuffix: false,
        });
    } catch (err) {
        return res.status(500).json({ ok: false, message: 'Erreur stockage: ' + (err.message || 'inconnue') });
    }

    let appended;
    try {
        appended = await appendTrackingUrl(saleId, blob.url);
    } catch (err) {
        return res.status(500).json({ ok: false, message: 'Erreur sheet: ' + (err.message || 'inconnue') });
    }

    if (!appended.ok) {
        return res.status(404).json({ ok: false, message: 'Vente introuvable' });
    }

    return res.status(200).json({ ok: true, url: blob.url, urls: appended.urls });
}
