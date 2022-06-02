const { User, Bid, NFT, Order } = require("../../../models");
const validators = require("./validators");
const mongoose = require("mongoose");
const controllers = {};
const nodemailer = require("../../../utils/lib/nodemailer");

controllers.createBidNft = async (req, res) => {
  console.log("req", req.body);
  try {
    if (!req.userId) return res.reply(messages.unauthorized());
    console.log("Checking Old Bids");
    let CheckBid = await Bid.findOne({
      bidderID: mongoose.Types.ObjectId(req.userId),
      owner: mongoose.Types.ObjectId(req.body.owner),
      nftID: mongoose.Types.ObjectId(req.body.nftID),
      orderID: mongoose.Types.ObjectId(req.body.orderID),
      bidStatus: "Bid",
    });
    if (CheckBid) {
      await Bid.findOneAndDelete(
        {
          bidderID: mongoose.Types.ObjectId(req.userId),
          owner: mongoose.Types.ObjectId(req.body.owner),
          nftID: mongoose.Types.ObjectId(req.body.nftID),
          orderID: mongoose.Types.ObjectId(req.body.orderID),
          bidStatus: "Bid",
        },
        function (err, bidDel) {
          if (err) {
            console.log("Error in deleting Old Bid" + err);
          } else {
            console.log("Old Bid record Deleted" + bidDel);
          }
        }
      );
    }
    const bidData = new Bid({
      bidderID: req.userId,
      owner: req.body.owner,
      bidStatus: "Bid",
      bidPrice: req.body.bidPrice,
      nftID: req.body.nftID,
      orderID: req.body.orderID,
      bidQuantity: req.body.bidQuantity,
      buyerSignature: req.body.buyerSignature,
      bidDeadline: req.body.bidDeadline,
    });
    bidData
      .save()
      .then(async (result) => {
        return res.reply(messages.created("Bid Placed"), result);
      })
      .catch((error) => {
        console.log("Created Bid error", error);
        return res.reply(messages.error());
      });
  } catch (e) {
    console.log("errr", e);
    return res.reply(messages.error());
  }
};

controllers.updateBidNft = async (req, res) => {
  console.log("req", req.body);
  try {
    if (!req.userId) return res.reply(messages.unauthorized());
    console.log("Checking Old Bids");
    let bidID = req.body.bidID;
    let CheckBid = await Bid.findById(bidID);
    if (CheckBid) {
      if (req.body.action == "Delete" || req.body.action == "Cancelled") {
        await Bid.findOneAndDelete(
          { _id: mongoose.Types.ObjectId(bidID) },
          function (err, delBid) {
            if (err) {
              console.log("Error in Deleting Bid" + err);
              return res.reply(messages.error());
            } else {
              console.log("Bid Deleted : ", delBid);
              return res.reply(messages.created("Bid Cancelled"), delBid);
            }
          }
        );
      } else {
        await Bid.findOneAndUpdate(
          { _id: mongoose.Types.ObjectId(bidID) },
          { bidStatus: req.body.action },
          function (err, rejBid) {
            if (err) {
              console.log("Error in Rejecting Bid" + err);
              return res.reply(messages.error());
            } else {
              console.log("Bid Rejected : ", rejBid);
              return res.reply(messages.created("Bid Rejected"), rejBid);
            }
          }
        );
      }
    } else {
      console.log("Bid Not found");
      return res.reply("Bid Not found");
    }
  } catch (e) {
    console.log("errr", e);
    return res.reply(messages.error());
  }
};

