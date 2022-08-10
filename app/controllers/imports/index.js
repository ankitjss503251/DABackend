const router = require("express").Router();
const ImportedController = require("./controllers");
const importedController = new ImportedController();
const nftMiddleware = require('./../helpers/middleware');

router.post("/getImportedCollection", nftMiddleware.verifyAdminToken, importedController.getImportedCollection );
router.post("/checkStatus", nftMiddleware.verifyAdminToken, importedController.checkStatus );
router.post("/importedCollectionNFTs", nftMiddleware.verifyAdminToken, importedController.importedCollectionNFTs );

module.exports = router;
