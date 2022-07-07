const Bid = require('./lib/Bid');
const Brand = require('./lib/Brand');
const Category = require('./lib/Category');
const Collection = require('./lib/Collection');
const History = require('./lib/History');
const NFT = require('./lib/NFT');
const Order = require('./lib/Order');
const User = require('./lib/User');
const importedCollection = require('./lib/importedCollection');
const importedNFT = require('./lib/importedNFT');
const whitelist = require('./lib/Whitelist')
module.exports = {
    Bid,
    Brand,
    Category,
    Collection,
    History,
    NFT,
    Order,
    User,
    importedNFT,
    importedCollection,
    whitelist
};