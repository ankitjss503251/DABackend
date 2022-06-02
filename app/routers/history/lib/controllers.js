/* eslint-disable no-undef */
const fs = require("fs");
const ipfsAPI = require("ipfs-api");
const ipfs = ipfsAPI("ipfs.infura.io", "5001", {
  protocol: "https",
  auth: "21w11zfV67PHKlkAEYAZWoj2tsg:f2b73c626c9f1df9f698828420fa8439",
});
const { History } = require("../../../models");
const mongoose = require("mongoose");
const validators = require("./validators");
var jwt = require("jsonwebtoken");
const e = require("express");
const controllers = {};


controllers.insertHistory = async (req, res) => {
  console.log("req", req.body);
  try {
    let nftID = req.body.nftID;
    let userId = req.body.userId;
    let action = req.body.action;
    let type = req.body.type;
    let message = req.body.message;
    let createdBy = req.body.createdBy;
    const insertData = new History({
      nftID: nftID,
      userId: userId,
      action: action,
      type: type,
      message: message,
      createdBy: createdBy
    });
    console.log("Insert Data is " +insertData);
    insertData.save().then(async (result) => {
      return res.reply(messages.created("Record Inserted"), result);
    }).catch((error) => {
      console.log("Error in creating Record", error);
      return res.reply(messages.error());
    });
  } catch (e) {
    console.log("errr", e);
    return res.reply(messages.error());
  }
};
controllers.fetchHistory = async (req, res) => {
  console.log("req", req.body);
  try {
    let data = [];
    let nftID = req.body.nftID;
    let userId = req.body.userId;
    let action = req.body.action;
    let type = req.body.type;

    const page = parseInt(req.body.page);
    const limit = parseInt(req.body.limit);

    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;

    let onftIDQuery = {};
    let ouserIDQuery = {};
    let oactionQuery = {};
    let otypeQuery = {};
    let SearchArray = [];
    let filters = [];
    if (nftID != "All") {
      onftIDQuery = { nftID: mongoose.Types.ObjectId(nftID) };
      SearchArray["nftID"] = mongoose.Types.ObjectId(nftID);
    }
    if (userId != "All") {
      ouserIDQuery = { userId: mongoose.Types.ObjectId(userId) };
      SearchArray["userId"] = mongoose.Types.ObjectId(userId);
    }
    if (action != "All") {
      oactionQuery = { action: action };
      SearchArray["action"] = action;
    }
    if (type != "All") {
      otypeQuery = { type: type };
      SearchArray["type"] = type;
    }
    let SearchObj = Object.assign({}, SearchArray);
    console.log(SearchObj);
    console.log(filters);
    const results = {};

    if ( endIndex < (await History.countDocuments(SearchObj).exec())) {
      results.next = {
        page: page + 1,
        limit: limit,
      };
    }
    
    if (startIndex > 0) {
      results.previous = {
        page: page - 1,
        limit: limit,
      };
    }
    await History.find( SearchObj )
      .sort({ sCreated: -1 })
      .select({
        _id: 1,
        nftID: 1,
        userId: 1,
        action: 1,
        type: 1,
        message: 1,
        sCreated: 1
      }).limit(limit)
      .skip(startIndex)
      .lean()
      .exec()
      .then((res) => {
        data.push(res);
      })
      .catch((e) => {
        console.log("Error", e);
      });

    results.count = await History.countDocuments(SearchObj).exec();
    results.results = data;
    res.header('Access-Control-Max-Age', 600);
    return res.reply(messages.success("History Details"), results);
  } catch (error) {
    console.log(error);
    return res.reply(messages.server_error());
  }
};



module.exports = controllers;
