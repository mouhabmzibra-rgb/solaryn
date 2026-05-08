// POST /api/create-order — manual order creation from quick-order.html form.
// Body: {phone, fullName, city, address, quantity, notes}

const SHOPIFY_VARIANT_ID = '53266501075257';

async function getShopifyToken() {
    const domain = process.env.SHOPIFY_STORE_DOMAIN;
    const cid = process.env.SHOPIFY_CLIENT_ID;
    const secret = process.env.SHOPIFY_CLIENT_SECRET;
    const res = await fetch(`https://${domain}/admin/oauth/access_token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: cid,
            client_secret: secret,
        }),
    });
    if (!res.ok) throw new Error(`Shopify token error ${res.status}`);
    const data = await res.json();
    return data.access_token;
}

async function notifyOwner(text) {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const owner = process.env.SOLARYN_OWNER_PHONE;
    const from = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886';
    if (!owner) return;
    const to = owner.startsWith('whatsapp:') ? owner : `whatsapp:${owner}`;
    const auth = Buffer.from(`${sid}:${token}`).toString('base64');
    const body = new URLSearchParams({ From: from, To: to, Body: text });
    try {
        await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body,
        });
    } catch { /* ignore */ }
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.status(405).json({ ok: false, error: 'Method not allowed' });
        return;
    }

    let data = req.body;
    if (typeof data === 'string') {
        try { data = JSON.parse(data); } catch { data = {}; }
    }

    const phone = String(data.phone || '').trim();
    const fullName = String(data.fullName || '').trim();
    const city = String(data.city || '').trim();
    const address = String(data.address || '').trim();
    const quantity = Math.max(1, Math.min(50, parseInt(data.quantity, 10) || 1));
    const notes = String(data.notes || '').trim();

    if (!phone || !fullName || !city || !address) {
        res.status(400).json({ ok: false, error: 'Missing required fields' });
        return;
    }

    const [firstName, ...rest] = fullName.split(/\s+/);
    const lastName = rest.join(' ') || '-';

    try {
        const token = await getShopifyToken();
        const domain = process.env.SHOPIFY_STORE_DOMAIN;
        const apiVersion = process.env.SHOPIFY_API_VERSION || '2025-10';

        const order = {
            order: {
                line_items: [{ variant_id: parseInt(SHOPIFY_VARIANT_ID, 10), quantity }],
                customer: { first_name: firstName, last_name: lastName, phone },
                shipping_address: {
                    first_name: firstName, last_name: lastName,
                    address1: address, city, country: 'Morocco', country_code: 'MA', phone,
                },
                billing_address: {
                    first_name: firstName, last_name: lastName,
                    address1: address, city, country: 'Morocco', country_code: 'MA', phone,
                },
                financial_status: 'pending',
                inventory_behaviour: 'decrement_obeying_policy',
                tags: 'manual_quick_order, whatsapp_lead',
                note: `Order placed via quick-order form.\nNotes: ${notes}`,
                send_receipt: false,
                send_fulfillment_receipt: false,
            },
        };

        const resp = await fetch(`https://${domain}/admin/api/${apiVersion}/orders.json`, {
            method: 'POST',
            headers: {
                'X-Shopify-Access-Token': token,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(order),
        });

        if (!resp.ok) {
            const text = await resp.text();
            throw new Error(`Shopify ${resp.status}: ${text.slice(0, 300)}`);
        }
        const result = await resp.json();

        await notifyOwner(
            `🎉 *Order ${result.order?.name} créée!*\n` +
            `👤 ${fullName}\n📞 ${phone}\n📍 ${address}, ${city}\n` +
            `🛒 ${quantity}× Solaryn SPF 50\n💰 ${result.order?.total_price} MAD COD`
        );

        res.status(200).json({ ok: true, order: result.order });
    } catch (err) {
        console.error('create_order_failed', err.message);
        res.status(500).json({ ok: false, error: err.message });
    }
}
