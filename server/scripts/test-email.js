// Sends one test email using your .env settings.   Usage:  npm run test-email -- you@example.com
require('dotenv').config();
const { sendMail, emailEnabled, provider } = require('../utils/mailer');

const to = process.argv[2];
if (!to) {
  console.log('Usage: npm run test-email -- you@example.com');
  process.exit(1);
}
if (!emailEnabled()) {
  console.log('Email is not configured: set MAIL_SCRIPT_URL + MAIL_SCRIPT_SECRET (Gmail relay), BREVO_API_KEY, or SMTP_HOST/SMTP_USER/SMTP_PASS in server/.env');
  process.exit(1);
}
const via = provider();
console.log(`Sending a test email to ${to} via ${via}…`);
sendMail(to, 'ClearPath: test email', `Hello!\n\nIf you can read this, email is working in ClearPath.\n\nSent via ${via} at ${new Date().toLocaleString()}.`)
  .then(() => console.log('Done – check the inbox (and the spam folder). Any error is shown above.'));
