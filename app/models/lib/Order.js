const mongoose = require("mongoose");

const orderSchema = mongoose.Schema({
  nftID: {
    type: mongoose.Schema.ObjectId,
    ref: "NFT",
  },
  collectionAddress: {
    type: String,
    require: true,
  },
  sellerID: {
    type: mongoose.Schema.ObjectId,
    ref: "User",
  },
  salesType: {
    type: Number,
    enum: [0, 1], // 0-Fixed Sale 1-Timed Auction
  },
  total_quantity: {
    type: Number,
  },
  quantity_sold: {
    type: Number,
    default: 0,
  },
  price: {
    type: mongoose.Types.Decimal128,
  },
  tokenID: {
    type: String,
  },
  hash: {
    type: String,
    require: true
  },
  deadlineDate: {
    type: Date,
  },
  paymentToken: {
    type: String,
  },
  salt: {
    type: String,
  },
  signature: Array,
  deadline: {
    type: Number,
  },
  bundleTokens: Array,
  bundleTokensQuantities: Array,
  status: {
    type: Number,
    default: 0,
    enum: [0, 1],
  },
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
module.exports = mongoose.model("Order", orderSchema);
