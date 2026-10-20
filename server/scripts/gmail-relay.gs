/**
 * ClearPath – Gmail relay (Google Apps Script)
 * Sends ClearPath emails from YOUR Gmail account over HTTPS. Free, no domain needed,
 * and it works on hosting that blocks SMTP (like Render's free plan).
 *
 * Setup (5 minutes):
 *  1. Open https://script.google.com while signed in to the Gmail you want to send from → New project.
 *  2. Delete the sample code and paste this whole file.
 *  3. Change SECRET below to a long random word, and put the SAME value in MAIL_SCRIPT_SECRET (server/.env).
 *  4. Deploy → New deployment → gear icon → Web app.
 *       Execute as: Me      Who has access: Anyone      → Deploy → Authorize access (allow the permissions).
 *  5. Copy the "Web app URL" (ends with /exec) into MAIL_SCRIPT_URL (server/.env), then restart the server.
 *  If you change this code later: Deploy → Manage deployments → Edit → Version: New version → Deploy.
 *
 * Gmail limit: about 100 emails per day on a normal Gmail account.
 */
const SECRET = 'change-this-to-a-long-random-word';

function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents);
    if (d.secret !== SECRET) return reply({ ok: false, error: 'Wrong MAIL_SCRIPT_SECRET' });
    if (!d.to || !d.subject) return reply({ ok: false, error: 'Missing to/subject' });
    MailApp.sendEmail({
      to: d.to,
      subject: d.subject,
      body: d.text || '',
      htmlBody: d.html || undefined,
      name: d.name || 'ClearPath',
    });
    return reply({ ok: true, remainingToday: MailApp.getRemainingDailyQuota() });
  } catch (err) {
    return reply({ ok: false, error: String(err) });
  }
}

function reply(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
