const fs = require("fs");
const http = require("https");
const { NFT, Collection } = require("../../models");
const mongoose = require("mongoose");
const validators = require("../helpers/validators");
var jwt = require("jsonwebtoken");
const e = require("express");
const { env } = require("process");

const Web3 = require("web3");
var web3 = new Web3(process.env.NETWORK_RPC_URL);
const erc721Abi = require("./../../../abis/extendedERC721.json");
const erc1155Abi = require("./../../../abis/extendedERC1155.json");
const nftMetaBaseURL = process.env.NFT_META_BASE_URL;
const chainID = process.env.CHAIN_ID;


class ImportedController {
  constructor() { }

  async getMyImportedCollection(req, res) {
    try {
      if (!req.userId) return res.reply(messages.unauthorized());
      let data = [];
      const page = parseInt(req.body.page);
      const limit = parseInt(req.body.limit);
      const startIndex = (page - 1) * limit;
      const endIndex = page * limit;

      let searchText = "";
      if (req.body.searchText && req.body.searchText !== undefined) {
        searchText = req.body.searchText;
      }
      let searchArray = [];
      searchArray["status"] = 1;
      searchArray["hashStatus"] = 1;
      searchArray["isImported"] = 1;
      searchArray["createdBy"] = mongoose.Types.ObjectId(req.userId);
      if (searchText !== "") {
        let searchKey = new RegExp(searchText, "i");
        searchArray["$or"] = [
          { name: searchKey },
        ];
      }
      let searchObj = Object.assign({}, searchArray);
      console.log("Obj", searchObj);
      const results = {};
      if (endIndex < (await Collection.countDocuments(searchObj).exec())) {
        results.next = {
          page: page + 1,
          limit: limit,
        };
      }
      if (startIndex > 0) {
        results.previous = {
          page: page - 1,
          limit: limit,
        };
      }
      await Collection.find(searchObj)
        .populate("categoryID")
        .populate("brandID")
        .sort({ createdOn: -1 })
        .limit(limit)
        .skip(startIndex)
        .lean()
        .exec()
        .then((res) => {
          data.push(res);
        })
        .catch((e) => {
          console.log("Error", e);
        });
      results.count = await Collection.countDocuments(searchObj).exec();
      results.results = data;
      res.header("Access-Control-Max-Age", 600);
      return res.reply(messages.success("Collection List"), results);
    } catch (error) {
      console.log("Error " + error);
      return res.reply(messages.server_error());
    }
  }

  async getImportedCollection(req, res) {
    try {
      let data = [];
      const page = parseInt(req.body.page);
      const limit = parseInt(req.body.limit);
      const startIndex = (page - 1) * limit;
      const endIndex = page * limit;

      let searchText = "";
      if (req.body.searchText && req.body.searchText !== undefined) {
        searchText = req.body.searchText;
      }
      let searchArray = [];
      searchArray["status"] = 1;
      searchArray["hashStatus"] = 1;
      searchArray["isImported"] = 1;
      if (searchText !== "") {
        let searchKey = new RegExp(searchText, "i");
        searchArray["$or"] = [
          { name: searchKey },
        ];
      }
      let searchObj = Object.assign({}, searchArray);
      console.log("Obj", searchObj);
      const results = {};
      if (endIndex < (await Collection.countDocuments(searchObj).exec())) {
        results.next = {
          page: page + 1,
          limit: limit,
        };
      }
      if (startIndex > 0) {
        results.previous = {
          page: page - 1,
          limit: limit,
        };
      }
      await Collection.find(searchObj)
        .populate("categoryID")
        .populate("brandID")
        .sort({ createdOn: -1 })
        .limit(limit)
        .skip(startIndex)
        .lean()
        .exec()
        .then((res) => {
          data.push(res);
        })
        .catch((e) => {
          console.log("Error", e);
        });
      results.count = await Collection.countDocuments(searchObj).exec();
      results.results = data;
      res.header("Access-Control-Max-Age", 600);
      return res.reply(messages.success("Collection List"), results);
    } catch (error) {
      console.log("Error " + error);
      return res.reply(messages.server_error());
    }
  }

