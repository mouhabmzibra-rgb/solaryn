import { google } from 'googleapis';

const SHEET_ID = '1uyItM4b7XLPbo2xgTbOrS99MWEz6Ls16MKtVBb1F6hA';
const AFFILIATES_TAB = 'Affiliates';
const SALES_TAB = 'Affiliate_Sales';

const SALES_COL_TRACKING = 'O';

let _sheetsClient = null;

function getSheetsClient() {
    if (_sheetsClient) return _sheetsClient;
    const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON env var not set');
    const jsonStr = raw.trim().startsWith('{')
        ? raw
        : Buffer.from(raw, 'base64').toString('utf-8');
    const credentials = JSON.parse(jsonStr);
    const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    _sheetsClient = google.sheets({ version: 'v4', auth });
    return _sheetsClient;
}

function toIso(val) {
    if (!val && val !== 0) return '';
    if (val instanceof Date) return val.toISOString();
    const s = String(val);
    const d = new Date(s);
    return isNaN(d.getTime()) ? s : d.toISOString();
}

function parseTrackingCell(raw) {
    if (!raw) return [];
    const s = String(raw).trim();
    if (!s) return [];
    try {
        const parsed = JSON.parse(s);
        if (Array.isArray(parsed)) return parsed.filter((u) => typeof u === 'string' && u);
    } catch {}
    return s.split(/[\s,]+/).filter((u) => /^https?:\/\//i.test(u));
}

function normalizePhone(raw) {
    return String(raw || '').replace(/\D/g, '');
}

function emptyStats() {
    return { count: 0, total_mad: 0, commission_mad: 0, commission_paid: 0, commission_pending: 0 };
}

function buildSaleObject(r) {
    const total = Number(r[8]) || 0;
    const commission = Number(r[9]) || 0;
    const status = String(r[10] || 'pending');
    return {
        sale_id: r[0],
        date: toIso(r[1]),
        affiliate_phone: String(r[2] || ''),
        customer_nom: r[3] || '',
        customer_tel: String(r[4] || ''),
        customer_ville: r[5] || '',
        customer_adresse: r[6] || '',
        quantite: Number(r[7]) || 0,
        total,
        commission,
        status,
        notes: r[11] || '',
        tracking_urls: parseTrackingCell(r[14]),
    };
}

function accumulateStats(stats, sale) {
    stats.count++;
    stats.total_mad += sale.total;
    stats.commission_mad += sale.commission;
    if (sale.status === 'paid') stats.commission_paid += sale.commission;
    else if (sale.status !== 'cancelled') stats.commission_pending += sale.commission;
}

export async function readAdminData() {
    const sheets = getSheetsClient();
    const res = await sheets.spreadsheets.values.batchGet({
        spreadsheetId: SHEET_ID,
        ranges: [`${AFFILIATES_TAB}!A2:F`, `${SALES_TAB}!A2:O`],
        valueRenderOption: 'UNFORMATTED_VALUE',
        dateTimeRenderOption: 'FORMATTED_STRING',
    });

    const [affRange, salesRange] = res.data.valueRanges || [];
    const affRows = (affRange && affRange.values) || [];
    const salesRows = (salesRange && salesRange.values) || [];

    const affiliates = [];
    const affMap = {};
    for (const r of affRows) {
        const phone = String(r[0] || '');
        if (!phone) continue;
        const aff = {
            phone,
            nom: r[1] || '',
            ville: r[2] || '',
            registered_at: toIso(r[4]),
            status: String(r[5] || 'active'),
            sales_count: 0,
            total_mad: 0,
            commission_mad: 0,
            commission_paid: 0,
            commission_pending: 0,
        };
        affiliates.push(aff);
        affMap[phone] = aff;
    }

    const sales = [];
    const stats = { affiliates: affiliates.length, ...emptyStats() };

    for (const r of salesRows) {
        if (!r[0]) continue;
        const sale = buildSaleObject(r);
        sale.affiliate_nom = affMap[sale.affiliate_phone] ? affMap[sale.affiliate_phone].nom : sale.affiliate_phone;
        sales.push(sale);
        accumulateStats(stats, sale);
        const aff = affMap[sale.affiliate_phone];
        if (aff) {
            aff.sales_count++;
            aff.total_mad += sale.total;
            aff.commission_mad += sale.commission;
            if (sale.status === 'paid') aff.commission_paid += sale.commission;
            else if (sale.status !== 'cancelled') aff.commission_pending += sale.commission;
        }
    }

    sales.sort((a, b) => String(b.date).localeCompare(String(a.date)));
    return { affiliates, sales, stats };
}

export async function getAffiliateDashboard(affiliateId) {
    const target = normalizePhone(affiliateId);
    const sheets = getSheetsClient();
    const res = await sheets.spreadsheets.values.batchGet({
        spreadsheetId: SHEET_ID,
        ranges: [`${AFFILIATES_TAB}!A2:F`, `${SALES_TAB}!A2:O`],
        valueRenderOption: 'UNFORMATTED_VALUE',
        dateTimeRenderOption: 'FORMATTED_STRING',
    });
    const [affRange, salesRange] = res.data.valueRanges || [];
    const affRows = (affRange && affRange.values) || [];
    const salesRows = (salesRange && salesRange.values) || [];

    let affiliate = null;
    for (const r of affRows) {
        if (normalizePhone(r[0]) === target) {
            affiliate = {
                id: String(r[0] || ''),
                nom: r[1] || '',
                tel: String(r[0] || ''),
                ville: r[2] || '',
                status: String(r[5] || 'active'),
            };
            break;
        }
    }
    if (!affiliate) return { ok: false, error: 'not_found' };

    const sales = [];
    const stats = emptyStats();
    for (const r of salesRows) {
        if (!r[0]) continue;
        if (normalizePhone(r[2]) !== target) continue;
        const sale = buildSaleObject(r);
        sales.push(sale);
        accumulateStats(stats, sale);
    }
    sales.sort((a, b) => String(b.date).localeCompare(String(a.date)));

    return { ok: true, affiliate, sales, stats };
}

async function findRowIndex(tab, columnRange, predicate) {
    const sheets = getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: `${tab}!${columnRange}`,
        valueRenderOption: 'UNFORMATTED_VALUE',
    });
    const rows = res.data.values || [];
    for (let i = 0; i < rows.length; i++) {
        if (predicate(rows[i])) return i + 2;
    }
    return -1;
}

