import crypto from 'node:crypto';
import { clean, readBody, validPhone, clientIp } from './_lib.js';
import { appendArLead, appendArPartial } from './_sheets.js';
import { firePurchaseCapi, capiConfigured } from './_ar_capi.js';

const COUNTRY_GATE_OFF = process.env.AR_COUNTRY_GATE_OFF === '1';

function setCors(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function asciiDigits(s) {
    return String(s || '')
        .replace(/[٠-٩]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x0660 + 0x30))
        .replace(/[۰-۹]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x06F0 + 0x30));
}

function normalizePhoneMA(raw) {
    const digits = asciiDigits(raw).replace(/\D/g, '');
    if (!digits) return '';
    if (digits.startsWith('212')) return '+' + digits;
    if (digits.startsWith('0')) return '+212' + digits.slice(1);
    return '+212' + digits;
}

function looksClean(name) {
    if (!name) return false;
    if (/https?:\/\//i.test(name)) return false;
    if (/[Ѐ-ӿ]/.test(name)) return false; // Cyrillic
    if (/[一-鿿]/.test(name)) return false; // CJK
    const specials = (name.match(/[!@#$%^&*()_+={}\[\]|\\:";'<>?/]/g) || []).length;
    return specials <= 5;
}

function safeLogTel(tel) {
    return '****' + String(tel || '').slice(-4);
}

export default async function handler(req, res) {
    setCors(res);

    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ ok: false, error: 'method_not_allowed' });
    }

    const body = readBody(req);

    // ─── PARTIAL submission path (typing snapshot, not a real purchase) ───
    // Body shape: { partial: true, session_id, form_id, prenom, tel, adresse, status, source }
    // Bypasses all validation; just logs whatever was typed to the Partials sheet tab.
    if (body.partial === true || body.partial === 'true' || body.partial === 1 || body.partial === '1') {
        const session_id = clean(body.session_id, 80);
        if (!session_id) return res.status(200).json({ ok: false, error: 'missing_session' });

        const p_form_id = clean(body.form_id, 32);
        const p_prenom = clean(body.prenom, 80);
        const p_tel = clean(body.tel, 30);
        const p_telDigits = asciiDigits(p_tel).replace(/\D/g, '');
        const p_adresse = clean(body.adresse, 400);
        const p_status = clean(body.status, 32) || 'snapshot';
        const p_source = clean(body.source, 32) || 'fb_ar';

        // Skip if user typed absolutely nothing
        if (!p_prenom && !p_telDigits && !p_adresse) {
            return res.status(200).json({ ok: true, skipped: 'empty' });
        }

        const p_tz = '+01:00';
        const p_iso = new Date().toISOString().replace('Z', p_tz);
        const p_country = req.headers['x-vercel-ip-country'] || '';
        const p_city = req.headers['x-vercel-ip-city'] || '';

        const p_row = [
            p_iso,
            session_id,
            p_form_id || '',
            p_status,
            p_prenom,
            "'" + p_tel,
            p_adresse,
            p_source,
            `${p_country}/${decodeURIComponent(p_city)}`,
        ];

        try {
            await appendArPartial(p_row);
            return res.status(200).json({ ok: true });
        } catch (err) {
            console.error('ar_partial_sheet_error', err.message || 'unknown');
            return res.status(200).json({ ok: false, error: 'sheet_error' });
        }
    }

    // Honeypot — silent 200 (don't tip off the bot)
    if (body.website) {
        return res.status(200).json({ ok: true });
    }

    // Time-trap — reject if form submitted < 2s after render
    const tsRendered = parseInt(body.ts_rendered || '0', 10);
    if (tsRendered > 0 && Date.now() - tsRendered < 2000) {
        return res.status(400).json({ ok: false, error: 'too_fast' });
    }

    // Country gate (overridable via AR_COUNTRY_GATE_OFF=1 for testing)
    const country = req.headers['x-vercel-ip-country'] || '';
    if (!COUNTRY_GATE_OFF && country && country !== 'MA') {
        return res.status(403).json({ ok: false, error: 'country_not_allowed' });
    }

    // Validate + clean fields (3-field form: prenom + tel + adresse-combined)
    // nom and ville are now optional (kept for backward compat with any older client cached)
    const prenom = clean(body.prenom, 80);
    const nom = clean(body.nom, 80);
    const telRaw = clean(body.tel, 30);
    const ville = clean(body.ville, 80);
    const adresse = clean(body.adresse, 400);
    const source = clean(body.source, 32) || 'fb_ar';
    const eventId = clean(body.event_id, 64) || crypto.randomUUID();
    const fbp = clean(body.fbp, 200);
    const fbc = clean(body.fbc, 200);

    // Only tel is required. prenom + adresse + nom are optional now
    // (we'll get them on the confirmation call).
    if (prenom && !looksClean(prenom)) {
        return res.status(400).json({ ok: false, error: 'invalid_name' });
    }
    if (nom && !looksClean(nom)) {
        return res.status(400).json({ ok: false, error: 'invalid_name' });
    }

    // Normalize phone: Arabic-Indic digits → ASCII → canonical +212XXXXXXXXX
    const telCanonical = normalizePhoneMA(telRaw);
    if (!validPhone(telCanonical)) {
        return res.status(400).json({ ok: false, error: 'invalid_phone' });
    }

    // Append to Sheet
    const tz = '+01:00';
    const iso = new Date().toISOString().replace('Z', tz);

    const row = [
        iso,
        prenom,
        nom,
        "'" + telCanonical, // apostrophe prefix keeps phone as text in Sheets
        ville,
        adresse,
        source,
        [fbp, fbc].filter(Boolean).join('|'),
    ];

    try {
        await appendArLead(row);
    } catch (err) {
        console.error('ar_lead_sheet_error', err.message || 'unknown', safeLogTel(telCanonical));
        return res.status(500).json({ ok: false, error: 'sheet_error' });
    }

    // Fire CAPI best-effort (does NOT block response)
    if (capiConfigured()) {
        const eventSourceUrl = req.headers['referer'] || 'https://solaryn-five.vercel.app/ar';
        firePurchaseCapi({
            event_id: eventId,
            event_source_url: eventSourceUrl,
            ip: clientIp(req),
            ua: req.headers['user-agent'] || '',
            prenom,
            ville,
            telCanonical,
            fbp,
            fbc,
        }).then(r => {
            if (!r.ok && !r.skipped) {
                console.error('ar_purchase_capi_error', r.error || r.status || 'unknown', safeLogTel(telCanonical));
            }
        }).catch(() => {});
    }

    return res.status(200).json({ ok: true, event_id: eventId });
}
