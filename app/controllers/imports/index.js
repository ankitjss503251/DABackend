const router = require("express").Router();
const ImportedController = require("./controllers");
const importedController = new ImportedController();
const nftMiddleware = require('./../helpers/middleware');

router.post("/getMyImportedCollection", nftMiddleware.verifyAdminToken, importedController.getMyImportedCollection );
router.post("/getImportedCollection", nftMiddleware.verifyAdminToken, importedController.getImportedCollection );
router.post("/checkStatus", nftMiddleware.verifyAdminToken, importedController.checkStatus );
router.post("/importedCollectionNFTs", nftMiddleware.verifyAdminToken, importedController.importedCollectionNFTs );
router.post("/refreshCollection", nftMiddleware.verifyAdminToken, importedController.refreshCollection );
router.post("/checkCollectionUpdate", nftMiddleware.verifyAdminToken, importedController.checkCollectionUpdate );
router.post("/refreshMetaNFT", nftMiddleware.verifyAdminToken, importedController.refreshMetaNFT );



module.exports = router;
