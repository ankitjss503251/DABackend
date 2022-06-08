const router = require("express").Router();
const ImportedController = require("./controllers");
const importedController = new ImportedController();
const nftMiddleware = require('./../helpers/middleware');


router.post("/createCollection", importedController.createCollection );

module.exports = router;
