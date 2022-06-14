const fs = require("fs");
const ipfsAPI = require("ipfs-api");
const ipfs = ipfsAPI("ipfs.infura.io", "5001", {
  protocol: "https",
  auth: "21w11zfV67PHKlkAEYAZWoj2tsg:f2b73c626c9f1df9f698828420fa8439",
});
const { Order, NFT, Bid, Collection, importedNFT } = require("../../models");
const pinataSDK = require("@pinata/sdk");
const multer = require("multer");
const pinata = pinataSDK(
  process.env.PINATAAPIKEY,
  process.env.PINATASECRETAPIKEY
);
const mongoose = require("mongoose");
const validators = require("../helpers/validators");
var jwt = require("jsonwebtoken");

class OrderController {
  constructor() {}

  async createOrder(req, res) {
    try {
      console.log(req);
      if (!req.userId) return res.reply(messages.unauthorized());
      let orderDate = new Date().setFullYear(new Date().getFullYear() + 10);
      let validity = Math.floor(orderDate / 1000);
      console.log("nft req", req.body);
      const order = new Order({
        nftID: req.body.nftID,
        tokenID: req.body.tokenID,
        collectionAddress: req.body.collectionAddress,
        total_quantity: req.body.quantity,
        deadline: req.body.deadline,
        deadlineDate: req.body.deadlineDate,
        salesType: req.body.saleType,
        paymentToken: req.body.tokenAddress,
        price: req.body.price,
        salt: req.body.salt,
        signature: req.body.signature,
        bundleTokens: [],
        bundleTokensQuantities: [],
        sellerID: req.userId,
      });

      order
        .save()
        .then((result) => {
          return res.reply(messages.created("Order"), result);
        })
        .catch((error) => {
          return res.reply(messages.already_exists("Failed:" + error));
        });
    } catch (error) {
      console.log("Error " + JSON.stringify(error));
      return res.reply(messages.server_error());
    }
  }

  async deleteOrder(req, res) {
    try {
      if (!req.userId) return res.reply(messages.unauthorized());
      await Order.find({ _id: req.body.orderId }).remove().exec();
      await Bid.find({ orderID: req.body.orderId, bidStatus: "Bid" })
        .remove()
        .exec();

      return res.reply(messages.deleted("order"));
    } catch (err) {
      return res.reply(messages.error(), err.message);
    }
  }

