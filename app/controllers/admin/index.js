const router = require('express').Router();
const AdminController   = require('./controllers');
const adminController = new AdminController();
const adminMiddleware = require('../helpers/middleware');
// Dashboard API
router.get('/getDashboardData', adminMiddleware.verifyUserToken, adminController.getDashboardData);
// Profile API
router.put('/updateProfile', adminMiddleware.verifyUserToken, adminController.updateProfile);

// NFT APIs
router.post('/nfts', adminMiddleware.verifyUserToken, adminController.nfts);

// User APIs
router.post('/users', adminMiddleware.verifyUserToken, adminController.users);
router.post('/toggleUserStatus', adminMiddleware.verifyUserToken, adminController.toggleUserStatus);

// Newsletter APIs
router.post('/sendNewsLetterEmail', adminMiddleware.verifyUserToken, adminController.sendNewsLetterEmail);
router.post('/getNewsLetterEmailsLists', adminMiddleware.verifyUserToken, adminController.getNewsLetterEmailsLists);
router.delete('/deleteNewsLetterEmail', adminMiddleware.verifyUserToken, adminController.deleteNewsLetterEmail);

// Category APIs
router.post("/addCategory", adminMiddleware.verifyUserToken, adminController.addCategory);
router.post("/getCategories",  adminController.getCategories);
router.put("/toggleCategory/:sName", adminMiddleware.verifyUserToken, adminController.toggleCategory);
router.delete("/deleteCategory/:sName", adminMiddleware.verifyUserToken, adminController.deleteCategory);
router.put("/editCategory", adminMiddleware.verifyUserToken, adminController.editCategory);

//CMS APIs
router.post("/updateAboutus", adminMiddleware.verifyUserToken, adminController.updateAboutus);
router.post("/updateTerms", adminMiddleware.verifyUserToken, adminController.updateTerms);
router.post("/updateFAQs", adminMiddleware.verifyUserToken, adminController.updateFAQs);

module.exports = router;