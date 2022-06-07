const router = require("express").Router();
const NFTController = require("./controllers");
const nftController = new NFTController();
const nftMiddleware = require('./../helpers/middleware');


router.post("/createCollection", nftMiddleware.verifyUserToken, nftController.createCollection );
router.post("/getCollections", nftController.getCollections);
router.post("/myCollections", nftMiddleware.verifyUserToken, nftController.myCollections);
router.post("/myNFTs", nftMiddleware.verifyUserToken, nftController.myNFTs);

router.get("/viewCollection/:collectionID", nftMiddleware.verifyWithoutToken, nftController.viewCollection );
router.post( "/updateCollection", nftMiddleware.verifyUserToken, nftController.updateCollection );
router.post("/getUpcomingCollections", nftController.getUpcomingCollections);

router.post("/createNFT", nftMiddleware.verifyUserToken, nftController.createNFT);
router.post("/viewNFTs", nftController.viewNFTs);
router.post( "/getHotCollections", nftMiddleware.verifyWithoutToken, nftController.getHotCollections );
router.post("/getOwnedNFTList", nftController.getOwnedNFTlist);
router.put( "/updateNftOrder", nftMiddleware.verifyUserToken, nftController.updateNftOrder );

// router.post("/likeNFT", nftMiddleware.verifyUserToken, nftController.likeNFT);
// router.post("/mynftlist", nftMiddleware.verifyUserToken, nftController.mynftlist);
// router.post(
//   "/getCollectionDetailsById",
//   nftMiddleware.verifyWithoutToken,
//   nftController.getCollectionDetails
// );
// router.post(
//   "/getCollectionDetailsByAddress",
//   nftMiddleware.verifyWithoutToken,
//   nftController.getCollectionDetailsByAddress
// );


// router.post(
//   "/collectionList",
//   // nftMiddleware.verifyUserToken,
//   nftController.collectionlist
// );
// router.get(
//   "/getcollections",
//   nftMiddleware.proceedWithoutToken,
//   nftController.getcollections
// );
// router.post(
//   "/nftListing",
//   nftMiddleware.verifyWithoutToken,
//   nftController.nftListing
// );
// router.get(
//   "/viewnft/:nNFTId",
//   nftMiddleware.verifyWithoutToken,
//   nftController.nftID
// );
// router.get(
//   "/viewnftOwner/:nNFTId",
//   nftMiddleware.verifyWithoutToken,
//   nftController.getNftOwner
// );
// router.get(
//   "/getAllnftOwner/:nNFTId",
//   nftMiddleware.verifyWithoutToken,
//   nftController.getAllnftOwner
// );
// router.post(
//   "/setTransactionHash",
//   nftMiddleware.verifyUserToken,
//   nftController.setTransactionHash
// );
// router.get("/landing", nftMiddleware.verifyWithoutToken, nftController.landing);
// router.get(
//   "/deleteNFT/:nNFTId",
//   nftMiddleware.verifyUserToken,
//   nftController.deleteNFT
// );
// router.post(
//   "/allCollectionWiseList",
//   nftMiddleware.verifyWithoutToken,
//   nftController.allCollectionWiselist
// );

// router.put(
//   "/updateBasePrice",
//   nftMiddleware.verifyUserToken,
//   nftController.updateBasePrice
// );
// router.put(
//   "/setNFTOrder",
//   nftMiddleware.verifyUserToken,
//   nftController.setNFTOrder
// );

// router.post(
//   "/getOnSaleItems",
//   nftMiddleware.verifyWithoutToken,
//   nftController.getOnSaleItems
// );

// router.put(
//   "/toggleSellingType",
//   nftMiddleware.verifyUserToken,
//   nftController.toggleSellingType
// );
// router.post(
//   "/myCollectionList",
//   nftMiddleware.verifyUserToken,
//   nftController.collectionlistMy
// );
// // router.post("/like", nftMiddleware.verifyUserToken, nftController.likeNFT);
// router.post(
//   "/uploadImage",
//   nftMiddleware.verifyUserToken,
//   nftController.uploadImage
// );
// router.get("/getAllNfts", nftController.getAllNfts);

// router.post("/getUserLikedNfts", nftController.getUserLikedNfts);
// router.post("/getUserOnSaleNfts", nftController.getUserOnSaleNfts);
// router.put(
//   "/transferNfts",
//   nftMiddleware.verifyUserToken,
//   nftController.transferNfts
// );
// router.post("/getCollectionNFT", nftController.getCollectionNFT);
// router.post(
//   "/getCollectionNFTOwned",
//   nftMiddleware.verifyUserToken,
//   nftController.getCollectionNFTOwned
// );
// router.post("/getSearchedNft", nftController.getSearchedNft);

// router.get(
//   "/updateCollectionToken/:collectionAddress",
//   nftMiddleware.verifyUserToken,
//   nftController.updateCollectionToken
// );
module.exports = router;
