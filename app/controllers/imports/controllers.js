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
  constructor() {}

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
      importedCollection.findOne(
        { contractAddress: contractAddress },
        (err, collection) => {
          if (err) {
            return res.reply(messages.error());
          }
          if (!collection) {
            const insertCollection = new importedCollection({
              contractAddress: contractAddress,
              totalSupply: totalSupply,
              link: req.body.link,
            });
            insertCollection
              .save()
              .then((result) => {
                return res.reply(messages.created("Collection"), result);
              })
              .catch((error) => {
                console.log(error);
                return res.reply(error);
              });
          } else {
            importedCollection
              .findOneAndUpdate(
                { contractAddress: contractAddress },
                { totalSupply: totalSupply },
                { new: true }
              )
              .then((result) => {
                return res.reply(messages.updated("Collection"), result);
              })
              .catch((error) => {
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
  }

  async getCollection(req, res) {
    try {
      let data = [];
      const page = parseInt(req.body.page);
      const limit = parseInt(req.body.limit);
      const startIndex = (page - 1) * limit;
      const endIndex = page * limit;

      let searchText = "";
      if (req.body.searchText && req.body.searchText !== undefined) {
        searchText = req.body.searchText;
      }
      let searchArray = [];

      if (searchText !== "") {
        searchArray["contractAddress"] = {
          $regex: new RegExp(searchText),
          $options: "i",
        };
      }
      let searchObj = Object.assign({}, searchArray);
      console.log("searchArray", searchArray);

      const results = {};
      if (
        endIndex < (await importedCollection.countDocuments(searchObj).exec())
      ) {
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

      console.log("search obkj", searchObj);

      await importedCollection
        .find(searchObj)
        .sort({ createdOn: -1 })
        .limit(limit)
        .skip(startIndex)
        .lean()
        .exec()
        .then((res) => {
          data.push(res);
        })
        .catch((e) => {
          console.log("Error", e);
        });
      results.count = await importedCollection.countDocuments(searchObj).exec();
      results.results = data;
      res.header("Access-Control-Max-Age", 600);
      return res.reply(messages.success("Collection List"), results);
    } catch (error) {
      console.log("Error " + error);
      return res.reply(messages.server_error());
    }
  }

  async createNFT(req, res) {
    try {
      if (!req.body.nftData) {
        return res.reply(messages.not_found("NFT Data"));
      }
      let NFTData = req.body.nftData;
      if (NFTData.length > 0) {
        NFTData.forEach((nftElement) => {
          let nft = new importedNFT({
            name: nftElement.name,
            description: nftElement.description,
            image: nftElement.image,
            tokenID: nftElement.tokenID,
            collectionAddress: nftElement.collectionAddress,
            ownedBy: [],
          });
          let NFTAttr = nftElement.attributes;
          if (NFTAttr.length > 0) {
            NFTAttr.forEach((obj) => {
              nft.attributes.push(obj);
            });
          }
          nft.ownedBy.push({
            address: nftElement.owner,
            quantity: 1,
          });
          nft.save().then(async (result) => {});
        });
        return res.reply(messages.created("NFT"));
      } else {
        return res.reply("Empty Request");
      }
    } catch (error) {
      console.log(error);
      return res.reply(messages.server_error());
    }
  }

  async updateNFT(req, res) {
    try {
      if (!req.body.name) {
        return res.reply(messages.not_found("NFT Name"));
      }
      if (!req.body.description) {
        return res.reply(messages.not_found("NFT Description"));
      }
      if (!req.body.collectionAddress) {
        return res.reply(messages.not_found("Collection Address"));
      }
      if (!req.body.tokenID) {
        return res.reply(messages.not_found("Token ID"));
      }
      if (!req.body.image) {
        return res.reply(messages.not_found("Image"));
      }

      let attributes = [];
      let NFTAttr = req.body.attributes;
      if (NFTAttr.length > 0) {
        NFTAttr.forEach((obj) => {
          attributes.push(obj);
        });
      }

      let dataToadd = {
        address: req.body.owner,
        quantity: 1,
      };
      importedNFT
        .findOneAndUpdate(
          {
            collectionAddress: req.body.collectionAddress,
            tokenID: req.body.tokenID,
          },
          {
            name: req.body.name,
            description: req.body.description,
            image: req.body.image,
            attributes: attributes,
            ownedBy: [],
          },
          // { $addToSet: { ownedBy: dataToadd } },
          { new: true }
        )

        .then((result) => {
          return res.reply(messages.updated("NFT"), result);
        })
        .catch((error) => {
          console.log(error);
          return res.reply(error);
        });
    } catch (error) {
      console.log(error);
      return res.reply(messages.server_error());
    }
  }

  async getNFT(req, res) {
    try {
      let data = [];
      const page = parseInt(req.body.page);
      const limit = parseInt(req.body.limit);
      const startIndex = (page - 1) * limit;
      const endIndex = page * limit;

      let collectionAddress = "";
      if (
        req.body.collectionAddress &&
        req.body.collectionAddress !== undefined
      ) {
        collectionAddress = req.body.collectionAddress;
      }
      let searchText = "";
      if (req.body.searchText && req.body.searchText !== undefined) {
        searchText = req.body.searchText;
      }
      let searchArray = [];

      if (collectionAddress !== "") {
        searchArray["collectionAddress"] = collectionAddress;
      }
      if (req.body.tokenID !== "" && req.body.tokenID != undefined) {
        searchArray["tokenID"] = req.body.tokenID;
      }
      if (searchText !== "") {
        searchArray["name"] = { $regex: new RegExp(searchText), $options: "i" };
      }
      let searchObj = Object.assign({}, searchArray);
      console.log("searchArray", searchArray);

      const results = {};
      if (endIndex < (await importedNFT.countDocuments(searchObj).exec())) {
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

      console.log("search obkj", searchObj);

      await importedNFT
        .find(searchObj)
        .sort({ createdOn: -1 })
        .limit(limit)
        .skip(startIndex)
        .lean()
        .exec()
        .then((res) => {
          data.push(res);
        })
        .catch((e) => {
          console.log("Error", e);
        });
      results.count = await importedNFT.countDocuments(searchObj).exec();
      results.results = data;
      res.header("Access-Control-Max-Age", 600);
      return res.reply(messages.success("NFT List"), results);
    } catch (error) {
      console.log("Error " + error);
      return res.reply(messages.server_error());
    }
  }
}
module.exports = ImportedController;
