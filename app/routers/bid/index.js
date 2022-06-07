const router = require('express').Router();
const BidController = require('./controllers');
const bidController = new BidController();
const bidMiddleware = require('./../helpers/middleware');

router.post("/createBidNft",bidMiddleware.verifyUserToken,bidController.createBidNft);
router.post("/updateBidNft",bidMiddleware.verifyUserToken,bidController.updateBidNft);
router.post("/fetchBidNft",bidMiddleware.verifyUserToken,bidController.fetchBidNft);
router.post("/acceptBidNft",bidMiddleware.verifyUserToken,bidController.acceptBidNft);

module.exports = router;
