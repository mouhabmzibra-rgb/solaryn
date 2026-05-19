/**
 * Solaryn — Google Apps Script
 * Receives leads from Vercel API and INSERTS them at TOP (row 2) of the sheet.
 * Phone numbers get clickable WhatsApp + Call links.
 *
 * SETUP :
 *  1. Open the Google Sheet (1uyItM4b...).
 *  2. Extensions → Apps Script.
 *  3. Replace the default code with this file.
 *  4. Deploy → Manage deployments → Edit current → New version → Deploy
 *  5. Keep the same Web App URL (env var SHEETS_WEBHOOK_URL stays valid).
 */

const SHEET_ID = '1uyItM4b7XLPbo2xgTbOrS99MWEz6Ls16MKtVBb1F6hA';
const TARGET_SHEET = 'Feuille 1';
const AFFILIATES_SHEET = 'Affiliates';
const AFFILIATE_SALES_SHEET = 'Affiliate_Sales';

// Target column layout (matches existing sheet):
// A Date | B Téléphone | C Dernier WhatsApp | D Commandé? | E Prénom
// F Ville | G Adresse expédition | H Notes | I Appelé? | J Message client
// K Audio appel | L Upload audio | M WhatsApp | N Call
const HEADERS = ['Date','Téléphone','Dernier WhatsApp','Commandé?','Prénom','Ville','Adresse expédition','Notes','Appelé?','Message client','Audio appel','Upload audio','WhatsApp','Call'];

/**
 * Normalize Moroccan phone numbers to international E.164 (212XXXXXXXXX).
 * Accepts: 06xxxxxxxx, 6xxxxxxxx, +2126xxxxxxxx, 2126xxxxxxxx
 */
function normalizePhone(raw) {
    if (!raw) return '';
    var digits = String(raw).replace(/[^0-9]/g, '');
    if (digits.indexOf('212') === 0) return digits;
    if (digits.indexOf('0') === 0)   return '212' + digits.slice(1);
    if (digits.length === 9)         return '212' + digits;
    return digits;
}

function whatsappFormula(rawPhone) {
    var intl = normalizePhone(rawPhone);
    if (!intl) return '';
    return '=HYPERLINK("https://wa.me/' + intl + '","💬 WhatsApp")';
}

function callFormula(rawPhone) {
    var intl = normalizePhone(rawPhone);
    if (!intl) return '';
    return '=HYPERLINK("tel:+' + intl + '","📞 Call")';
}

function jsonResp(obj) {
    return ContentService
        .createTextOutput(JSON.stringify(obj))
        .setMimeType(ContentService.MimeType.JSON);
}

function getOrCreateSheet(name, headers) {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName(name);
    if (!sheet) {
        sheet = ss.insertSheet(name);
        sheet.appendRow(headers);
        sheet.getRange(1, 1, 1, headers.length)
            .setFontWeight('bold').setBackground('#1B2D4D').setFontColor('#FFFFFF');
        sheet.setFrozenRows(1);
    }
    return sheet;
}

function affiliateRegister(data) {
    var sheet = getOrCreateSheet(AFFILIATES_SHEET, ['Phone','Nom','Ville','PIN_Hash','Registered_At','Status','WhatsApp','Call']);
    var phone = normalizePhone(data.tel);
    var rows = sheet.getDataRange().getValues();
    for (var i = 1; i < rows.length; i++) {
        if (normalizePhone(rows[i][0]) === phone) {
            return jsonResp({ ok: false, error: 'phone_exists' });
        }
    }
    sheet.appendRow([
        phone, data.nom, data.ville, data.pin_hash, data.date, 'active',
        whatsappFormula(phone), callFormula(phone)
    ]);
    return jsonResp({ ok: true, affiliate_id: phone });
}

function affiliateLogin(data) {
    var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(AFFILIATES_SHEET);
    if (!sheet) return jsonResp({ ok: false });
    var phone = normalizePhone(data.tel);
    var rows = sheet.getDataRange().getValues();
    for (var i = 1; i < rows.length; i++) {
        if (normalizePhone(rows[i][0]) === phone && String(rows[i][3]) === String(data.pin_hash)) {
            if (String(rows[i][5]) !== 'active') return jsonResp({ ok: false });
            return jsonResp({ ok: true, nom: rows[i][1], ville: rows[i][2], affiliate_id: phone });
        }
    }
    return jsonResp({ ok: false });
}

