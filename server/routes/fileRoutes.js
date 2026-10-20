const router = require('express').Router();
const c = require('../controllers/fileController');

router.get('/:key', c.serve);

module.exports = router;