  async updateOrder(req, res) {
    try {
      if (!req.userId) return res.reply(messages.unauthorized());

      let lazyMintingStatus = Number(req.body.LazyMintingStatus);

      if (!req.body.nftID) {
        return res.reply(messages.bad_request(), "NFTID is required.");
      } else {
        await Order.updateOne(
          { _id: req.body.orderId },
          {
            $set: {
              quantity_sold: req.body.qty_sold,
            },
          },
          {
            upsert: true,
          },
          (err) => {
            if (err) throw error;
          }
        );
      }
      let NFTData = await NFT.findOne({
        _id: mongoose.Types.ObjectId(req.body.nftID),
        "ownedBy.address": req.body.seller.toLowerCase(),
      }).select("ownedBy -_id");

      console.log("NFTData-------->", NFTData);
      let currentQty = NFTData.ownedBy.find(
        (o) => o.address === req.body.seller.toLowerCase()
      ).quantity;
      let boughtQty = parseInt(req.body.qtyBought);
      let leftQty = currentQty - boughtQty;
      if (leftQty < 1) {
        await NFT.findOneAndUpdate(
          { _id: mongoose.Types.ObjectId(req.body.nftID) },
          {
            $pull: {
              ownedBy: { address: req.body.seller },
            },
          }
        ).catch((e) => {
          console.log("Error1", e.message);
        });
      } else {
        await NFT.findOneAndUpdate(
          {
            _id: mongoose.Types.ObjectId(req.body.nftID),
            "ownedBy.address": req.body.seller,
          },
          {
            $set: {
              "ownedBy.$.quantity": parseInt(leftQty),
            },
          }
        ).catch((e) => {
          console.log("Error2", e.message);
        });
      }

      //Credit the buyer
      console.log("Crediting Buyer");

      let subDocId = await NFT.exists({
        _id: mongoose.Types.ObjectId(req.body.nftID),
        "ownedBy.address": req.body.buyer,
      });
      if (subDocId) {
        console.log("Subdocument Id", subDocId);

        let NFTData_Buyer = await NFT.findOne({
          _id: mongoose.Types.ObjectId(req.body.nftID),
          "ownedBy.address": req.body.buyer,
        }).select("ownedBy -_id");
        console.log("NFTData_Buyer-------->", NFTData_Buyer);
        console.log(
          "Quantity found for buyers",
          NFTData_Buyer.ownedBy.find(
            (o) => o.address === req.body.buyer.toLowerCase()
          ).quantity
        );
        currentQty = NFTData_Buyer.ownedBy.find(
          (o) => o.address === req.body.buyer.toLowerCase()
        ).quantity
          ? parseInt(
              NFTData_Buyer.ownedBy.find(
                (o) => o.address === req.body.buyer.toLowerCase()
              ).quantity
            )
          : 0;
        boughtQty = req.body.qtyBought;
        let ownedQty = currentQty + boughtQty;

        await NFT.findOneAndUpdate(
          {
            _id: mongoose.Types.ObjectId(req.body.nftID),
            "ownedBy.address": req.body.buyer,
          },
          {
            $set: {
              "ownedBy.$.quantity": parseInt(ownedQty),
            },
          },
          { upsert: true, runValidators: true }
        ).catch((e) => {
          console.log("Error1", e.message);
        });
      } else {
        console.log("Subdocument Id not found");
        let dataToadd = {
          address: req.body.buyer,
          quantity: parseInt(req.body.qtyBought),
        };
        await NFT.findOneAndUpdate(
          { _id: mongoose.Types.ObjectId(req.body.nftID) },
          { $addToSet: { ownedBy: dataToadd } },

          { upsert: true }
        );
        console.log("wasn't there but added");
      }
      await NFT.findOneAndUpdate(
        { _id: mongoose.Types.ObjectId(req.body.nftID) },
        {
          $set: {
            lazyMintingStatus: Number(lazyMintingStatus),
            quantity_minted: Number(req.body.quantity_minted),
          },
        }
      ).catch((e) => {
        console.log("Error1", e.message);
      });
      return res.reply(messages.updated("order"));
    } catch (error) {
      return res.reply(messages.error(), error.message);
    }
  }

  async getOrder(req, res) {
    try {
      Order.findOne({ _id: req.body.orderId }, (err, order) => {
        if (err) return res.reply(messages.server_error());
        if (!order) return res.reply(messages.not_found("Order"));
        return res.reply(messages.no_prefix("Order Details"), order);
      })
        .populate("sellerID")
        .populate("nftID");
    } catch (error) {
      return res.reply(messages.server_error());
    }
  }