  async checkStatus(req, res) {
    try {
      let collectionID = req.body.collectionID;
      Collection.find({ _id: mongoose.Types.ObjectId(collectionID) }, async function (err, collectionData) {
        if (err) {
          return res.reply(messages.server_error("Collection"));
        } else {
          if (collectionData.length == 0) {
            return res.reply(messages.not_found("Collection"));
          } else {
            let tokenURI = nftMetaBaseURL + "/collections?ChainId=" + chainID + "&ContractAddress=" + collectionData[0].contractAddress;
            try {
              http.get(tokenURI, (res) => {
                let body = "";
                res.on("data", (chunk) => {
                  body += chunk;
                });
                res.on("end", async () => {
                  try {
                    let newJSON = JSON.parse(body);
                    let initStatus = newJSON[0].init_progress;
                    let apiStatus = newJSON[0].apiStatus;
                    let updateCollectionData = {
                      init_progress: initStatus,
                      apiStatus: apiStatus
                    }
                    if (initStatus === "complete" && collectionData[0].progressStatus === 0) {
                      updateCollectionData.progressStatus = 1;
                    }
                    await Collection.findOneAndUpdate(
                      { _id: mongoose.Types.ObjectId(collectionID) },
                      { updateCollectionData }, function (err, updateCollection) {
                        if (err) {
                          console.log("Error in Updating Collection" + err);
                          return res.reply(messages.error());
                        } else {
                          console.log("Collection status Updated: ", updateCollection);
                          return res.reply(messages.created("Collection Updated"), updateCollection);
                        }
                      }
                    );
                  } catch (error) {
                    console.log("Error ", error);
                    return res.reply(messages.server_error());
                  };
                });
              }).on("error", (error) => {
                console.log("Error ", error);
                return res.reply(messages.server_error());
              });
            } catch (error) {
              console.log("Error ", error);
              return res.reply(messages.server_error());
            }
          }
        }
      });
    } catch (error) {
      console.log("Error " + error);
      return res.reply(messages.server_error());
    }
  }

