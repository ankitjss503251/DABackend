const { User } = require("../../../models");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const saltRounds = 10;
const crypto = require("crypto");
const { nodemailer, sendgrid } = require("../../../utils");
const validators = require("./validators");
const pinataSDK = require("@pinata/sdk");
const aws = require("aws-sdk");
const multer = require("multer");
const multerS3 = require("multer-s3");
const pinata = pinataSDK(
  process.env.PINATAAPIKEY,
  process.env.PINATASECRETAPIKEY
);
const controllers = {};

let signJWT = function (user) {
  return jwt.sign(
    {
      id: user._id,
      role: user.role,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "1d",
    }
  );
};

// Set S3 endpoint to DigitalOcean Spaces
const spacesEndpoint = new aws.Endpoint(process.env.BUCKET_ENDPOINT);
const s3 = new aws.S3({
  endpoint: spacesEndpoint,
  accessKeyId: process.env.BUCKET_ACCESS_KEY_ID,
  secretAccessKey: process.env.BUCKET_SECRET_ACCESS_KEY,
});

const storage = multerS3({
  s3: s3,
  bucket: process.env.BUCKET_NAME,
  acl: "public-read",
  contentType: multerS3.AUTO_CONTENT_TYPE,
  key: function (request, file, cb) {
    cb(null, file.originalname);
  },
});

var allowedMimes;
var errAllowed;

let fileFilter = function (req, file, cb) {
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      {
        success: false,
        message: `Invalid file type! Only ${errAllowed}  files are allowed.`,
      },
      false
    );
  }
};

let oMulterObj = {
  storage: storage,
  limits: {
    fileSize: 15 * 1024 * 1024, // 15mb
  },
  fileFilter: fileFilter,
};
const uploadBanner = multer(oMulterObj);

controllers.register = (req, res) => {
  try {
    if (!req.body.walletAddress)
      return res.reply(messages.required_field("Wallet Address"));

    bcrypt.hash(req.body.walletAddress?.toLowerCase(), saltRounds, (err, hash) => {
      if (err) return res.reply(messages.error());
      if (!req.body.walletAddress?.toLowerCase())
        return res.reply(messages.required_field("Wallet Address"));

      const user = new User({

        walletAddress: _.toChecksumAddress(req.body.walletAddress?.toLowerCase())

      });
      console.log("Wallet " + req.body.walletAddress?.toLowerCase())
      user
        .save()
        .then((result) => {
          let token = signJWT(user);
          req.session["_id"] = user._id;
          req.session["walletAddress"] = user.walletAddress?.toLowerCase();
          return res.reply(messages.created("User"), {
            auth: true,
            token,
            walletAddress: user.walletAddress?.toLowerCase(),
          });
        })
        .catch((error) => {
          return res.reply(messages.already_exists("User"));
        });
    });
  } catch (error) {
    return res.reply(messages.server_error());
  }
};

controllers.login = (req, res) => {
  try {
    if (!req.body.walletAddress)
      return res.reply(messages.required_field("Wallet Address"));

    User.findOne(
      {
        walletAddress: _.toChecksumAddress(req.body.walletAddress),
      },
      (err, user) => {
        if (err) return res.reply(messages.error());
        if (!user) return res.reply(messages.not_found("User"));

        if (user && user.role != "superadmin") {
          var token = signJWT(user);

          req.session["_id"] = user._id;
          req.session["walletAddress"] = user.walletAddress;
          req.session["username"] = user.username;
          return res.reply(messages.successfully("User Login"), {
            auth: true,
            token,
            walletAddress: user.walletAddress,
            userId: user._id,
            userType: user.role,
            userData: user,
          });
        } else {
          return res.reply(messages.invalid("Login"));
        }
      }
    );
  } catch (error) {
    return res.reply(messages.server_error());
  }
};

controllers.logout = (req, res, next) => {
  try {
    if (!req.userId) return res.reply(messages.unauthorized());
    User.findOne(
      {
        _id: req.userId,
      },
      (err, user) => {
        req.session.destroy();
        if (err) return res.reply(messages.server_error());
        if (!user) return res.reply(messages.not_found("User"));
        return res.reply(messages.successfully("Logout"), {
          auth: false,
          token: null,
        });
      }
    );
  } catch (error) {
    return res.reply(messages.server_error());
  }
};

controllers.adminregister = async (req, res) => {
  try {
    if (!req.body.walletAddress)
      return res.reply(messages.required_field("Wallet Address"));
    bcrypt.hash(req.body.walletAddress, saltRounds, (err, hash) => {
      if (err) return res.reply(messages.error());
      if (!req.body.walletAddress)
        return res.reply(messages.required_field("Wallet Address"));

      const user = new User({
        walletAddress: _.toChecksumAddress(req.body.walletAddress),
        role: req.body.role
      });
      console.log("Wallet " + req.body.walletAddress)
      user
        .save()
        .then((result) => {
          let token = signJWT(user);
          req.session["_id"] = user._id;
          req.session["walletAddress"] = user.walletAddress;
          return res.reply(messages.created("User"), {
            auth: true,
            token,
            walletAddress: user.walletAddress,
          });
        })
        .catch((error) => {
          return res.reply(messages.already_exists("User"));
        });
    });
  } catch (error) {
    return res.reply(messages.server_error());
  }
};

