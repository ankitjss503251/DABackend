const fs = require("fs");
const https = require("https");
const http = require("http");
const axios = require('axios');
const { NFT, Collection, Category, Brand } = require("../../models");
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

const postAPIURL = process.env.NFT_META_POST_URL;


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
      if (results.count === 0) {
        results.results = data;
      } else {
        results.results = data[0];
      }
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
            let tokenURI = nftMetaBaseURL + "collections?ChainId=" + chainID + "&ContractAddress=" + collectionData[0].contractAddress;
            try {
              http.get(tokenURI, (resData) => {
                let body = "";
                resData.on("data", (chunk) => {
                  body += chunk;
                });
                resData.on("end", async () => {
                  try {
                    let newJSON = JSON.parse(body);
                    let apiStatus = newJSON[0].status;
                    let totalSupply = newJSON[0].total_supply;
                    let updateCollectionData = {
                      apiStatus: apiStatus,
                      totalSupply: totalSupply
                    }
                    if (apiStatus === "available" && collectionData[0].progressStatus === 0) {
                      updateCollectionData.progressStatus = 1;
                    }
                    await Collection.findOneAndUpdate(
                      { _id: mongoose.Types.ObjectId(collectionID) },
                      { $set: updateCollectionData }, { new: true }, function (err, updateCollection) {
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
            let tokenURI = nftMetaBaseURL + "collections?ChainId=" + chainID + "&ContractAddress=" + collectionData[0].contractAddress;
            try {
              http.get(tokenURI, (resData) => {
                let body = "";
                resData.on("data", (chunk) => {
                  body += chunk;
                });
                resData.on("end", async () => {
                  try {
                    let newJSON = JSON.parse(body);
                    let apiStatus = newJSON[0].status;
                    let lastUpdatedCollection = newJSON[0].last_updated;
                    var d = new Date(0);
                    let lastUpdateMetaDBCollection = d.setUTCSeconds(lastUpdatedCollection);
                    if (apiStatus === "available" && collectionData[0].progressStatus === 1) {
                      let NFTDataList = nftMetaBaseURL + "tokenDetailsExtended?ChainId=" + chainID + "&ContractAddress=" + collectionData[0].contractAddress;
                      console.log("NFTDataList", NFTDataList);
                      try {
                        await http.get(NFTDataList, (resData) => {
                          let body = "";
                          resData.on("data", (chunk) => {
                            body += chunk;
                          });
                          resData.on("end", async () => {
                            try {
                              let jsonNFTData = JSON.parse(body);
                              jsonNFTData.forEach(nftRecord => {
                                let lastUpdated = nftRecord.MetadataLastUpdated;
                                var d = new Date(0);
                                let lastUpdateMetaDB = d.setUTCSeconds(lastUpdated);
                                var d1 = new Date(lastUpdateMetaDB);
                                NFT.find({
                                  collectionAddress: collectionData[0].contractAddress, tokenID: Number(nftRecord.token_id)
                                }, async function (err, nftData) {
                                  if (err) {
                                    return res.reply(messages.server_error("NFT"));
                                  } else {
                                    if (nftData.length == 0) {
                                      let nft = new NFT({
                                        name: nftRecord.name,
                                        description: nftRecord.description,
                                        tokenID: Number(nftRecord.token_id),
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
                                        lastUpdatedOn: lastUpdateMetaDB,
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
                                          { $set: updateNFTData }, { new: true }, function (err, updateNFT) {
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
                          progressStatus: 2,
                          checkStatus: 0,
                          lastUpdatedOn: lastUpdateMetaDBCollection
                        }
                        await Collection.findOneAndUpdate(
                          { _id: mongoose.Types.ObjectId(collectionID) },
                          { $set: updateCollectionData }, { new: true }, function (err, updateCollection) {
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

  async checkCollectionUpdate(req, res) {
    try {
      let collectionID = req.body.collectionID;
      Collection.find({ _id: mongoose.Types.ObjectId(collectionID) }, async function (err, collectionData) {
        if (err) {
          return res.reply(messages.server_error("Collection"));
        } else {
          if (collectionData.length == 0) {
            return res.reply(messages.not_found("Collection"));
          } else {
            let $request = [];
            $request["request_type"] = "update";
            $request["address"] = collectionData[0].contractAddress;
            $request["chain_id"] = chainID;
            $request["name"] = "rockstar";
            $request["total_supply_field"] = "indicatesID";
            let payload = Object.assign({}, $request);
            try {
              let response = await axios.post(postAPIURL + 'impCollection/', payload);
              let data = response.data;
              if (data?.status !== undefined && data?.status === "update") {
                let updateCollectionData = {
                  checkStatus: 1
                }
                await Collection.findOneAndUpdate(
                  { _id: mongoose.Types.ObjectId(collectionID) },
                  { $set: updateCollectionData }, { new: true }, function (err, updateCollection) {
                    if (err) {
                      console.log("Error in Updating Collection" + err);
                      return res.reply(messages.error());
                    } else {
                      console.log("Collection status Updated: ", updateCollection);
                      return res.reply(messages.created("Collection Updated"), updateCollection);
                    }
                  }
                );
              } else {
                console.log("Error ", error);
                return res.reply(messages.server_error());
              }
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

  async refreshCollection(req, res) {
    try {
      let collectionID = req.body.collectionID;
      Collection.find({ _id: mongoose.Types.ObjectId(collectionID) }, async function (err, collectionData) {
        if (err) {
          return res.reply(messages.server_error("Collection"));
        } else {
          if (collectionData.length == 0) {
            return res.reply(messages.not_found("Collection"));
          } else {
            let tokenURI = nftMetaBaseURL + "collections?ChainId=" + chainID + "&ContractAddress=" + collectionData[0].contractAddress;
            console.log("tokenURI", tokenURI);
            try {
              http.get(tokenURI, (resData) => {
                let body = "";
                resData.on("data", (chunk) => {
                  body += chunk;
                });
                resData.on("end", async () => {
                  try {
                    let newJSON = JSON.parse(body);
                    let lastUpdated = newJSON[0].last_updated;
                    let totalSupply = newJSON[0].total_supply;
                    var d = new Date(0);
                    let lastUpdateMetaDB = d.setUTCSeconds(lastUpdated);
                    var d1 = new Date(lastUpdateMetaDB);
                    var d2 = new Date(collectionData[0].lastUpdatedOn);

                    if (d1.getTime() === d2.getTime()) {
                      console.log("No changes found in Collection");
                      return res.reply(messages.already_updated("Collection"));
                    } else {
                      console.log("changes found in Collection");
                      let apiStatus = newJSON[0].status;
                      console.log("File Status", apiStatus);
                      if (apiStatus === "available" && collectionData[0].progressStatus === 2) {
                        let NFTDataList = nftMetaBaseURL + "tokenDetailsExtended?ChainId=" + chainID + "&ContractAddress=" + collectionData[0].contractAddress;
                        console.log("NFTDataList", NFTDataList);
                        try {
                          await http.get(NFTDataList, (resData) => {
                            let body = "";
                            resData.on("data", (chunk) => {
                              body += chunk;
                            });
                            resData.on("end", async () => {
                              try {
                                let jsonNFTData = JSON.parse(body);
                                jsonNFTData.forEach(nftRecord => {
                                  let lastUpdated = nftRecord.MetadataLastUpdated;
                                  var d = new Date(0);
                                  let lastUpdateMetaDBNFT = d.setUTCSeconds(lastUpdated);
                                  var d1 = new Date(lastUpdateMetaDBNFT);
                                  NFT.find({ collectionID: mongoose.Types.ObjectId(collectionData[0]._id), tokenID: Number(nftRecord.token_id) }, async function (err, nftData) {
                                    if (err) {
                                      console.log("Error in nft Query", err)
                                    } else {
                                      if (nftData.length == 0) {
                                        let nft = new NFT({
                                          name: nftRecord.name,
                                          description: nftRecord.description,
                                          tokenID: Number(nftRecord.token_id),
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
                                          lastUpdatedOn: lastUpdateMetaDBNFT,
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
                                            _id: mongoose.Types.ObjectId(collectionData[0]._id),
                                          });
                                          let nextID = collection.getNextID();
                                          collection.nextID = nextID;
                                          collection.save();
                                          await Collection.findOneAndUpdate({
                                            _id: mongoose.Types.ObjectId(collectionData[0]._id),
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
                                            lastUpdatedOn: lastUpdateMetaDBNFT
                                          }
                                          if (nftRecord.S3Images.S3Animation === "" || nftRecord.S3Images.S3Animation === null) {
                                            updateNFTData.image = nftRecord.S3Images.S3Image;
                                          } else {
                                            updateNFTData.image = nftRecord.S3Images.S3Animation;
                                          }
                                          await NFT.findOneAndUpdate(
                                            { _id: mongoose.Types.ObjectId(nftData[0]._id) },
                                            { $set: updateNFTData }, { new: true }, function (err, updateNFT) {
                                              if (err) {
                                                console.log("Error in Updating NFT" + nftData[0]._id);
                                              } else {
                                                console.log("NFT MetaData Updated: ", nftData[0]._id);
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
                            progressStatus: 2,
                            checkStatus: 0,
                            totalSupply: totalSupply,
                            lastUpdatedOn: lastUpdateMetaDB
                          }
                          await Collection.findOneAndUpdate(
                            { _id: mongoose.Types.ObjectId(collectionID) },
                            { $set: updateCollectionData }, { new: true }, function (err, updateCollection) {
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
                      } else {
                        return res.reply(messages.status_not_updated("Collection"));
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

  async refreshMetaNFT(req, res) {
    try {
      let nftID = req.body.nftID;
      NFT.find({ _id: mongoose.Types.ObjectId(nftID) }, async function (err, nftData) {
        if (err) {
          return res.reply(messages.server_error("NFT"));
        } else {
          if (nftData.length == 0) {
            return res.reply(messages.not_found("NFT"));
          } else {

            let $request = [];
            $request["address"] = nftData.collectionAddress;
            $request["chain_id"] = chainID;
            $request["token_id"] = nftData.tokenID;
            let payload = Object.assign({}, $request);
            try {
              let response = await axios.post(postAPIURL + 'tokenRefresh/', payload);
              let data = response.data;
              if (data?.status !== undefined && data?.status === "success") {
                console.log("Added to Queue ");
                return res.reply(messages.created("Added to Queue"));
              } else {
                console.log("Error ", error);
                return res.reply(messages.server_error());
              }
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