const router = require('express').Router();
const c = require('../controllers/universityController');
const { protect, authorize } = require('../middleware/auth');
const { logoUpload } = require('../middleware/upload');

// Platform admin only: manage the universities on ClearPath
router.use(protect, authorize('superadmin'));
router.get('/universities', c.listAll);
router.post('/universities', c.create);
router.patch('/universities/:id', c.update);
router.post('/universities/:id/logo', logoUpload.single('logo'), c.uploadLogo);
router.delete('/universities/:id/logo', c.removeLogo);
router.get('/universities/:id/admins', c.listAdmins);
router.post('/universities/:id/admins', c.createAdmin);

module.exports = router;
