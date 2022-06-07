const router = require("express").Router();
const UtilsController = require("./controllers");
const utilsController = new UtilsController();
const utilsMiddleware = require("../helpers/middleware");

router.post("/addCategory", utilsMiddleware.verifyUserToken, utilsController.addCategory);
router.post("/addBrand", utilsMiddleware.verifyUserToken, utilsController.addBrand);
router.get("/getAllCategory", utilsController.getAllCategory);
router.get("/getAllBrand", utilsController.getAllBrand);

module.exports = router;