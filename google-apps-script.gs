/**
 * Solaryn — Google Apps Script
 * Receives leads from Vercel API and INSERTS them at TOP of the spreadsheet.
 * Phone numbers become clickable WhatsApp links.
 *
 * SETUP :
 *  1. Open your Google Sheet.
 *  2. Extensions → Apps Script.
 *  3. Replace the default code with this file.
 *  4. Deploy → Manage deployments → Edit current → New version → Deploy
 *  5. Keep the same Web App URL (env var SHEETS_WEBHOOK_URL stays valid).
 */

const SHEET_ID = '1YReg6fb4aTJG5NogXdZ5Pt8NEOJ1cQooY2WgjuAq1QI';
const HEADERS_LEAD      = ['Date', 'Nom', 'Téléphone', 'Ville', 'Quantité', 'Message', 'IP', 'User-Agent', 'Statut', 'WhatsApp', 'Call'];
const HEADERS_BULK      = ['Date', 'Nom', 'Téléphone', 'Email', 'Type activité', 'Ville', 'Quantité', 'Message', 'IP', 'User-Agent', 'Statut', 'WhatsApp', 'Call'];
const HEADERS_ABANDONED = ['Date', 'Téléphone', 'Ville', 'Page', 'IP', 'User-Agent', 'Statut', 'WhatsApp', 'Call'];

/**
 * Normalize Moroccan phone numbers to international E.164 format (212XXXXXXXXX).
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
        var isBulk = data.kind === 'bulk';
        var isAbandoned = data.kind === 'abandoned';
        var sheetName = isAbandoned ? 'Abandons' : (isBulk ? 'Bulk' : 'Commandes');
        var headers   = isAbandoned ? HEADERS_ABANDONED : (isBulk ? HEADERS_BULK : HEADERS_LEAD);

        var sheet = ss.getSheetByName(sheetName);
        if (!sheet) sheet = ss.insertSheet(sheetName);

        // Ensure header row
        if (sheet.getLastRow() === 0) {
            sheet.appendRow(headers);
            sheet.getRange(1, 1, 1, headers.length)
                .setFontWeight('bold')
                .setBackground('#1B2D4D')
                .setFontColor('#FFFFFF');
            sheet.setFrozenRows(1);
        }

        var date = data.date ? new Date(data.date) : new Date();
        var dateStr = Utilities.formatDate(date, 'GMT+1', 'yyyy-MM-dd HH:mm:ss');

        var phone = data.tel || data.phone || '';
        var waLink = whatsappFormula(phone);
        var callLink = callFormula(phone);

        var row;
        if (isAbandoned) {
            row = [dateStr, phone, data.ville || data.city || '', data.page || '', data.ip || '', data.ua || '', 'À rappeler', waLink, callLink];
        } else if (isBulk) {
            row = [dateStr, data.nom, phone, data.email || '', data.type_activite || '', data.ville, data.quantite, data.message || '', data.ip || '', data.ua || '', 'Nouveau', waLink, callLink];
        } else {
            row = [dateStr, data.nom, phone, data.ville, data.quantite, data.message || '', data.ip || '', data.ua || '', 'Nouveau', waLink, callLink];
        }

        // === INSERT AT TOP (row 2, just below header) ===
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
        .createTextOutput('Solaryn webhook is alive. Inserts at top with clickable phone links.')
        .setMimeType(ContentService.MimeType.TEXT);
}

/**
 * One-shot helper: run manually from Apps Script editor to add WhatsApp + Call
 * columns + formulas to ALL existing rows in Commandes, Bulk, and Abandons.
 * Run once after deploying the new script. Safe to re-run.
 */
function backfillClickableLinks() {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var configs = [
        { name: 'Commandes', phoneCol: 3, afterCol: 9 },   // Statut is col 9
        { name: 'Bulk',      phoneCol: 3, afterCol: 11 },  // Statut is col 11
        { name: 'Abandons',  phoneCol: 2, afterCol: 7 }    // Statut is col 7
    ];

    configs.forEach(function(cfg) {
        var sheet = ss.getSheetByName(cfg.name);
        if (!sheet) return;
        var lastRow = sheet.getLastRow();
        if (lastRow < 2) return;

        // Set header for WhatsApp and Call columns
        sheet.getRange(1, cfg.afterCol + 1).setValue('WhatsApp')
            .setFontWeight('bold').setBackground('#1B2D4D').setFontColor('#FFFFFF');
        sheet.getRange(1, cfg.afterCol + 2).setValue('Call')
            .setFontWeight('bold').setBackground('#1B2D4D').setFontColor('#FFFFFF');

        var phones = sheet.getRange(2, cfg.phoneCol, lastRow - 1, 1).getValues();
        var waVals = [], callVals = [];
        phones.forEach(function(r) {
            waVals.push([whatsappFormula(r[0])]);
            callVals.push([callFormula(r[0])]);
        });
        sheet.getRange(2, cfg.afterCol + 1, waVals.length, 1).setValues(waVals);
        sheet.getRange(2, cfg.afterCol + 2, callVals.length, 1).setValues(callVals);
    });
}
