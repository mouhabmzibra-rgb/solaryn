import crypto from 'crypto';

const SECRET = process.env.AFFILIATE_HMAC_SECRET || 'CHANGE_ME_IN_VERCEL_ENV';

export function hashPin(pin) {
    return crypto.createHmac('sha256', SECRET).update('pin:' + String(pin)).digest('hex');
}

export function signToken(affiliateId, expiryHours = 24 * 30) {
    const exp = Math.floor(Date.now() / 1000) + expiryHours * 3600;
    const payload = `${affiliateId}.${exp}`;
    const sig = crypto.createHmac('sha256', SECRET).update(payload).digest('hex');
    return `${payload}.${sig}`;
}

export function verifyToken(token) {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [id, exp, sig] = parts;
    const expected = crypto.createHmac('sha256', SECRET).update(`${id}.${exp}`).digest('hex');
    try {
        const sigBuf = Buffer.from(sig, 'hex');
        const expBuf = Buffer.from(expected, 'hex');
        if (sigBuf.length !== expBuf.length) return null;
        if (!crypto.timingSafeEqual(sigBuf, expBuf)) return null;
    } catch { return null; }
    if (parseInt(exp, 10) < Math.floor(Date.now() / 1000)) return null;
    return { affiliateId: id };
}

export function bearerToken(req) {
    const auth = req.headers['authorization'] || '';
    if (auth.startsWith('Bearer ')) return auth.slice(7).trim();
    return '';
}
