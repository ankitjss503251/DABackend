const mongoose = require("mongoose");
const NFTMetaQueueSchema = new mongoose.Schema({
  nftID: {
    type: mongoose.Schema.ObjectId,
    ref: "NFT",
  }
});
module.exports = mongoose.model("NFTMetaQueue", NFTMetaQueueSchema);