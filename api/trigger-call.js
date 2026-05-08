// Manual trigger endpoint — owner taps the link in their WhatsApp to launch a Vapi call.
// GET /api/trigger-call?phone=%2B212XXX&name=Ahmed

const VAPI_API_BASE = 'https://api.vapi.ai';

async function triggerVapiCall(toPhone, customerName) {
    const payload = {
        phoneNumberId: process.env.VAPI_PHONE_NUMBER_ID,
        assistantId: process.env.VAPI_ASSISTANT_ID,
        customer: {
            number: toPhone,
            name: customerName || 'Client',
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

function htmlPage({ title, body, color = '#1B2D4D' }) {
    return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>
  *{box-sizing:border-box}
  body{margin:0;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,system-ui,sans-serif;background:#FFFAF0;min-height:100vh;display:grid;place-items:center;padding:24px;color:#1B2D4D}
  .card{background:#fff;border-radius:18px;padding:36px 28px;max-width:420px;width:100%;text-align:center;box-shadow:0 12px 32px rgba(27,45,77,.1)}
  h1{margin:0 0 8px;font-size:24px;color:${color}}
  p{margin:8px 0;color:#4A5878;line-height:1.5}
  .badge{display:inline-block;background:#FCE8B6;color:#6B4F12;padding:6px 14px;border-radius:999px;font-size:12px;font-weight:700;letter-spacing:.05em;margin-bottom:14px}
  code{background:#F5EFE2;padding:2px 8px;border-radius:6px;font-size:13px}
</style>
</head>
<body>
<div class="card">
  ${body}
</div>
</body>
</html>`;
}

export default async function handler(req, res) {
    const { phone, name } = req.query || {};

    if (!phone) {
        res.setHeader('Content-Type', 'text/html');
        res.status(400).send(htmlPage({
            title: 'Erreur',
            body: '<h1>❌ Phone manquant</h1><p>L paramètre <code>phone</code> obligatoire.</p>',
            color: '#B00020',
        }));
        return;
    }

    try {
        const call = await triggerVapiCall(phone, name);
        res.setHeader('Content-Type', 'text/html');
        res.status(200).send(htmlPage({
            title: 'Vapi call lancé',
            body: `
                <span class="badge">VAPI CALL</span>
                <h1>📞 Call lancé!</h1>
                <p>Ghizlane ka-tcontactar daba <strong>${name || 'Client'}</strong></p>
                <p><code>${phone}</code></p>
                <p style="margin-top:24px;font-size:13px">📋 Call ID: ${call.id?.slice(0, 12)}...</p>
                <p style="margin-top:8px;font-size:13px">⏳ B3d ma kollchi tsafa, ghadi twselek confirmation WhatsApp m3a order details.</p>
            `,
        }));
    } catch (err) {
        console.error('trigger_call_failed', err.message);
        res.setHeader('Content-Type', 'text/html');
        res.status(500).send(htmlPage({
            title: 'Erreur Vapi',
            body: `
                <h1>⚠️ Vapi call failed</h1>
                <p>Phone: <code>${phone}</code></p>
                <p style="color:#B00020;font-size:13px;margin-top:16px">${err.message.slice(0, 200)}</p>
                <p style="margin-top:24px;font-size:13px">Try Quick add order manuel à la place.</p>
            `,
            color: '#B00020',
        }));
    }
}
