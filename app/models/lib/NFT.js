const mongoose = require("mongoose");

const nftSchema = mongoose.Schema({
  name: {
    type: String,
    require: true,
  },
  type: {
    type: Number,
    default: 1,
    require: true,
    enum: [1, 2],
  },
  image: { type: String, require: true },
  price: { type: mongoose.Types.Decimal128, require: true },
  description: { type: String },
  collectionID: {
    type: mongoose.Schema.ObjectId,
    ref: "Collection",
  },
  tokenID: String,
  assetsInfo: [
    {
      size: {
        type: String,
      },
      type: {
        type: String,
      },
      dimension: {
        type: String,
      },
    },
  ],
  attributes: [
    {
      name: {
        type: String,
      },
      value: {
        type: String,
      },
    },
  ],
  levels: [
    {
      name: {
        type: String,
      },
      value: {
        type: String,
      },
    },
  ],
  totalQuantity: Number,
  ownedBy: [
    {
      address: {
        type: String,
        lowercase: true,
      },
      quantity: {
        type: Number,
      },
    },
  ],
  hash: {
    type: String,
    require: true,
    unique: true,
  },
  isMinted: {
    type: Number,
    default: 0,
    enum: [0, 1],
  },
  categoryID: {
    type: mongoose.Schema.ObjectId,
    ref: "Category",
  },
  brandID: {
    type: mongoose.Schema.ObjectId,
    ref: "Brand",
  },
  lazyMintingStatus: {
    type: Number,
    default: 0,
    enum: [0, 1, 2],
  },
  quantity_minted: {
    type: Number,
    default: 0,
  },
  user_likes: [
    {
      type: mongoose.Schema.ObjectId,
    },
  ],
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
module.exports = mongoose.model("NFT", nftSchema);
