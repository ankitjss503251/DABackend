const mongoose = require("mongoose");

const nftSchema = mongoose.Schema({
  name: {
    type: String,
    require: true,
    unique: true,
  },
  type: {
    type: Number,
    default: 1,
    require: true,
    enum: [1, 2],
  },
  image: { type: String, require: true },
  fileType: { type: String },
  price: { type: mongoose.Types.Decimal128, require: true },
  description: { type: String },
  collectionID: {
    type: mongoose.Schema.ObjectId,
    ref: "Collection",
  },
  collectionAddress: {
    type: String,
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
      trait_type: {
        type: String,
      },
      value: {
        type: String,
      },
      max_value: {
        type: String,
        default: "",
      },
      isImage: {
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
    // require: true,
    // unique: true,
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
  isImported: {
    type: Number,
    default: 0,
    enum: [0, 1], // 0-No 1-Yes
  },
  // brandID: {
  //   type: mongoose.Schema.ObjectId,
  //   ref: "Brand",
  // },
  // categoryID: {
  //   type: mongoose.Schema.ObjectId,
  //   ref: "Category",
  // },
  status: {
    //0 - Inactive & 1 - Active
    type: Number,
    enum: [0, 1],
    default: 1,
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
module.exports = mongoose.model("NFT", nftSchema);
