const router = require("express").Router();
const HistoryController = require("./controllers");
const historyController = new HistoryController();
const historyMiddleware = require('./../helpers/middleware');

router.post("/insert", historyMiddleware.verifyWithoutToken, historyController.insertHistory);
router.post("/fetchHistory",historyMiddleware.verifyWithoutToken,historyController.fetchHistory);

module.exports = router;