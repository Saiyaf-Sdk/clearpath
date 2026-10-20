const router = require('express').Router();
const c = require('../controllers/clearanceController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.post('/', authorize('student'), c.createRequest);
router.get('/my', authorize('student'), c.getMyRequests);
router.patch('/:id/cancel', authorize('student'), c.cancelRequest);
router.get('/department', authorize('officer', 'admin'), c.getDepartmentRequests);
router.patch('/:id/items/:deptId', authorize('officer', 'admin'), c.actionItem);

module.exports = router;
