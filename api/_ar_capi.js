import crypto from 'node:crypto';

const PIXEL_ID = process.env.META_PIXEL_ID || '';
const ACCESS_TOKEN = process.env.META_CAPI_ACCESS_TOKEN || '';
const TEST_EVENT_CODE = process.env.META_TEST_EVENT_CODE || '';
const GRAPH_API_VERSION = 'v22.0';

function sha256(s) {
    return crypto.createHash('sha256').update(String(s || '').trim().toLowerCase()).digest('hex');
}

function normalizeForCapi(phone) {
    let digits = String(phone || '').replace(/\D/g, '');
    if (digits.startsWith('212')) return digits;
    if (digits.startsWith('0')) return '212' + digits.slice(1);
    return '212' + digits;
}

export function capiConfigured() {
    return Boolean(PIXEL_ID && ACCESS_TOKEN);
}

export async function firePurchaseCapi({
    event_id,
    event_source_url,
    ip,
    ua,
    prenom,
    ville,
    telCanonical,
    fbp,
    fbc,
}) {
    if (!capiConfigured()) {
        return { skipped: true, reason: 'no_capi_creds' };
    }

    const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${PIXEL_ID}/events?access_token=${ACCESS_TOKEN}`;
    const event_time = Math.floor(Date.now() / 1000);

    const user_data = {
        ph: [sha256(normalizeForCapi(telCanonical))],
        fn: [sha256(prenom)],
        ct: [sha256(ville)],
        country: [sha256('ma')],
    };
    if (ip) user_data.client_ip_address = ip;
    if (ua) user_data.client_user_agent = ua;
    if (fbp) user_data.fbp = fbp;
    if (fbc) user_data.fbc = fbc;

    const payload = {
        data: [{
            event_name: 'Purchase',
            event_time,
            event_id,
            event_source_url,
            action_source: 'website',
            user_data,
            custom_data: {
                value: 150,
                currency: 'MAD',
                content_name: 'Solaryn SPF 50',
                content_category: 'Skincare',
                content_ids: ['solaryn-spf50-150'],
                content_type: 'product',
                num_items: 1,
            },
        }],
    };
    if (TEST_EVENT_CODE) payload.test_event_code = TEST_EVENT_CODE;

    const ctrl = new AbortController();
    const timeoutId = setTimeout(() => ctrl.abort(), 4000);
    try {
        const r = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: ctrl.signal,
        });
        const respBody = await r.json().catch(() => ({}));
        return { ok: r.ok, status: r.status, body: respBody };
    } catch (err) {
        return { ok: false, error: err.name === 'AbortError' ? 'timeout' : 'network_error' };
    } finally {
        clearTimeout(timeoutId);
    }
}
