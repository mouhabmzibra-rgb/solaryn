/**
 * Solaryn — Google Apps Script
 * Receives leads from Vercel API and appends them to the active spreadsheet.
 *
 * SETUP :
 *  1. Open your Google Sheet (or create a new one).
 *  2. Extensions → Apps Script.
 *  3. Replace the default code with this file.
 *  4. Deploy → New deployment → type "Web app"
 *       - Execute as : Me (your account)
 *       - Who has access : Anyone
 *  5. Copy the Web App URL.
 *  6. In Vercel project → Settings → Environment Variables
 *       Key  : SHEETS_WEBHOOK_URL
 *       Value: <the URL you copied>
 *  7. Redeploy on Vercel.
 */

const SHEET_ID = '1YReg6fb4aTJG5NogXdZ5Pt8NEOJ1cQooY2WgjuAq1QI';
const HEADERS_LEAD = ['Date', 'Nom', 'Téléphone', 'Ville', 'Quantité', 'Message', 'IP', 'User-Agent', 'Statut'];
const HEADERS_BULK = ['Date', 'Nom', 'Téléphone', 'Email', 'Type activité', 'Ville', 'Quantité', 'Message', 'IP', 'User-Agent', 'Statut'];
const HEADERS_ABANDONED = ['Date', 'Téléphone', 'Ville', 'Page', 'IP', 'User-Agent', 'Statut'];

function doPost(e) {
    try {
        const data = JSON.parse(e.postData.contents);
        const ss = SpreadsheetApp.openById(SHEET_ID);
        const isBulk = data.kind === 'bulk';
        const isAbandoned = data.kind === 'abandoned';
        const sheetName = isAbandoned ? 'Abandons' : (isBulk ? 'Bulk' : 'Commandes');
        const headers = isAbandoned ? HEADERS_ABANDONED : (isBulk ? HEADERS_BULK : HEADERS_LEAD);

        let sheet = ss.getSheetByName(sheetName);
        if (!sheet) {
            sheet = ss.insertSheet(sheetName);
        }

        if (sheet.getLastRow() === 0) {
            sheet.appendRow(headers);
            sheet.getRange(1, 1, 1, headers.length)
                .setFontWeight('bold')
                .setBackground('#1B2D4D')
                .setFontColor('#FFFFFF');
            sheet.setFrozenRows(1);
        }

        const date = data.date ? new Date(data.date) : new Date();
        const dateStr = Utilities.formatDate(date, 'GMT+1', 'yyyy-MM-dd HH:mm:ss');

        const row = isAbandoned
            ? [dateStr, data.tel, data.ville, data.page || '', data.ip || '', data.ua || '', 'À rappeler']
            : isBulk
            ? [dateStr, data.nom, data.tel, data.email || '', data.type_activite || '', data.ville, data.quantite, data.message || '', data.ip || '', data.ua || '', 'Nouveau']
            : [dateStr, data.nom, data.tel, data.ville, data.quantite, data.message || '', data.ip || '', data.ua || '', 'Nouveau'];

        sheet.appendRow(row);

        return ContentService
            .createTextOutput(JSON.stringify({ ok: true }))
            .setMimeType(ContentService.MimeType.JSON);
    } catch (err) {
        return ContentService
            .createTextOutput(JSON.stringify({ ok: false, error: err.toString() }))
            .setMimeType(ContentService.MimeType.JSON);
    }
}

function doGet() {
    return ContentService
        .createTextOutput('Solaryn webhook is alive.')
        .setMimeType(ContentService.MimeType.TEXT);
}
