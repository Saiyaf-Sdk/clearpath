const router = require('express').Router();
const c = require('../controllers/statsController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.get('/badges', c.badges);
router.get('/officer', authorize('officer', 'admin'), c.officerOverview);
router.get('/officer/activity', authorize('officer', 'admin'), c.officerActivity);

module.exports = router;
