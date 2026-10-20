const router = require('express').Router();
const c = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect, authorize('admin'));
router.get('/users', c.listUsers);
router.post('/users', c.createUser);
router.patch('/users/:id', c.updateUser);
router.delete('/users/:id', c.deleteUser);
router.get('/requests', c.listRequests);
router.get('/reports', c.reports);
router.get('/audit', c.auditLogs);

module.exports = router;
