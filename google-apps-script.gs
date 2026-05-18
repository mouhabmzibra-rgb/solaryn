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

function doPost(e) {
    try {
        var data = JSON.parse(e.postData.contents);
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
