require('./env');
require('./globals');
require('./transactionTracker');

const { mongodb } = require('./app/utils');
const router = require('./app/controllers');

mongodb.initialize();
router.initialize();

module.exports = router;