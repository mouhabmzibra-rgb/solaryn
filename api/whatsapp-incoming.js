// Twilio WhatsApp incoming-message webhook (TEXT BOT MODE).
// State machine in Darija: greets, collects name → city → address → confirms → creates Shopify order.
// State stored on the Shopify customer record (tags + first_name/last_name/default_address).

const SHOPIFY_VARIANT_ID = '53266501075257';

function parseTwilioBody(body) {
    if (typeof body === 'object' && body !== null && !Array.isArray(body)) return body;
    if (typeof body !== 'string') return {};
    return Object.fromEntries(new URLSearchParams(body));
}

function normalizePhone(raw) {
    return String(raw || '').replace(/^whatsapp:/, '').trim();
}

function twiml(text) {
    const escaped = String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${escaped}</Message>
</Response>`;
}

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

async function shopifyApi(path, options = {}, token) {
    const domain = process.env.SHOPIFY_STORE_DOMAIN;
    const apiVersion = process.env.SHOPIFY_API_VERSION || '2025-10';
    const res = await fetch(`https://${domain}/admin/api/${apiVersion}${path}`, {
        ...options,
        headers: {
            'X-Shopify-Access-Token': token,
            'Content-Type': 'application/json',
            ...(options.headers || {}),
        },
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Shopify ${path} ${res.status}: ${text.slice(0, 300)}`);
    }
    return res.json();
}

async function getCustomerByPhone(phone, token) {
    // Try with + prefix first, then without
    let data = await shopifyApi(
        `/customers/search.json?query=${encodeURIComponent('phone:' + phone)}`,
        {}, token
    );
    if (data.customers && data.customers.length > 0) return data.customers[0];
    const stripped = phone.replace(/^\+/, '');
    data = await shopifyApi(
        `/customers/search.json?query=${encodeURIComponent('phone:' + stripped)}`,
        {}, token
    );
    return (data.customers || [])[0] || null;
}

async function createCustomer(phone, token) {
    const data = await shopifyApi('/customers.json', {
        method: 'POST',
        body: JSON.stringify({
            customer: {
                phone,
                tags: 'whatsapp_lead, state:NEW',
                accepts_marketing: false,
            },
        }),
    }, token);
    return data.customer;
}

function getStateTag(customer) {
    const tags = (customer?.tags || '').split(',').map(t => t.trim());
    const stateTag = tags.find(t => t.startsWith('state:'));
    return stateTag ? stateTag.split(':')[1] : 'NEW';
}

async function setCustomerState(customerId, newState, token, extraFields = {}) {
    const customer = (await shopifyApi(`/customers/${customerId}.json`, {}, token)).customer;
    const tags = (customer.tags || '').split(',').map(t => t.trim()).filter(Boolean);
    const filtered = tags.filter(t => !t.startsWith('state:'));
    filtered.push('state:' + newState);
    if (!filtered.includes('whatsapp_lead')) filtered.push('whatsapp_lead');
    const updateBody = {
        customer: { id: customerId, tags: filtered.join(', '), ...extraFields },
    };
    await shopifyApi(`/customers/${customerId}.json`, {
        method: 'PUT',
        body: JSON.stringify(updateBody),
    }, token);
}

async function setCustomerAddress(customerId, address1, city, token) {
    const data = await shopifyApi(`/customers/${customerId}/addresses.json`, {
        method: 'POST',
        body: JSON.stringify({
            address: {
                address1,
                city,
                country: 'Morocco',
                country_code: 'MA',
                default: true,
            },
        }),
    }, token);
    return data.customer_address;
}

async function createOrder(customer, token) {
    const phone = customer.phone || customer.default_address?.phone;
    const addr = customer.default_address || (customer.addresses && customer.addresses[0]) || {};
    const order = {
        order: {
            line_items: [{ variant_id: parseInt(SHOPIFY_VARIANT_ID, 10), quantity: 1 }],
            customer: { id: customer.id },
            shipping_address: {
                first_name: customer.first_name || '-',
                last_name: customer.last_name || '-',
                address1: addr.address1 || '-',
                city: addr.city || '-',
                country: 'Morocco',
                country_code: 'MA',
                phone,
            },
            billing_address: {
                first_name: customer.first_name || '-',
                last_name: customer.last_name || '-',
                address1: addr.address1 || '-',
                city: addr.city || '-',
                country: 'Morocco',
                country_code: 'MA',
                phone,
            },
            financial_status: 'pending',
            inventory_behaviour: 'decrement_obeying_policy',
            tags: 'whatsapp_bot, COD',
            note: 'Order placed via WhatsApp text bot',
            send_receipt: false,
            send_fulfillment_receipt: false,
        },
    };
    const result = await shopifyApi('/orders.json', {
        method: 'POST',
        body: JSON.stringify(order),
    }, token);
    return result.order;
}

async function notifyOwner(text) {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const owner = process.env.SOLARYN_OWNER_PHONE;
    const from = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886';
    if (!owner || !sid || !token) return;
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
        console.error('owner_notify_failed', e.message);
    }
}

// ────────────────────────────────────────────────────────────────────
// Conversation state machine
// ────────────────────────────────────────────────────────────────────

function isYes(text) {
    const lower = text.toLowerCase();
    const yesWords = ['oui', 'yes', 'iyeh', 'iyyeh', 'iyy', 'naam', 'na3am', 'eyh', 'ayyeh', 'ah', 'wakha', 'wkha', '7sn', 'ok', 'd accord', 'dac', 'tmam', 'tmam', 'sahbi', 'sahbtek'];
    return yesWords.some(w => lower.includes(w));
}

function isNo(text) {
    const lower = text.toLowerCase();
    return /\bla\b|\bnon\b|\bno\b|\bnope\b|maba?ghi/i.test(lower);
}

function isOrderIntent(text) {
    const lower = text.toLowerCase();
    return /bghi|bri|nbghi|nb?ri|tle?b|kommand|commande|order|solar?yn|spf|crem|dial|achat/.test(lower);
}

async function processMessage(state, messageBody, customer, token) {
    const msg = messageBody.trim();

    switch (state) {
        case 'NEW':
            if (isOrderIntent(msg) || isYes(msg)) {
                return {
                    reply: `السلام! 🌞 شكرا بزاف باش تواصلتي معانا.\n\n*Solaryn SPF 50* - واقي شمس مغربي:\n💰 99 درهم\n🚚 توصيل مجاني فالمغرب كامل\n💵 الدفع عند الاستلام\n📦 توصيل ف 2-5 يام\n\nواش بغيتي تطلبي وحدة؟ (جاوب ب *نعم* لإكمال الطلبية)`,
                    newState: 'AWAITING_CONFIRMATION',
                };
            }
            return {
                reply: `السلام! 🌞 أنا غزلان من Solaryn.\nواش باغية تطلبي *Solaryn SPF 50* (واقي شمس) ب 99 درهم؟ جاوب *نعم* للاستمرار.`,
                newState: 'AWAITING_CONFIRMATION',
            };

        case 'AWAITING_CONFIRMATION':
            if (isYes(msg) || isOrderIntent(msg)) {
                return {
                    reply: `ممتاز! ✨\n\nباش نسيفطو الطلبية، عافاك بعتي لينا:\n\n1️⃣ *السمية الكاملة*\n\n(مثال: Ahmed Benali)`,
                    newState: 'AWAITING_NAME',
                };
            }
            if (isNo(msg)) {
                return {
                    reply: `بلا مشكل، شكرا. ⚘ سلامات!`,
                    newState: 'NEW',
                };
            }
            return {
                reply: `عافاك جاوب ب *نعم* أو *لا*. 🌸\nواش بغيتي *Solaryn SPF 50* ب 99 درهم؟`,
                newState: 'AWAITING_CONFIRMATION',
            };

        case 'AWAITING_NAME':
            if (msg.length < 2 || msg.length > 80) {
                return {
                    reply: `عافاك بعتي السمية الكاملة.\n(مثال: Ahmed Benali)`,
                    newState: 'AWAITING_NAME',
                };
            }
            const parts = msg.split(/\s+/);
            const firstName = parts[0];
            const lastName = parts.slice(1).join(' ') || '-';
            return {
                reply: `شكرا ${firstName}! 👌\n\n2️⃣ *من أي مدينة نتي/نتا*؟\n(مثال: Casablanca)`,
                newState: 'AWAITING_CITY',
                update: { first_name: firstName, last_name: lastName },
            };

        case 'AWAITING_CITY':
            if (msg.length < 2 || msg.length > 80) {
                return {
                    reply: `عافاك بعتي اسم المدينة.\n(مثال: Casablanca)`,
                    newState: 'AWAITING_CITY',
                };
            }
            return {
                reply: `زوين! 📍\n\n3️⃣ *العنوان الكامل* عافاك:\n(الزنقة، الرقم، الحي/الحومة)`,
                newState: 'AWAITING_ADDRESS',
                tempCity: msg,
            };

        case 'AWAITING_ADDRESS': {
            if (msg.length < 5 || msg.length > 200) {
                return {
                    reply: `عافاك بعتي العنوان الكامل (5 حروف على الأقل).`,
                    newState: 'AWAITING_ADDRESS',
                };
            }
            // Save address
            // We need the city — it was saved on previous step via customer record (we didn't actually save; let's save now)
            // For simplicity, store address and city together in customer's default_address
            return {
                reply: `📋 *تأكيد الطلبية*:\n\n👤 ${customer.first_name || '-'} ${customer.last_name || ''}\n📞 ${customer.phone}\n📍 ${msg}\n🛒 1× Solaryn SPF 50\n💰 99 درهم\n🚚 توصيل مجاني\n💵 الدفع عند الاستلام\n\nأكدي ب *OK* للإرسال، أو *تعديل* للتغيير.`,
                newState: 'AWAITING_FINAL_CONFIRMATION',
                pendingAddress: msg,
            };
        }

        case 'AWAITING_FINAL_CONFIRMATION':
            if (isYes(msg)) {
                return {
                    action: 'create_order',
                    newState: 'ORDERED',
                };
            }
            if (msg.toLowerCase().includes('تعديل') || msg.toLowerCase().includes('modif')) {
                return {
                    reply: `بلا مشكل. عاود السمية الكاملة عافاك:`,
                    newState: 'AWAITING_NAME',
                };
            }
            return {
                reply: `عافاك جاوب ب *OK* للتأكيد أو *تعديل* للتغيير.`,
                newState: 'AWAITING_FINAL_CONFIRMATION',
            };

        case 'ORDERED':
            return {
                reply: `الطلبية ديالك مسجلة! 🎉 سنتواصل معاك قريبا.`,
                newState: 'ORDERED',
            };

        default:
            return {
                reply: `السلام! 🌞 أنا غزلان من Solaryn.\nواش باغية تطلبي *Solaryn SPF 50* (واقي شمس) ب 99 درهم؟ جاوب *نعم* للاستمرار.`,
                newState: 'AWAITING_CONFIRMATION',
            };
    }
}

// ────────────────────────────────────────────────────────────────────
// Handler
// ────────────────────────────────────────────────────────────────────

export const config = { api: { bodyParser: { type: 'application/x-www-form-urlencoded' } } };

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.status(405).send('Method not allowed');
        return;
    }

    const params = parseTwilioBody(req.body);
    const fromPhone = normalizePhone(params.From);
    const messageBody = (params.Body || '').trim();

    if (!fromPhone || !fromPhone.startsWith('+')) {
        res.status(400).send('Invalid phone');
        return;
    }

    try {
        const token = await getShopifyToken();

        // Get or create customer
        let customer = await getCustomerByPhone(fromPhone, token);
        if (!customer) customer = await createCustomer(fromPhone, token);

        // Get current state from tags
        const state = getStateTag(customer);

        // Process message
        const result = await processMessage(state, messageBody, customer, token);

        // Update customer state + extra fields
        if (result.update) {
            await setCustomerState(customer.id, result.newState, token, result.update);
        } else {
            await setCustomerState(customer.id, result.newState, token);
        }

        // Save city if provided
        if (result.tempCity) {
            // We persist city later when we have address; for now store in note
            await shopifyApi(`/customers/${customer.id}.json`, {
                method: 'PUT',
                body: JSON.stringify({
                    customer: { id: customer.id, note: `tempCity:${result.tempCity}` },
                }),
            }, token);
        }

        // Save address (combined with previously stored city)
        if (result.pendingAddress) {
            const cust = (await shopifyApi(`/customers/${customer.id}.json`, {}, token)).customer;
            const cityFromNote = (cust.note || '').match(/tempCity:(.+)/)?.[1]?.trim() || '';
            await setCustomerAddress(customer.id, result.pendingAddress, cityFromNote, token);
        }

        // Execute order action
        if (result.action === 'create_order') {
            const fullCust = (await shopifyApi(`/customers/${customer.id}.json`, {}, token)).customer;
            try {
                const order = await createOrder(fullCust, token);
                const orderName = order?.name || order?.id;
                const successText = `🎉 شكرا! الطلبية ديالك مسجلة:\n*Order ${orderName}*\n\n✅ Solaryn SPF 50 — 99 درهم\n📦 توصيل ف 2-5 يام\n💵 الدفع عند الاستلام\n\nسنتواصل معاك ل تأكيد. شكرا بزاف! 🌞`;
                await notifyOwner(
                    `🎉 *Order ${orderName} via WhatsApp bot*\n` +
                    `👤 ${fullCust.first_name} ${fullCust.last_name}\n` +
                    `📞 ${fromPhone}\n` +
                    `📍 ${fullCust.default_address?.address1}, ${fullCust.default_address?.city}\n` +
                    `💰 ${order?.total_price} MAD COD`
                );
                res.setHeader('Content-Type', 'text/xml');
                res.status(200).send(twiml(successText));
                return;
            } catch (err) {
                console.error('order_failed', err.message);
                await notifyOwner(`⚠️ Order creation FAILED for ${fromPhone}\nName: ${fullCust.first_name} ${fullCust.last_name}\nError: ${err.message}`);
                res.setHeader('Content-Type', 'text/xml');
                res.status(200).send(twiml('عذرا، وقع مشكل تقني. سنتواصل معاك قريبا.'));
                return;
            }
        }

        // Standard reply
        res.setHeader('Content-Type', 'text/xml');
        res.status(200).send(twiml(result.reply));
    } catch (err) {
        console.error('whatsapp_bot_error', err.message, err.stack);
        // In debug mode, surface the error so we can fix it; otherwise show friendly message
        const debug = process.env.BOT_DEBUG === '1';
        const fallback = debug
            ? `[DEBUG] ${err.message.slice(0, 300)}`
            : 'السلام! وقع مشكل صغير، عاود الرسالة عافاك. 🌷';
        res.setHeader('Content-Type', 'text/xml');
        res.status(200).send(twiml(fallback));
    }
}