controllers.fetchBidNft = async (req, res) => {
  console.log("req", req.body);
  try {
    if (!req.userId) return res.reply(messages.unauthorized());
    let nftID = req.body.nftID;
    let orderID = req.body.orderID;
    let buyerID = req.body.buyerID;
    let bidStatus = req.body.bidStatus;
    let oTypeQuery = {};
    let nftIDQuery = {};
    let orderIDQuery = {};
    let buyerIDQuery = {};

    let filters = [];
    if (bidStatus != "All") {
      oTypeQuery = { bidStatus: mongoose.Types.ObjectId(bidStatus) };
    }
    if (nftID != "All") {
      nftIDQuery = { nftID: mongoose.Types.ObjectId(nftID) };
    }
    if (orderID != "All") {
      orderIDQuery = { orderID: mongoose.Types.ObjectId(orderID) };
    }
    if (buyerID != "All") {
      buyerIDQuery = { bidderID: mongoose.Types.ObjectId(buyerID) };
    }
    console.log(filters);
    let data = await Bid.aggregate([
      {
        $match: {
          $and: [
            { oBidQuantity: { $gte: 1 } },
            { bidStatus: "Bid" },
            oTypeQuery,
            nftIDQuery,
            orderIDQuery,
            buyerIDQuery,
          ],
        },
      },
      {
        $project: {
          _id: 1,
          bidderID: 1,
          owner: 1,
          bidStatus: 1,
          oBidPrice: 1,
          nftID: 1,
          orderID: 1,
          oBidQuantity: 1,
          buyerSignature: 1,
          oBidDeadline: 1,
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "bidderID",
          foreignField: "_id",
          as: "bidderID",
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "owner",
          foreignField: "_id",
          as: "owner",
        },
      },
      {
        $sort: {
          sCreated: -1,
        },
      },
      { $unwind: "$bidderID" },
      { $unwind: "$owner" },
      {
        $facet: {
          bids: [
            {
              $skip: +0,
            },
          ],
          totalCount: [
            {
              $count: "count",
            },
          ],
        },
      },
    ]);
    console.log("Datat" + data[0].bids.length);
    let iFiltered = data[0].bids.length;
    if (data[0].totalCount[0] == undefined) {
      return res.reply(messages.no_prefix("Bid Details"), {
        data: [],
        draw: req.body.draw,
        recordsTotal: 0,
        recordsFiltered: 0,
      });
    } else {
      return res.reply(messages.no_prefix("Bid Details"), {
        data: data[0].bids,
        draw: req.body.draw,
        recordsTotal: data[0].totalCount[0].count,
        recordsFiltered: iFiltered,
      });
    }
  } catch (error) {
    return res.reply(messages.server_error());
  }
};

