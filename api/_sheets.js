import { google } from 'googleapis';

const SHEET_ID = '1uyItM4b7XLPbo2xgTbOrS99MWEz6Ls16MKtVBb1F6hA';
const AFFILIATES_TAB = 'Affiliates';
const SALES_TAB = 'Affiliate_Sales';

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

export async function readAdminData() {
    const sheets = getSheetsClient();
    const res = await sheets.spreadsheets.values.batchGet({
        spreadsheetId: SHEET_ID,
        ranges: [`${AFFILIATES_TAB}!A2:F`, `${SALES_TAB}!A2:L`],
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
    const stats = {
        affiliates: affiliates.length,
        count: 0,
        total_mad: 0,
        commission_mad: 0,
        commission_pending: 0,
        commission_paid: 0,
    };

    for (const r of salesRows) {
        const saleId = r[0];
        if (!saleId) continue;
        const affPhone = String(r[2] || '');
        const total = Number(r[8]) || 0;
        const commission = Number(r[9]) || 0;
        const status = String(r[10] || 'pending');
        const sale = {
            sale_id: saleId,
            date: toIso(r[1]),
            affiliate_phone: affPhone,
            affiliate_nom: affMap[affPhone] ? affMap[affPhone].nom : affPhone,
            customer_nom: r[3] || '',
            customer_tel: String(r[4] || ''),
            customer_ville: r[5] || '',
            customer_adresse: r[6] || '',
            quantite: Number(r[7]) || 0,
            total,
            commission,
            status,
            notes: r[11] || '',
        };
        sales.push(sale);
        stats.count++;
        stats.total_mad += total;
        stats.commission_mad += commission;
        if (status === 'paid') stats.commission_paid += commission;
        else if (status !== 'cancelled') stats.commission_pending += commission;
        const aff = affMap[affPhone];
        if (aff) {
            aff.sales_count++;
            aff.total_mad += total;
            aff.commission_mad += commission;
            if (status === 'paid') aff.commission_paid += commission;
            else if (status !== 'cancelled') aff.commission_pending += commission;
        }
    }

    sales.sort((a, b) => String(b.date).localeCompare(String(a.date)));

    return { affiliates, sales, stats };
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
    const target = String(phone).replace(/\D/g, '');
    const rowNum = await findRowIndex(AFFILIATES_TAB, 'A2:A', (r) => {
        const p = String(r[0] || '').replace(/\D/g, '');
        return p === target;
    });
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
