const router = require("express").Router();
const UserController = require("./controllers");
const userController = new UserController();
const userMiddleware = require("../helpers/middleware");

router.post(
  "/getUsers",
  userMiddleware.verifyAdminToken,
  userController.getUsers
);
router.post(
  "/blockUser",
  userMiddleware.verifyAdminToken,
  userController.blockUser
);
router.get("/profile", userMiddleware.verifyUserToken, userController.profile);
router.put(
  "/updateProfile",
  userMiddleware.verifyUserToken,
  userController.updateProfile
);

router.post(
  "/allDetails",
  userMiddleware.verifyWithoutToken,
  userController.getAllUserDetails
);
router.post(
  "/profileWithNfts",
  userMiddleware.verifyWithoutToken,
  userController.getUserWithNfts
);
router.get("/getUserDetails/:user", userController.getUserDetails);
router.post("/getAllUsers", userController.getAllUsers);
router.post("/getIndividualUser/:userID", userController.getIndividualUser);
router.post("/profileDetail", userController.getUserProfilewithNfts);
router.post("/checkIfBlocked", userController.checkIfBlocked);
module.exports = router;
