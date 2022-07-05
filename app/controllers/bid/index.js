const router = require('express').Router();
const BidController = require('./controllers');
const bidController = new BidController();
const bidMiddleware = require('./../helpers/middleware');

router.post("/fetchOfferNft",bidController.fetchOfferNft);

router.post("/createBidNft",bidMiddleware.verifyUserToken,bidController.createBidNft);
<<<<<<< HEAD


=======
>>>>>>> 07a72ef0a1ee0df852200b37cd4a35284e30c339
router.post("/createOffer",bidMiddleware.verifyUserToken,bidController.createOffer);
router.post("/updateBidNft",bidMiddleware.verifyUserToken,bidController.updateBidNft);

router.post("/fetchBidNft",bidMiddleware.verifyUserToken,bidController.fetchBidNft);
router.post("/fetchOfferNft",bidController.fetchOfferNft);
router.post("/acceptBidNft",bidMiddleware.verifyUserToken,bidController.acceptBidNft);

module.exports = router;