  async importedCollectionNFTs(req, res) {
    try {
      let collectionID = req.body.collectionID;
      Collection.find({ _id: mongoose.Types.ObjectId(collectionID) }, async function (err, collectionData) {
        if (err) {
          return res.reply(messages.server_error("Collection"));
        } else {
          if (collectionData.length == 0) {
            return res.reply(messages.not_found("Collection"));
          } else {
            let tokenURI = nftMetaBaseURL + "/collections?ChainId=" + chainID + "&ContractAddress=" + collectionData[0].contractAddress;
            try {
              http.get(tokenURI, (res) => {
                let body = "";
                res.on("data", (chunk) => {
                  body += chunk;
                });
                res.on("end", async () => {
                  try {
                    let newJSON = JSON.parse(body);
                    let initStatus = newJSON[0].init_progress;
                    if (initStatus === "complete" && collectionData[0].progressStatus === 1) {
                      let NFTDataList = nftMetaBaseURL + "/tokenDetailsExtended?ChainId=" + chainID + "&ContractAddress=" + collectionData[0].contractAddress;
                      try {
                        await http.get(NFTDataList, (res) => {
                          let body = "";
                          res.on("data", (chunk) => {
                            body += chunk;
                          });
                          res.on("end", async () => {
                            try {
                              let jsonNFTData = JSON.parse(body);
                              jsonNFTData.forEach(nftRecord => {
                                let lastUpdated = nftRecord.MetadataLastUpdated;
                                var d = new Date(0);
                                let lastUpdateMetaDB = d.setUTCSeconds(lastUpdated);
                                var d1 = new Date(lastUpdateMetaDB);
                                NFT.find({ collectionID: mongoose.Types.ObjectId(collectionData[0]._id), tokenID: nftRecord.edition }, async function (err, nftData) {
                                  if (err) {
                                    return res.reply(messages.server_error("NFT"));
                                  } else {
                                    if (nftData.length == 0) {
                                      let nft = new NFT({
                                        name: nftRecord.name,
                                        description: nftRecord.description,
                                        tokenID: nftRecord.edition,
                                        collectionID: collectionData[0]._id,
                                        collectionAddress: collectionData[0].contractAddress,
                                        totalQuantity: 1,
                                        isImported: 1,
                                        type: 1,
                                        isMinted: 1,
                                        previewImg: nftRecord.S3Images.S3Thumb,
                                        hashStatus: 1,
                                        brandID: collectionData[0].brandID,
                                        categoryID: collectionData[0].categoryID,
                                        ownedBy: [],
                                      });
                                      if (nftRecord.S3Images.S3Animation === "" || nftRecord.S3Images.S3Animation === null) {
                                        nft.image = nftRecord.S3Images.S3Image;
                                      } else {
                                        nft.image = nftRecord.S3Images.S3Animation;
                                      }
                                      nft.ownedBy.push({
                                        address: nftRecord.owner.owner,
                                        quantity: 1,
                                      });
                                      nft.save().then(async (result) => {
                                        const collection = await Collection.findOne({
                                          _id: mongoose.Types.ObjectId(collectionID),
                                        });
                                        let nextID = collection.getNextID();
                                        collection.nextID = nextID;
                                        collection.save();
                                        await Collection.findOneAndUpdate({
                                          _id: mongoose.Types.ObjectId(collectionID),
                                        },
                                          { $inc: { nftCount: 1 } },
                                          function () { }
                                        );
                                        if (collectionData[0].categoryID === "" || collectionData[0].categoryID === undefined) {
                                        } else {
                                          await Category.findOneAndUpdate({
                                            _id: mongoose.Types.ObjectId(collectionData[0].categoryID),
                                          },
                                            { $inc: { nftCount: 1 } },
                                            function () { }
                                          );
                                        }
                                        if (collectionData[0].brandID === "" || collectionData[0].brandID === undefined) {
                                        } else {
                                          await Brand.findOneAndUpdate({
                                            _id: mongoose.Types.ObjectId(collectionData[0].brandID),
                                          },
                                            { $inc: { nftCount: 1 } },
                                            function () { }
                                          );
                                        }
                                      }).catch((error) => {
                                        console.log("Created NFT error", error);
                                      });
                                    } else {
                                      var d2 = new Date(nftData[0].lastUpdatedOn);
                                      if (d1.getTime() === d2.getTime()) {
                                        console.log("NFT already Updated");
                                      } else {
                                        let updateNFTData = {
                                          name: nftRecord.name,
                                          description: nftRecord.description,
                                          previewImg: nftRecord.S3Images.S3Thumb,
                                          lastUpdatedOn: lastUpdateMetaDB
                                        }
                                        if (nftRecord.S3Images.S3Animation === "" || nftRecord.S3Images.S3Animation === null) {
                                          updateNFTData.image = nftRecord.S3Images.S3Image;
                                        } else {
                                          updateNFTData.image = nftRecord.S3Images.S3Animation;
                                        }
                                        await NFT.findOneAndUpdate(
                                          { _id: mongoose.Types.ObjectId(nftID) },
                                          { updateNFTData }, function (err, updateNFT) {
                                            if (err) {
                                              console.log("Error in Updating NFT" + err);
                                            } else {
                                              console.log("NFT MetaData Updated: ", updateNFT);
                                            }
                                          }
                                        );
                                      }
                                    }
                                  }
                                })
                              });
                            } catch (error) {
                              console.log("Error ", error);
                              return res.reply(messages.server_error());
                            };
                          });
                        }).on("error", (error) => {
                          console.log("Error ", error);
                          return res.reply(messages.server_error());
                        });
                        let updateCollectionData = {
                          progressStatus: 2
                        }
                        await Collection.findOneAndUpdate(
                          { _id: mongoose.Types.ObjectId(collectionID) },
                          { updateCollectionData }, function (err, updateCollection) {
                            if (err) {
                              console.log("Error in Updating Collection" + err);
                              return res.reply(messages.error());
                            } else {
                              console.log("Collection status Updated: ", updateCollection);
                              return res.reply(messages.created("Collection Updated"), updateCollection);
                            }
                          }
                        );
                      } catch (error) {
                        console.log("Error ", error);
                        return res.reply(messages.server_error());
                      }
                    }
                  } catch (error) {
                    console.log("Error ", error);
                    return res.reply(messages.server_error());
                  };
                });
              }).on("error", (error) => {
                console.log("Error ", error);
                return res.reply(messages.server_error());
              });
            } catch (error) {
              console.log("Error ", error);
              return res.reply(messages.server_error());
            }
          }
        }
      });
    } catch (error) {
      console.log("Error " + error);
      return res.reply(messages.server_error());
    }
  }
}

module.exports = ImportedController;