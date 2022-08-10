const mongoose = require("mongoose");

const collectionSchema = mongoose.Schema({
  name: {
    type: String,
    require: true,
    unique: true,
  },
  type: {
    type: Number,
    enum: [1, 2],
    default: 1,
  },
  hash: {
    type: String,
    require: true
  },
  symbol: {
    type: String,
  },
  logoImage: {
    type: String,
    require: true,
  },
  coverImage: {
    type: String,
    require: true,
  },
  description: {
    type: String,
    require: true,
  },
  categoryID: {
    type: mongoose.Schema.ObjectId,
    ref: "Category",
  },
  brandID: {
    type: mongoose.Schema.ObjectId,
    ref: "Brand",
  },
  contractAddress: {
    type: String,
    // unique: true,
    require: true,
    lowercase: true,
  },
  price: { type: mongoose.Types.Decimal128, default: 0 },
  royalityPercentage: { type: Number, default: 0 },
  salesCount: {
    type: Number,
    default: 0,
  },
  nftCount: {
    type: Number,
    default: 0,
  },
  volumeTraded: {
    type: Number,
    default: 0,
  },
  preSaleStartTime: {
    type: Date,
  },
  preSaleEndTime: {
    type: Date,
  },
  preSaleTokenAddress: {
    type: String,
  },
  totalSupply: {
    type: Number,
    default: 0,
  },
  nextID: {
    type: Number,
    require: true,
    default: 0,
  },
  isHotCollection: {
    type: Number,
    default: 0,
    enum: [0, 1],
  },
  isMinted: {
    type: Number,
    default: 0,
    enum: [0, 1],
  },
  isExclusive: {
    type: Number,
    default: 0,
    enum: [0, 1],
  },
  isOnMarketplace: {
    type: Number,
    default: 0,
    enum: [0, 1],
  },
  isImported: {
    type: Number,
    default: 0,
    enum: [0, 1], // 0-No 1-Yes
  },
  isDeployed: {
    type: Number,
    default: 0,
    enum: [0, 1], // 0-No 1-Yes
  },
  link: {
    type: String,
  },
  status: {
    //0 - Inactive & 1 - Active
    type: Number,
    enum: [0, 1],
    default: 1,
  },
  hashStatus: {
    //0 - Inactive & 1 - Active & 2 - Failed/Cancel
    type: Number,
    enum: [0, 1, 2],
    default: 0,
  },
  progressStatus: {
    //0 - Read & 1 - Process & 2 - Completed
    type: Number,
    enum: [0, 1, 2],
    default: 1,
  },
  apiStatus: {
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
collectionSchema.methods.getNextID = function () {
  let nextIDDD = this.nextID + 1;
  return nextIDDD;
};
module.exports = mongoose.model("Collection", collectionSchema);
