
  
const router = require('express').Router();
const OrderController = require('./controllers');
const orderController = new OrderController();
const orderMiddleware = require('./../helpers/middleware');

router.post('/getOrder', orderController.getOrder);
router.post('/getOrdersByNftId', orderController.getOrdersByNftId);

router.post('/createOrder', orderMiddleware.verifyUserToken, orderController.createOrder);
router.put('/updateOrder', orderMiddleware.verifyUserToken, orderController.updateOrder);
router.delete('/deleteOrder', orderMiddleware.verifyUserToken, orderController.deleteOrder);
module.exports = router;