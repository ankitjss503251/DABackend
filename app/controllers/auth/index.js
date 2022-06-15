const router = require('express').Router();
const AuthController = require('./controllers');
const authController = new AuthController();
const authMiddleware = require('../helpers/middleware');

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/checkuseraddress', authController.checkuseraddress);
router.post('/adminlogin', authController.adminlogin);
router.post('/superAdminLogin', authController.superAdminLogin);
router.post('/logout', authMiddleware.verifyUserToken, authController.logout);
router.post('/changePassword', authMiddleware.verifyUserToken, authController.changePassword);
router.post('/passwordreset', authController.passwordReset);
router.get('/reset/:token', authController.passwordResetGet);
router.post('/reset/:token', authController.passwordResetPost);
router.post('/adminregister', authController.adminregister);
module.exports = router;