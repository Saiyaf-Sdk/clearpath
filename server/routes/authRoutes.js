const router = require('express').Router();
const c = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { avatarUpload } = require('../middleware/upload');

router.post('/register/start', c.registerStart);
router.post('/register/verify', c.registerVerify);
router.post('/register/complete', c.registerComplete);
router.post('/login', c.login);
router.post('/forgot-password', c.forgotPassword);
router.get('/reset-password/:token', c.checkResetToken);
router.post('/reset-password/:token', c.resetPassword);
router.get('/me', protect, c.me);
router.patch('/me', protect, c.updateProfile);
router.patch('/password', protect, c.changePassword);
router.post('/me/avatar', protect, avatarUpload.single('avatar'), c.uploadAvatar);
router.delete('/me/avatar', protect, c.removeAvatar);

module.exports = router;
