const router = require('express').Router();
const c = require('../controllers/notificationController');
const { protect } = require('../middleware/auth');

router.use(protect);
router.get('/', c.list);
router.patch('/read-all', c.readAll);
router.patch('/:id/read', c.readOne);
router.delete('/', c.clearRead);

module.exports = router;
