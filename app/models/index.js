const Bid = require('./lib/Bid');
const Brand = require('./lib/Brand');
const Category = require('./lib/Category');
const Collection = require('./lib/Collection');
const History = require('./lib/History');
const NFT = require('./lib/NFT');
const Order = require('./lib/Order');
const User = require('./lib/User');
const whitelist = require('./lib/Whitelist')
const MintCollection = require('./lib/MintCollection');
// const NFTMetaQueue = require('./lib/NFTMetaQueue');
module.exports = {
    Bid,
    Brand,
    Category,
    Collection,
    History,
    NFT,
    Order,
    User,
    whitelist,
    // NFTMetaQueue,
    MintCollection
};