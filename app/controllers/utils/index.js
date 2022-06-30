const router = require("express").Router();
const UtilsController = require("./controllers");
const utilsController = new UtilsController();
const utilsMiddleware = require("../helpers/middleware");

router.post("/addCategory", utilsMiddleware.verifyAdminToken, utilsController.addCategory);
router.post("/addBrand", utilsMiddleware.verifyAdminToken, utilsController.addBrand);
router.post("/getCategory", utilsController.getCategory);
router.get("/getAllBrand", utilsController.getAllBrand);
router.post("/getBrandByID/:brandID",utilsController.getBrandByID);

router.post("/myCategoryList", utilsMiddleware.verifyAdminToken, utilsController.myCategoryList);
router.post("/myBrandsList", utilsMiddleware.verifyAdminToken, utilsController.myBrandsList);
router.post("/categoryList", utilsMiddleware.verifySuperAdminToken, utilsController.categoryList);
router.post("/brandsList", utilsMiddleware.verifySuperAdminToken, utilsController.brandsList);

module.exports = router;