const mongoose = require("mongoose");

const importednftSchema = mongoose.Schema({
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
    description: { type: String },
    ownedBy: {
        type: String,
        lowercase: true,
    },
    collectionAddress: {
        type: String,
        lowercase: true,
    },
    tokenID: String,
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
                default:"",
            },
            isImage: {
                type: String,
            },
        },
    ],
    totalQuantity: {
        type: Number,
        default: 1
    }
});
module.exports = mongoose.model("importedNFT", importednftSchema);