function lookupAffiliateName(phone) {
    var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(AFFILIATES_SHEET);
    if (!sheet) return '';
    var rows = sheet.getDataRange().getValues();
    var p = normalizePhone(phone);
    for (var i = 1; i < rows.length; i++) {
        if (normalizePhone(rows[i][0]) === p) return String(rows[i][1] || '');
    }
    return '';
}

function affiliateSale(data) {
    var sheet = getOrCreateSheet(AFFILIATE_SALES_SHEET, [
        'Sale_ID','Date','Affiliate_Phone','Customer_Nom','Customer_Tel','Customer_Ville',
        'Customer_Adresse','Quantite','Total_MAD','Commission_MAD','Status','Notes',
        'Customer_WhatsApp','Customer_Call','Affiliate_Nom','Affiliate_WhatsApp'
    ]);
    // Backfill new headers if sheet existed with old 14-col layout
    if (sheet.getRange(1, 15).getValue() === '') {
        sheet.getRange(1, 13, 1, 4).setValues([['Customer_WhatsApp','Customer_Call','Affiliate_Nom','Affiliate_WhatsApp']])
            .setFontWeight('bold').setBackground('#1B2D4D').setFontColor('#FFFFFF');
    }
    var saleId = 'SALE-' + new Date().getTime() + '-' + Math.floor(Math.random() * 1000);
    var dateStr = Utilities.formatDate(new Date(data.date || new Date()), 'GMT+1', 'yyyy-MM-dd HH:mm:ss');
    var phone = data.customer_tel || '';
    var affPhone = data.affiliate_id || '';
    var affNom = lookupAffiliateName(affPhone);
    sheet.insertRowBefore(2);
    sheet.getRange(2, 1, 1, 16).setValues([[
        saleId, dateStr, affPhone, data.customer_nom, phone, data.customer_ville,
        data.customer_adresse, data.quantite, data.total, data.commission, 'pending', data.notes,
        whatsappFormula(phone), callFormula(phone),
        affNom, whatsappFormula(affPhone)
    ]]);
    return jsonResp({ ok: true, sale_id: saleId });
}

function adminData(data) {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var affSheet = ss.getSheetByName(AFFILIATES_SHEET);
    var salesSheet = ss.getSheetByName(AFFILIATE_SALES_SHEET);

    var affiliates = [];
    var affMap = {};
    if (affSheet) {
        var aRows = affSheet.getDataRange().getValues();
        for (var j = 1; j < aRows.length; j++) {
            var aff = {
                phone: String(aRows[j][0]),
                nom: aRows[j][1],
                ville: aRows[j][2],
                registered_at: String(aRows[j][4]),
                status: String(aRows[j][5] || 'active'),
                sales_count: 0,
                total_mad: 0,
                commission_mad: 0,
                commission_paid: 0,
                commission_pending: 0,
            };
            affiliates.push(aff);
            affMap[aff.phone] = aff;
        }
    }

    var sales = [];
    var globalStats = { affiliates: affiliates.length, count: 0, total_mad: 0, commission_mad: 0, commission_pending: 0, commission_paid: 0 };

    if (salesSheet) {
        var rows = salesSheet.getDataRange().getValues();
        for (var i = 1; i < rows.length; i++) {
            var status = String(rows[i][10] || 'pending');
            var commission = Number(rows[i][9]) || 0;
            var total = Number(rows[i][8]) || 0;
            var affPhone = String(rows[i][2]);
            var sale = {
                sale_id: rows[i][0],
                date: String(rows[i][1]),
                affiliate_phone: affPhone,
                affiliate_nom: affMap[affPhone] ? affMap[affPhone].nom : affPhone,
                customer_nom: rows[i][3],
                customer_tel: String(rows[i][4]),
                customer_ville: rows[i][5],
                customer_adresse: rows[i][6],
                quantite: rows[i][7],
                total: total,
                commission: commission,
                status: status,
                notes: rows[i][11],
            };
            sales.push(sale);
            globalStats.count++;
            globalStats.total_mad += total;
            globalStats.commission_mad += commission;
            if (status === 'paid') globalStats.commission_paid += commission;
            else if (status !== 'cancelled') globalStats.commission_pending += commission;
            if (affMap[affPhone]) {
                affMap[affPhone].sales_count++;
                affMap[affPhone].total_mad += total;
                affMap[affPhone].commission_mad += commission;
                if (status === 'paid') affMap[affPhone].commission_paid += commission;
                else if (status !== 'cancelled') affMap[affPhone].commission_pending += commission;
            }
        }
    }

    return jsonResp({ ok: true, affiliates: affiliates, sales: sales, stats: globalStats });
}

