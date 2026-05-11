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

// Hash function for PII (SHA-256) — required by TikTok Events API
async function sha256(str) {
    const crypto = await import('node:crypto');
    return crypto.createHash('sha256').update(String(str).toLowerCase().trim()).digest('hex');
}

// Send Sale event to TikTok server-side (more reliable than pixel)
async function fireTikTokEvent(orderData) {
    const token = process.env.TIKTOK_ACCESS_TOKEN || '18eee8dbb9e1b0edf67c08c9a6271493a71cde94';
    const pixelId = process.env.TIKTOK_PIXEL_ID || 'D80ESLJC77U3PBBHM3J0';
    if (!token || !pixelId) return;

    try {
        const phoneE164 = orderData.phone.startsWith('+212')
            ? orderData.phone
            : ('+212' + orderData.phone.replace(/^0/, ''));
        const phoneHash = await sha256(phoneE164);
        const eventId = `solaryn_order_${orderData.orderId}`;

        const payload = {
            event_source: 'web',
            event_source_id: pixelId,
            data: [{
                event: 'CompletePayment',
                event_time: Math.floor(Date.now() / 1000),
                event_id: eventId,
                user: {
                    phone: phoneHash,
                    external_id: await sha256(String(orderData.orderId)),
                },
                properties: {
                    currency: 'MAD',
                    value: parseFloat(orderData.value || 99),
                    contents: [{
                        content_id: '53266501075257',
                        content_type: 'product',
                        content_name: 'Solaryn SPF 50',
                        quantity: orderData.quantity || 1,
                        price: parseFloat(orderData.value || 99),
                    }],
                },
                page: {
                    url: 'https://solaryn.co/products/ecran-solaire-solaryn-spf-50',
                },
            }],
        };

        await fetch('https://business-api.tiktok.com/open_api/v1.3/event/track/', {
            method: 'POST',
            headers: {
                'Access-Token': token,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });
    } catch { /* ignore */ }
}

async function notifyOwner(text) {
    // Send to Telegram (primary, instant, free)
    const tgToken = process.env.TELEGRAM_BOT_TOKEN || '8719409348:AAGob_39mSvd1NeYo6LhLZXZ-Tu7_ur6ccI';
    const tgChat = process.env.TELEGRAM_CHAT_ID || '8113442719';
    if (tgToken && tgChat) {
        // Try with HTML parse_mode first (handles tel: links and special chars)
        let sent = false;
        try {
            const r = await fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: tgChat,
                    text,
                    parse_mode: 'HTML',
                    disable_web_page_preview: true,
                }),
            });
            sent = r.ok;
        } catch (e) { sent = false; }
        // Fallback: plain text without parsing if HTML failed
        if (!sent) {
            try {
                await fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chat_id: tgChat,
                        text: text.replace(/<[^>]+>/g, '').replace(/\*/g, ''),
                        disable_web_page_preview: true,
                    }),
                });
            } catch { /* ignore */ }
        }
    }

    // Backup: Twilio WhatsApp (if available)
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const owner = process.env.SOLARYN_OWNER_PHONE;
    const from = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886';
    if (!sid || !token || !owner) return;
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
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
    }

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

        // Look up existing customer by phone to avoid duplicate phone error
        let existingCustomerId = null;
        try {
            const phoneVariants = [phone];
            if (phone.startsWith('0')) phoneVariants.push('+212' + phone.slice(1));
            if (phone.startsWith('+212')) phoneVariants.push('0' + phone.slice(4));
            for (const p of phoneVariants) {
                const searchResp = await fetch(
                    `https://${domain}/admin/api/${apiVersion}/customers/search.json?query=${encodeURIComponent('phone:' + p)}`,
                    { headers: { 'X-Shopify-Access-Token': token } }
                );
                if (searchResp.ok) {
                    const sd = await searchResp.json();
                    if (sd.customers && sd.customers.length > 0) {
                        existingCustomerId = sd.customers[0].id;
                        break;
                    }
                }
            }
        } catch { /* fall through to no customer match */ }

        // Build a unique fake email per phone+time to avoid email collision
        const phoneDigits = phone.replace(/\D/g, '').slice(-10);
        const fakeEmail = `${phoneDigits}.${Date.now()}@solaryn.co`;

        const orderPayload = {
            order: {
                line_items: [{ variant_id: parseInt(SHOPIFY_VARIANT_ID, 10), quantity }],
                email: fakeEmail,
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

        // Link to existing customer if found (avoids phone collision)
        if (existingCustomerId) {
            orderPayload.order.customer = { id: existingCustomerId };
        }

        const resp = await fetch(`https://${domain}/admin/api/${apiVersion}/orders.json`, {
            method: 'POST',
            headers: {
                'X-Shopify-Access-Token': token,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(orderPayload),
        });

        if (!resp.ok) {
            const text = await resp.text();
            // Last-resort retry without any customer/email if phone-related error
            if (text.includes('phone') || text.includes('email')) {
                const fallback = {
                    order: {
                        ...orderPayload.order,
                        email: `guest.${Date.now()}@solaryn.co`,
                    },
                };
                delete fallback.order.customer;
                const retryResp = await fetch(`https://${domain}/admin/api/${apiVersion}/orders.json`, {
                    method: 'POST',
                    headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
                    body: JSON.stringify(fallback),
                });
                if (!retryResp.ok) {
                    const retryText = await retryResp.text();
                    throw new Error(`Shopify ${retryResp.status}: ${retryText.slice(0, 300)}`);
                }
                const retryResult = await retryResp.json();
                const rOrderName = retryResult.order?.name || '?';
                const rOrderId = retryResult.order?.id || Date.now();
                const rTotal = retryResult.order?.total_price || '99.00';
                fireTikTokEvent({
                    orderId: rOrderId, phone: phone.startsWith('+212') ? phone : ('+212' + phone.slice(1)),
                    value: rTotal, quantity,
                }).catch(() => {});
                const rIsLead = fullName === 'Client à confirmer';
                const rCleanPhone = phone.replace(/\s+/g,'').replace(/^\+212/, '0');
                const rIntlPhone = phone.startsWith('+212') ? phone : ('+212' + phone.slice(1));
                const rWaNum = rIntlPhone.replace('+','');
                await notifyOwner(
                    (rIsLead ? `📞 <b>NOUVEAU LEAD ${rOrderName}</b>\n` : `🎉 <b>Commande ${rOrderName}</b>\n`) +
                    `\n📱 <b>${rCleanPhone}</b>\n📍 ${city}\n` +
                    (rIsLead ? '' : `👤 ${fullName}\n📦 ${address}\n`) +
                    `🛒 ${quantity}× Solaryn SPF 50 — <b>${rTotal} MAD</b>\n\n` +
                    (rIsLead ? `⏰ Appeler dans 5 min\n\n` : '') +
                    `📞 <a href="tel:${rIntlPhone}">Appeler</a>\n💬 <a href="https://wa.me/${rWaNum}">WhatsApp</a>`
                );
                res.status(200).json({ ok: true, order: retryResult.order });
                return;
            }
            throw new Error(`Shopify ${resp.status}: ${text.slice(0, 300)}`);
        }
        const result = await resp.json();

        const orderName = result.order?.name || '?';
        const orderId = result.order?.id || Date.now();
        const totalPrice = result.order?.total_price || '99.00';
        const isLead = fullName === 'Client à confirmer';
        const cleanPhone = phone.replace(/\s+/g,'').replace(/^\+212/, '0');
        const intlPhone = phone.startsWith('+212') ? phone : ('+212' + phone.slice(1));
        const waNum = intlPhone.replace('+','');

        // Fire TikTok CompletePayment event server-side for optimization
        fireTikTokEvent({
            orderId, phone: intlPhone, value: totalPrice, quantity,
        }).catch(() => {});
        await notifyOwner(
            (isLead ? `📞 <b>NOUVEAU LEAD ${orderName}</b>\n` : `🎉 <b>Commande ${orderName}</b>\n`) +
            `\n📱 <b>${cleanPhone}</b>\n` +
            `📍 ${city}\n` +
            (isLead ? '' : `👤 ${fullName}\n📦 ${address}\n`) +
            `🛒 ${quantity}× Solaryn SPF 50 — <b>${totalPrice} MAD</b>\n` +
            `\n` +
            (isLead ? `⏰ Appeler dans 5 min\n\n` : '\n') +
            `📞 <a href="tel:${intlPhone}">Appeler maintenant</a>\n` +
            `💬 <a href="https://wa.me/${waNum}">WhatsApp</a>`
        );

        res.status(200).json({ ok: true, order: result.order });
    } catch (err) {
        console.error('create_order_failed', err.message);
        res.status(500).json({ ok: false, error: err.message });
    }
}
