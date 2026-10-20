const router = require('express').Router();
const c = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect, authorize('admin'));
router.get('/users', c.listUsers);
router.post('/users', c.createUser);
router.get('/users/:id/summary', c.userSummary);
router.patch('/users/:id', c.updateUser);
router.delete('/users/:id', c.deleteUser);
router.get('/requests', c.listRequests);
router.get('/requests/:id', c.getRequest);
router.get('/reports', c.reports);
router.get('/audit', c.auditLogs);
router.get('/roster', c.listRoster);
router.post('/roster', c.addRosterEntry);
router.post('/roster/import', c.importRoster);
router.delete('/roster/:id', c.deleteRosterEntry);

module.exports = router;
