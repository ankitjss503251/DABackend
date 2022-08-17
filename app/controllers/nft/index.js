const router = require("express").Router();
const NFTController = require("./controllers");
const nftController = new NFTController();
const nftMiddleware = require("./../helpers/middleware");

router.post("/allCollections",nftMiddleware.verifySuperAdminToken,nftController.allCollections);
router.post("/blockUnblockCollection",nftMiddleware.verifySuperAdminToken,nftController.blockUnblockCollection);
router.post("/blockUnblockNFT",nftMiddleware.verifySuperAdminToken,nftController.blockUnblockNFT);
router.post("/myCollections",nftMiddleware.verifyAdminToken,nftController.myCollections);
router.post("/createCollection",nftMiddleware.verifyAdminToken,nftController.createCollection);

router.post("/myNFTs", nftMiddleware.verifyAdminToken, nftController.myNFTs);
router.post("/updateCollection",nftMiddleware.verifyAdminToken,nftController.updateCollection);
router.post("/createNFT",nftMiddleware.verifyAdminToken,nftController.createNFT);
router.post("/importNFT",nftMiddleware.verifyAdminToken,nftController.importNFT);
router.get("/updateCollectionToken/:collectionAddress",nftController.updateCollectionToken);
router.post("/getCollections", nftController.getCollections);
router.post("/viewNFTs", nftController.viewNFTs);
router.post("/viewNFTDetails", nftController.viewNFTDetails);
router.post("/viewNFTByOrder", nftController.viewNFTByOrder);
router.post("/getOwnedNFTList", nftController.getOwnedNFTlist);
router.post("/getCombinedNfts", nftController.getCombinedNfts);
router.post("/getOnSaleItems", nftController.getOnSaleItems);
router.get("/getCollectionDetails/:collection",nftController.getCollectionDetails);
router.post("/insertMintAddress", nftController.insertMintAddress);
router.post("/fetchMintAddress", nftController.fetchMintAddress);

router.post("/fetchOfferMade", nftController.fetchOfferMade);
router.post("/fetchOfferReceived", nftController.fetchOfferReceived);
router.post("/updateStatus", nftMiddleware.verifyUserToken, nftController.updateStatus);

router.post("/nftButtons", nftController.nftButtons);
router.post("/refreshMetaData", nftController.refreshMetaData);

router.post("/updateOwner", nftController.updateOwner);

// router.put("/updateNftOrder",nftMiddleware.verifyAdminToken,nftController.updateNftOrder);
// router.post("/getHotCollections",nftMiddleware.verifyWithoutToken, nftController.getHotCollections);
// router.post("/likeNFT", nftMiddleware.verifyUserToken, nftController.likeNFT);
// router.post("/mynftlist", nftMiddleware.verifyUserToken, nftController.mynftlist);
// router.post("/getCollectionDetailsById", nftMiddleware.verifyWithoutToken, nftController.getCollectionDetails );
// router.post("/getCollectionDetailsByAddress", nftMiddleware.verifyWithoutToken, nftController.getCollectionDetailsByAddress );
// router.post("/collectionList", nftMiddleware.verifyUserToken, nftController.collectionlist );
// router.get("/getcollections",nftMiddleware.proceedWithoutToken,nftController.getcollections);
// router.post("/nftListing",nftMiddleware.verifyWithoutToken,nftController.nftListing);
// router.get("/viewnft/:nNFTId",nftMiddleware.verifyWithoutToken,nftController.nftID);
// router.get("/viewnftOwner/:nNFTId",nftMiddleware.verifyWithoutToken,nftController.getNftOwner);
// router.get("/getAllnftOwner/:nNFTId",nftMiddleware.verifyWithoutToken,nftController.getAllnftOwner);
// router.post("/setTransactionHash",nftMiddleware.verifyUserToken,nftController.setTransactionHash);
// router.get("/landing", nftMiddleware.verifyWithoutToken, nftController.landing);
// router.get("/deleteNFT/:nNFTId",nftMiddleware.verifyUserToken,nftController.deleteNFT);
// router.post("/allCollectionWiseList",nftMiddleware.verifyWithoutToken,nftController.allCollectionWiselist);
// router.put("/updateBasePrice",nftMiddleware.verifyUserToken,nftController.updateBasePrice);
// router.put("/setNFTOrder",nftMiddleware.verifyUserToken,nftController.setNFTOrder);
// router.post("/getOnSaleItems",nftMiddleware.verifyWithoutToken, nftController.getOnSaleItems);
// router.put("/toggleSellingType",nftMiddleware.verifyUserToken,nftController.toggleSellingType);
// router.post("/myCollectionList",nftMiddleware.verifyUserToken,nftController.collectionlistMy);
// router.post("/like", nftMiddleware.verifyUserToken, nftController.likeNFT);
// router.post("/uploadImage",nftMiddleware.verifyUserToken,nftController.uploadImage );
// router.get("/getAllNfts", nftController.getAllNfts);
// router.post("/getUserLikedNfts", nftController.getUserLikedNfts);
// router.post("/getUserOnSaleNfts", nftController.getUserOnSaleNfts);
// router.put("/transferNfts",nftMiddleware.verifyUserToken,nftController.transferNfts);
// router.post("/getCollectionNFT", nftController.getCollectionNFT);
// router.post("/getCollectionNFTOwned",nftMiddleware.verifyUserToken,nftController.getCollectionNFTOwned);
// router.post("/getSearchedNft", nftController.getSearchedNft);

module.exports = router;
