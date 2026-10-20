const nodemailer = require('nodemailer');

let transporter = null;
if (process.env.SMTP_HOST && process.env.SMTP_USER) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

// Sends an email if SMTP is configured, otherwise logs it (handy for demos)
const sendMail = async (to, subject, text) => {
  if (!to) return;
  if (!transporter) {
    console.log(`[email] to=${to} | ${subject} | ${text}`);
    return;
  }
  try {
    await transporter.sendMail({ from: process.env.MAIL_FROM, to, subject, text });
  } catch (err) {
    console.error('Email failed:', err.message);
  }
};

module.exports = { sendMail };
