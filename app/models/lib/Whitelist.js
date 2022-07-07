const mongoose = require("mongoose");

const WhitelistSchema =mongoose.Schema({
    uAddress:{
        type: String,
        required:true
    },
    uSignature:{
       type: String,
       default:[]
    }
})

module.exports = mongoose.model('whitelist', WhitelistSchema)