function adminUpdateSale(data) {
    var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(AFFILIATE_SALES_SHEET);
    if (!sheet) return jsonResp({ ok: false, error: 'no_sheet' });
    var rows = sheet.getDataRange().getValues();
    for (var i = 1; i < rows.length; i++) {
        if (String(rows[i][0]) === String(data.sale_id)) {
            sheet.getRange(i + 1, 11).setValue(data.status);
            return jsonResp({ ok: true });
        }
    }
    return jsonResp({ ok: false, error: 'not_found' });
}

function adminToggleAffiliate(data) {
    var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(AFFILIATES_SHEET);
    if (!sheet) return jsonResp({ ok: false, error: 'no_sheet' });
    var rows = sheet.getDataRange().getValues();
    var phone = normalizePhone(data.affiliate_phone);
    for (var i = 1; i < rows.length; i++) {
        if (normalizePhone(rows[i][0]) === phone) {
            sheet.getRange(i + 1, 6).setValue(data.status);
            return jsonResp({ ok: true });
        }
    }
    return jsonResp({ ok: false, error: 'not_found' });
}

function affiliateDashboard(data) {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var affSheet = ss.getSheetByName(AFFILIATES_SHEET);
    var salesSheet = ss.getSheetByName(AFFILIATE_SALES_SHEET);

    var affiliate = { id: data.affiliate_id, nom: '', ville: '' };
    if (affSheet) {
        var aRows = affSheet.getDataRange().getValues();
        for (var j = 1; j < aRows.length; j++) {
            if (String(aRows[j][0]) === String(data.affiliate_id)) {
                affiliate.nom = aRows[j][1];
                affiliate.ville = aRows[j][2];
                break;
            }
        }
    }

    var sales = [];
    var stats = { count: 0, total_mad: 0, commission_mad: 0, commission_pending: 0, commission_paid: 0 };

    if (salesSheet) {
        var rows = salesSheet.getDataRange().getValues();
        for (var i = 1; i < rows.length; i++) {
            if (String(rows[i][2]) === String(data.affiliate_id)) {
                var status = String(rows[i][10] || 'pending');
                var commission = Number(rows[i][9]) || 0;
                var total = Number(rows[i][8]) || 0;
                sales.push({
                    sale_id: rows[i][0],
                    date: String(rows[i][1]),
                    customer_nom: rows[i][3],
                    customer_tel: String(rows[i][4]),
                    customer_ville: rows[i][5],
                    quantite: rows[i][7],
                    total: total,
                    commission: commission,
                    status: status,
                });
                stats.count++;
                stats.total_mad += total;
                stats.commission_mad += commission;
                if (status === 'paid') stats.commission_paid += commission;
                else if (status !== 'cancelled') stats.commission_pending += commission;
            }
        }
    }

    return jsonResp({ ok: true, affiliate: affiliate, sales: sales, stats: stats });
}

