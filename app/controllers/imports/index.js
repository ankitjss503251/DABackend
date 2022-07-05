const router = require("express").Router();
const ImportedController = require("./controllers");
const importedController = new ImportedController();
const nftMiddleware = require('./../helpers/middleware');

router.post("/createCollection", nftMiddleware.verifyAdminToken, importedController.createCollection );
router.post("/getImportedCollection", importedController.getImportedCollection );

// router.post("/createNFT", nftMiddleware.verifyUserToken, importedController.createNFT );
// router.post("/updateNFT", nftMiddleware.verifyUserToken, importedController.updateNFT );
// router.post("/getNFT", importedController.getNFT );

module.exports = router;
