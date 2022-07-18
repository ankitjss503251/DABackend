const { User, Bid, NFT, Order } = require("../../models");
const validators = require("../helpers/validators");
const mongoose = require("mongoose");
const nodemailer = require("../../utils/lib/nodemailer");

class BidController {
  constructor() {}

  async createBidNft(req, res) {
    console.log("req", req.body);
    try {
      if (!req.userId) return res.reply(messages.unauthorized());
      console.log("Checking Old Bids");
      let isblocked = await validators.isBlockedNFT(req.body.nftID);
      if (isblocked === -1) {
        return res.reply(messages.server_error("Query "));
      } else if (isblocked === 0) {
        return res.reply(messages.blocked("NFT"));
      } else if (isblocked === -2) {
        return res.reply(messages.not_found("NFT/Collection"));
      } else if (isblocked === 1) {
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
          isOffer: req.body.isOffer,
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
      }
    } catch (e) {
      console.log("errr", e);
      return res.reply(messages.error());
    }
  }

  //Create Offer API

  async createOffer(req, res) {
    console.log("req in create offer", req.body);
    try {
      if (!req.userId) return res.reply(messages.unauthorized());
      console.log("Checking Old Offer");

      console.log("ownerr addres isss------>", req.body.owner.address);

      let user = await User.findOne({ walletAddress: req.body.owner.address });
      console.log("User is--->", user);

      let CheckBid = await Bid.findOne({
        bidderID: mongoose.Types.ObjectId(req.userId),
        owner: mongoose.Types.ObjectId(user._id),
        nftID: mongoose.Types.ObjectId(req.body.nftID),
        //orderID: mongoose.Types.ObjectId(req.body.orderID),
        bidStatus: "MakeOffer",
      });
      if (CheckBid) {
        await Bid.findOneAndDelete(
          {
            bidderID: mongoose.Types.ObjectId(req.userId),
            owner: mongoose.Types.ObjectId(user._id),
            nftID: mongoose.Types.ObjectId(req.body.nftID),
            //orderID: mongoose.Types.ObjectId(req.body.orderID),
            bidStatus: "MakeOffer",
          },
          function (err, bidDel) {
            if (err) {
              console.log("Error in deleting Old Bid" + err);
              return res.reply(messages.error("Failed"));
            } else {
              console.log("Old Bid record Deleted" + bidDel);
            }
          }
        );
      }
      const bidData = new Bid({
        bidderID: req.userId,
        owner: user._id,
        bidStatus: "MakeOffer",
        bidPrice: req.body.bidPrice,
        nftID: req.body.nftID,
        //orderID: req.body.orderID,
        bidQuantity: req.body.bidQuantity,
        paymentToken: req.body.paymentToken,
        buyerSignature: req.body.buyerSignature,
        bidDeadline: req.body.bidDeadline,
        isOffer: true,
        salt: req.body.salt,
        tokenAddress: req.body.tokenAddress,
      });
      console.log("bidDat is--->", bidData);
      bidData
        .save()
        .then(async (result) => {
          return res.reply(messages.created("Offer Placed"), result);
        })
        .catch((error) => {
          console.log("Created Offer error", error);
          return res.reply(messages.error("Failed"));
        });
    } catch (e) {
      console.log("errr", e);
      return res.reply(messages.error("Offer Failed"));
    }
  }

  async updateBidNft(req, res) {
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
  }