export async function updateSaleStatus(saleId, status) {
    const rowNum = await findRowIndex(SALES_TAB, 'A2:A', (r) => String(r[0]) === String(saleId));
    if (rowNum === -1) return { ok: false, error: 'not_found' };
    const sheets = getSheetsClient();
    await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: `${SALES_TAB}!K${rowNum}`,
        valueInputOption: 'RAW',
        requestBody: { values: [[status]] },
    });
    return { ok: true };
}

export async function toggleAffiliateStatus(phone, status) {
    const target = normalizePhone(phone);
    const rowNum = await findRowIndex(AFFILIATES_TAB, 'A2:A', (r) => normalizePhone(r[0]) === target);
    if (rowNum === -1) return { ok: false, error: 'not_found' };
    const sheets = getSheetsClient();
    await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: `${AFFILIATES_TAB}!F${rowNum}`,
        valueInputOption: 'RAW',
        requestBody: { values: [[status]] },
    });
    return { ok: true };
}

async function readTrackingCell(saleId) {
    const sheets = getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: `${SALES_TAB}!A2:O`,
        valueRenderOption: 'UNFORMATTED_VALUE',
    });
    const rows = res.data.values || [];
    for (let i = 0; i < rows.length; i++) {
        if (String(rows[i][0]) === String(saleId)) {
            return { rowNum: i + 2, urls: parseTrackingCell(rows[i][14]) };
        }
    }
    return { rowNum: -1, urls: [] };
}

async function writeTrackingCell(rowNum, urls) {
    const sheets = getSheetsClient();
    await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: `${SALES_TAB}!${SALES_COL_TRACKING}${rowNum}`,
        valueInputOption: 'RAW',
        requestBody: { values: [[urls.length ? JSON.stringify(urls) : '']] },
    });
}

export async function appendTrackingUrl(saleId, url) {
    if (!url) return { ok: false, error: 'no_url' };
    const { rowNum, urls } = await readTrackingCell(saleId);
    if (rowNum === -1) return { ok: false, error: 'not_found' };
    if (!urls.includes(url)) urls.push(url);
    await writeTrackingCell(rowNum, urls);
    return { ok: true, urls };
}

export async function removeTrackingUrl(saleId, url) {
    const { rowNum, urls } = await readTrackingCell(saleId);
    if (rowNum === -1) return { ok: false, error: 'not_found' };
    const next = urls.filter((u) => u !== url);
    await writeTrackingCell(rowNum, next);
    return { ok: true, urls: next };
}
