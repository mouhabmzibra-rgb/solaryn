import { put } from '@vercel/blob';
import { clean, readBody } from './_lib.js';
import { signToken, verifyToken, bearerToken } from './_auth.js';
import { readAdminData, updateSaleStatus, toggleAffiliateStatus, appendTrackingUrl, removeTrackingUrl } from './_sheets.js';

export const config = {
    api: { bodyParser: { sizeLimit: '6mb' } },
};

const ADMIN_ID = 'admin';
const VALID_STATUSES = ['pending', 'confirmed', 'delivered', 'paid', 'cancelled'];
const VALID_AFF_STATUSES = ['active', 'disabled'];
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MAX_FILE_BYTES = 4 * 1024 * 1024;

function isAdminSession(req) {
    const s = verifyToken(bearerToken(req));
    return s && s.affiliateId === ADMIN_ID;
}

function extFor(mime) {
    if (mime === 'image/jpeg') return 'jpg';
    if (mime === 'image/png') return 'png';
    if (mime === 'image/webp') return 'webp';
    if (mime === 'image/gif') return 'gif';
    return 'bin';
}

async function handleUploadTracking(req, res, body) {
    const saleId = clean(body.sale_id, 100);
    const contentType = clean(body.content_type, 50);
    const dataBase64 = typeof body.data_base64 === 'string' ? body.data_base64 : '';

    if (!saleId) return res.status(400).json({ ok: false, message: 'sale_id requis' });
    if (!ALLOWED_MIME.has(contentType)) {
        return res.status(400).json({ ok: false, message: 'Format non supporté (JPG/PNG/WEBP/GIF)' });
    }
    if (!dataBase64) return res.status(400).json({ ok: false, message: 'fichier requis' });

    let buffer;
    try {
        buffer = Buffer.from(dataBase64, 'base64');
    } catch {
        return res.status(400).json({ ok: false, message: 'base64 invalide' });
    }
    if (!buffer.length) return res.status(400).json({ ok: false, message: 'fichier vide' });
    if (buffer.length > MAX_FILE_BYTES) {
        return res.status(413).json({ ok: false, message: 'Fichier trop lourd (max 4 MB)' });
    }

    const ext = extFor(contentType);
    const safeSaleId = saleId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const blobPath = `tracking/${safeSaleId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    let blob;
    try {
        blob = await put(blobPath, buffer, {
            access: 'public',
            contentType,
            addRandomSuffix: false,
        });
    } catch (err) {
        return res.status(500).json({ ok: false, message: 'Erreur stockage: ' + (err.message || 'inconnue') });
    }

    const appended = await appendTrackingUrl(saleId, blob.url);
    if (!appended.ok) return res.status(404).json({ ok: false, message: 'Vente introuvable' });
    return res.status(200).json({ ok: true, url: blob.url, urls: appended.urls });
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ ok: false, message: 'Method not allowed' });
    }

    const body = readBody(req);
    const action = clean(body.action, 40);

    if (action === 'login') {
        const pwd = clean(body.password, 200);
        const expected = process.env.ADMIN_PASSWORD || '';
        if (!expected) {
            return res.status(500).json({ ok: false, message: 'ADMIN_PASSWORD env var not set' });
        }
        if (pwd !== expected) {
            return res.status(401).json({ ok: false, message: 'Mot de passe incorrect' });
        }
        const token = signToken(ADMIN_ID, 24 * 7);
        return res.status(200).json({ ok: true, token });
    }

    if (!isAdminSession(req)) {
        return res.status(401).json({ ok: false, message: 'Session expirée' });
    }

    try {
        if (action === 'data') {
            const data = await readAdminData();
            return res.status(200).json({ ok: true, ...data });
        }

        if (action === 'update_sale') {
            const saleId = clean(body.sale_id, 100);
            const status = clean(body.status, 20);
            if (!saleId) return res.status(400).json({ ok: false, message: 'sale_id requis' });
            if (!VALID_STATUSES.includes(status)) return res.status(400).json({ ok: false, message: 'status invalide' });
            const r = await updateSaleStatus(saleId, status);
            if (!r.ok) return res.status(404).json({ ok: false, message: 'Vente introuvable' });
            return res.status(200).json({ ok: true });
        }

        if (action === 'toggle_affiliate') {
            const phone = clean(body.affiliate_phone, 20);
            const status = clean(body.status, 20);
            if (!phone) return res.status(400).json({ ok: false, message: 'affiliate_phone requis' });
            if (!VALID_AFF_STATUSES.includes(status)) return res.status(400).json({ ok: false, message: 'status invalide' });
            const r = await toggleAffiliateStatus(phone, status);
            if (!r.ok) return res.status(404).json({ ok: false, message: 'Affiliée introuvable' });
            return res.status(200).json({ ok: true });
        }

        if (action === 'upload_tracking') {
            return await handleUploadTracking(req, res, body);
        }

        if (action === 'delete_tracking') {
            const saleId = clean(body.sale_id, 100);
            const url = clean(body.url, 1000);
            if (!saleId || !url) return res.status(400).json({ ok: false, message: 'sale_id et url requis' });
            const r = await removeTrackingUrl(saleId, url);
            if (!r.ok) return res.status(404).json({ ok: false, message: 'Vente introuvable' });
            return res.status(200).json({ ok: true, urls: r.urls });
        }

        return res.status(400).json({ ok: false, message: 'action inconnue' });
    } catch (err) {
        return res.status(500).json({ ok: false, message: 'Erreur: ' + (err.message || 'inconnue') });
    }
}
