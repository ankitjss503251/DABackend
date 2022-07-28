var jwt = require("jsonwebtoken");
const { User } = require("../../models");
const mongoose = require("mongoose");
const middleware = {};

middleware.verifyToken = (req, res, next) => {
  try {
    var token = req.headers.authorization;
    if (!token) {
      return res.reply(messages.unauthorized());
    }
    token = token.replace("Bearer ", "");
    jwt.verify(token, process.env.JWT_SECRET, function (err, decoded) {
      if (err !== null) {
        return res.reply(messages.unauthorized());
      }
      req.userId = decoded.id ? decoded.id : "";
      req.role = decoded.role ? decoded.role : "";
      req.name = decoded.name ? decoded.name : "";
      req.email = decoded.email ? decoded.email : "";
      next();
    });
  } catch (error) {
    return res.reply(messages.server_error());
  }
};

middleware.verifyUserToken = (req, res, next) => {
  try {
    var token = req.headers.authorization;
    if (!token) {
      return res.reply(messages.unauthorized());
    }
    token = token.replace("Bearer ", "");
    jwt.verify(token, process.env.JWT_SECRET, function (err, decoded) {
      if (err !== null) {
        return res.reply(messages.unauthorized());
      }
      if (decoded.role === "user" || decoded.role === "admin") {
        console.log("User ID", decoded.id)
        User.findOne({ _id: mongoose.Types.ObjectId(decoded.id) }, function (err, userData) {
          if (err) {
            return res.reply(messages.unauthorized());
          } else {
            if (!userData) return res.reply(messages.not_found("User Account"));
            if (userData.status == 0) {
              return res.reply(messages.blocked("User"));
            } else {
              req.userId = decoded.id ? decoded.id : '';
              req.role = decoded.role ? decoded.role : '';
              req.name = decoded.name ? decoded.name : '';
              req.email = decoded.email ? decoded.email : '';
              next();
            }
          }
        });
      } else {
        return res.reply(messages.unauthorized());
      }
    });
  } catch (error) {
    return res.reply(messages.server_error());
  }
};
middleware.verifyAdminToken = (req, res, next) => {
  try {
    var token = req.headers.authorization;
    if (!token) {
      return res.reply(messages.unauthorized());
    }
    token = token.replace("Bearer ", "");
    jwt.verify(token, process.env.JWT_SECRET, function (err, decoded) {
      if (err) return res.reply(messages.unauthorized());
      console.log("Role ", decoded.role);
      if (decoded.role === "admin" || decoded.role === "superadmin") {
        User.findOne({ _id: mongoose.Types.ObjectId(decoded.id) }, function (err, userData) {
          if (err) {
            return res.reply(messages.unauthorized());
          } else {
            if (!userData) return res.reply(messages.not_found("User Account"));
            if (userData.status == 0) {
              return res.reply(messages.blocked("User"));
            } else {
              req.userId = decoded.id ? decoded.id : '';
              req.role = decoded.role ? decoded.role : '';
              req.name = decoded.name ? decoded.name : '';
              req.email = decoded.email ? decoded.email : '';
              next();
            }
          }
        });
      } else return res.reply(messages.unauthorized());
    });
  } catch (error) {
    return res.reply(messages.server_error());
  }
};

middleware.verifySuperAdminToken = (req, res, next) => {
  try {
    var token = req.headers.authorization;
    if (!token) {
      return res.reply(messages.unauthorized());
    }
    token = token.replace("Bearer ", "");
    jwt.verify(token, process.env.JWT_SECRET, function (err, decoded) {
      if (err) return res.reply(messages.unauthorized());
      console.log(decoded.role)
      if (decoded.role === "superadmin") {
        User.findOne({ _id: mongoose.Types.ObjectId(decoded.id) }, function (err, userData) {
          if (err) {
            return res.reply(messages.unauthorized());
          } else {
            if (!userData) return res.reply(messages.not_found("User Account"));
            if (userData.status == 0) {
              return res.reply(messages.blocked("User"));
            } else {
              req.userId = decoded.id ? decoded.id : '';
              req.role = decoded.role ? decoded.role : '';
              req.name = decoded.name ? decoded.name : '';
              req.email = decoded.email ? decoded.email : '';
              next();
            }
          }
        });
      } else return res.reply(messages.unauthorized());
    });
  } catch (error) {
    return res.reply(messages.server_error());
  }
};
middleware.verifyWithoutToken = (req, res, next) => {
  try {
    var token = req.headers.authorization;
    if (token && token != undefined && token != "") {
      token = token.replace("Bearer ", "");
      jwt.verify(token, process.env.JWT_SECRET, function (err, decoded) {
        if (err) {
          return res.reply(messages.unauthorized());
        }
        req.userId = decoded.id ? decoded.id : "";
        req.role = decoded.role ? decoded.role : "";
        req.name = decoded.name ? decoded.name : "";
        req.email = decoded.email ? decoded.email : "";
        next();
      });
    } else {
      next();
    }
  } catch (error) {
    return res.reply(messages.server_error());
  }
};
middleware.proceedWithoutToken = (req, res, next) => {
  next();
};
middleware.checkAuth = (req, res, next) => {
  if (req.session["admin_id"] != null && req.session["admin_id"] != undefined) {
    res.redirect("/a/dashboard");
  } else {
    if (req.session["_id"] != null && req.session["_id"] != undefined)
      res.redirect("/");
    else return next();
  }
};
middleware.checkAuthAdmin = async (req, res, next) => {
  if (req.session["admin_id"] == null && req.session["admin_id"] == undefined) {
    if (req.session["_id"] != null && req.session["_id"] != undefined)
      res.redirect("/");
    else res.redirect(`/a/signin`);
  } else {
    let user = await User.findOne({ _id: req.session["admin_id"] });

    req.session["admin_id"] = user._id;

    return next();
  }
};

module.exports = middleware;
