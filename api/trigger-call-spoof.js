// Triggers an outbound call via Twilio DIRECTLY (bypasses Vapi BYO)
// so the caller ID displayed to the customer is your verified +212 number.
// When the customer answers, audio streams to Vapi assistant via TwiML.
//
// GET /api/trigger-call-spoof?phone=%2B212XXX&name=Ahmed

const VAPI_ASSISTANT_ID = '98361577-8e4a-4f14-8be1-109c91377c91';
const SPOOF_CALLER_ID = '+212668111173'; // Must be a verified Twilio caller ID

function htmlPage({ title, body, color = '#1B2D4D' }) {
    return `<!doctype html>
<html lang="fr"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>
  body{margin:0;font-family:-apple-system,BlinkMacSystemFont,system-ui,sans-serif;background:#FFFAF0;min-height:100vh;display:grid;place-items:center;padding:24px;color:#1B2D4D}
  .card{background:#fff;border-radius:18px;padding:36px 28px;max-width:440px;width:100%;text-align:center;box-shadow:0 12px 32px rgba(27,45,77,.1)}
  h1{margin:0 0 8px;font-size:24px;color:${color}}
  p{margin:8px 0;color:#4A5878;line-height:1.5}
  .badge{display:inline-block;background:#FCE8B6;color:#6B4F12;padding:6px 14px;border-radius:999px;font-size:12px;font-weight:700;letter-spacing:.05em;margin-bottom:14px}
  code{background:#F5EFE2;padding:2px 8px;border-radius:6px;font-size:13px}
</style></head><body><div class="card">${body}</div></body></html>`;
}

async function makeTwilioCall({ to, from, twimlUrl, twimlInline, accountSid, authToken }) {
    const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
    const params = new URLSearchParams({ To: to, From: from });
    if (twimlInline) params.append('Twiml', twimlInline);
    if (twimlUrl) params.append('Url', twimlUrl);
    const r = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`,
        {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params,
        },
    );
    const text = await r.text();
    if (!r.ok) throw new Error(`Twilio ${r.status}: ${text.slice(0, 400)}`);
    return JSON.parse(text);
}

export default async function handler(req, res) {
    const { phone, name } = req.query || {};
    if (!phone) {
        res.setHeader('Content-Type', 'text/html');
        res.status(400).send(htmlPage({
            title: 'Erreur',
            body: '<h1>❌ Phone manquant</h1><p>Param <code>phone</code> required.</p>',
            color: '#B00020',
        }));
        return;
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    if (!accountSid || !authToken) {
        res.status(500).send('Missing Twilio credentials');
        return;
    }

    // TwiML that bridges audio to Vapi assistant via Media Streams
    const proto = (req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
    const host = req.headers['host'];
    const baseUrl = `${proto}://${host}`;
    const customerName = encodeURIComponent(name || 'Client');

    // Inline TwiML — Twilio dials the customer, then streams audio to Vapi
    const twimlInline = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="wss://api.vapi.ai/twilio/inbound_call">
      <Parameter name="assistantId" value="${VAPI_ASSISTANT_ID}" />
      <Parameter name="customerName" value="${name || 'Client'}" />
      <Parameter name="customerNumber" value="${phone}" />
    </Stream>
  </Connect>
</Response>`;

    try {
        const call = await makeTwilioCall({
            to: phone,
            from: SPOOF_CALLER_ID,
            twimlInline,
            accountSid,
            authToken,
        });

        res.setHeader('Content-Type', 'text/html');
        res.status(200).send(htmlPage({
            title: 'Appel lancé',
            body: `
                <span class="badge">CALL TRIGGERED</span>
                <h1>📞 Appel en cours...</h1>
                <p>Customer: <strong>${name || 'Client'}</strong></p>
                <p><code>${phone}</code></p>
                <p>Caller ID affiché: <code>${SPOOF_CALLER_ID}</code> 🇲🇦</p>
                <p style="font-size:13px;margin-top:24px">Call SID: ${(call.sid || '').slice(0, 20)}...</p>
                <p style="font-size:13px;margin-top:8px">Status: ${call.status || 'queued'}</p>
                <p style="font-size:13px;margin-top:16px;color:#4A5878">⏳ Si réussi → customer's phone rings avec ton +212.<br>Ghizlane handles conversation darija.</p>
            `,
        }));
    } catch (err) {
        console.error('trigger_spoof_call_failed', err.message);
        res.setHeader('Content-Type', 'text/html');
        res.status(500).send(htmlPage({
            title: 'Erreur',
            body: `
                <h1>❌ Call failed</h1>
                <p>${phone}</p>
                <p style="color:#B00020;font-size:13px">${err.message.slice(0, 300)}</p>
                <p style="margin-top:24px;font-size:13px">Possible causes:<br>
                - Caller ID +212 not allowed by Maroc carrier<br>
                - Customer number invalid<br>
                - Twilio balance epuised</p>
            `,
            color: '#B00020',
        }));
    }
}
