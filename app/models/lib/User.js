const mongoose = require("mongoose");

const userSchema = mongoose.Schema({
  walletAddress: {
    type: String,
    unique: true,
    require: true,
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
    //0 - active & 1 - Inactive
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
module.exports = mongoose.model("User", userSchema);
