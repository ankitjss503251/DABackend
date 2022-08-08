const router = require("express").Router();
const UtilsController = require("./controllers");
const utilsController = new UtilsController();
const utilsMiddleware = require("../helpers/middleware");

router.post("/addCategory", utilsMiddleware.verifyAdminToken, utilsController.addCategory);
router.post("/addBrand", utilsMiddleware.verifyAdminToken, utilsController.addBrand);
router.post("/getCategory", utilsController.getCategory);
router.get("/getAllBrand", utilsController.getAllBrand);
router.get("/showBrandByID/:brandID", utilsController.showBrandByID);
router.get("/showCategoryByID/:categoryID", utilsController.showCategoryByID);


router.post("/myCategoryList", utilsMiddleware.verifyAdminToken, utilsController.myCategoryList);
router.post("/myBrandsList", utilsMiddleware.verifyAdminToken, utilsController.myBrandsList);
router.post("/categoryList", utilsMiddleware.verifySuperAdminToken, utilsController.categoryList);
router.post("/brandsList", utilsMiddleware.verifySuperAdminToken, utilsController.brandsList);
router.get("/getBrandByID/:brandID", utilsMiddleware.verifyAdminToken, utilsController.getBrandByID);
router.get("/getCategoryByID/:categoryID", utilsMiddleware.verifyAdminToken, utilsController.getCategoryByID);
router.post("/updateCategory", utilsMiddleware.verifyAdminToken, utilsController.updateCategory);
router.post("/updateBrand", utilsMiddleware.verifyAdminToken, utilsController.updateBrand);

router.post("/getCategoryWithCollectionData", utilsController.getCategoryWithCollectionData);
router.post("/getCollections", utilsController.getCollections);

module.exports = router;