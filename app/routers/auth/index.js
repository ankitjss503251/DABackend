const router = require('express').Router();
const authController = require('./lib/controllers');
const authMiddleware = require('./lib/middleware');

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/checkuseraddress', authController.checkuseraddress);
router.post('/adminlogin', authController.adminlogin);



router.post('/logout', authMiddleware.verifyToken, authController.logout);
router.post('/changePassword', authMiddleware.verifyToken, authController.changePassword);


router.post('/passwordreset', authController.passwordReset);
router.get('/reset/:token', authController.passwordResetGet);
router.post('/reset/:token', authController.passwordResetPost);


router.post('/adminregister', authController.adminregister);

module.exports = router;