const router = require("express").Router();
const ImportedController = require("./controllers");
const importedController = new ImportedController();
const nftMiddleware = require('./../helpers/middleware');


router.post("/createCollection", importedController.createCollection );
router.post("/createNFT", importedController.createNFT );

module.exports = router;
