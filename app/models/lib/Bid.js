const mongoose = require("mongoose");

const bidSchema = new mongoose.Schema({
  bidderID: {
    type: mongoose.Schema.ObjectId,
    ref: "User",
  },
  owner: {
    type: mongoose.Schema.ObjectId,
    ref: "User",
  },
  nftID: {
    type: mongoose.Schema.ObjectId,
    ref: "NFT",
  },
  orderID: {
    type: mongoose.Schema.ObjectId,
    ref: "Order",
  },
  bidStatus: {
    type: String,
    enum: [
      "Bid",
      "Cancelled",
      "Accepted",
      "Sold",
      "Rejected",
      "MakeOffer",
      "AcceptOffer",
      "RejectOffer",
      "CancelledOffer",
    ],
  },
  bidPrice: {
    type: mongoose.Types.Decimal128,
    required: true,
  },
  bidDeadline: {
    type: Number,
  },
  hash: {
    type: String,
    require: true
  },
  bidQuantity: Number,
  buyerSignature: Array,
  tokenAddress: String,
  isOffer: {
    type: Boolean,
    default: false,
  },
  salt: Number,
  paymentToken: String,
  hashStatus: {
    //0 - Inactive & 1 - Active & 2 - Failed/Cancel
    type: Number,
    enum: [0, 1, 2],
    default: 0,
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

module.exports = mongoose.model("Bid", bidSchema);