  async getOrdersByNftId(req, res) {
    try {
      const sortKey = req.body.sortKey ? req.body.sortKey : "price";
      const sortType = req.body.sortType ? req.body.sortType : -1;
      var sortObject = {};
      var stype = sortKey;
      var sdir = sortType;
      sortObject[stype] = sdir;
      const page = parseInt(req.body.page);
      const limit = parseInt(req.body.limit);
      const startIndex = (page - 1) * limit;
      const endIndex = page * limit;
      const results = {};
      let searchArray = [];
      if (req.body.nftID != undefined && req.body.nftID != "") {
        searchArray["nftID"] = req.body.nftID;
      }
      if (req.body.tokenID != undefined && req.body.tokenID != "") {
        searchArray["tokenID"] = req.body.tokenID;
        searchArray["collectionAddress"] = req.body.collectionAddress;
      }
      let searchObj = Object.assign({}, searchArray);
      if (endIndex < (await Order.count(searchObj).exec())) {
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

      let AllOrders = await Order.find(searchObj)
        .populate("sellerID")
        .sort(sortObject)
        .limit(limit)
        .skip(startIndex)
        .exec();

      results.results = AllOrders;
      return res.reply(messages.success("NFT Orders List"), results);
    } catch (error) {
      return res.reply(messages.server_error(), error.message);
    }
  }

  async createOrderImport(req, res) {
    try {
      console.log(req.body);
      if (!req.userId) return res.reply(messages.unauthorized());
      let collectionID = "";
      let nftID = "";
      console.log("collectionID " + collectionID);
      console.log("nftID " + nftID);
      let importedNFTID = req.body.nftID;
      let importedCollection = req.body.collectionAddress.toLowerCase();
      // let creatorAddress = req.body.creatorAddress;
      console.log("importedCollection " + importedCollection);

      let createCollection = await new Promise((resolve) => {
        Collection.find(
          { contractAddress: importedCollection },
          (err, colData) => {
            if (err) {
              console.log("Collection Query error", error);
              return res.reply(messages.error());
            }
            if (colData.length == 0) {
              const collection = new Collection({
                contractAddress: importedCollection,
                createdBy: req.userId,
                isImported: 1,
                link: colData.link,
              });
              collection
                .save()
                .then((saveCol) => {
                  console.log("Saved Collection", saveCol);
                  collectionID = saveCol._id;
                  resolve(collectionID);
                })
                .catch((error) => {
                  console.log("Created Collection error", error);
                  return res.reply(error);
                });
            } else {
              console.log("Updated Collection", colData);
              collectionID = colData._id;
              resolve(collectionID);
            }
          }
        );
      });

      let createNFT = await new Promise((resolve) => {
        importedNFT
          .findById(importedNFTID, (err, nftData) => {
            if (err) {
              console.log("NFT Query error", error);
              return res.reply(messages.error());
            }
            if (!nftData) {
              return res.reply(messages.not_found("Imported NFT"));
            } else {
              const nft = new NFT({
                name: nftData.name,
                collectionID: collectionID,
                collectionAddress: importedCollection,
                description: nftData.description,
                createdBy: req.userId,
                tokenID: nftData.tokenID,
                attributesImported: nftData.attributes,
                isMinted: 1,
                lazyMintingStatus: 0,
                isImported: 1,
                ownedBy: [],
                image: nftData.image,
              });
              nft.ownedBy.push(nftData.ownedBy);
              nft
                .save()
                .then(async (result) => {
                  console.log("nft res", result);
                  nftID = result._id;
                  const collection = await Collection.findOne({
                    _id: mongoose.Types.ObjectId(collectionID),
                  });

                  console.log("_id", collectionID, collection);
                  let nextID = collection.getNextID();
                  collection.nextID = nextID;
                  collection.save();
                  await Collection.findOneAndUpdate(
                    { _id: mongoose.Types.ObjectId(collectionID) },
                    { $inc: { nftCount: 1 } },
                    function () {}
                  );
                  await importedNFT.deleteOne({
                    _id: mongoose.Types.ObjectId(importedNFTID),
                  });
                  resolve(result._id);
                })
                .catch((error) => {
                  console.log("Created NFT error", error);
                  return res.reply(messages.error());
                });
            }
          })
          .catch((e) => {
            console.log("Error 1" + e);
            return res.reply(messages.error());
          });
      });
      console.log("collectionID " + collectionID);
      console.log("nftID " + nftID);
      let orderDate = new Date().setFullYear(new Date().getFullYear() + 10);
      let validity = Math.floor(orderDate / 1000);

      const order = new Order({
        nftID: nftID,
        tokenID: req.body.tokenID,
        collectionAddress: req.body.collectionAddress,
        total_quantity: req.body.quantity,
        deadline: req.body.deadline,
        deadlineDate: req.body.deadlineDate,
        salesType: req.body.saleType,
        paymentToken: req.body.tokenAddress,
        price: req.body.price,
        salt: req.body.salt,
        signature: req.body.signature,
        bundleTokens: [],
        bundleTokensQuantities: [],
        sellerID: req.userId,
      });
      order
        .save()
        .then((result) => {
          return res.reply(messages.created("Order"), result);
        })
        .catch((error) => {
          return res.reply(messages.already_exists("Failed:" + error));
        });
    } catch (error) {
      console.log("Error 2", error);
      return res.reply(messages.server_error());
    }
  }

  /*
  async createOrderImport(req, res) {
    try {
      console.log(req.body);
      let collectionID = "";
      let nftID = "";
      console.log("collectionID " + collectionID);
      console.log("nftID " + nftID);
      let importedNFTID = req.body.nftId;
      let importedCollection = req.body.collection.toLowerCase();
      let creatorAddress = req.body.creatorAddress;
      console.log("importedCollection " + importedCollection)
      await Collection.find({ contractAddress: importedCollection },
        (err, colData) => {
          if (err){
            console.log("Collection Query error",error);
            return res.reply(messages.error());
          }
          if ( colData.length == 0) {
            const collection = new Collection({
              contractAddress: importedCollection,
              createdBy: req.userId,
              isImported: 1
            });
            collection.save().then((saveCol) => {
              console.log("Saved Collection", saveCol);
              collectionID = saveCol._id;
            })
            .catch((error) => {
              console.log("Created Collection error",error);
              return res.reply(error);
            });
          } else {
            console.log("Updated Collection", colData);
            collectionID = colData._id;
          }
        }
      );
      await importedNFT.findById(importedNFTID, (err, nftData) => {
        if (err){
          console.log("NFT Query error",error);
          return res.reply(messages.error());
        }
        if (!nftData) {
          return res.reply(messages.not_found("Imported NFT"));
        } else {
          const nft = new NFT({
            name: nftData.name,
            collectionID: collectionID,
            description: nftData.description,
            createdBy: req.userId,
            tokenID: nftData.tokenID,
            attributesImported: nftData.attributes,
            isMinted: 1,
            lazyMintingStatus: 0,
            isImported: 1
          });
          nft.ownedBy.push({
            address: creatorAddress.toLowerCase(),
            quantity: req.body.quantity,
          });
          nft.save().then(async (result) => {
            nftID = result._id;
            const collection = await Collection.findOne({
              _id: mongoose.Types.ObjectId(collectionID),
            });
            let nextID = collection.getNextID();
            collection.nextID = nextID;
            collection.save();
            await Collection.findOneAndUpdate(
              { _id: mongoose.Types.ObjectId(collectionID) },
              { $inc: { nftCount: 1 } },
              function () { }
            );

          }).catch((error) => {
            console.log("Created NFT error", error);
            return res.reply(messages.error());
          });
        }
      })
      .catch((e) => {
        console.log("Error 1" + e);
        return res.reply(messages.error());
      });
      console.log("collectionID " + collectionID);
          console.log("nftID " + nftID);
          let orderDate = new Date().setFullYear(new Date().getFullYear() + 10);
          let validity = Math.floor(orderDate / 1000);
          
          const order = new Order({
            nftID: nftID,
            tokenID: req.body.tokenId,
            tokenAddress: collectionID,
            total_quantity: req.body.quantity,
            deadline: req.body.deadline,
            deadlineDate: req.body.deadlineDate,
            salesType: req.body.saleType,
            paymentToken: req.body.tokenAddress,
            price: req.body.price,
            salt: req.body.salt,
            signature: req.body.signature,
            bundleTokens: [],
            bundleTokensQuantities: [],
            sellerID: req.userId,
          });
          order.save().then((result) => {
            return res.reply(messages.created("Order"), result);
          }).catch((error) => {
            return res.reply(messages.already_exists("Failed:" + error));
          });
    } catch (error) {
      console.log("Error 2" ,error );
      return res.reply(messages.server_error());
    }
  };
  */
}

module.exports = OrderController;
