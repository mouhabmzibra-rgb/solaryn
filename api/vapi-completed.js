// Vapi end-of-call webhook.
// When the AI agent finishes a call, Vapi POSTs the transcript + tool calls here.
// If the captureOrder function was called, we create a Shopify draft order with COD.

const SHOPIFY_VARIANT_ID = '53266501075257';
const SHOPIFY_LOCATION_ID = '113370661177';

async function getShopifyToken() {
    const domain = process.env.SHOPIFY_STORE_DOMAIN; // solaryn-3.myshopify.com
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
    if (!res.ok) {
        throw new Error(`Shopify token error ${res.status}: ${await res.text()}`);
    }
    const data = await res.json();
    return data.access_token;
}

function findCaptureOrderArgs(message) {
    // Vapi sends message.toolCalls or message.functionCall depending on version
    if (Array.isArray(message?.toolCalls)) {
        for (const tc of message.toolCalls) {
            if (tc?.function?.name === 'captureOrder') {
                try {
                    return typeof tc.function.arguments === 'string'
                        ? JSON.parse(tc.function.arguments)
                        : tc.function.arguments;
                } catch { /* ignore */ }
            }
        }
    }
    if (message?.functionCall?.name === 'captureOrder') {
        try {
            return typeof message.functionCall.parameters === 'string'
                ? JSON.parse(message.functionCall.parameters)
                : message.functionCall.parameters;
        } catch { /* ignore */ }
    }
    // Try to find in conversation
    const messages = message?.conversation || message?.messages || [];
    for (const m of messages) {
        if (m?.toolCalls) {
            for (const tc of m.toolCalls) {
                if (tc?.function?.name === 'captureOrder') {
                    try {
                        return typeof tc.function.arguments === 'string'
                            ? JSON.parse(tc.function.arguments)
                            : tc.function.arguments;
                    } catch { /* ignore */ }
                }
            }
        }
    }
    return null;
}

async function createShopifyOrder(orderData, token, callId) {
    const domain = process.env.SHOPIFY_STORE_DOMAIN;
    const apiVersion = process.env.SHOPIFY_API_VERSION || '2025-10';

    const [firstName, ...rest] = (orderData.fullName || 'Client').split(/\s+/);
    const lastName = rest.join(' ') || '-';
    const quantity = Math.max(1, Math.min(50, parseInt(orderData.quantity, 10) || 1));

    const order = {
        order: {
            line_items: [{
                variant_id: parseInt(SHOPIFY_VARIANT_ID, 10),
                quantity,
            }],
            customer: {
                first_name: firstName,
                last_name: lastName,
                phone: orderData.phone,
            },
            shipping_address: {
                first_name: firstName,
                last_name: lastName,
                address1: orderData.address || '-',
                city: orderData.city || '-',
                country: 'Morocco',
                country_code: 'MA',
                phone: orderData.phone,
            },
            billing_address: {
                first_name: firstName,
                last_name: lastName,
                address1: orderData.address || '-',
                city: orderData.city || '-',
                country: 'Morocco',
                country_code: 'MA',
                phone: orderData.phone,
            },
            financial_status: 'pending',
            inventory_behaviour: 'decrement_obeying_policy',
            tags: `vapi_confirmed,whatsapp_lead,call:${callId}`,
            note: `Order placed via Vapi WhatsApp automation.\nNotes: ${orderData.notes || ''}`,
            send_receipt: false,
            send_fulfillment_receipt: false,
        },
    };

    const res = await fetch(`https://${domain}/admin/api/${apiVersion}/orders.json`, {
        method: 'POST',
        headers: {
            'X-Shopify-Access-Token': token,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(order),
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Shopify order error ${res.status}: ${text.slice(0, 400)}`);
    }
    return res.json();
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
    } catch (e) {
        console.error('owner_notification_failed', e.message);
    }
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.status(405).send('Method not allowed');
        return;
    }

    // Optional shared secret check
    const expected = process.env.VAPI_WEBHOOK_SECRET;
    if (expected) {
        const provided = req.headers['x-vapi-secret'] || req.headers['authorization']?.replace(/^Bearer\s+/, '');
        if (provided !== expected) {
            res.status(403).send('Forbidden');
            return;
        }
    }

    let body = req.body;
    if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch { /* ignore */ }
    }

    const message = body?.message || body;
    const messageType = message?.type || body?.type;

    // Only act on end-of-call reports
    if (messageType !== 'end-of-call-report' && messageType !== 'tool-calls') {
        res.status(200).json({ ok: true, ignored: messageType });
        return;
    }

    const callId = message?.call?.id || body?.call?.id || 'unknown';
    const orderData = findCaptureOrderArgs(message);

    if (!orderData || orderData.wantsToOrder === false) {
        await notifyOwner(`☎️ Vapi call ${callId} ended — pas de commande (cust. didn't confirm).`);
        res.status(200).json({ ok: true, action: 'no_order' });
        return;
    }

    try {
        const token = await getShopifyToken();
        const result = await createShopifyOrder(orderData, token, callId);
        const orderName = result?.order?.name || result?.order?.id;
        await notifyOwner(
            `🎉 Commande ${orderName} créée!\n` +
            `👤 ${orderData.fullName}\n` +
            `📞 ${orderData.phone}\n` +
            `📍 ${orderData.address}, ${orderData.city}\n` +
            `🛒 Qté: ${orderData.quantity || 1}\n` +
            `💰 COD à la livraison`
        );
        res.status(200).json({ ok: true, order: result.order });
    } catch (err) {
        console.error('order_creation_failed', err.message);
        await notifyOwner(`⚠️ Vapi call ${callId} — order creation FAILED.\nDetails:\n${JSON.stringify(orderData)}\nError: ${err.message}`);
        res.status(200).json({ ok: false, error: err.message });
    }
}
