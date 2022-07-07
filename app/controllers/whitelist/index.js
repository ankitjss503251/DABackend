const router = require('express').Router();
const WhitelistController = require('./controllers');
const whitelistController = new WhitelistController();

router.post('/fetchWhitelistedAddress', whitelistController.fetchWhitelistedAddress);
router.post('/insertAddress', whitelistController.insertAddress);

module.exports = router;