  async fetchBidNft(req, res) {
    console.log("req", req.body);
    try {
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
              { bidQuantity: { $gte: 1 } },
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
            bidPrice: 1,
            nftID: 1,
            orderID: 1,
            bidQuantity: 1,
            buyerSignature: 1,
            bidDeadline: 1,
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
          $lookup: {
            from: "orders",
            localField: "orderID",
            foreignField: "_id",
            as: "orderID",
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
  }

  //async updateOfferNft(req, res) {
  //  console.log("req", req.body);
  //  try {
  //    if (!req.userId) return res.reply(messages.unauthorized());
  //    console.log("Checking Old Offers");
  //    let bidID = req.body.bidID;
  //    let CheckBid = await Bid.findById(bidID);
  //    if (CheckBid) {
  //      if (req.body.action == "Delete" || req.body.action == "Cancelled") {
  //        await Bid.findOneAndDelete(
  //          { _id: mongoose.Types.ObjectId(bidID) },
  //          function (err, delBid) {
  //            if (err) {
  //              console.log("Error in Deleting Bid" + err);
  //              return res.reply(messages.error());
  //            } else {
  //              console.log("Offer Deleted : ", delBid);
  //              return res.reply(messages.created("Offer Cancelled"), delBid);
  //            }
  //          }
  //        );
  //      } else {
  //        await Bid.findOneAndUpdate(
  //          { _id: mongoose.Types.ObjectId(bidID) },
  //          { bidStatus: req.body.action },
  //          function (err, rejBid) {
  //            if (err) {
  //              console.log("Error in Rejecting Offer" + err);
  //              return res.reply(messages.error());
  //            } else {
  //              console.log("Offer Rejected : ", rejBid);
  //              return res.reply(messages.created("Offer Rejected"), rejBid);
  //            }
  //          }
  //        );
  //      }
  //    } else {
  //      console.log("Offer Not found");
  //      return res.reply("Offer Not found");
  //    }
  //  } catch (e) {
  //    console.log("errr", e);
  //    return res.reply(messages.error());
  //  }
  //}

  async fetchOfferNft(req, res) {
    console.log("req in fetchOffer nft", req.body);
    try {
      //if (!req.userId) return res.reply(messages.unauthorized());
      let nftID = req.body.nftID;

      let buyerID = req.body.buyerID;
      let bidStatus = req.body.bidStatus;
      let oTypeQuery = {};
      let nftIDQuery = {};

      let buyerIDQuery = {};

      let filters = [];
      if (bidStatus != "All") {
        oTypeQuery = { bidStatus: mongoose.Types.ObjectId(bidStatus) };
      }
      if (nftID != "All") {
        nftIDQuery = { nftID: mongoose.Types.ObjectId(nftID) };
      }
      //if (orderID != "All") {
      //  orderIDQuery = { orderID: mongoose.Types.ObjectId(orderID) };
      //}
      if (buyerID != "All") {
        buyerIDQuery = { bidderID: mongoose.Types.ObjectId(buyerID) };
      }
      console.log("filters", oTypeQuery, nftIDQuery);
      let data = await Bid.aggregate([
        {
          $match: {
            $and: [
              { bidQuantity: { $gte: 1 } },
              { isOffer: true },

              oTypeQuery,
              nftIDQuery,
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
            bidPrice: 1,
            nftID: 1,
            bidQuantity: 1,
            buyerSignature: 1,
            bidDeadline: 1,
            isOffer: 1,
            tokenAddress: 1,
            paymentToken: 1,
            salt: 1,
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

      console.log("Data" + data[0].bids.length);
      let iFiltered = data[0].bids.length;
      if (data[0].totalCount[0] == undefined) {
        return res.reply(messages.no_prefix("Offer Details"), {
          data: [],
          draw: req.body.draw,
          recordsTotal: 0,
          recordsFiltered: 0,
        });
      } else {
        return res.reply(messages.no_prefix("Offer Details"), {
          data: data[0].bids,
          draw: req.body.draw,
          recordsTotal: data[0].totalCount[0].count,
          recordsFiltered: iFiltered,
        });
      }
    } catch (error) {
      console.log("error is", error);
      return res.reply(messages.server_error());
    }
  }

  async acceptBidNft(req, res) {
    console.log("req", req.body);
    try {
      if (!req.userId) return res.reply(messages.unauthorized());
      if (!req.body.bidID)
        return res.reply(messages.bad_request(), "Bid is required.");

      console.log("Checking Old Bids");
      let ERC721 = req.body.erc721;
      let bidID = req.body.bidID;
      let status = req.body.status;
      let qty_sold = req.body.qty_sold;
      let BidData = await Bid.findById(bidID);
      if (BidData) {
        let isblocked = await validators.isBlockedNFT(req.body.nftID);
        if (isblocked === -1) {
          return res.reply(messages.server_error("Query "));
        } else if (isblocked === 0) {
          return res.reply(messages.blocked("NFT"));
        } else if (isblocked === -2) {
          return res.reply(messages.not_found("NFT/Collection"));
        } else if (isblocked === 1) {
          let nftID = BidData.nftID;
          let orderId = BidData.orderID;
          let boughtQty = parseInt(BidData.bidQuantity);
          let bidderID = BidData.bidderID;
          let BuyerData = await User.findById(bidderID);
          let buyer = BuyerData.walletAddress;
          let owner = BidData.owner;
          console.log("owner", owner);
          let OwnerData = await User.findById(owner);
          let seller = OwnerData.walletAddress;

          console.log("seller", seller, nftID);
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

          let _NFT = await NFT.find({
            _id: mongoose.Types.ObjectId(nftID),
            "ownedBy.address": seller,
          }).select("ownedBy -_id");
          console.log("_NFT-------->", _NFT);
          let currentQty;
          if (_NFT.length > 0)
            currentQty = _NFT[0].ownedBy.find(
              (o) => o.address === seller.toLowerCase()
            ).quantity;

          let leftQty = currentQty - boughtQty;
          if (leftQty < 1) {
            await NFT.findOneAndUpdate(
              { _id: mongoose.Types.ObjectId(nftID) },
              {
                $pull: {
                  ownedBy: { address: seller },
                },
              }
            ).catch((e) => {
              console.log("Error1", e.message);
            });
          } else {
            await NFT.findOneAndUpdate(
              {
                _id: mongoose.Types.ObjectId(nftID),
                "ownedBy.address": seller,
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
            _id: mongoose.Types.ObjectId(nftID),
            "ownedBy.address": buyer,
          });
          if (subDocId) {
            console.log("Subdocument Id", subDocId);
            let NFTNewData = await NFT.findOne({
              _id: mongoose.Types.ObjectId(nftID),
              "ownedBy.address": buyer,
            }).select("ownedBy -_id");
            console.log("NFTNewData-------->", NFTNewData);
            console.log(
              "Quantity found for buyers",
              NFTNewData.ownedBy.find((o) => o.address === buyer.toLowerCase())
                .quantity
            );

            currentQty = NFTNewData.ownedBy.find(
              (o) => o.address === buyer.toLowerCase()
            ).quantity
              ? parseInt(
                  NFTNewData.ownedBy.find(
                    (o) => o.address === buyer.toLowerCase()
                  ).quantity
                )
              : 0;

            let ownedQty = currentQty + boughtQty;
            await NFT.findOneAndUpdate(
              {
                _id: mongoose.Types.ObjectId(nftID),
                "ownedBy.address": buyer,
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
              address: buyer,
              quantity: parseInt(boughtQty),
            };
            await NFT.findOneAndUpdate(
              { _id: mongoose.Types.ObjectId(nftID) },
              { $addToSet: { ownedBy: dataToadd } },
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
            let leftQty = _order.quantity - qty_sold;
            if (leftQty <= 0) {
              await Order.deleteOne({ _id: mongoose.Types.ObjectId(orderId) });
            }
            console.log("left qty 1155", leftQty);
            await Bid.deleteMany({
              owner: mongoose.Types.ObjectId(owner),
              nftID: mongoose.Types.ObjectId(nftID),
              bidStatus: "Bid",
              bidQuantity: { $gt: leftQty },
            })
              .then(function () {
                console.log("Data deleted from 1155");
              })
              .catch(function (error) {
                console.log(error);
              });
          }
          return res.reply(messages.updated("order"));
        }
      } else {
        console.log("Bid Not found");
        return res.reply("Bid Not found");
      }
    } catch (e) {
      console.log("errr", e);
      return res.reply(messages.error());
    }
  }
}
module.exports = BidController;