controllers.acceptBidNft = async (req, res) => {
  console.log("req", req.body);
  try {
    if (!req.userId) return res.reply(messages.unauthorized());
    if (!req.body.bidID)
      return res.reply(messages.bad_request(), "Bid is required.");

    console.log("Checking Old Bids");
    let ERC721 = req.body.ERC721;
    let bidID = req.body.bidID;
    let status = req.body.status;
    let qty_sold = req.body.qty_sold;
    let BidData = await Bid.findById(bidID);
    if (BidData) {
      let nftID = BidData.nftID;
      let orderId = BidData.orderID;
      let boughtQty = parseInt(BidData.oBidQuantity);
      let bidderID = BidData.bidderID;
      let BuyerData = await User.findById(bidderID);
      let buyer = BuyerData.walletAddress;
      let owner = BidData.owner;
      let OwnerData = await User.findById(owner);
      let seller = OwnerData.walletAddress;

      await Order.updateOne(
        { _id: orderId },
        {
          $set: {
            status: status,
            quantity_sold: qty_sold,
          },
        },
        {
          upsert: true,
        },
        (err) => {
          if (err) throw error;
        }
      );
      //deduct previous owner

      let _NFT = await NFT.findOne({
        _id: mongoose.Types.ObjectId(nftID),
        "nOwnedBy.address": seller,
      }).select("nOwnedBy -_id");
      console.log("_NFT-------->", _NFT);
      let currentQty = _NFT.nOwnedBy.find(
        (o) => o.address === seller.toLowerCase()
      ).quantity;

      let leftQty = currentQty - boughtQty;
      if (leftQty < 1) {
        await NFT.findOneAndUpdate(
          { _id: mongoose.Types.ObjectId(nftID) },
          {
            $pull: {
              nOwnedBy: { address: seller },
            },
          }
        ).catch((e) => {
          console.log("Error1", e.message);
        });
      } else {
        await NFT.findOneAndUpdate(
          {
            _id: mongoose.Types.ObjectId(nftID),
            "nOwnedBy.address": seller,
          },
          {
            $set: {
              "nOwnedBy.$.quantity": parseInt(leftQty),
            },
          }
        ).catch((e) => {
          console.log("Error2", e.message);
        });
      }
      //Credit the buyer
      console.log("Crediting Buyer");
      let subDocId = await NFT.exists({
        _id: mongoose.Types.ObjectId(nftID),
        "nOwnedBy.address": buyer,
      });
      if (subDocId) {
        console.log("Subdocument Id", subDocId);
        let NFTNewData = await NFT.findOne({
          _id: mongoose.Types.ObjectId(nftID),
          "nOwnedBy.address": buyer,
        }).select("nOwnedBy -_id");
        console.log("NFTNewData-------->", NFTNewData);
        console.log(
          "Quantity found for buyers",
          NFTNewData.nOwnedBy.find((o) => o.address === buyer.toLowerCase())
            .quantity
        );

        currentQty = NFTNewData.nOwnedBy.find(
          (o) => o.address === buyer.toLowerCase()
        ).quantity
          ? parseInt(
              NFTNewData.nOwnedBy.find((o) => o.address === buyer.toLowerCase())
                .quantity
            )
          : 0;

        let ownedQty = currentQty + boughtQty;
        await NFT.findOneAndUpdate(
          {
            _id: mongoose.Types.ObjectId(nftID),
            "nOwnedBy.address": buyer,
          },
          {
            $set: {
              "nOwnedBy.$.quantity": parseInt(ownedQty),
            },
          },
          { upsert: true, runValidators: true }
        ).catch((e) => {
          console.log("Error1", e.message);
        });
      } else {
        console.log("Subdocument Id not found");
        let dataToadd = {
          address: buyer,
          quantity: parseInt(boughtQty),
        };
        await NFT.findOneAndUpdate(
          { _id: mongoose.Types.ObjectId(nftID) },
          { $addToSet: { nOwnedBy: dataToadd } },
          { upsert: true }
        );
        console.log("wasn't there but added");
      }

      await Bid.findOneAndUpdate(
        {
          _id: mongoose.Types.ObjectId(bidID),
        },
        { bidStatus: "Accepted" },
        function (err, acceptBid) {
          if (err) {
            console.log("Error in Accepting Bid" + err);
            return res.reply(messages.error());
          } else {
            console.log("Bid Accepted : ", acceptBid);
          }
        }
      );
      if (ERC721) {
        await Bid.deleteMany({
          owner: mongoose.Types.ObjectId(owner),
          nftID: mongoose.Types.ObjectId(nftID),
          bidStatus: "Bid",
        })
          .then(function () {
            console.log("Data deleted");
          })
          .catch(function (error) {
            console.log(error);
          });
      } else {
        let _order = await Order.findOne({
          _id: mongoose.Types.ObjectId(orderId),
        });
        let leftQty = _order.oQuantity - qty_sold;
        if (leftQty <= 0) {
          await Order.deleteOne({ _id: mongoose.Types.ObjectId(orderId) });
        }
        console.log("left qty 1155", leftQty);
        await Bid.deleteMany({
          owner: mongoose.Types.ObjectId(owner),
          nftID: mongoose.Types.ObjectId(nftID),
          bidStatus: "Bid",
          oBidQuantity: { $gt: leftQty },
        })
          .then(function () {
            console.log("Data deleted from 1155");
          })
          .catch(function (error) {
            console.log(error);
          });
      }

      return res.reply(messages.updated("order"));
    } else {
      console.log("Bid Not found");
      return res.reply("Bid Not found");
    }
  } catch (e) {
    console.log("errr", e);
    return res.reply(messages.error());
  }
};

module.exports = controllers;