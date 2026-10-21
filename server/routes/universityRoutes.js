const router = require('express').Router();
const c = require('../controllers/universityController');

// Public
router.get('/', c.listPublic);
router.get('/lookup', c.lookup);
router.get('/:portal', c.getPortal);

module.exports = router;
