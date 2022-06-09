
  
const router = require('express').Router();
const OrderController = require('./controllers');
const orderController = new OrderController();
const orderMiddleware = require('./../helpers/middleware');

router.post('/createOrder', orderMiddleware.verifyUserToken, orderController.createOrder);
router.put('/updateOrder', orderMiddleware.verifyUserToken, orderController.updateOrder);
router.delete('/deleteOrder', orderMiddleware.verifyUserToken, orderController.deleteOrder);
router.post('/getOrder', orderController.getOrder);
router.post('/getOrdersByNftId', orderController.getOrdersByNftId);

router.post('/createOrderImport', orderMiddleware.verifyUserToken, orderController.createOrderImport);

module.exports = router;