// Twilio TwiML endpoint for incoming WhatsApp Calling.
// Returns TwiML that streams the call audio to Vapi via Media Streams,
// so the Vapi assistant (Ghizlane) handles the WhatsApp call.

const VAPI_ASSISTANT_ID = '98361577-8e4a-4f14-8be1-109c91377c91';
const VAPI_STREAM_URL = 'wss://api.vapi.ai/twilio/inbound_call'; // Vapi's Twilio Media Streams endpoint

export const config = { api: { bodyParser: { type: 'application/x-www-form-urlencoded' } } };

export default async function handler(req, res) {
    if (req.method !== 'POST' && req.method !== 'GET') {
        res.status(405).send('Method not allowed');
        return;
    }

    // Parse Twilio params
    let body = req.body || {};
    if (typeof body === 'string') body = Object.fromEntries(new URLSearchParams(body));

    const from = body.From || '';
    const callSid = body.CallSid || '';

    console.log('whatsapp_call_inbound', { from, callSid });

    const assistantId = process.env.VAPI_ASSISTANT_ID || VAPI_ASSISTANT_ID;

    // TwiML: bridge audio between Twilio (WhatsApp call) and Vapi assistant
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${VAPI_STREAM_URL}">
      <Parameter name="assistantId" value="${assistantId}" />
      <Parameter name="customerNumber" value="${from}" />
    </Stream>
  </Connect>
</Response>`;

    res.setHeader('Content-Type', 'text/xml');
    res.status(200).send(twiml);
}
