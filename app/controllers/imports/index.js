const router = require("express").Router();
const ImportedController = require("./controllers");
const importedController = new ImportedController();
const nftMiddleware = require('./../helpers/middleware');


router.post("/createCollection", importedController.createCollection );
router.post("/createNFT", importedController.createNFT );
router.post("/updateNFT", importedController.updateNFT );
router.post("/getNFT", importedController.getNFT );
router.post("/getCollection", importedController.getCollection );

module.exports = router;
