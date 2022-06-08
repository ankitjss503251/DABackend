const mongoose = require("mongoose");

const importedcollectionSchema = mongoose.Schema({
    contractAddress: {
        type: String,
        unique: true,
        require: true,
        lowercase: true,
    },
    totalSupply: {
        type: Number,
        default: 0
    }
});
module.exports = mongoose.model("importedCollection", importedcollectionSchema);
