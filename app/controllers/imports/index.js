const router = require("express").Router();
const ImportedController = require("./controllers");
const importedController = new ImportedController();
const nftMiddleware = require('./../helpers/middleware');


router.post("/createCollection", nftMiddleware.verifyUserToken, importedController.createCollection );
router.post("/createNFT", nftMiddleware.verifyUserToken, importedController.createNFT );
router.post("/updateNFT", nftMiddleware.verifyUserToken, importedController.updateNFT );
router.post("/getNFT", importedController.getNFT );
router.post("/getImportedCollection", importedController.getImportedCollection );

module.exports = router;
