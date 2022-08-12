const mongoose = require("mongoose");

const WhitelistSchema = mongoose.Schema({
    uAddress: {
        type: String,
        required: true,
    },
    cAddress: {
        type: String,
        required: true
    }
})

module.exports = mongoose.model('whitelist', WhitelistSchema)