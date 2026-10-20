const router = require('express').Router();
const c = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.get('/', c.listDepartments);
router.post('/', authorize('admin'), c.createDepartment);
router.patch('/:id', authorize('admin'), c.updateDepartment);
router.delete('/:id', authorize('admin'), c.deleteDepartment);

module.exports = router;
