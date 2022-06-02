const router = require("express").Router();
const utilsController = require("./lib/controllers");
const utilsMiddleware = require("./lib/middleware");

router.post(
  "/addCategory",
  utilsMiddleware.verifyToken,
  utilsController.addCategory
);

router.post("/addBrand", utilsMiddleware.verifyToken, utilsController.addBrand);

router.get("/getAllCategory", utilsController.getAllCategory);
router.get("/getAllBrand", utilsController.getAllBrand);

module.exports = router;