function doPost(e) {
    try {
        var data = JSON.parse(e.postData.contents);
        var kind = data.kind || 'lead';

        if (kind === 'affiliate_register') return affiliateRegister(data);
        if (kind === 'affiliate_login')    return affiliateLogin(data);
        if (kind === 'affiliate_sale')     return affiliateSale(data);
        if (kind === 'affiliate_dashboard') return affiliateDashboard(data);
        if (kind === 'admin_data')         return adminData(data);
        if (kind === 'admin_update_sale')  return adminUpdateSale(data);
        if (kind === 'admin_toggle_affiliate') return adminToggleAffiliate(data);

        // Guard: don't silently fall back to lead insertion for unknown affiliate_/admin_ kinds
        if (String(kind).indexOf('affiliate_') === 0 || String(kind).indexOf('admin_') === 0) {
            return jsonResp({ ok: false, error: 'unknown_kind', kind: kind });
        }

        var ss = SpreadsheetApp.openById(SHEET_ID);
        var sheet = ss.getSheetByName(TARGET_SHEET);
        if (!sheet) sheet = ss.insertSheet(TARGET_SHEET);

        // Ensure header row matches expected layout
        if (sheet.getLastRow() === 0) {
            sheet.appendRow(HEADERS);
            sheet.getRange(1, 1, 1, HEADERS.length)
                .setFontWeight('bold')
                .setBackground('#1B2D4D')
                .setFontColor('#FFFFFF');
            sheet.setFrozenRows(1);
        }

        var date = data.date ? new Date(data.date) : new Date();
        var dateStr = Utilities.formatDate(date, 'GMT+1', 'yyyy-MM-dd HH:mm:ss');

        var phone   = data.tel || data.phone || '';
        var nom     = data.nom || '';
        var ville   = data.ville || data.city || '';
        var message = data.message || data.notes || '';
        var isAbandoned = data.kind === 'abandoned';

        // Map incoming payload → 12 sheet columns + 2 clickable cols
        var row = [
            dateStr,                                     // A Date
            phone,                                        // B Téléphone
            isAbandoned ? message : '',                   // C Dernier WhatsApp (only for abandons)
            'FALSE',                                      // D Commandé?
            nom,                                          // E Prénom
            ville,                                        // F Ville
            '',                                           // G Adresse expédition (à compléter)
            isAbandoned ? '🟡 Lead abandonné' : '',       // H Notes
            'FALSE',                                      // I Appelé?
            message,                                      // J Message client
            '',                                           // K Audio appel
            '📤 Uploader',                                // L Upload audio
            whatsappFormula(phone),                       // M WhatsApp link
            callFormula(phone)                            // N Call link
        ];

        // === INSERT AT TOP (row 2, just below the header) ===
        sheet.insertRowBefore(2);
        sheet.getRange(2, 1, 1, row.length).setValues([row]);

        return ContentService
            .createTextOutput(JSON.stringify({ ok: true, inserted_at_top: true }))
            .setMimeType(ContentService.MimeType.JSON);
    } catch (err) {
        return ContentService
            .createTextOutput(JSON.stringify({ ok: false, error: err.toString() }))
            .setMimeType(ContentService.MimeType.JSON);
    }
}

function doGet() {
    return ContentService
        .createTextOutput('Solaryn webhook is alive. Target: ' + TARGET_SHEET + '. Inserts at top + clickable phone links.')
        .setMimeType(ContentService.MimeType.TEXT);
}

/**
 * One-shot helper: run manually from Apps Script editor to backfill
 * WhatsApp + Call clickable columns for existing rows.
 * Safe to re-run — overwrites M/N for all rows.
 */
function backfillClickableLinks() {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName(TARGET_SHEET);
    if (!sheet) return;
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return;

    // Set header for WhatsApp (M) and Call (N) columns
    sheet.getRange(1, 13).setValue('WhatsApp')
        .setFontWeight('bold').setBackground('#1B2D4D').setFontColor('#FFFFFF');
    sheet.getRange(1, 14).setValue('Call')
        .setFontWeight('bold').setBackground('#1B2D4D').setFontColor('#FFFFFF');

    var phones = sheet.getRange(2, 2, lastRow - 1, 1).getValues(); // col B
    var waVals = [], callVals = [];
    phones.forEach(function(r) {
        waVals.push([whatsappFormula(r[0])]);
        callVals.push([callFormula(r[0])]);
    });
    sheet.getRange(2, 13, waVals.length, 1).setValues(waVals);
    sheet.getRange(2, 14, callVals.length, 1).setValues(callVals);
}
