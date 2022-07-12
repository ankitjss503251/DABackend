/* eslint-disable no-undef */
const fs = require("fs");
const http = require("https");
const { whitelist } = require("../../models");
const mongoose = require("mongoose");
const validators = require("../helpers/validators");
const e = require("express");
const controllers = {};

class WhitelistController {
  constructor() { }
  async fetchWhitelistedAddress(req, res, next) {
    try {
      if (!req.body.uAddress) return res.reply(messages.required_field("user Address"));
      if (!req.body.cAddress) return res.reply(messages.required_field("Contract Address"));
      let uAddress = req.body.uAddress;
      let cAddress = req.body.cAddress;
   
      whitelist.findOne({ uAddress: { $regex: new RegExp(uAddress), $options: "i" },cAddress:{ $regex: new RegExp(cAddress), $options: "i" } }, (err, whitelistData) => {
        if (err) console.log(err);
        if (!whitelistData) {
          console.log(whitelistData);
          return res.reply(messages.not_found("Data"));
        } else {
          console.log(whitelistData);
          return res.reply(messages.successfully("whitelistData Found"), {
            auth: true,
            address: whitelistData.uAddress,
            contract: whitelistData.cAddress
          });
        }
      });
    } catch (error) {
      console.log(error);
      return res.reply(messages.server_error());
    }
  };

  async insertAddress(req, res, next) {
    try {
      let uAddress = req.body.uAddress;
      let cAddress = req.body.cAddress;
      console.log("data:",req.body);
      const insertData = new whitelist({
        uAddress: uAddress,
        cAddress: cAddress
      });
      console.log("Insert Data is " + insertData);
      insertData.save().then(async (result) => {
        return res.reply(messages.created("Record Inserted"), result);
      }).catch((error) => {
        console.log("Error in creating Record", error);
        return res.reply(messages.error());
      });
    } catch (error) {
      console.log(error);
      return res.reply(messages.server_error());
    }
  };

}
module.exports = WhitelistController; 