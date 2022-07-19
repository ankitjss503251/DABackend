const router = require('express').Router();
const BidController = require('./controllers');
const bidController = new BidController();
const bidMiddleware = require('./../helpers/middleware');

router.post("/fetchOfferNft",bidController.fetchOfferNft);

router.post("/createBidNft",bidMiddleware.verifyUserToken,bidController.createBidNft);
router.post("/createOffer",bidMiddleware.verifyUserToken,bidController.createOffer);
router.post("/updateBidNft",bidMiddleware.verifyUserToken,bidController.updateBidNft);

router.post("/fetchBidNft",bidController.fetchBidNft);
router.post("/fetchOfferNft",bidController.fetchOfferNft);
router.post("/acceptBidNft",bidMiddleware.verifyUserToken,bidController.acceptBidNft);
router.post("/acceptOfferNft",bidMiddleware.verifyUserToken,bidController.acceptOfferNft);


module.exports = router;
