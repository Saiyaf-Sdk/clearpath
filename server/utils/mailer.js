const nodemailer = require('nodemailer');

/*
  Email sending. Options, checked in this order:
  1. Gmail relay     (MAIL_SCRIPT_URL + MAIL_SCRIPT_SECRET) – a tiny Google Apps Script that sends from
     your own Gmail over HTTPS. Free (about 100 emails/day), no domain or approval needed, and it works
     on Render's free plan, which blocks normal SMTP ports. See scripts/gmail-relay.gs.
  2. Brevo HTTP API  (BREVO_API_KEY) – new Brevo accounts must be approved by Brevo first.
  3. SMTP            (SMTP_HOST + SMTP_USER) – e.g. Gmail with an app password. Works on your own computer.
  4. Nothing set     – emails are printed in the server console (handy for local demos).

  Safety: addresses that start with "demo." (the seeded demo accounts) are never emailed,
  so real university mail servers don't receive demo messages. Set MAIL_SEND_TO_DEMO=true to override.
*/

const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';

let transporter = null;
if (!process.env.MAIL_SCRIPT_URL && !process.env.BREVO_API_KEY && process.env.SMTP_HOST && process.env.SMTP_USER) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

const emailEnabled = () => !!(process.env.MAIL_SCRIPT_URL || process.env.BREVO_API_KEY || (process.env.SMTP_HOST && process.env.SMTP_USER));
const provider = () => (process.env.MAIL_SCRIPT_URL ? 'Gmail relay (Apps Script)' : process.env.BREVO_API_KEY ? 'Brevo' : process.env.SMTP_HOST ? `SMTP (${process.env.SMTP_HOST})` : 'console');

// "ClearPath <no-reply@x.lk>" -> { name: 'ClearPath', email: 'no-reply@x.lk' }
const parseFrom = (from = '') => {
  const m = String(from).match(/^\s*"?([^"<]*)"?\s*<([^>]+)>\s*$/);
  if (m) return { name: m[1].trim() || 'ClearPath', email: m[2].trim() };
  return { name: 'ClearPath', email: String(from).trim() };
};

const escapeHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Simple branded HTML version of a plain-text message (links become clickable)
const toHtml = (subject, text) => {
  const body = escapeHtml(text)
    .replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" style="color:#4f46e5">$1</a>')
    .replace(/\n/g, '<br>');
  return `<!doctype html><html><body style="margin:0;background:#f7f8fb;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif">
  <div style="max-width:560px;margin:24px auto;background:#fff;border:1px solid #e5e9f0;border-radius:14px;overflow:hidden">
    <div style="padding:18px 24px;border-bottom:1px solid #e5e9f0;font-weight:700;font-size:18px;color:#0f172a">
      <span style="display:inline-block;width:26px;height:26px;line-height:26px;text-align:center;border-radius:8px;background:#4f46e5;color:#fff;margin-right:8px">&#10003;</span>ClearPath
    </div>
    <div style="padding:22px 24px;color:#334155;font-size:15px;line-height:1.6">
      <h2 style="margin:0 0 12px;font-size:17px;color:#0f172a">${escapeHtml(subject.replace(/^ClearPath:\s*/, ''))}</h2>
      ${body}
    </div>
    <div style="padding:14px 24px;background:#f7f8fb;color:#64748b;font-size:12px">This is an automatic message from ClearPath, the university clearance system.</div>
  </div></body></html>`;
};

const isDemoAddress = (to) => /^demo\./i.test(String(to)) && process.env.MAIL_SEND_TO_DEMO !== 'true';

// Sends an email; never throws (a failed email must not break the request that triggered it)
const sendMail = async (to, subject, text) => {
  if (!to) return;
  if (!emailEnabled()) {
    console.log(`[email] to=${to} | ${subject} | ${text}`);
    return;
  }
  if (isDemoAddress(to)) {
    console.log(`[email skipped – demo account] to=${to} | ${subject}`);
    return;
  }
  const from = process.env.MAIL_FROM || 'ClearPath <no-reply@clearpath.lk>';
  try {
    if (process.env.MAIL_SCRIPT_URL) {
      const res = await fetch(process.env.MAIL_SCRIPT_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ secret: process.env.MAIL_SCRIPT_SECRET || '', to, subject, text, html: toHtml(subject, text), name: parseFrom(from).name }),
        redirect: 'follow',
      });
      const raw = await res.text();
      let out = null;
      try { out = JSON.parse(raw); } catch { /* Google returned an HTML page */ }
      if (!res.ok || !out?.ok) {
        throw new Error(out?.error || `Gmail relay answered ${res.status}. Check the web app URL and that it is deployed with access "Anyone".`);
      }
    } else if (process.env.BREVO_API_KEY) {
      const res = await fetch(BREVO_URL, {
        method: 'POST',
        headers: { 'api-key': process.env.BREVO_API_KEY, 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ sender: parseFrom(from), to: [{ email: to }], subject, textContent: text, htmlContent: toHtml(subject, text) }),
      });
      if (!res.ok) throw new Error(`Brevo ${res.status}: ${(await res.text()).slice(0, 200)}`);
    } else {
      await transporter.sendMail({ from, to, subject, text, html: toHtml(subject, text) });
    }
    console.log(`[email sent] to=${to} | ${subject}`);
  } catch (err) {
    console.error(`Email to ${to} failed: ${err.message}`);
  }
};

module.exports = { sendMail, emailEnabled, provider };
