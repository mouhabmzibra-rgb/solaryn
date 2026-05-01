export function clean(value, max = 500) {
    if (typeof value !== 'string') return '';
    let v = value.trim().replace(/[\r\0]/g, '');
    if (v.length > max) v = v.slice(0, max);
    return v;
}

export function validPhone(tel) {
    return /^(0|\+212)[5-7][0-9]{8}$/.test(String(tel || '').replace(/\s+/g, ''));
}

export function validEmail(email) {
    if (!email) return true;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function clientIp(req) {
    return (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || '';
}

export async function forwardToSheets(payload) {
    const url = process.env.SHEETS_WEBHOOK_URL;
    if (!url) {
        console.warn('SHEETS_WEBHOOK_URL not configured');
        return;
    }
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal,
            redirect: 'follow',
        });
        clearTimeout(timeout);
        if (!res.ok) {
            console.error('Sheets webhook returned', res.status);
        }
    } catch (err) {
        console.error('Sheets webhook error', err.message);
    }
}

export function readBody(req) {
    if (req.body && typeof req.body === 'object') return req.body;
    if (typeof req.body === 'string') {
        try { return JSON.parse(req.body); } catch { return {}; }
    }
    return {};
}
