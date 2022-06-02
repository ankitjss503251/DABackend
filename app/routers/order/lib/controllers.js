const fs = require("fs");
const ipfsAPI = require("ipfs-api");
const ipfs = ipfsAPI("ipfs.infura.io", "5001", {
  protocol: "https",
  auth: "21w11zfV67PHKlkAEYAZWoj2tsg:f2b73c626c9f1df9f698828420fa8439",
});
const { Order, NFT, Bid } = require("../../../models");
const pinataSDK = require("@pinata/sdk");
const multer = require("multer");
const pinata = pinataSDK(
  process.env.PINATAAPIKEY,
  process.env.PINATASECRETAPIKEY
);
const mongoose = require("mongoose");
const validators = require("./validators");
var jwt = require("jsonwebtoken");
const controllers = {};

controllers.createOrder = async (req, res) => {
  try {
    console.log(req);

    let orderDate = new Date().setFullYear(new Date().getFullYear() + 10);
    let validity = Math.floor(orderDate / 1000);
    console.log("nft req", req.body);
    const order = new Order({
      nftID: req.body.nftId,
      tokenID: req.body.tokenId,
      tokenAddress: req.body.collection,
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
};

controllers.deleteOrder = async (req, res) => {
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
};

controllers.updateOrder = async (req, res) => {
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
};

controllers.getOrder = (req, res) => {
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
};

controllers.getOrdersByNftId = async (req, res) => {
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
    if (
      endIndex <
      (await Order.count({ nftID: req.body.nftId, status: 1 }).exec())
    ) {
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

    let AllOrders = await Order.find({
      nftID: req.body.nftId,
    })
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
};
module.exports = controllers;
