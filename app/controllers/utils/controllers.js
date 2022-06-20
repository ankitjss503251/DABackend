/* eslint-disable no-undef */
const fs = require("fs");
const http = require("https");
const { Category, Brand } = require("../../models");
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
const controllers = {};

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

//const upload = multer(oMulterObj).single("nftFile");

const uploadCategory = multer(oMulterObj);

const uploadBrand = multer(oMulterObj);

class UtilsController {
  constructor() {}

  async addCategory(req, res) {
    try {
      if (!req.userId) return res.reply(messages.unauthorized());
      allowedMimes = ["image/jpeg", "image/jpg", "image/png", "image/gif"];
      errAllowed = "JPG, JPEG, PNG,GIF";
      uploadCategory.fields([{ name: "image", maxCount: 1 }])(
        req,
        res,
        function (error) {
          if (error) {
            log.red(error);
            console.log("Error ");
            return res.reply(messages.bad_request(error.message));
          } else {
            console.log("Here");

            if (!req.body.name) {
              return res.reply(messages.not_found("Category Name"));
            }
            if (!validators.isValidString(req.body.name)) {
              return res.reply(messages.invalid("Category Name"));
            }
            const category = new Category({
              name: req.body.name,
              image: req.files.image[0].location,
              createdBy: req.userId,
            });
            category
              .save()
              .then((result) => {
                return res.reply(messages.created("Category"), result);
              })
              .catch((error) => {
                return res.reply(messages.already_exists("Category"), error);
              });
          }
        }
      );
    } catch (error) {
      return res.reply(messages.server_error());
    }
  }

  async addBrand(req, res) {
    try {
      if (!req.userId) return res.reply(messages.unauthorized());
      allowedMimes = ["image/jpeg", "image/jpg", "image/png", "image/gif"];
      errAllowed = "JPG, JPEG, PNG,GIF";

      uploadBrand.fields([
        { name: "logoImage", maxCount: 1 },
        { name: "coverImage", maxCount: 1 },
      ])(req, res, function (error) {
        console.log("in add brand api");
        if (error) {
          log.red(error);
          console.log("Error ", error);
          return res.reply(messages.bad_request(error.message));
        } else {
          console.log("Here");

          if (!req.body.name) {
            return res.reply(messages.not_found("Brand Name"));
          }
          if (!validators.isValidString(req.body.name)) {
            return res.reply(messages.invalid("Brand Name"));
          }
          if (req.body.description.trim().length > 1000) {
            return res.reply(messages.invalid("Description"));
          }
          const brand = new Brand({
            name: req.body.name,
            description: req.body.description,
            logoImage: req.files.logoImage[0].location,
            coverImage: req.files.coverImage[0].location,
            createdBy: req.userId,
          });
          brand
            .save()
            .then((result) => {
              return res.reply(messages.created("Brand"), result);
            })
            .catch((error) => {
              return res.reply(messages.already_exists("Brand"), error);
            });
        }
      });
    } catch (error) {
      return res.reply(messages.server_error());
    }
  }

  async getCategory(req, res) {
    try {
      let categoryID = "";
      if (req.body.categoryID && req.body.categoryID !== undefined) {
        categoryID = req.body.categoryID;
      }
      let name = "";
      if (req.body.name && req.body.name !== undefined) {
        name = req.body.name;
      }

      let searchArray = [];
      if (categoryID !== "") {
        searchArray["_id"] = mongoose.Types.ObjectId(categoryID);
      }

      if (name !== "") {
        searchArray["name"] = name;
      }
      let searchObj = Object.assign({}, searchArray);
      await Category.find(searchObj)
        .then((result) => {
          if (!result)
             res.reply(messages.not_found("Category"));
          res.reply(messages.successfully("Category Found"), result);
        })
        .catch((err) => {
          res.reply(messages.server_error());
        });
    } catch (e) {
      return res.reply(messages.error(e));
    }
  }

  async getAllBrand(req, res) {
    try {
      let brand = await Brand.find({});

      console.log("brand", brand);

      if (!brand) {
        return res.reply(messages.not_found("brand"));
      }
      return res.reply(messages.no_prefix("brand "), brand);
    } catch (e) {
      return res.reply(messages.error(e));
    }
  }

  async getBrandByID(req, res) {
    try {
      if (!req.params.brandID) return res.reply(messages.not_found("Brand ID"));
      Brand.findById(req.params.brandID, (err, brand) => {
        if (err) return res.reply(messages.server_error());
        if (!brand) return res.reply(messages.not_found("Brand"));
        return res.reply(messages.successfully("Brand Details Found"), brand);
      });
    } catch (e) {
      return res.reply(message.error(e));
    }
  }
}

module.exports = UtilsController;
