const mongoose = require("mongoose");

const importedcollectionSchema = mongoose.Schema({
  name: {
    type: String,
  },
  type: {
    type: Number,
    enum: [1, 2],
    default: 1,
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

  royalityPercentage: { type: Number, default: 0 },

  totalSupply: {
    type: Number,
    default: 0,
  },

  link: {
    type: String,
  },
});
module.exports = mongoose.model("importedCollection", importedcollectionSchema);
