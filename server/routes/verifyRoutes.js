const router = require('express').Router();
const c = require('../controllers/certificateController');

// Public: anyone with the certificate number / QR code can verify it
router.get('/:certificateNo/qr.png', c.qr);
router.get('/:certificateNo', c.verify);

module.exports = router;
