const fs = require("fs");
const ipfsAPI = require("ipfs-api");
const ipfs = ipfsAPI("ipfs.infura.io", "5001", {
  protocol: "https",
  auth: "21w11zfV67PHKlkAEYAZWoj2tsg:f2b73c626c9f1df9f698828420fa8439",
});
const { History } = require("../../models");
const mongoose = require("mongoose");
const validators = require("../helpers/validators");
var jwt = require("jsonwebtoken");
const e = require("express");

class HistoryController {
  constructor() {

  }

  async insertHistory(req, res) {
    console.log("req", req.body);
    try {
      let nftID = req.body.nftID;
      let buyerID = req.body.buyerID;
      let sellerID = req.body.sellerID;
      let action = req.body.action;
      let type = req.body.type;
      let paymentToken = req.body.paymentToken;
      let price = req.body.price;
      let quantity = req.body.quantity;
      let createdBy = req.body.createdBy;
      const insertData = new History({
        nftID: nftID,
        buyerID: buyerID,
        sellerID: sellerID,
        action: action,
        type: type,
        paymentToken: paymentToken,
        price: price,
        quantity: quantity,
        createdBy: createdBy
      });
      console.log("Insert Data is " + insertData);
      insertData.save().then(async (result) => {
        return res.reply(messages.created("Record Inserted"), result);
      }).catch((error) => {
        console.log("Error in creating Record", error);
        return res.reply(messages.error());
      });
    } catch (e) {
      console.log("errr", e);
      return res.reply(messages.error());
    }
  };

  async fetchHistory(req, res) {
    console.log("req", req.body);
    try {
      let data = [];
      const page = parseInt(req.body.page);
      const limit = parseInt(req.body.limit);
      const startIndex = (page - 1) * limit;
      const endIndex = page * limit;
      let nftID = "";
      if (req.body.nftID && req.body.nftID !== undefined) {
        nftID = req.body.nftID;
      }
      let userID = "";
      if (req.body.userID && req.body.userID !== undefined) {
        userID = req.body.userID;
      }
      let collectionID = "";
      if (req.body.collectionID && req.body.collectionID !== undefined) {
        collectionID = req.body.collectionID;
      }
      let brandID = "";
      if (req.body.brandID && req.body.brandID !== undefined) {
        brandID = req.body.brandID;
      }
      let searchArray = [];
      if (nftID !== "") {
        searchArray["nftsData._id"] = mongoose.Types.ObjectId(nftID);
      }
      if (collectionID !== "") {
        searchArray["nftsData.collectionID"] = mongoose.Types.ObjectId(collectionID);
      }
      if (userID !== "") {
        searchArray["createdBy"] = mongoose.Types.ObjectId(userID);
      }
      if (brandID !== "") {
        searchArray["nftsData.brandID"] = mongoose.Types.ObjectId(brandID);
      }

      let searchObj = Object.assign({}, searchArray);

      let isOnMarketplaceSearchArray = [];
      isOnMarketplaceSearchArray["$match"] = { "CollectionData.status": 1 };
      let isOnMarketplaceSearchObj = Object.assign(
        {},
        isOnMarketplaceSearchArray
      );
      console.log("isOnMarketplaceSearchObj", isOnMarketplaceSearchObj);

      let history = await History.aggregate([    
        {
          $lookup: {
            from: "nfts",
            localField: "nftID",
            foreignField: "_id",
            as: "nftsData",
          },
        },
        {
          $lookup: {
            from: "collections",
            localField: "nftsData.collectionID",
            foreignField: "_id",
            as: "CollectionData",
          },
        },
        {
          $lookup: {
            from: "brands",
            localField: "nftsData.brandID",
            foreignField: "_id",
            as: "BrandData",
          },
        },
        isOnMarketplaceSearchObj,
        {
          $lookup: {
            from: "users",
            localField: "sellerID",
            foreignField: "_id",
            as: "SellerData",
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "buyerID",
            foreignField: "_id",
            as: "BuyerData",
          },
        },
        { $match: searchObj },
        {
          $project: {
            _id: 1,
            buyerID: 1,
            sellerID: 1,
            action: 1,
            type: 1,
            paymentToken: 1,
            price: 1,
            quantity: 1,
            createdOn: 1,
            "nftsData._id": 1,
            "nftsData.name": 1,
            "nftsData.type": 1,
            "nftsData.image": 1,
            "CollectionData._id": 1,
            "CollectionData.name": 1,
            "CollectionData.contractAddress": 1,
            "CollectionData.isOnMarketplace": 1,
            "CollectionData.status": 1,
            "BrandData._id": 1,
            "BrandData.name": 1,
            "BrandData.logoImage": 1,
            "BrandData.coverImage": 1,
            "SellerData._id": 1,
            "SellerData.username": 1,
            "SellerData.fullname": 1,
            "SellerData.walletAddress": 1,
            "BuyerData._id": 1,
            "BuyerData.username": 1,
            "BuyerData.fullname": 1,
            "BuyerData.walletAddress": 1,
          },
        },
        { $sort: { createdOn: -1 } },
        { $skip: startIndex },
        { $limit: limit },
        
      ]).exec(function (e, historyData) {
        console.log("Error ", e);
        let results = {};
        results.count = historyData?.length ? historyData.length : 0;
        results.results = historyData;
        return res.reply(messages.success("History List"), results);
      });
    } catch (error) {
      console.log("Error " + error);
      return res.reply(messages.server_error());
    }
  }
}
module.exports = HistoryController;