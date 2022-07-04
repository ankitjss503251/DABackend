const mongoose = require("mongoose");
const bcrypt = require('bcrypt');
const SALT_PASSWORD = 10;

const userSchema = mongoose.Schema({
  walletAddress: {
    type: String,
    unique: true,
    require: true,
    lowercase:true
  },
  username: {
    type: String,
    default: "",
  },
  fullname: {
    type: String,
  },
  email: {
    type: String,
  },
  password:{
    type: String,
  },
  profileIcon: String,
  phoneNo: String,
  role: {
    type: String,
    enum: ["user","admin","creator", "superadmin"],
    default: "user",
  },
  status: {
    //0 - Inactive & 1 - Active
    type: Number,
    enum: [0, 1],
    default: 1,
  },
  bio: String,
  user_followings: [
    {
      type: mongoose.Schema.ObjectId,
      ref: "User",
    },
  ],
  user_followers_size: { type: Number, default: 0 },
  createdBy: {
    type: mongoose.Schema.ObjectId,
    ref: "User",
  },
  createdOn: {
    type: Date,
    default: Date.now,
  },
  lastUpdatedBy: {
    type: mongoose.Schema.ObjectId,
    ref: "User",
  },
  lastUpdatedOn: {
    type: Date,
    default: Date.now,
  },
});
userSchema.pre('save', function (next) {
  var user = this;
  if (!user.isModified('password')) return next();
  bcrypt.genSalt(SALT_PASSWORD, function (err, salt) {
    if (err) return next(err);
    bcrypt.hash(user.password, salt, function (err, hash) {
      if (err) return next(err);
      user.password = hash;
      next();
    });
  });
});
userSchema.methods.comparePassword = function (adminPassword, cb) {
  bcrypt.compare(adminPassword, this.password, function (err, isMatch) {
    if (err) return cb(err);
    cb(null, isMatch);
  });
};
module.exports = mongoose.model("User", userSchema);
