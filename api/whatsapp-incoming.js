// Twilio WhatsApp incoming-message webhook (manual-trigger mode).
// When a customer messages WhatsApp, we notify the owner with action links.
// The owner decides when to launch the Vapi call by tapping the link.

import crypto from 'node:crypto';

function parseTwilioBody(body) {
    if (typeof body === 'object' && body !== null && !Array.isArray(body)) return body;
    if (typeof body !== 'string') return {};
    return Object.fromEntries(new URLSearchParams(body));
}

function normalizePhone(raw) {
    return String(raw || '').replace(/^whatsapp:/, '').trim();
}

async function sendOwnerNotification(payload) {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const owner = process.env.SOLARYN_OWNER_PHONE;
    const from = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886';
    if (!owner || !sid || !token) return false;

    const to = owner.startsWith('whatsapp:') ? owner : `whatsapp:${owner}`;
    const auth = Buffer.from(`${sid}:${token}`).toString('base64');
    const body = new URLSearchParams({ From: from, To: to, Body: payload });

    try {
        const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body,
        });
        return r.ok;
    } catch (e) {
        console.error('owner_notification_failed', e.message);
        return false;
    }
}

export const config = { api: { bodyParser: { type: 'application/x-www-form-urlencoded' } } };

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.status(405).send('Method not allowed');
        return;
    }

    const params = parseTwilioBody(req.body);
    const fromPhone = normalizePhone(params.From);
    const messageBody = (params.Body || '').trim();
    const profileName = (params.ProfileName || '').trim();

    if (!fromPhone || !fromPhone.startsWith('+')) {
        res.status(400).send('Invalid phone');
        return;
    }

    // Build the deployment base URL from request headers
    const proto = (req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
    const host = req.headers['host'];
    const baseUrl = `${proto}://${host}`;

    const phoneEnc = encodeURIComponent(fromPhone);
    const nameEnc = encodeURIComponent(profileName || 'Client');

    const ownerMsg = [
        '🆕 *NOUVEAU LEAD SOLARYN*',
        `👤 ${profileName || 'Client'}`,
        `📞 ${fromPhone}`,
        `💬 _"${messageBody.slice(0, 120)}"_`,
        '',
        '👇 *Actions:*',
        `🤖 Lance Vapi call: ${baseUrl}/api/trigger-call?phone=${phoneEnc}&name=${nameEnc}`,
        `💬 Reply WhatsApp: https://wa.me/${fromPhone.replace('+', '')}`,
        `⚡ Quick add order: ${baseUrl}/quick-order?phone=${phoneEnc}&name=${nameEnc}`,
    ].join('\n');

    const sent = await sendOwnerNotification(ownerMsg);
    console.log('lead_received', { from: fromPhone, sent });

    // Optional: send a polite reply to the customer
    const customerReply = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>Salam${profileName ? ' ' + profileName : ''}! 🌞 شكرا بزاف باش بعتي لينا. غادي نتواصلو معاك فمدة دقائق باش نأكدو الطلبية. مرحبا بيك!</Message>
</Response>`;

    res.setHeader('Content-Type', 'text/xml');
    res.status(200).send(customerReply);
}
