const router = require('express').Router();
const c = require('../controllers/dueController');
const { protect, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.use(protect);
router.get('/my', authorize('student'), c.getMyDues);
router.post('/:id/receipt', authorize('student'), upload.single('receipt'), c.uploadReceipt);
router.get('/department', authorize('officer', 'admin'), c.getDepartmentDues);
router.get('/lookup', authorize('officer', 'admin'), c.lookupStudent);
router.post('/', authorize('officer', 'admin'), c.addDue);
router.patch('/:id/verify', authorize('officer', 'admin'), c.verifyDue);
router.patch('/:id', authorize('officer', 'admin'), c.updateDue);
router.delete('/:id', authorize('officer', 'admin'), c.deleteDue);

module.exports = router;
