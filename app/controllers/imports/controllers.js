const fs = require("fs");
const http = require("https");
const { importedNFT, importedCollection } = require("../../models");
const pinataSDK = require("@pinata/sdk");
const aws = require("aws-sdk");
const multer = require("multer");
const multerS3 = require("multer-s3");
const pinata = pinataSDK(
  process.env.PINATAAPIKEY,
  process.env.PINATASECRETAPIKEY
);
const mongoose = require("mongoose");
const validators = require("../helpers/validators");
var jwt = require("jsonwebtoken");
const e = require("express");


class ImportedController {

  constructor() {

  }


  async createCollection(req, res) {
    try {
      if (!req.body.address) {
        return res.reply(messages.not_found("Collection Address"));
      }
      if (!req.body.totalSupply) {
        return res.reply(messages.invalid("Total Supply"));
      }
      let contractAddress = req.body.address.toLowerCase();
      let totalSupply = req.body.totalSupply;
      importedCollection.findOne({ contractAddress: contractAddress },
        (err, collection) => {
          if (err) {
            return res.reply(messages.error());
          }
          if (!collection) {
            const insertCollection = new importedCollection({
              contractAddress: contractAddress,
              totalSupply: totalSupply,
            });
            insertCollection.save().then((result) => {
              return res.reply(messages.created("Collection"), result);
            }).catch((error) => {
              console.log(error);
              return res.reply(error);
            });
          } else {
            importedCollection.findOneAndUpdate({ contractAddress: contractAddress }, { totalSupply: totalSupply},{ new: true }).then((result) => {
              return res.reply(messages.updated("Collection"), result);
            }).catch((error) => {
              console.log(error);
              return res.reply(error);
            });
          }
        }
      );

    } catch (error) {
      console.log(error);
      return res.reply(messages.server_error());
    }
  };
}
module.exports = ImportedController;