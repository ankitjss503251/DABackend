const mongoose = require("mongoose");
const mintCollectionSchema = mongoose.Schema({
  type: {
    type: String,
  },
  address: {
    type: String,
    require: true,
  },
});
module.exports = mongoose.model("MintCollection", mintCollectionSchema);