/*
controllers.adminregister = async (req, res) => {
  try {
    if (!req.userId) return res.reply(messages.unauthorized());
    allowedMimes = ["image/jpeg", "image/jpg", "image/png", "image/gif"];
    errAllowed = "JPG, JPEG, PNG,GIF";

    uploadBanner.fields([{ name: 'profileIcon', maxCount: 1 }])(req, res, async function (error) {
      if (error) {
        return res.reply(messages.bad_request(error.message));
      } else {
        log.green(req.files.profileIcon[0].location);
        if (!req.body.fullname) {
          return res.reply(messages.not_found("User Fullname"));
        }
        if (!req.body.walletAddress) {
          return res.reply(messages.not_found("User Wallet Address"));
        }
        if (!req.body.email) {
          return res.reply(messages.not_found("User Email"));
        }
        if (!req.body.username) {
          return res.reply(messages.not_found("User username"));
        }
        if (!req.body.role) {
          return res.reply(messages.not_found("User Role"));
        }
        let searchArray = [];
        searchArray["or"] = [
          { 'fullname': { $regex: new RegExp(req.body.fullname), $options: "i" } },
          { 'walletAddress': { $regex: new RegExp(req.body.walletAddress), $options: "i" } },
          { 'email': { $regex: new RegExp(req.body.email), $options: "i" } },
          { 'username': { $regex: new RegExp(req.body.username), $options: "i" } }
        ];
        let searchObj = Object.assign({}, searchArray);
        const checkUser = await User.countDocuments(searchObj).exec();

        const salt = await bcrypt.genSalt(10);
        let encryptPassword = await bcrypt.hash(req.body.password, salt);
        if(checkUser == 0){
          const user = new User({
            walletAddress: _.toChecksumAddress(req.body.walletAddress),
            username : req.body.username,
            fullname : req.body.fullname,
            email : req.body.email,
            password : encryptPassword,
            profileIcon : req.body.profileIcon,
            bio : req.body.bio,
            phoneNo : req.body.phoneNo,
            role : req.body.role,
          });
          user.save().then((result) => {
            let token = signJWT(user);
            req.session["_id"] = user._id;
            req.session["walletAddress"] = user.walletAddress;
            return res.reply(messages.created("User"), {
              auth: true,
              token,
              walletAddress: user.walletAddress,
            });
          }).catch((error) => {
            return res.reply(messages.already_exists("User"), error);
          });
        }else{
          return res.reply(messages.already_exists("User"), error);
        }
      }
    });

  } catch (error) {
    return res.reply(messages.server_error());
  }
};
*/


controllers.adminlogin = async (req, res, next) => {
  try {
    if (!req.body.username) return res.reply(messages.required_field("Username"));
    if (!req.body.password) return res.reply(messages.required_field("Password"));
    
    User.findOne({ password: req.body.password, username : req.body.username }, (err, user) => {
      if (err) console.log(err); 
      if (!user) return res.reply(messages.not_found("User"));
      var token = signJWT(user);
      req.session["_id"] = user._id;
      req.session["username"] = user.username;
      return res.reply(messages.successfully("User Login"), {
        auth: true,
        token,
        walletAddress: user.walletAddress,
        userId: user._id,
        userType: user.role,
        userData: user,
      });
    });
  } catch (error) {
    console.log(error); 
    return res.reply(messages.server_error());
  }
};

controllers.changePassword = async (req, res, next) => {
  try {
    if (!req.userId) return res.reply(messages.unauthorized());
    if (!req.body.password) return res.reply(messages.required_field("Password"));

    const loggedInUser = req.userId;
    const salt = await bcrypt.genSalt(10);
    let encryptPassword = await bcrypt.hash(req.body.password, salt);

    User.findOne({ _id: mongoose.Types.ObjectId(loggedInUser) },
      (err, user) => {
        if (err) return res.reply(messages.error());
        if (!user) return res.reply(messages.not_found("User"));
        if (user.role !== "user") {
          User.findOneAndUpdate({ _id: mongoose.Types.ObjectId(loggedInUser) },
            {
              $set: {
                password: encryptPassword,
              },
            },
            {
              upsert: true,
            }
          ).then((doc) => { return res.reply(messages.updated("Password")); })
            .catch((err) => { return res.reply(messages.server_error()); });
        } else{
          return res.reply(messages.unauthorized());
        }

      });
  } catch (error) {
    return res.reply(messages.server_error());
  }
};

