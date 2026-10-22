const router = require('express').Router();
const c = require('../controllers/certificateController');
const { protect, authorize } = require('../middleware/auth');

router.get('/:requestId/pdf', protect, authorize('student', 'admin', 'facultyadmin'), c.downloadPdf);

module.exports = router;
