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
  constructor() { }
  async addCategory(req, res) {
    try {
      if (!req.userId) return res.reply(messages.unauthorized());
      allowedMimes = ["image/jpeg", "image/jpg", "image/png", "image/gif"];
      errAllowed = "JPG, JPEG, PNG,GIF";
      uploadCategory.fields([{ name: "image", maxCount: 1 }])(req, res, function (error) {
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
          category.save().then((result) => {
            return res.reply(messages.created("Category"), result);
          }).catch((error) => {
            return res.reply(messages.already_exists("Category"), error);
          });
        }
      }
      );
    } catch (error) {
      return res.reply(messages.server_error());
    }
  }


  async updateCategory(req, res) {
    try {
      if (!req.userId) return res.reply(messages.unauthorized());
      allowedMimes = ["image/jpeg", "image/jpg", "image/png", "image/gif"];
      errAllowed = "JPG, JPEG, PNG,GIF";
      uploadCategory.fields([{ name: "image", maxCount: 1 }])(req, res, async function (error) {
        if (error) {
          log.red(error);
          console.log("Error ");
          return res.reply(messages.bad_request(error.message));
        } else {
          console.log("Here");
          if (!req.body.name) {
            return res.reply(messages.not_found("Category Name"));
          }
          let categoryDetails = {};
          categoryDetails = { name: req.body.name, lastUpdatedBy: req.userId, lastUpdatedOn: new Date() };

          if (req.files.image !== undefined) {
            if (!allowedMimes.includes(req.files.image[0].mimetype)) {
              return res.reply(messages.invalid("File Type"));
            }
            categoryDetails["image"] = req.files.image[0].location;
          }
          await Category.findByIdAndUpdate(
            req.body.categoryID,
            categoryDetails,
            (err, category) => {
              if (err) return res.reply(messages.server_error());
              if (!category) return res.reply(messages.not_found("Category"));
              return res.reply(messages.successfully("Category Details Updated"));
            }
          ).catch((e) => {
            return res.reply(messages.error());
          });
        }
      }
      );
    } catch (error) {
      return res.reply(messages.server_error());
    }
  }

  async updateBrand(req, res) {
    try {
      if (!req.userId) return res.reply(messages.unauthorized());
      allowedMimes = ["image/jpeg", "image/jpg", "image/png", "image/gif"];
      errAllowed = "JPG, JPEG, PNG,GIF";

      uploadBrand.fields([{ name: "logoImage", maxCount: 1 }, { name: "coverImage", maxCount: 1 },])(req, res, async function (error) {
        if (error) {
          return res.reply(messages.bad_request(error.message));
        } else {
          if (!req.body.name) {
            return res.reply(messages.not_found("Brand Name"));
          }
          if (!validators.isValidString(req.body.name)) {
            return res.reply(messages.invalid("Brand Name"));
          }
          if (req.body.description.trim().length > 1000) {
            return res.reply(messages.invalid("Description"));
          }
          let brandsDetails = {};
          brandsDetails = { name: req.body.name, description: req.body.description, lastUpdatedBy: req.userId, lastUpdatedOn: new Date() };
          if (req.files.logoImage !== undefined) {
            if (!allowedMimes.includes(req.files.logoImage[0].mimetype)) {
              return res.reply(messages.invalid("File Type"));
            }
            brandsDetails["logoImage"] = req.files.logoImage[0].location;
          }
          if (req.files.coverImage !== undefined) {
            if (!allowedMimes.includes(req.files.coverImage[0].mimetype)) {
              return res.reply(messages.invalid("File Type"));
            }
            brandsDetails["coverImage"] = req.files.coverImage[0].location;
          }
          await Brand.findByIdAndUpdate(
            req.body.brandID,
            brandsDetails,
            (err, brand) => {
              if (err) return res.reply(messages.server_error());
              if (!brand) return res.reply(messages.not_found("Brand"));
              return res.reply(messages.successfully("Brand Details Updated"));
            }
          ).catch((e) => {
            return res.reply(messages.error());
          });
        }
      });
    } catch (error) {
      return res.reply(messages.server_error());
    }
  }

  async addBrand(req, res) {
    try {
      if (!req.userId) return res.reply(messages.unauthorized());
      allowedMimes = ["image/jpeg", "image/jpg", "image/png", "image/gif"];
      errAllowed = "JPG, JPEG, PNG,GIF";

      uploadBrand.fields([{ name: "logoImage", maxCount: 1 }, { name: "coverImage", maxCount: 1 },])(req, res, function (error) {
        if (error) {
          return res.reply(messages.bad_request(error.message));
        } else {
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
          brand.save().then((result) => {
            return res.reply(messages.created("Brand"), result);
          }).catch((error) => {
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
      await Category.find(searchObj).then((result) => {
        if (!result) {
          res.reply(messages.not_found("Category"));
        }
        res.reply(messages.successfully("Category Found"), result);
      }).catch((err) => {
        res.reply(messages.server_error());
      });
    } catch (e) {
      return res.reply(messages.error(e));
    }
  }
  async getAllBrand(req, res) {
    try {
      let brand = await Brand.find({});
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
      if (!req.userId) return res.reply(messages.unauthorized());
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
  async getCategoryByID(req, res) {
    try {
      if (!req.userId) return res.reply(messages.unauthorized());
      if (!req.params.categoryID) return res.reply(messages.not_found("Category ID"));
      Category.findById(req.params.categoryID, (err, category) => {
        if (err) return res.reply(messages.server_error());
        if (!category) return res.reply(messages.not_found("Category"));
        return res.reply(messages.successfully("Category Details Found"), category);
      });
    } catch (e) {
      return res.reply(message.error(e));
    }
  }

  async myCategoryList(req, res) {
    try {
      if (!req.userId) return res.reply(messages.unauthorized());
      const results = {};
      const page = parseInt(req.body.page);
      const limit = parseInt(req.body.limit);
      const startIndex = (page - 1) * limit;
      let searchText = "";
      if (req.body.searchText && req.body.searchText !== undefined) {
        searchText = req.body.searchText;
      }
      let searchArray = [];
      searchArray["createdBy"] = mongoose.Types.ObjectId(req.userId);
      if (searchText !== "") {
        searchArray["name"] = { $regex: new RegExp(searchText), $options: "i" };
      }
      let searchObj = Object.assign({}, searchArray);
      let category = await Category.aggregate([
        { $match: searchObj },
        { $skip: startIndex },
        { $limit: limit },
        { $sort: { createdOn: -1 } },
      ]).exec( async function (e, categoryData) {
        results.count = await Category.countDocuments(searchObj).exec();
        results.results = categoryData;
        return res.reply(messages.success("Category List"), results);
      });
    } catch (error) {
      return res.reply(messages.server_error());
    }
  };

  async myBrandsList(req, res) {
    try {
      if (!req.userId) return res.reply(messages.unauthorized());
      const results = {};
      const page = parseInt(req.body.page);
      const limit = parseInt(req.body.limit);
      const startIndex = (page - 1) * limit;
      let searchText = "";
      if (req.body.searchText && req.body.searchText !== undefined) {
        searchText = req.body.searchText;
      }
      let searchArray = [];
      searchArray["createdBy"] = mongoose.Types.ObjectId(req.userId);
      if (searchText !== "") {
        searchArray["or"] = [
          { 'name': { $regex: new RegExp(searchText), $options: "i" } },
          { 'description': { $regex: new RegExp(searchText), $options: "i" } }
        ];
      }
      let searchObj = Object.assign({}, searchArray);
      let brands = await Brand.aggregate([
        { $match: searchObj },
        { $skip: startIndex },
        { $limit: limit },
        { $sort: { createdOn: -1 } },
      ]).exec( async function (e, brandsData) {
        results.count = await Brand.countDocuments(searchObj).exec();
        results.results = brandsData;
        return res.reply(messages.success("Brands List"), results);
      });
    } catch (error) {
      return res.reply(messages.server_error());
    }
  };


  async categoryList(req, res) {
    try {
      if (!req.userId) return res.reply(messages.unauthorized());
      const results = {};
      const page = parseInt(req.body.page);
      const limit = parseInt(req.body.limit);
      const startIndex = (page - 1) * limit;
      let searchText = "";
      if (req.body.searchText && req.body.searchText !== undefined) {
        searchText = req.body.searchText;
      }
      let searchArray = [];
      if (searchText !== "") {
        searchArray["name"] = { $regex: new RegExp(searchText), $options: "i" };
      }
      let searchObj = Object.assign({}, searchArray);
      let category = await Category.aggregate([
        { $match: searchObj },
        { $skip: startIndex },
        { $limit: limit },
        { $sort: { createdOn: -1 } },
      ]).exec( async function (e, categoryData) {
        results.count = await Category.countDocuments(searchObj).exec();
        results.results = categoryData;
        return res.reply(messages.success("Category List"), results);
      });
    } catch (error) {
      return res.reply(messages.server_error());
    }
  };

  async brandsList(req, res) {
    try {
      if (!req.userId) return res.reply(messages.unauthorized());
      const results = {};
      const page = parseInt(req.body.page);
      const limit = parseInt(req.body.limit);
      const startIndex = (page - 1) * limit;
      let searchText = "";
      if (req.body.searchText && req.body.searchText !== undefined) {
        searchText = req.body.searchText;
      }
      let searchArray = [];
      if (searchText !== "") {
        searchArray["or"] = [
          { 'name': { $regex: new RegExp(searchText), $options: "i" } },
          { 'description': { $regex: new RegExp(searchText), $options: "i" } }
        ];
      }
      let searchObj = Object.assign({}, searchArray);
      let brands = await Brand.aggregate([
        { $match: searchObj },
        { $skip: startIndex },
        { $limit: limit },
        { $sort: { createdOn: -1 } },
      ]).exec( async function (e, brandsData) {
        results.count = await Brand.countDocuments(searchObj).exec();
        results.results = brandsData;
        return res.reply(messages.success("Brands List"), results);
      });
    } catch (error) {
      return res.reply(messages.server_error());
    }
  };

  async showBrandByID(req, res) {
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
  async showCategoryByID(req, res) {
    try {
      if (!req.params.categoryID) return res.reply(messages.not_found("Category ID"));
      Category.findById(req.params.categoryID, (err, category) => {
        if (err) return res.reply(messages.server_error());
        if (!category) return res.reply(messages.not_found("Category"));
        return res.reply(messages.successfully("Category Details Found"), category);
      });
    } catch (e) {
      return res.reply(message.error(e));
    }
  }

}
module.exports = UtilsController;