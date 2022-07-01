const router = require("express").Router();
const UserController = require("./controllers");
const userController = new UserController();
const userMiddleware = require("../helpers/middleware");

router.post("/allDetails", userMiddleware.verifyWithoutToken, userController.getAllUserDetails);
router.post("/getUsers", userMiddleware.verifyUserToken, userController.getUsers);
router.post("/getAllUsers",  userController.getAllUsers);
router.post("/getIndividualUser/:userID", userController.getIndividualUser);
router.post("/blockUser", userMiddleware.verifyUserToken, userController.blockUser);
router.get("/profile", userMiddleware.verifyUserToken, userController.profile);
router.post("/profileDetail", userController.getUserProfilewithNfts);
router.post( "/profileWithNfts", userMiddleware.verifyWithoutToken, userController.getUserWithNfts);
router.put("/updateProfile", userMiddleware.verifyUserToken, userController.updateProfile);
router.get("/getUserDetails/:user", userController.getUserDetails );


module.exports = router;