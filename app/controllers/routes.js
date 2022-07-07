const router = require('express').Router();

const authRoute = require('./auth');
const userRoute = require('./user');
const adminRoute = require('./admin');
const nftRoute = require('./nft');
const bidRoute = require('./bid');
const orderRoute = require('./order');
const historyRoute = require('./history');
const utilsRoute=require('./utils');
const importRoute = require('./imports');
const whitelistRoute = require('./whitelist');

router.use('/auth', authRoute);
router.use('/user', userRoute);
router.use('/admin', adminRoute);
router.use('/nft', nftRoute);
router.use('/bid', bidRoute);
router.use('/order', orderRoute);
router.use('/history', historyRoute);
router.use('/utils',utilsRoute);
router.use('/import',importRoute);
router.use('/whitelist',whitelistRoute);

module.exports = router;
