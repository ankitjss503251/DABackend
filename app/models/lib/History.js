const mongoose = require("mongoose");

const historySchema = new mongoose.Schema({
  nftID: {
    type: mongoose.Schema.ObjectId,
    ref: "NFT",
  },
  collectionID: {
    type: mongoose.Schema.ObjectId,
    ref: "Collection",
  },
  brandID: {
    type: mongoose.Schema.ObjectId,
    ref: "Brand",
  },
  bidID: {
    type: mongoose.Schema.ObjectId,
    ref: "Bid",
  },
  buyerID: {
    type: mongoose.Schema.ObjectId,
    ref: "User",
  },
  sellerID: {
    type: mongoose.Schema.ObjectId,
    ref: "User",
  },
  action : { 
    type: String,
    enum: ["Put on Sale","Remove from Sale"],
  },
  type : { 
    type: String,
    enum: ["Bid", "Cancelled", "Accepted", "Sold", "Rejected", "MakeOffer", "AcceptOffer", "RejectOffer", "CancelledOffer"],
  },
  quantity: Number,
  message: {
    type: String,
  },
  price: {
    type: mongoose.Types.Decimal128,
    required: true,
  },
  transactionHash: {
    type: String,
  },
  createdBy: {
    type: mongoose.Schema.ObjectId,
    ref: "User",
  },
  createdOn: {
    type: Date,
    default: Date.now,
  },
  lastUpdatedBy: {
    type: mongoose.Schema.ObjectId,
    ref: "User",
  },
  lastUpdatedOn: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("History", historySchema);
