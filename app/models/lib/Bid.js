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
    enum: ["Bid", "Cancelled", "Accepted", "Sold", "Rejected", "MakeOffer", "AcceptOffer", "RejectOffer", "CancelledOffer"],
  },
  bidPrice: {
    type: mongoose.Types.Decimal128,
    required: true,
  },
  bidDeadline: {
    type: Date
  },
  bidQuantity: Number,
  buyerSignature: Array,
  isOffer: {
    type: Boolean,
    default: true,
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
