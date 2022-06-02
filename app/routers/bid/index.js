const router = require('express').Router();
const bidController = require('./lib/controllers');
const bidMiddleware = require('./lib/middleware');

router.post("/createBidNft",bidMiddleware.verifyToken,bidController.createBidNft);
router.post("/updateBidNft",bidMiddleware.verifyToken,bidController.updateBidNft);
router.post("/fetchBidNft",bidMiddleware.verifyToken,bidController.fetchBidNft);
router.post("/acceptBidNft",bidMiddleware.verifyToken,bidController.acceptBidNft);

module.exports = router;
