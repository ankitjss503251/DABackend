const router = require('express').Router();
const AuthController = require('./controllers');
const authController = new AuthController();
const authMiddleware = require('../helpers/middleware');

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/checkuseraddress', authController.checkuseraddress);
router.post('/adminlogin', authController.adminlogin);
router.get('/superAdminRegister', authController.superAdminRegister);
router.post('/superAdminLogin', authController.superAdminLogin);
router.post('/logout', authMiddleware.verifyUserToken, authController.logout);
router.post('/changePassword', authMiddleware.verifyUserToken, authController.changePassword);
router.post('/passwordreset', authController.passwordReset);
router.get('/reset/:token', authController.passwordResetGet);
router.post('/reset/:token', authController.passwordResetPost);
router.post('/adminregister', authController.adminregister);

router.post('/addAdmin12', authMiddleware.verifySuperAdminToken,  authController.addAdmin);
router.post('/allAdmin', authController.allAdmin);
router.post('/updateAdmin12', authMiddleware.verifySuperAdminToken,  authController.updateAdmin);

module.exports = router;