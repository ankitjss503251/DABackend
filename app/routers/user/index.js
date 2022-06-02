const router = require("express").Router();
const userController = require("./lib/controllers");
const userMiddleware = require("./lib/middleware");

router.post( "/allDetails", userMiddleware.verifyWithoutToken, userController.getAllUserDetails);
router.post("/getUsers", userMiddleware.verifyToken, userController.getUsers);
router.post("/getAllUsers",  userController.getAllUsers);
router.post("/getIndividualUser/:userID", userController.getIndividualUser);
router.post("/blockUser", userMiddleware.verifyToken, userController.blockUser);
router.get("/profile", userMiddleware.verifyToken, userController.profile);
router.post("/profileDetail", userController.getUserProfilewithNfts);
router.post( "/profileWithNfts", userMiddleware.verifyWithoutToken, userController.getUserWithNfts);
router.put("/updateProfile", userMiddleware.verifyToken, userController.updateProfile);


module.exports = router;