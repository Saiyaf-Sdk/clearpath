const router = require('express').Router();
const c = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/auth');
const uni = require('../controllers/universityController');
const { logoUpload } = require('../middleware/upload');

// University admins and faculty admins (a faculty admin only ever sees their own faculty)
router.use(protect, authorize('admin', 'facultyadmin'));
router.get('/faculties', c.listFaculties);
router.post('/faculties', authorize('admin'), c.createFaculty);
router.patch('/faculties/:id', authorize('admin'), c.updateFaculty);
router.delete('/faculties/:id', authorize('admin'), c.deleteFaculty);
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
router.patch('/roster/:id', c.updateRosterEntry);
router.delete('/roster/:id', c.deleteRosterEntry);

// Their own university's logo
router.post('/logo', authorize('admin'), logoUpload.single('logo'), uni.uploadLogo);
router.delete('/logo', authorize('admin'), uni.removeLogo);

module.exports = router;
