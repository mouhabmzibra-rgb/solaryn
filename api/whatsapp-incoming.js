// Twilio WhatsApp incoming-message webhook.
// When a customer messages WhatsApp, Twilio POSTs here.
// We trigger an outbound Vapi call to that customer in Darija.

import crypto from 'node:crypto';

const VAPI_API_BASE = 'https://api.vapi.ai';

function parseTwilioBody(body) {
    if (typeof body === 'object' && body !== null && !Array.isArray(body)) return body;
    if (typeof body !== 'string') return {};
    return Object.fromEntries(new URLSearchParams(body));
}

function validateTwilioSignature(req, body, authToken) {
    const signature = req.headers['x-twilio-signature'];
    if (!signature) return false;
    const proto = (req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
    const host = req.headers['host'];
    const url = `${proto}://${host}${req.url}`;
    const params = parseTwilioBody(body);
    const sortedKeys = Object.keys(params).sort();
    let data = url;
    for (const k of sortedKeys) data += k + params[k];
    const expected = crypto.createHmac('sha1', authToken).update(data).digest('base64');
    return signature === expected;
}

function normalizePhone(raw) {
    // "whatsapp:+212668111173" → "+212668111173"
    return String(raw || '').replace(/^whatsapp:/, '').trim();
}

async function triggerVapiCall(toPhone, customerName, originalMessage) {
    const payload = {
        phoneNumberId: process.env.VAPI_PHONE_NUMBER_ID,
        assistantId: process.env.VAPI_ASSISTANT_ID,
        customer: {
            number: toPhone,
            name: customerName || 'Client',
        },
        assistantOverrides: {
            variableValues: {
                customerPhone: toPhone,
                originalMessage: originalMessage || '',
            },
        },
    };
    const res = await fetch(`${VAPI_API_BASE}/call`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${process.env.VAPI_PRIVATE_KEY}`,
            'Content-Type': 'application/json',
            'User-Agent': 'curl/8.7.1',
        },
        body: JSON.stringify(payload),
    });
    const text = await res.text();
    if (!res.ok) {
        throw new Error(`Vapi error ${res.status}: ${text.slice(0, 300)}`);
    }
    return JSON.parse(text);
}

export const config = { api: { bodyParser: { type: 'application/x-www-form-urlencoded' } } };

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.status(405).send('Method not allowed');
        return;
    }

    // Twilio sends application/x-www-form-urlencoded
    const params = parseTwilioBody(req.body);

    // Optional: verify signature
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    if (authToken && process.env.STRICT_SIGNATURES === '1') {
        if (!validateTwilioSignature(req, req.body, authToken)) {
            res.status(403).send('Invalid signature');
            return;
        }
    }

    const fromPhone = normalizePhone(params.From);
    const messageBody = (params.Body || '').trim();
    const profileName = (params.ProfileName || '').trim();

    if (!fromPhone || !fromPhone.startsWith('+')) {
        res.status(400).send('Invalid phone');
        return;
    }

    try {
        const call = await triggerVapiCall(fromPhone, profileName, messageBody);

        // Reply on WhatsApp letting them know we're calling
        const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>Salam ${profileName ? profileName + ' 👋 ' : ''}! Ghadi ne3yt-lik daba bach n-confirmoua l-commande dyalek 🌞</Message>
</Response>`;

        res.setHeader('Content-Type', 'text/xml');
        res.status(200).send(twiml);

        // Log success (Vercel logs)
        console.log('vapi_call_triggered', { from: fromPhone, callId: call.id });
    } catch (err) {
        console.error('vapi_call_failed', err.message);
        const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>Salam, jat-lina ressala dyalek. Ghadi nseftou-lik wahed mn team y-conferma m3ak f bzeqef. Shukran! 🌞</Message>
</Response>`;
        res.setHeader('Content-Type', 'text/xml');
        res.status(200).send(twiml);
    }
}
