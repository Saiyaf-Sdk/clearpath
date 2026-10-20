const router = require('express').Router();
const c = require('../controllers/authController');
const { protect } = require('../middleware/auth');

router.post('/register', c.register);
router.post('/login', c.login);
router.post('/forgot-password', c.forgotPassword);
router.get('/reset-password/:token', c.checkResetToken);
router.post('/reset-password/:token', c.resetPassword);
router.get('/me', protect, c.me);
router.patch('/password', protect, c.changePassword);

module.exports = router;