controllers.checkuseraddress = (req, res) => {
  try {
    if (!req.body.walletAddress)
      return res.reply(messages.required_field("Wallet Address"));
    if (!validators.isValidWalletAddress(req.body.walletAddress))
      return res.reply(messages.invalid("Wallet Address"));

    User.findOne(
      {
        walletAddress: _.toChecksumAddress(req.body.walletAddress),
      },
      (err, user) => {
        if (err) return res.reply(messages.error());
        if (!user)
          return res.reply(messages.not_found("User"), {
            user: true,
          });
        return res.reply(messages.successfully("User Found"), {
          user: true,
          status: user.status,
        });
      }
    );
  } catch (error) {
    return res.reply(error);
  }
};
/*
controllers.adminlogin = (req, res) => {
  try {
    log.green(req.body);
    log.green(req.body.email);
    if (!req.body.email) return res.reply(messages.required_field("Email ID"));
    if (_.iemail(req.body.email))
      return res.reply(messages.invalid("Email ID"));

    User.findOne(
      {
        email: req.body.email,
      },
      (err, user) => {
        log.error(err);
        if (err) return res.reply(messages.error());
        if (!user) return res.reply(messages.not_found("User"));

        bcrypt.compare(req.body.password, user.hash, (err, result) => {
          if (result && user.role == "admin") {
            req.session["admin_id"] = user.id;
            req.session["admin_fullname"] = user.fullname;
            var token = signJWT(user);
            return res.reply(messages.successfully("Admin Login"), {
              auth: true,
              token,
              walletAddress: user.walletAddress,
              user: false,
            });
          } else {
            return res.reply(messages.invalid("Password"));
          }
        });
      }
    );
  } catch (error) {
    return res.reply(messages.server_error());
  }
};*/

controllers.passwordReset = (req, res, next) => {
  try {
    log.red(req.body);
    if (!req.body.email) return res.reply(messages.required_field("Email ID"));
    if (_.iemail(req.body.email))
      return res.reply(messages.invalid("Email ID"));

    var randomHash = "";
    crypto.randomBytes(20, function (err, buf) {
      randomHash = buf.toString("hex");
    });

    User.findOne(
      {
        email: req.body.email,
      },
      (err, user) => {
        if (err) return res.reply(messages.error());
        if (!user) return res.reply(messages.not_found("User"));

        User.findOneAndUpdate(
          {
            email: user.email,
          },
          {
            $set: {
              resetPasswordToken: randomHash,
              resetPasswordExpires: Date.now() + 600,
            },
          },
          {
            upsert: true,
          }
        )
          .then((doc) => { })
          .catch((err) => { });
        nodemailer.send(
          "forgot_password_mail.html",
          {
            SITE_NAME: "DecryptMarketplace",
            USERNAME: user.username,
            ACTIVELINK: `${process.env.BASE_URL}:${process.env.PORT}/api/v1/auth/reset/${randomHash}`,
          },
          {
            from: process.env.SMTP_USERNAME,
            to: user.email,
            subject: "Forgot Password",
          }
        );
        return res.reply(messages.successfully("Email Sent"));
      }
    );
  } catch (error) {
    return res.reply(messages.server_error());
  }
};

controllers.passwordResetGet = (req, res, next) => {
  try {
    if (!req.params.token) return res.reply(messages.not_found("Token"));

    User.findOne(
      {
        resetPasswordToken: req.params.token,
      },
      function (err, user) {
        if (!user) {
          return res.render("error/token_expire");
        }
        return res.render("Admin/resetPassword");
      }
    );
  } catch (error) {
    return res.reply(messages.server_error());
  }
};

controllers.passwordResetPost = (req, res, next) => {
  try {
    if (!req.params.token) return res.reply(messages.not_found("Token"));
    if (!req.body.password) return res.reply(messages.not_found("Password"));
    if (!req.body.confirmPassword)
      return res.reply(messages.not_found("Confirm Password"));

    if (_.ipassword(req.body.password))
      return res.reply(messages.invalid("Password"));
    if (_.ipassword(req.body.confirmPassword))
      return res.reply(messages.invalid("Password"));

    User.findOne(
      {
        resetPasswordToken: req.params.token,
      },
      function (err, user) {
        if (!user) return res.render("error/token_expire");
        if (req.body.confirmPassword !== req.body.password)
          return res.reply(messages.bad_request("Password not matched"));

        bcrypt.hash(req.body.confirmPassword, saltRounds, (err, hash) => {
          if (err) return res.reply(messages.error());

          user.hash = hash;
          user.resetPasswordToken = undefined;
          user.resetPasswordExpires = undefined;

          user.save((err) => {
            if (err) return res.reply(messages.error());
            return res.reply(messages.updated("Password"));
          });
        });
      }
    );
  } catch (error) {
    return res.reply(messages.server_error());
  }
};

module.exports = controllers;