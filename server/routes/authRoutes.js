const router = require('express').Router();
const c = require('../controllers/authController');
const { protect } = require('../middleware/auth');

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

module.exports = router;
