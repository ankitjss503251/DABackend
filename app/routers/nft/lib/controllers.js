/* eslint-disable no-undef */
const fs = require("fs");
const http = require("https");
const {
  NFT,
  Collection,
  User,
  Bid,
  NFTowners,
  Order,
  Brand,
} = require("../../../models");
const pinataSDK = require("@pinata/sdk");
const aws = require("aws-sdk");
const multer = require("multer");
const multerS3 = require("multer-s3");
const pinata = pinataSDK(
  process.env.PINATAAPIKEY,
  process.env.PINATASECRETAPIKEY
);
const mongoose = require("mongoose");
const validators = require("./validators");
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

const upload = multer(oMulterObj).single("nftFile");
const uploadBanner = multer(oMulterObj);

controllers.createCollection = async (req, res) => {
  try {
    if (!req.userId) return res.reply(messages.unauthorized());
    allowedMimes = ["image/jpeg", "image/jpg", "image/png", "image/gif"];
    errAllowed = "JPG, JPEG, PNG,GIF";

    uploadBanner.fields([
      { name: "logoImage", maxCount: 1 },
      { name: "coverImage", maxCount: 1 },
    ])(req, res, function (error) {
      if (error) {
        log.red(error);
        console.log("Error ");
        return res.reply(messages.bad_request(error.message));
      } else {
        console.log("Here");
        log.green(req.body);
        log.green(req.files.logoImage[0].location);
        log.green(req.files.coverImage[0].location);

        if (!req.body.name) {
          return res.reply(messages.not_found("Collection Name"));
        }
        if (!validators.isValidString(req.body.name)) {
          return res.reply(messages.invalid("Collection Name"));
        }
        if (req.body.description.trim().length > 1000) {
          return res.reply(messages.invalid("Description"));
        }
        const collection = new Collection({
          name: req.body.name,
          symbol: req.body.symbol,
          description: req.body.description,
          type: req.body.type,
          contractAddress: req.body.contractAddress,
          logoImage: req.files.logoImage[0].location,
          coverImage: req.files.coverImage[0].location,
          categoryID: req.body.categoryID,
          brandID: req.body.brandID,
          chainID: req.body.chainID,
          preSaleStartTime: req.body.preSaleStartTime,
          preSaleEndTime: req.body.preSaleEndTime,
          totalSupply: req.body.totalSupply,
          nextId: 0,
          price: req.body.price,
          createdBy: req.userId,
        });
        collection
          .save()
          .then((result) => {
            return res.reply(messages.created("Collection"), result);
          })
          .catch((error) => {
            console.log(error);
            return res.reply(error);
          });
      }
    });
  } catch (error) {
    return res.reply(messages.server_error());
  }
};

controllers.getCollections = async (req, res) => {
  try {
    let data = [];
    const page = parseInt(req.body.page);
    const limit = parseInt(req.body.limit);
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;

    let collectionID = "";
    if (req.body.collectionID && req.body.collectionID !== undefined) {
      collectionID = req.body.collectionID;
    }
    let userID = "";
    if (req.body.userID && req.body.userID !== undefined) {
      userID = req.body.userID;
    }
    let categoryID = "";
    if (req.body.categoryID && req.body.categoryID !== undefined) {
      categoryID = req.body.categoryID;
    }
    let brandID = "";
    if (req.body.brandID && req.body.brandID !== undefined) {
      brandID = req.body.brandID;
    }
    let ERCType = "";
    if (req.body.ERCType && req.body.ERCType !== undefined) {
      ERCType = req.body.ERCType;
    }
    let searchText = "";
    if (req.body.searchText && req.body.searchText !== undefined) {
      searchText = req.body.searchText;
    }
    let filterString = "";
    if (req.body.filterString && req.body.filterString !== undefined) {
      filterString = req.body.filterString;
    }
    let isMinted = "";
    if (req.body.isMinted && req.body.isMinted !== undefined) {
      isMinted = req.body.isMinted;
    }
    let isHotCollection = "";
    if (req.body.isHotCollection && req.body.isHotCollection !== undefined) {
      isHotCollection = req.body.isHotCollection;
    }
    let isExclusive = "";
    if (req.body.isExclusive && req.body.isExclusive !== undefined) {
      isExclusive = req.body.isExclusive;
    }

    let searchArray = [];
    if (collectionID !== "") {
      searchArray["_id"] = mongoose.Types.ObjectId(collectionID);
    }
    if (userID !== "") {
      searchArray["createdBy"] = mongoose.Types.ObjectId(userID);
    }
    if (categoryID !== "") {
      searchArray["categoryID"] = mongoose.Types.ObjectId(categoryID);
    }
    if (brandID !== "") {
      searchArray["brandID"] = mongoose.Types.ObjectId(brandID);
    }
    if (isMinted !== "") {
      searchArray["isMinted"] = isMinted;
    }
    if (isHotCollection !== "") {
      searchArray["isHotCollection"] = isHotCollection;
    }
    if (isExclusive !== "") {
      searchArray["isExclusive"] = isExclusive;
    }
    if (ERCType !== "") {
      searchArray["type"] = ERCType;
    }
    if (filterString !== "") {
      searchArray["salesCount"] = { $gte: 0 };
    }
    if (searchText !== "") {
      let searchKey = new RegExp(searchText,'i');
      searchArray["$or"] = [{name: searchKey}, {contractAddress:searchKey}];
      // searchArray["or"] =  [{ contractAddress:searchKey }];
    }
    let searchObj = Object.assign({}, searchArray);

    console.log("Obj", searchObj);
    const results = {};
    if (endIndex < (await Collection.countDocuments(searchObj).exec())) {
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

    await Collection.find(searchObj)
      .populate("categoryID")
      .populate("brandID")
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
    results.count = await Collection.countDocuments(searchObj).exec();
    results.results = data;
    res.header("Access-Control-Max-Age", 600);
    return res.reply(messages.success("Collection List"), results);
  } catch (error) {
    console.log("Error " + error);
    return res.reply(messages.server_error());
  }
};

controllers.myCollections = async (req, res) => {
  try {
    if (!req.userId) return res.reply(messages.unauthorized());
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
    searchArray["createdBy"] = mongoose.Types.ObjectId(req.userId);
    if (searchText !== "") {
      searchArray["$or"] = [
        { name: { $regex: new RegExp(searchText), $options: "i" } },
        { contractAddress: { $regex: new RegExp(searchText), $options: "i" } },
      ];
    }
    let searchObj = Object.assign({}, searchArray);

    const results = {};
    if (endIndex < (await Collection.countDocuments(searchObj).exec())) {
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

    await Collection.find(searchObj)
      .populate("categoryID")
      .populate("brandID")
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
    results.count = await Collection.countDocuments(searchObj).exec();
    results.results = data;
    res.header("Access-Control-Max-Age", 600);
    return res.reply(messages.success("Collection List"), results);
  } catch (error) {
    console.log("Error " + error);
    return res.reply(messages.server_error());
  }
};

controllers.viewCollection = async (req, res) => {
  try {
    if (!req.params.collectionID)
      return res.reply(messages.not_found("Collection ID"));
    if (!validators.isValidObjectID(req.params.collectionID))
      res.reply(messages.invalid("Collection ID"));

    let collectionData = await Collection.findById(
      req.params.collectionID
    ).populate({
      path: "createdBy",
      options: {
        limit: 1,
      },
    });

    if (!collectionData) return res.reply(messages.not_found("Collection"));
    collectionData = collectionData.toObject();

    var token = req.headers.authorization;

    req.userId =
      req.userId && req.userId != undefined && req.userId != null
        ? req.userId
        : "";

    let likeARY =
      aNFT.user_likes && aNFT.user_likes.length
        ? aNFT.user_likes.filter((v) => v.toString() == req.userId.toString())
        : [];
    if (token) {
      token = token.replace("Bearer ", "");
      jwt.verify(token, process.env.JWT_SECRET, function (err, decoded) {
        if (decoded) req.userId = decoded.id;
      });

      if (aNFT.oCurrentOwner._id != req.userId)
        await NFT.findByIdAndUpdate(req.params.nNFTId, {
          $inc: {
            nView: 1,
          },
        });
    }
    aNFT.loggedinUserId = req.userId;
    console.log("---------------------------8");

    if (!aNFT) {
      console.log("---------------------------9");

      return res.reply(messages.not_found("NFT"));
    }
    console.log("---------------------------10");

    return res.reply(messages.success(), aNFT);
  } catch (error) {
    return res.reply(messages.server_error());
  }
};

controllers.updateCollection = async (req, res) => {
  try {
    if (!req.userId) return res.reply(messages.unauthorized());
    allowedMimes = ["image/jpeg", "image/jpg", "image/png", "image/gif"];
    errAllowed = "JPG, JPEG, PNG,GIF";

    uploadBanner.fields([
      { name: "logoImage", maxCount: 1 },
      { name: "coverImage", maxCount: 1 },
    ])(req, res, function (error) {
      let updateData = [];
      let collectionID = req.body.id;
      if (
        req.files &&
        req.files.logoImage &&
        req.files.logoImage[0] &&
        req.files.logoImage[0].location
      ) {
        updateData["logoImage"] = req.files.logoImage[0].location;
      }
      if (
        req.files &&
        req.files.coverImage &&
        req.files.coverImage[0] &&
        req.files.coverImage[0].location
      ) {
        updateData["coverImage"] = req.files.coverImage[0].location;
      }
      if (req.body) {
        if (req.body.price) {
          updateData["price"] = req.body.price;
        }
        if (req.body.isHotCollection) {
          updateData["isHotCollection"] = req.body.isHotCollection;
        }
        if (req.body.isMinted) {
          updateData["isMinted"] = req.body.isMinted;
        }
        if (req.body.preSaleStartTime) {
          updateData["preSaleStartTime"] = req.body.preSaleStartTime;
        }
        updateData["lastUpdatedBy"] = req.userId;
        updateData["lastUpdatedOn"] = Date.now();
      }
      let updateObj = Object.assign({}, updateData);
      Collection.findByIdAndUpdate(
        { _id: mongoose.Types.ObjectId(collectionID) },
        { $set: updateObj }
      ).then((collection) => {
        return res.reply(
          messages.updated("Collection Updated successfully."),
          collection
        );
      });
    });
  } catch (error) {
    return res.reply(messages.server_error());
  }
};

controllers.getUpcomingCollections = async (req, res) => {
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
    searchArray["preSaleStartTime"] = { $lt: new Date() };
    if (searchText !== "") {
      searchArray["$or"] = [
        { name: { $regex: new RegExp(searchText), $options: "i" } },
        { contractAddress: { $regex: new RegExp(searchText), $options: "i" } },
      ];
    }
    let searchObj = Object.assign({}, searchArray);

    const results = {};
    if (endIndex < (await Collection.countDocuments(searchObj).exec())) {
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

    await Collection.find(searchObj)
      .populate("categoryID")
      .populate("brandID")
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
    results.count = await Collection.countDocuments(searchObj).exec();
    results.results = data;
    res.header("Access-Control-Max-Age", 600);
    return res.reply(messages.success("Collection List"), results);
  } catch (error) {
    console.log("Error " + error);
    return res.reply(messages.server_error());
  }
};

controllers.createNFT = async (req, res) => {
  try {
    if (!req.userId) return res.reply(messages.unauthorized());
    allowedMimes = [
      "image/jpeg",
      "video/mp4",
      "image/jpg",
      "image/webp",
      "image/png",
      "image/gif",
      "audio/mp3",
      "audio/mpeg",
    ];
    errAllowed = "JPG, JPEG, PNG, GIF, MP3, WEBP & MPEG";
    let attributes = req.body.attributes;
    upload(req, res, function (error) {
      if (error) {
        log.red(error);
        return res.reply(messages.bad_request(error.message));
      } else {
        if (!req.body.creatorAddress) {
          return res.reply(messages.not_found("Creator Wallet Address"));
        }
        if (!req.body.name) {
          return res.reply(messages.not_found("Name"));
        }
        if (!req.body.quantity) {
          return res.reply(messages.not_found("Quantity"));
        }
        if (!validators.isValidString(req.body.name)) {
          return res.reply(messages.invalid("Title"));
        }
        if (req.body.description.trim().length > 1000) {
          return res.reply(messages.invalid("Description"));
        }
        if (isNaN(req.body.quantity) || !req.body.quantity > 0) {
          return res.reply(messages.invalid("Quantity"));
        }
        if (!req.file) {
          return res.reply(messages.not_found("File"));
        }
        const iOptions = {
          pinataMetadata: {
            name: req.file.originalname,
          },
          pinataOptions: {
            cidVersion: 0,
          },
        };
        try {
          let creatorAddress = req.body.creatorAddress;
          const pathString = "/tmp/";
          const file = fs.createWriteStream(pathString + req.file.originalname);
          const request = http.get(`${req.file.location}`, function (response) {
            var stream = response.pipe(file);
            const readableStreamForFile = fs.createReadStream(
              pathString + req.file.originalname
            );
            stream.on("finish", async function () {
              pinata
                .pinFileToIPFS(readableStreamForFile, iOptions)
                .then((res) => {
                  attributes = JSON.parse(req.body.attributes);
                  let uploadingData = {};
                  uploadingData = {
                    description: req.body.description,
                    external_url: "",
                    image: "https://ipfs.io/ipfs/" + res.IpfsHash,
                    name: req.body.name,
                    attributes: req.body.attributes,
                  };
                  console.log("uploadingData", uploadingData);
                  const mOptions = {
                    pinataMetadata: {
                      name: "hello",
                    },
                    pinataOptions: {
                      cidVersion: 0,
                    },
                  };
                  console.log("res---", res.IpfsHash);
                  return pinata.pinJSONToIPFS(uploadingData, mOptions);
                })
                .then(async (file2) => {
                  console.log("111", req.body);
                  const collectionID = req.body.collectionID;
                  const collectionData = await Collection.findOne({
                    _id: mongoose.Types.ObjectId(collectionID),
                  });
                  const brandID = collectionData.brandID;
                  const categoryID = collectionData.categoryID;
                  console.log("222", req.body);
                  const nft = new NFT({
                    name: req.body.name,
                    collectionID:
                      collectionID && collectionID != undefined
                        ? collectionID
                        : "",
                    hash: file2.IpfsHash,
                    ownedBy: [],
                    totalQuantity: req.body.quantity,
                    description: req.body.description,
                    createdBy: req.userId,
                    tokenID: req.body.tokenID,
                    type: req.body.type,
                    image: req.file.location,
                    price: req.body.price,
                    isMinted: req.body.isMinted,
                    categoryID: categoryID,
                    brandID: brandID,
                    lazyMintingStatus: 1,
                  });
                  console.log("body", req.body);
                  console.log("NFTAttr", req.body.attributes);
                  let NFTAttr = JSON.parse(req.body.attributes);
                  console.log("NFTAttr", NFTAttr);
                  if (NFTAttr.length > 0) {
                    NFTAttr.forEach((obj) => {
                      for (let [key, value] of Object.entries(obj)) {
                        nft.attributes.push({
                          name: key,
                          value: value,
                        });
                        console.log(key + " : " + value);
                      }
                    });
                  }

                  let NFTLevels = JSON.parse(req.body.levels);
                  if (NFTLevels.length > 0) {
                    NFTLevels.forEach((obj) => {
                      for (let [key, value] of Object.entries(obj)) {
                        nft.levels.push({
                          name: key,
                          value: value,
                        });
                        console.log(key + " : " + value);
                      }
                    });
                  }

                  nft.assetsInfo.push({
                    size: req.body.imageSize,
                    type: req.body.imageType,
                    dimension: req.body.imageDimension,
                  });
                  nft.ownedBy.push({
                    address: creatorAddress.toLowerCase(),
                    quantity: req.body.quantity,
                  });
                  nft
                    .save()
                    .then(async (result) => {
                      const collection = await Collection.findOne({
                        _id: mongoose.Types.ObjectId(collectionID),
                      });
                      let nextID = collection.getNextID();
                      collection.nextID = nextID;
                      collection.save();
                      await Collection.findOneAndUpdate(
                        { _id: mongoose.Types.ObjectId(collectionID) },
                        { $inc: { nftCount: 1 } },
                        function () {}
                      );
                      await Brand.findOneAndUpdate(
                        { _id: mongoose.Types.ObjectId(brandID) },
                        { $inc: { nftCount: 1 } },
                        function () {}
                      );
                      return res.reply(messages.created("NFT"), result);
                    })
                    .catch((error) => {
                      console.log("Created NFT error", error);
                      return res.reply(messages.error());
                    });
                })
                .catch((e) => {
                  console.log("Error " + e);
                  return res.reply(messages.error());
                });
            });
          });
        } catch (e) {
          console.log("error in file upload..", e);
        }
      }
    });
  } catch (error) {
    return res.reply(messages.error());
  }
};

controllers.viewNFTs = async (req, res) => {
  try {
    let data = [];
    const page = parseInt(req.body.page);
    const limit = parseInt(req.body.limit);
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;

    let nftID = "";
    if (req.body.nftID && req.body.nftID !== undefined) {
      nftID = req.body.nftID;
    }
    let userID = "";
    if (req.body.userID && req.body.userID !== undefined) {
      userID = req.body.userID;
    }
    let collectionID = "";
    if (req.body.collectionID && req.body.collectionID !== undefined) {
      collectionID = req.body.collectionID;
    }
    let categoryID = "";
    if (req.body.categoryID && req.body.categoryID !== undefined) {
      categoryID = req.body.categoryID;
    }
    let brandID = "";
    if (req.body.brandID && req.body.brandID !== undefined) {
      brandID = req.body.brandID;
    }
    let ERCType = "";
    if (req.body.ERCType && req.body.ERCType !== undefined) {
      ERCType = req.body.ERCType;
    }
    let searchText = "";
    if (req.body.searchText && req.body.searchText !== undefined) {
      searchText = req.body.searchText;
    }
    let isMinted = "";
    if (req.body.isMinted && req.body.isMinted !== undefined) {
      isMinted = req.body.isMinted;
    }
    let isLazyMinted = "";
    if (req.body.isLazyMinted !== undefined) {
      isLazyMinted = req.body.isLazyMinted;
    }

    let searchArray = [];

    if (nftID !== "") {
      searchArray["_id"] = mongoose.Types.ObjectId(nftID);
    }
    if (collectionID !== "") {
      searchArray["collectionID"] = mongoose.Types.ObjectId(collectionID);
    }
    if (userID !== "") {
      searchArray["createdBy"] = mongoose.Types.ObjectId(userID);
    }
    if (categoryID !== "") {
      searchArray["categoryID"] = mongoose.Types.ObjectId(categoryID);
    }
    if (brandID !== "") {
      searchArray["brandID"] = mongoose.Types.ObjectId(brandID);
    }
    if (ERCType !== "") {
      searchArray["type"] = ERCType;
    }
    if (isMinted !== "") {
      searchArray["isMinted"] = isMinted;
    }
    if (searchText !== "") {
      searchArray["name"] = { $regex: new RegExp(searchText), $options: "i" };
    }
    console.log("isLazyMinted == 1", isLazyMinted == 1);
    if (isLazyMinted !== "") {
      if (isLazyMinted == true) searchArray["lazyMintingStatus"] = 1;
      else searchArray["lazyMintingStatus"] = 0;
    }

    let searchObj = Object.assign({}, searchArray);

    console.log("searchArray", searchArray);

    const results = {};
    if (endIndex < (await NFT.countDocuments(searchObj).exec())) {
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
    await NFT.find(searchObj)
      .populate("collectionID")
      .populate("categoryID")
      .populate("brandID")
      .populate("createdBy")
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
    results.count = await NFT.countDocuments(searchObj).exec();
    results.results = data;
    res.header("Access-Control-Max-Age", 600);
    return res.reply(messages.success("NFT List"), results);
  } catch (error) {
    console.log("Error " + error);
    return res.reply(messages.server_error());
  }
};

controllers.myNFTs = async (req, res) => {
  try {
    if (!req.userId) return res.reply(messages.unauthorized());
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
    searchArray["createdBy"] = mongoose.Types.ObjectId(req.userId);
    if (searchText !== "") {
      searchArray["$or"] = [
        { name: { $regex: new RegExp(searchText), $options: "i" } },
        { contractAddress: { $regex: new RegExp(searchText), $options: "i" } },
      ];
    }
    let searchObj = Object.assign({}, searchArray);

    const results = {};
    if (endIndex < (await NFT.countDocuments(searchObj).exec())) {
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

    await NFT.find(searchObj)
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
    results.count = await NFT.countDocuments(searchObj).exec();
    results.results = data;
    res.header("Access-Control-Max-Age", 600);
    return res.reply(messages.success("Collection List"), results);
  } catch (error) {
    console.log("Error " + error);
    return res.reply(messages.server_error());
  }
};

controllers.likeNFT = async (req, res) => {
  try {
    if (!req.userId) return res.reply(messages.unauthorized());
    let { id } = req.body;
    return NFT.findOne({ _id: mongoose.Types.ObjectId(id) }).then(
      async (NFTData) => {
        if (NFTData && NFTData != null) {
          let likeMAINarray = [];
          likeMAINarray = NFTData.nUser_likes;
          let flag = "";
          let likeARY =
            likeMAINarray && likeMAINarray.length
              ? likeMAINarray.filter(
                  (v) => v.toString() == req.userId.toString()
                )
              : [];
          if (likeARY && likeARY.length) {
            flag = "dislike";
            var index = likeMAINarray.indexOf(likeARY[0]);
            if (index != -1) {
              likeMAINarray.splice(index, 1);
            }
          } else {
            flag = "like";
            likeMAINarray.push(mongoose.Types.ObjectId(req.userId));
          }
          await NFT.findByIdAndUpdate(
            { _id: mongoose.Types.ObjectId(id) },
            { $set: { nUser_likes: likeMAINarray } }
          ).then((user) => {
            if (flag == "like") {
              return res.reply(messages.updated("NFT liked successfully."));
            } else {
              return res.reply(messages.updated("NFT unliked successfully."));
            }
          });
        } else {
          return res.reply(messages.bad_request("NFT not found."));
        }
      }
    );
  } catch (error) {
    log.red(error);
    return res.reply(messages.server_error());
  }
};

controllers.getNftOwner = async (req, res) => {
  try {
    // if (!req.userId) return res.reply(messages.unauthorized());
    // if (!req.params.nNFTId) return res.reply(messages.not_found("NFT ID"));
    console.log("user id && NFTId -->", req.userId, req.params.nNFTId);

    let nftOwner = {};

    nftOwner = await NFTowners.findOne({
      nftId: req.params.nNFTId,
      oCurrentOwner: req.userId,
    });
    if (!nftOwner) {
      nftOwner = await NFTowners.findOne(
        { nftId: req.params.nNFTId },
        {},
        { sort: { sCreated: -1 } }
      );
      console.log("nft owner is-->", nftOwner);
      return res.reply(messages.success(), nftOwner);
    } else {
      if (nftOwner.oCurrentOwner) {
        users = await User.findOne(nftOwner.oCurrentOwner);
        nftOwner.oCurrentOwner = users;
      }
      console.log("nft owner is-->", nftOwner);
      return res.reply(messages.success(), nftOwner);
    }
  } catch (e) {
    console.log("error in getNftOwner is-->", e);
    return e;
  }
};

controllers.getAllnftOwner = async (req, res) => {
  try {
    console.log("All Nft Called -->", req.params.nNFTId);

    let nftOwner = {};

    nftOwner = await NFTowners.find({ nftId: req.params.nNFTId });
    return res.reply(messages.success(), nftOwner);
  } catch (e) {
    console.log("error in getNftOwner is-->", e);
    return e;
  }
};

controllers.mynftlist = async (req, res) => {
  try {
    if (!req.userId) return res.reply(messages.unauthorized());

    var nLimit = parseInt(req.body.length);
    var nOffset = parseInt(req.body.start);
    let oTypeQuery = {},
      oSellingTypeQuery = {},
      oSortingOrder = {};
    log.red(req.body);
    if (req.body.eType[0] != "All" && req.body.eType[0] != "") {
      oTypeQuery = {
        $or: [],
      };
      req.body.eType.forEach((element) => {
        oTypeQuery["$or"].push({
          eType: element,
        });
      });
    }

    let oCollectionQuery = {};
    if (req.body.sCollection != "All" && req.body.sCollection != "") {
      oCollectionQuery = {
        sCollection: req.body.sCollection,
      };
    }

    if (req.body.sSellingType != "") {
      oSellingTypeQuery = {
        eAuctionType: req.body.sSellingType,
      };
    }

    if (req.body.sSortingType == "Recently Added") {
      oSortingOrder["sCreated"] = -1;
    } else if (req.body.sSortingType == "Most Viewed") {
      oSortingOrder["nView"] = -1;
    } else if (req.body.sSortingType == "Price Low to High") {
      oSortingOrder["nBasePrice"] = 1;
    } else if (req.body.sSortingType == "Price High to Low") {
      oSortingOrder["nBasePrice"] = -1;
    } else {
      oSortingOrder["_id"] = -1;
    }

    let data = await NFT.aggregate([
      {
        $match: {
          $and: [
            oTypeQuery,
            oCollectionQuery,
            oSellingTypeQuery,
            {
              $or: [
                {
                  oCurrentOwner: mongoose.Types.ObjectId(req.userId),
                },
              ],
            },
          ],
        },
      },
      {
        $sort: oSortingOrder,
      },
      {
        $project: {
          _id: 1,
          sName: 1,
          eType: 1,
          nBasePrice: 1,
          collectionImage: 1,
          nQuantity: 1,
          nTokenID: 1,
          oCurrentOwner: 1,
          sTransactionStatus: 1,
          eAuctionType: 1,

          sGenre: 1,
          sBpm: 1,
          skey_equalTo: 1,
          skey_harmonicTo: 1,
          track_cover: 1,

          user_likes: {
            $size: {
              $filter: {
                input: "$user_likes",
                as: "user_likes",
                cond: {
                  $eq: ["$$user_likes", mongoose.Types.ObjectId(req.userId)],
                },
              },
            },
          },
          user_likes_size: {
            $cond: {
              if: {
                $isArray: "$user_likes",
              },
              then: {
                $size: "$user_likes",
              },
              else: 0,
            },
          },
        },
      },
      {
        $project: {
          _id: 1,
          sName: 1,
          eType: 1,
          nBasePrice: 1,
          collectionImage: 1,
          nQuantity: 1,
          nTokenID: 1,
          oCurrentOwner: 1,
          sTransactionStatus: 1,
          eAuctionType: 1,
          sGenre: 1,
          sBpm: 1,
          skey_equalTo: 1,
          skey_harmonicTo: 1,
          track_cover: 1,

          is_user_like: {
            $cond: {
              if: {
                $gte: ["$user_likes", 1],
              },
              then: "true",
              else: "false",
            },
          },
          user_likes_size: 1,
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "oCurrentOwner",
          foreignField: "_id",
          as: "oUser",
        },
      },
      { $unwind: "$oUser" },
      {
        $facet: {
          nfts: [
            {
              $skip: +nOffset,
            },
            {
              $limit: +nLimit,
            },
          ],
          totalCount: [
            {
              $count: "count",
            },
          ],
        },
      },
    ]);
    let iFiltered = data[0].nfts.length;
    if (data[0].totalCount[0] == undefined) {
      return res.reply(messages.success("Data"), {
        data: 0,
        draw: req.body.draw,
        recordsTotal: 0,
        recordsFiltered: iFiltered,
      });
    } else {
      return res.reply(messages.no_prefix("NFT Details"), {
        data: data[0].nfts,
        draw: req.body.draw,
        recordsTotal: data[0].totalCount[0].count,
        recordsFiltered: iFiltered,
      });
    }
  } catch (error) {
    return res.reply(messages.server_error());
  }
};

controllers.getHotCollections = async (req, res) => {
  try {
    let data = [];
    let setConditions = {};
    let sTextsearch = req.body.sTextsearch;
    const erc721 = req.body.erc721;

    if (req.body.conditions) {
      setConditions = req.body.conditions;
    }

    //sortKey is the column
    const sortKey = req.body.sortKey ? req.body.sortKey : "";

    //sortType will let you choose from ASC 1 or DESC -1
    const sortType = req.body.sortType ? req.body.sortType : -1;

    var sortObject = {};
    var stype = sortKey;
    var sdir = sortType;
    sortObject[stype] = sdir;

    let CollectionSearchArray = [];
    if (sTextsearch !== "") {
      CollectionSearchArray["sName"] = {
        $regex: new RegExp(sTextsearch),
        $options: "<options>",
      };
    }

    if (erc721 !== "" && erc721) {
      CollectionSearchArray["erc721"] = true;
    }
    if (erc721 !== "" && erc721 === false) {
      CollectionSearchArray["erc721"] = false;
    }
    let CollectionSearchObj = Object.assign({}, CollectionSearchArray);

    const page = parseInt(req.body.page);
    const limit = parseInt(req.body.limit);

    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;

    const results = {};

    if (
      endIndex < (await Collection.countDocuments(CollectionSearchObj).exec())
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

    let aCollections = await Collection.aggregate([
      {
        $lookup: {
          from: "users",
          localField: "oCreatedBy",
          foreignField: "_id",
          as: "oUser",
        },
      },
      {
        $sort: {
          sCreated: req.body.sortType,
        },
      },
      { $match: CollectionSearchObj },
      {
        $skip: (page - 1) * limit,
      },
      {
        $limit: limit,
      },
    ]);

    results.results = aCollections;
    results.count = await Collection.countDocuments(CollectionSearchObj).exec();
    console.log("Collections", data);
    res.header("Access-Control-Max-Age", 600);
    return res.reply(messages.no_prefix("Collections List"), results);
  } catch (e) {
    return res.reply(messages.error(e));
  }
};

controllers.collectionlistMy = async (req, res) => {
  try {
    if (!req.userId) return res.reply(messages.unauthorized());

    var nLimit = parseInt(req.body.length);
    var nOffset = parseInt(req.body.start);

    let query = {
      oCreatedBy: mongoose.Types.ObjectId(req.userId),
    };
    if (req && req.body.sTextsearch && req.body.sTextsearch != undefined) {
      query["sName"] = new RegExp(req.body.sTextsearch, "i");
    }

    let aCollections = await Collection.aggregate([
      {
        $match: query,
      },
      {
        $lookup: {
          from: "users",
          localField: "oCreatedBy",
          foreignField: "_id",
          as: "oUser",
        },
      },
      {
        $unwind: { preserveNullAndEmptyArrays: true, path: "$oUser" },
      },
      {
        $sort: {
          sCreated: -1,
        },
      },
      {
        $facet: {
          collections: [
            {
              $skip: +nOffset,
            },
            {
              $limit: +nLimit,
            },
          ],
          totalCount: [
            {
              $count: "count",
            },
          ],
        },
      },
    ]);

    let iFiltered = aCollections[0].collections.length;
    if (aCollections[0].totalCount[0] == undefined) {
      return res.reply(messages.success("Data"), {
        aCollections: 0,
        draw: req.body.draw,
        recordsTotal: 0,
        recordsFiltered: iFiltered,
      });
    } else {
      return res.reply(messages.no_prefix("Collection Details"), {
        data: aCollections[0].collections,
        draw: req.body.draw,
        recordsTotal: aCollections[0].totalCount[0].count,
        recordsFiltered: iFiltered,
      });
    }
  } catch (error) {
    return res.reply(messages.server_error());
  }
};

controllers.nftListing = async (req, res) => {
  try {
    var nLimit = parseInt(req.body.length);
    var nOffset = parseInt(req.body.start);
    let sBPMQuery = {};
    let sGenreQuery = {};
    let oTypeQuery = {},
      oSellingTypeQuery = {},
      oSortingOrder = {};
    let oTtextQuery = {
      sName: new RegExp(req.body.sTextsearch, "i"),
    };
    if (req.body.eType[0] != "All" && req.body.eType[0] != "") {
      oTypeQuery = {
        $or: [],
      };
      req.body.eType.forEach((element) => {
        oTypeQuery["$or"].push({
          eType: element,
        });
      });
    }
    if (
      req.body.sFrom &&
      req.body.sFrom != undefined &&
      req.body.sFrom != "" &&
      req.body.sTo &&
      req.body.sTo != undefined &&
      req.body.sTo != ""
    ) {
      sBPMQuery = {
        sBpm: { $gte: parseInt(req.body.sFrom), $lte: parseInt(req.body.sTo) },
      };
    }

    if (req.body.sSortingType == "Recently Added") {
      oSortingOrder["sCreated"] = -1;
    } else if (req.body.sSortingType == "Most Viewed") {
      oSortingOrder["nView"] = -1;
    } else if (req.body.sSortingType == "Price Low to High") {
      oSortingOrder["nBasePrice"] = 1;
    } else if (req.body.sSortingType == "Price High to Low") {
      oSortingOrder["nBasePrice"] = -1;
    } else {
      oSortingOrder["_id"] = -1;
    }

    if (
      req.body.sGenre &&
      req.body.sGenre != undefined &&
      req.body.sGenre.length
    ) {
      sGenreQuery = {
        sGenre: { $in: req.body.sGenre },
      };
    }

    if (req.body.sSellingType != "") {
      oSellingTypeQuery = {
        $or: [
          {
            eAuctionType: req.body.sSellingType,
          },
        ],
      };
    }

    let data = await NFT.aggregate([
      {
        $match: {
          $and: [
            {
              sTransactionStatus: {
                $eq: 1,
              },
            },
            {
              eAuctionType: {
                $ne: "Unlockable",
              },
            },
            oTypeQuery,
            oTtextQuery,
            oSellingTypeQuery,
            sBPMQuery,
            sGenreQuery,
          ],
        },
      },
      {
        $sort: oSortingOrder,
      },
      {
        $project: {
          _id: 1,
          sName: 1,
          eType: 1,
          nBasePrice: 1,
          collectionImage: 1,
          oCurrentOwner: 1,
          eAuctionType: 1,
          sGenre: 1,
          sBpm: 1,
          skey_equalTo: 1,
          skey_harmonicTo: 1,
          track_cover: 1,
          user_likes: {
            $size: {
              $filter: {
                input: "$user_likes",
                as: "user_likes",
                cond: {
                  $eq: [
                    "$$user_likes",
                    req.userId && req.userId != undefined && req.userId != null
                      ? mongoose.Types.ObjectId(req.userId)
                      : "",
                  ],
                },
              },
            },
          },
          user_likes_size: {
            $cond: {
              if: {
                $isArray: "$user_likes",
              },
              then: {
                $size: "$user_likes",
              },
              else: 0,
            },
          },
        },
      },
      {
        $project: {
          _id: 1,
          sName: 1,
          eType: 1,
          nBasePrice: 1,
          collectionImage: 1,
          oCurrentOwner: 1,
          eAuctionType: 1,
          sGenre: 1,
          sBpm: 1,
          skey_equalTo: 1,
          skey_harmonicTo: 1,
          track_cover: 1,
          is_user_like: {
            $cond: {
              if: {
                $gte: ["$user_likes", 1],
              },
              then: "true",
              else: "false",
            },
          },
          user_likes_size: 1,
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "oCurrentOwner",
          foreignField: "_id",
          as: "oUser",
        },
      },
      { $unwind: "$oUser" },
      {
        $facet: {
          nfts: [
            {
              $skip: +nOffset,
            },
            {
              $limit: +nLimit,
            },
          ],
          totalCount: [
            {
              $count: "count",
            },
          ],
        },
      },
    ]);
    let iFiltered = data[0].nfts.length;
    if (data[0].totalCount[0] == undefined) {
      return res.reply(messages.success("Data"), {
        data: 0,
        draw: req.body.draw,
        recordsTotal: 0,
        recordsFiltered: iFiltered,
      });
    } else {
      return res.reply(messages.no_prefix("NFT Details"), {
        data: data[0].nfts,
        draw: req.body.draw,
        recordsTotal: data[0].totalCount[0].count,
        recordsFiltered: iFiltered,
      });
    }
  } catch (error) {
    return res.reply(messages.server_error());
  }
};

controllers.nftID = async (req, res) => {
  try {
    if (!req.params.nNFTId) return res.reply(messages.not_found("NFT ID"));

    if (!validators.isValidObjectID(req.params.nNFTId))
      res.reply(messages.invalid("NFT ID"));

    let aNFT = await NFT.findById(req.params.nNFTId).populate({
      path: "nCreater",
      options: {
        limit: 1,
      },
      select: {
        sWalletAddress: 1,
        _id: 1,
        sProfilePicUrl: 1,
      },
    });

    if (!aNFT) return res.reply(messages.not_found("NFT"));
    aNFT = aNFT.toObject();
    aNFT.sCollectionDetail = {};

    aNFT.sCollectionDetail = await Collection.findOne({
      sName:
        aNFT.sCollection && aNFT.sCollection != undefined
          ? aNFT.sCollection
          : "-",
    });

    var token = req.headers.authorization;

    req.userId =
      req.userId && req.userId != undefined && req.userId != null
        ? req.userId
        : "";

    let likeARY =
      aNFT.user_likes && aNFT.user_likes.length
        ? aNFT.user_likes.filter((v) => v.toString() == req.userId.toString())
        : [];

    // if (likeARY && likeARY.length) {
    //   aNFT.is_user_like = "true";
    // } else {
    //   aNFT.is_user_like = "false";
    // }

    //
    if (token) {
      token = token.replace("Bearer ", "");
      jwt.verify(token, process.env.JWT_SECRET, function (err, decoded) {
        if (decoded) req.userId = decoded.id;
      });

      if (aNFT.oCurrentOwner._id != req.userId)
        await NFT.findByIdAndUpdate(req.params.nNFTId, {
          $inc: {
            nView: 1,
          },
        });
    }
    aNFT.loggedinUserId = req.userId;
    console.log("---------------------------8");

    if (!aNFT) {
      console.log("---------------------------9");

      return res.reply(messages.not_found("NFT"));
    }
    console.log("---------------------------10");

    return res.reply(messages.success(), aNFT);
  } catch (error) {
    return res.reply(messages.server_error());
  }
};

controllers.deleteNFT = async (req, res) => {
  try {
    if (!req.params.nNFTId) return res.reply(messages.not_found("NFT ID"));

    if (!validators.isValidObjectID(req.params.nNFTId))
      res.reply(messages.invalid("NFT ID"));

    await NFT.findByIdAndDelete(req.params.nNFTId);
    return res.reply(messages.success("NFT deleted"));
  } catch (error) {
    return res.reply(messages.server_error());
  }
};

controllers.getCollectionDetails = (req, res) => {
  try {
    // if (!req.userId) {
    //     return res.reply(messages.unauthorized());
    // }
    Collection.findOne({ _id: req.body.collectionId }, (err, collection) => {
      if (err) return res.reply(messages.server_error());
      if (!collection) return res.reply(messages.not_found("Collection"));
      return res.reply(messages.no_prefix("Collection Details"), collection);
    });
  } catch (error) {
    return res.reply(messages.server_error());
  }
};

// controllers.getCollectionDetailsByAddress = (req, res) => {
//   try {
//     Collection.findOne(
//       { sContractAddress: req.body.sContractAddress },
//       (err, collection) => {
//         if (err) return res.reply(messages.server_error());
//         if (!collection) return res.reply(messages.not_found("Collection"));
//         return res.reply(messages.no_prefix("Collection Details"), collection);
//       }
//     );
//   } catch (error) {
//     return res.reply(messages.server_error());
//   }
// };

controllers.setTransactionHash = async (req, res) => {
  try {
    // if (!req.body.nTokenID) return res.reply(messages.not_found("Token ID"));
    if (!req.body.nNFTId) return res.reply(messages.not_found("NFT ID"));
    if (!req.body.sTransactionHash)
      return res.reply(messages.not_found("Transaction Hash"));

    if (!validators.isValidObjectID(req.body.nNFTId))
      res.reply(messages.invalid("NFT ID"));
    // if (req.body.nTokenID <= 0) res.reply(messages.invalid("Token ID"));
    if (!validators.isValidTransactionHash(req.body.sTransactionHash))
      res.reply(messages.invalid("Transaction Hash"));

    NFT.findByIdAndUpdate(
      req.body.nNFTId,
      {
        // nTokenID: req.body.nTokenID,
        sTransactionHash: req.body.sTransactionHash,
        sTransactionStatus: 0,
      },
      (err, nft) => {
        if (err) return res.reply(messages.server_error());
        if (!nft) return res.reply(messages.not_found("NFT"));

        return res.reply(messages.updated("NFT Details"));
      }
    );
  } catch (error) {
    return res.reply(messages.server_error());
  }
};

controllers.landing = async (req, res) => {
  try {
    console.log("---------------------1");

    req.userId =
      req.userId && req.userId != undefined && req.userId != null
        ? req.userId
        : "";
    console.log("---------------------2", req.userId);

    let data = await NFT.aggregate([
      {
        $facet: {
          recentlyAdded: [
            {
              $match: {
                sTransactionStatus: {
                  $eq: 1,
                },
                eAuctionType: {
                  $ne: "Unlockable",
                },
              },
            },
            {
              $sort: {
                _id: -1,
              },
            },
            {
              $limit: 10,
            },
            {
              $lookup: {
                from: "users",
                localField: "oCurrentOwner",
                foreignField: "_id",
                as: "aCurrentOwner",
              },
            },
            { $unwind: "$aCurrentOwner" },
            {
              $project: {
                collectionImage: 1,
                eType: 1,
                sCreated: 1,
                oCurrentOwner: 1,
                oPostedBy: 1,
                sCollection: 1,
                sName: 1,
                sCollaborator: 1,
                sNftdescription: 1,
                nCollaboratorPercentage: 1,
                sSetRRoyaltyPercentage: 1,
                nQuantity: 1,
                nView: 1,
                nBasePrice: 1,
                eAuctionType: 1,
                nTokenID: 1,
                sTransactionHash: 1,
                sTransactionStatus: 1,
                aCurrentOwner: 1,
                sGenre: 1,
                sBpm: 1,
                skey_equalTo: 1,
                skey_harmonicTo: 1,
                track_cover: 1,
                user_likes: {
                  $size: {
                    $filter: {
                      input: "$user_likes",
                      as: "user_likes",
                      cond: {
                        $eq: [
                          "$$user_likes",
                          req.userId &&
                          req.userId != undefined &&
                          req.userId != null
                            ? mongoose.Types.ObjectId(req.userId)
                            : "",
                        ],
                      },
                    },
                  },
                },
                user_likes_size: {
                  $cond: {
                    if: {
                      $isArray: "$user_likes",
                    },
                    then: {
                      $size: "$user_likes",
                    },
                    else: 0,
                  },
                },
              },
            },
            {
              $project: {
                collectionImage: 1,
                eType: 1,
                sCreated: 1,
                oCurrentOwner: 1,
                oPostedBy: 1,
                sCollection: 1,
                sName: 1,
                sCollaborator: 1,
                sNftdescription: 1,
                nCollaboratorPercentage: 1,
                sSetRRoyaltyPercentage: 1,
                nQuantity: 1,
                nView: 1,
                nBasePrice: 1,
                eAuctionType: 1,
                nTokenID: 1,
                sGenre: 1,
                sBpm: 1,
                skey_equalTo: 1,
                skey_harmonicTo: 1,
                track_cover: 1,
                sTransactionHash: 1,
                sTransactionStatus: 1,
                aCurrentOwner: 1,
                is_user_like: {
                  $cond: {
                    if: {
                      $gte: ["$user_likes", 1],
                    },
                    then: "true",
                    else: "false",
                  },
                },
                user_likes_size: 1,
              },
            },
          ],
          onSale: [
            {
              $match: {
                sTransactionStatus: {
                  $eq: 1,
                },
                eAuctionType: {
                  $eq: "Fixed Sale",
                },
              },
            },
            {
              $sort: {
                _id: -1,
              },
            },
            {
              $limit: 10,
            },
            {
              $lookup: {
                from: "users",
                localField: "oCurrentOwner",
                foreignField: "_id",
                as: "aCurrentOwner",
              },
            },
            { $unwind: "$aCurrentOwner" },
            {
              $project: {
                collectionImage: 1,
                eType: 1,
                sCreated: 1,
                oCurrentOwner: 1,
                oPostedBy: 1,
                sCollection: 1,
                sName: 1,
                sCollaborator: 1,
                sNftdescription: 1,
                nCollaboratorPercentage: 1,
                sSetRRoyaltyPercentage: 1,
                nQuantity: 1,
                nView: 1,
                nBasePrice: 1,
                eAuctionType: 1,
                sGenre: 1,
                sBpm: 1,
                skey_equalTo: 1,
                skey_harmonicTo: 1,
                track_cover: 1,
                nTokenID: 1,
                sTransactionHash: 1,
                sTransactionStatus: 1,
                aCurrentOwner: 1,
                user_likes: {
                  $size: {
                    $filter: {
                      input: "$user_likes",
                      as: "user_likes",
                      cond: {
                        $eq: [
                          "$$user_likes",
                          req.userId &&
                          req.userId != undefined &&
                          req.userId != null
                            ? mongoose.Types.ObjectId(req.userId)
                            : "",
                        ],
                      },
                    },
                  },
                },
                user_likes_size: {
                  $cond: {
                    if: {
                      $isArray: "$user_likes",
                    },
                    then: {
                      $size: "$user_likes",
                    },
                    else: 0,
                  },
                },
              },
            },
            {
              $project: {
                collectionImage: 1,
                eType: 1,
                sCreated: 1,
                oCurrentOwner: 1,
                oPostedBy: 1,
                sCollection: 1,
                sName: 1,
                sCollaborator: 1,
                sNftdescription: 1,
                nCollaboratorPercentage: 1,
                sSetRRoyaltyPercentage: 1,
                nQuantity: 1,
                sGenre: 1,
                sBpm: 1,
                skey_equalTo: 1,
                skey_harmonicTo: 1,
                track_cover: 1,
                nView: 1,
                nBasePrice: 1,
                eAuctionType: 1,
                nTokenID: 1,
                sTransactionHash: 1,
                sTransactionStatus: 1,
                aCurrentOwner: 1,
                is_user_like: {
                  $cond: {
                    if: {
                      $gte: ["$user_likes", 1],
                    },
                    then: "true",
                    else: "false",
                  },
                },
                user_likes_size: 1,
              },
            },
          ],
          onAuction: [
            {
              $match: {
                sTransactionStatus: {
                  $eq: 1,
                },
                eAuctionType: {
                  $eq: "Auction",
                },
              },
            },
            {
              $sort: {
                _id: -1,
              },
            },
            {
              $limit: 10,
            },
            {
              $lookup: {
                from: "users",
                localField: "oCurrentOwner",
                foreignField: "_id",
                as: "aCurrentOwner",
              },
            },
            { $unwind: "$aCurrentOwner" },
            {
              $project: {
                collectionImage: 1,
                eType: 1,
                sCreated: 1,
                oCurrentOwner: 1,
                oPostedBy: 1,
                sCollection: 1,
                sName: 1,
                sCollaborator: 1,
                sNftdescription: 1,
                nCollaboratorPercentage: 1,
                sSetRRoyaltyPercentage: 1,
                nQuantity: 1,
                nView: 1,
                sGenre: 1,
                sBpm: 1,
                skey_equalTo: 1,
                skey_harmonicTo: 1,
                track_cover: 1,
                nBasePrice: 1,
                eAuctionType: 1,
                nTokenID: 1,
                sTransactionHash: 1,
                sTransactionStatus: 1,
                aCurrentOwner: 1,
                user_likes: {
                  $size: {
                    $filter: {
                      input: "$user_likes",
                      as: "user_likes",
                      cond: {
                        $eq: [
                          "$$user_likes",
                          req.userId &&
                          req.userId != undefined &&
                          req.userId != null
                            ? mongoose.Types.ObjectId(req.userId)
                            : "",
                        ],
                      },
                    },
                  },
                },
                user_likes_size: {
                  $cond: {
                    if: {
                      $isArray: "$user_likes",
                    },
                    then: {
                      $size: "$user_likes",
                    },
                    else: 0,
                  },
                },
              },
            },
            {
              $project: {
                collectionImage: 1,
                eType: 1,
                sCreated: 1,
                oCurrentOwner: 1,
                oPostedBy: 1,
                sCollection: 1,
                sName: 1,
                sCollaborator: 1,
                sNftdescription: 1,
                sGenre: 1,
                sBpm: 1,
                skey_equalTo: 1,
                skey_harmonicTo: 1,
                track_cover: 1,
                nCollaboratorPercentage: 1,
                sSetRRoyaltyPercentage: 1,
                nQuantity: 1,
                nView: 1,
                nBasePrice: 1,
                eAuctionType: 1,
                nTokenID: 1,
                sTransactionHash: 1,
                sTransactionStatus: 1,
                aCurrentOwner: 1,
                is_user_like: {
                  $cond: {
                    if: {
                      $gte: ["$user_likes", 1],
                    },
                    then: "true",
                    else: "false",
                  },
                },
                user_likes_size: 1,
              },
            },
          ],
        },
      },
    ]);
    console.log("---------------------data", data);

    data[0].users = [];
    data[0].users = await User.find({ sRole: "user" });

    let agQuery = [
      {
        $lookup: {
          from: "users",
          localField: "oCreatedBy",
          foreignField: "_id",
          as: "oUser",
        },
      },
      {
        $sort: {
          sCreated: -1,
        },
      },
      { $unwind: "$oUser" },
    ];

    data[0].collections = [];
    data[0].collections = await Collection.aggregate(agQuery);
    return res.reply(messages.success(), data[0]);
  } catch (error) {
    return res.reply(messages.server_error());
  }
};

controllers.toggleSellingType = async (req, res) => {
  try {
    if (!req.userId) return res.reply(messages.unauthorized());

    if (!req.body.nNFTId) return res.reply(messages.not_found("NFT ID"));
    if (!req.body.sSellingType)
      return res.reply(messages.not_found("Selling Type"));

    if (!validators.isValidObjectID(req.body.nNFTId))
      return res.reply(messages.invalid("NFT ID"));
    if (!validators.isValidSellingType(req.body.sSellingType))
      return res.reply(messages.invalid("Selling Type"));

    let oNFT = await NFT.findById(req.body.nNFTId);

    if (!oNFT) return res.reply(messages.not_found("NFT"));
    if (oNFT.oCurrentOwner != req.userId)
      return res.reply(
        message.bad_request("Only NFT Owner Can Set Selling Type")
      );

    let BIdsExist = await Bid.find({
      oNFTId: mongoose.Types.ObjectId(req.body.nNFTId),
      sTransactionStatus: 1,
      eBidStatus: "Bid",
    });

    if (BIdsExist && BIdsExist != undefined && BIdsExist.length) {
      return res.reply(
        messages.bad_request("Please Cancel Active bids on this NFT.")
      );
    } else {
      let updObj = {
        eAuctionType: req.body.sSellingType,
      };

      if (req.body.auction_end_date && req.body.auction_end_date != undefined) {
        updObj.auction_end_date = req.body.auction_end_date;
      }
      NFT.findByIdAndUpdate(req.body.nNFTId, updObj, (err, nft) => {
        if (err) return res.reply(messages.server_error());
        if (!nft) return res.reply(messages.not_found("NFT"));

        return res.reply(messages.updated("NFT Details"));
      });
    }
  } catch (error) {
    return res.reply(messages.server_error());
  }
};

controllers.allCollectionWiselist = async (req, res) => {
  console.log("------data--------", req.body);
  //    let agQuery = [ {
  //         '$lookup': {
  //             'from': 'users',
  //             'localField': 'oCreatedBy',
  //             'foreignField': '_id',
  //             'as': 'oUser'
  //         }
  //     }, {
  //         '$sort': {
  //             'sCreated': -1
  //         }
  //     }]

  try {
    //         let aCollections = await Collection.aggregate(agQuery);

    //         if (!aCollections) {
    //             return res.reply(messages.not_found('collection'));
    //         }

    //         return res.reply(messages.no_prefix('Collection Details'), aCollections);

    //     } catch (error) {
    //         return res.reply(messages.server_error());
    //     }

    var nLimit = parseInt(req.body.length);
    var nOffset = parseInt(req.body.start);
    let oTypeQuery = {},
      oSellingTypeQuery = {},
      oCollectionQuery = {},
      oSortingOrder = {};
    let oTtextQuery = {
      sName: new RegExp(req.body.sTextsearch, "i"),
    };
    if (req.body.eType[0] != "All" && req.body.eType[0] != "") {
      oTypeQuery = {
        $or: [],
      };
      req.body.eType.forEach((element) => {
        oTypeQuery["$or"].push({
          eType: element,
        });
      });
    }
    if (req.body.sCollection != "All" && req.body.sCollection != "") {
      oCollectionQuery = {
        $or: [],
      };
      oCollectionQuery["$or"].push({
        sCollection: req.body.sCollection,
      });
    }

    if (req.body.sSortingType == "Recently Added") {
      oSortingOrder["sCreated"] = -1;
    } else if (req.body.sSortingType == "Most Viewed") {
      oSortingOrder["nView"] = -1;
    } else if (req.body.sSortingType == "Price Low to High") {
      oSortingOrder["nBasePrice"] = 1;
    } else if (req.body.sSortingType == "Price High to Low") {
      oSortingOrder["nBasePrice"] = -1;
    } else {
      oSortingOrder["_id"] = -1;
    }

    if (req.body.sSellingType != "") {
      oSellingTypeQuery = {
        $or: [
          {
            eAuctionType: req.body.sSellingType,
          },
        ],
      };
    }

    let data = await NFT.aggregate([
      {
        $match: {
          $and: [
            {
              sTransactionStatus: {
                $eq: 1,
              },
            },
            {
              eAuctionType: {
                $ne: "Unlockable",
              },
            },
            oTypeQuery,
            oCollectionQuery,
            oTtextQuery,
            oSellingTypeQuery,
          ],
        },
      },
      {
        $sort: oSortingOrder,
      },
      {
        $project: {
          _id: 1,
          sName: 1,
          eType: 1,
          nBasePrice: 1,
          collectionImage: 1,
          oCurrentOwner: 1,
          eAuctionType: 1,
          sCollection: 1,
          sGenre: 1,
          sBpm: 1,
          skey_equalTo: 1,
          skey_harmonicTo: 1,
          track_cover: 1,
          user_likes: {
            $size: {
              $filter: {
                input: "$user_likes",
                as: "user_likes",
                cond: {
                  $eq: [
                    "$$user_likes",
                    req.userId && req.userId != undefined && req.userId != null
                      ? mongoose.Types.ObjectId(req.userId)
                      : "",
                  ],
                },
              },
            },
          },
          user_likes_size: {
            $cond: {
              if: {
                $isArray: "$user_likes",
              },
              then: {
                $size: "$user_likes",
              },
              else: 0,
            },
          },
        },
      },
      {
        $project: {
          _id: 1,
          sName: 1,
          eType: 1,
          nBasePrice: 1,
          collectionImage: 1,
          oCurrentOwner: 1,
          eAuctionType: 1,
          sCollection: 1,
          sGenre: 1,
          sBpm: 1,
          skey_equalTo: 1,
          skey_harmonicTo: 1,
          track_cover: 1,
          is_user_like: {
            $cond: {
              if: {
                $gte: ["$user_likes", 1],
              },
              then: "true",
              else: "false",
            },
          },
          user_likes_size: 1,
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "oCurrentOwner",
          foreignField: "_id",
          as: "oUser",
        },
      },
      { $unwind: "$oUser" },
      {
        $facet: {
          nfts: [
            {
              $skip: +nOffset,
            },
            {
              $limit: +nLimit,
            },
          ],
          totalCount: [
            {
              $count: "count",
            },
          ],
        },
      },
    ]);
    let iFiltered = data[0].nfts.length;
    if (data[0].totalCount[0] == undefined) {
      return res.reply(messages.success("Data"), {
        data: 0,
        draw: req.body.draw,
        recordsTotal: 0,
        recordsFiltered: iFiltered,
      });
    } else {
      return res.reply(messages.no_prefix("NFT Details"), {
        data: data[0].nfts,
        draw: req.body.draw,
        recordsTotal: data[0].totalCount[0].count,
        recordsFiltered: iFiltered,
      });
    }
  } catch (error) {
    return res.reply(messages.server_error());
  }
};

controllers.updateBasePrice = async (req, res) => {
  try {
    if (!req.userId) return res.reply(messages.unauthorized());

    console.log(req.body);
    if (!req.body.nNFTId) return res.reply(messages.not_found("NFT ID"));
    if (!req.body.nBasePrice)
      return res.reply(messages.not_found("Base Price"));

    if (!validators.isValidObjectID(req.body.nNFTId))
      return res.reply(messages.invalid("NFT ID"));
    if (
      isNaN(req.body.nBasePrice) ||
      parseFloat(req.body.nBasePrice) <= 0 ||
      parseFloat(req.body.nBasePrice) <= 0.000001
    )
      return res.reply(messages.invalid("Base Price"));

    let oNFT = await NFT.findById(req.body.nNFTId);

    if (!oNFT) return res.reply(messages.not_found("NFT"));
    if (oNFT.oCurrentOwner != req.userId)
      return res.reply(
        message.bad_request("Only NFT Owner Can Set Base Price")
      );

    let BIdsExist = await Bid.find({
      oNFTId: mongoose.Types.ObjectId(req.body.nNFTId),
      sTransactionStatus: 1,
      eBidStatus: "Bid",
    });

    if (BIdsExist && BIdsExist != undefined && BIdsExist.length) {
      return res.reply(
        messages.bad_request("Please Cancel Active bids on this NFT.")
      );
    } else {
      NFT.findByIdAndUpdate(
        req.body.nNFTId,
        {
          nBasePrice: req.body.nBasePrice,
        },
        (err, nft) => {
          if (err) return res.reply(messages.server_error());
          if (!nft) return res.reply(messages.not_found("NFT"));

          return res.reply(messages.updated("Price"));
        }
      );
    }
  } catch (error) {
    console.log(error);
    return res.reply(messages.server_error());
  }
};

controllers.updateNftOrder = async (req, res) => {
  try {
    if (!req.userId) return res.reply(messages.unauthorized());
    console.log("request is--->", JSON.stringify(req.body));
    console.log("id is--->", req.body._id);

    let sId = await NFT.findById(req.body._id);
    let nftownerID = req.body.nftownerID;

    if (!sId) return res.reply(messages.not_found("NFT"));

    await NFTowners.findByIdAndUpdate(nftownerID, {
      sOrder: req.body.sOrder,
      sSignature: req.body.sSignature,
      sTransactionStatus: 1,
      nBasePrice: req.body.nBasePrice,
    }).then((err, nftowner) => {
      console.log("Error Update is " + JSON.stringify(err));
    });

    NFTowners.findByIdAndUpdate(
      nftownerID,
      { $inc: { nQuantityLeft: -req.body.putOnSaleQty } },
      { new: true },
      function (err, response) {}
    );
    if (req.body.erc721) {
      await NFT.findByIdAndUpdate(sId, {
        sOrder: req.body.sOrder,
        sSignature: req.body.sSignature,
        sTransactionStatus: 1,
        nBasePrice: req.body.nBasePrice,
      }).then((err, nft) => {
        console.log("Updating By ID" + nftownerID);
        return res.reply(messages.success("Order Created"));
      });
    } else {
      return res.reply(messages.success("Order Created"));
    }
  } catch (e) {
    console.log("Error is " + e);
    return res.reply(messages.server_error());
  }
};

controllers.uploadImage = async (req, res) => {
  try {
    allowedMimes = ["image/jpeg", "image/jpg", "image/png", "image/gif"];
    errAllowed = "JPG, JPEG, PNG,GIF";

    upload(req, res, function (error) {
      if (error) {
        //instanceof multer.MulterError
        fs.unlinkSync(req.file.path);
        return res.reply(messages.bad_request(error.message));
      } else {
        if (!req.file) {
          fs.unlinkSync(req.file.path);
          return res.reply(messages.not_found("File"));
        }

        const oOptions = {
          pinataMetadata: {
            name: req.file.originalname,
          },
          pinataOptions: {
            cidVersion: 0,
          },
        };
        const readableStreamForFile = fs.createReadStream(req.file.path);
        let testFile = fs.readFileSync(req.file.path);
        //Creating buffer for ipfs function to add file to the system
        let testBuffer = new Buffer(testFile);
        try {
          pinata
            .pinFileToIPFS(readableStreamForFile, oOptions)
            .then(async (result) => {
              fs.unlinkSync(req.file.path);
              return res.reply(messages.created("Collection"), {
                track_cover: result.IpfsHash,
              });
            })
            .catch((err) => {
              //handle error here
              return res.reply(messages.error());
            });
        } catch (err) {
          console.log("err", err);
        }
      }
    });
  } catch (error) {
    return res.reply(messages.server_error());
  }
};

controllers.getAllNfts = async (req, res) => {
  try {
    let aNft = await NFT.find({})
      .select({
        nTitle: 1,
        nCollection: 1,
        nHash: 1,
        nLazyMintingStatus: 1,
        nNftImage: 1,
      })
      .populate({
        path: "nOrders",
        options: {
          limit: 1,
        },
        select: {
          oPrice: 1,
          oType: 1,
          oValidUpto: 1,
          auction_end_date: 1,
          oStatus: 1,
          _id: 0,
        },
      })
      .populate({
        path: "nCreater",
        options: {
          limit: 1,
        },
        select: {
          _id: 0,
        },
      })
      .limit(limit)
      .skip(startIndex)
      .exec()
      .then((res) => {
        data.push(res);
      })
      .catch((e) => {
        console.log("Error", e);
      });

    results.results = data;
    console.log("Collections", aNft);

    if (!aNft) {
      return res.reply(messages.not_found("nft"));
    }
    return res.reply(messages.no_prefix("nfts List"), aNft);
  } catch (e) {
    return res.reply(messages.error(e));
  }
};

controllers.setNFTOrder = async (req, res) => {
  try {
    let aNft = await NFT.findById(req.body.nftId);
    if (!aNft) {
      return res.reply(messages.not_found("nft"));
    }

    aNft.nOrders.push(req.body.orderId);
    await aNft.save();

    return res.reply(messages.updated("nfts List"), aNft);
  } catch (e) {
    return res.reply(messages.error(e));
  }
};

controllers.getOnSaleItems = async (req, res) => {
  try {
    let data = [];
    let OrderSearchArray = [];
    let sSellingType = req.body.sSellingType;
    let sTextsearch = req.body.sTextsearch;
    let itemType = req.body.itemType;
    const page = parseInt(req.body.page);
    const limit = parseInt(req.body.limit);

    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;

    OrderSearchArray["oStatus"] = 1;
    if (sSellingType !== "") {
      OrderSearchArray["oType"] = sSellingType;
    }
    let OrderSearchObj = Object.assign({}, OrderSearchArray);
    let OrderIdsss = await Order.distinct("oNftId", OrderSearchObj);

    let NFTSearchArray = [];
    NFTSearchArray["_id"] = { $in: OrderIdsss.map(String) };
    if (sTextsearch !== "") {
      NFTSearchArray["nTitle"] = {
        $regex: new RegExp(sTextsearch),
        $options: "<options>",
      };
    }
    if (itemType !== "") {
      NFTSearchArray["nType"] = itemType;
    }
    let NFTSearchObj = Object.assign({}, NFTSearchArray);
    const results = {};
    if (endIndex < (await NFT.countDocuments(NFTSearchObj).exec())) {
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

    await NFT.find(NFTSearchObj)
      .sort({ nCreated: -1 })
      .select({
        nTitle: 1,
        nCollection: 1,
        nHash: 1,
        nType: 1,
        nUser_likes: 1,
        nNftImage: 1,
        nLazyMintingStatus: 1,
      })
      .populate({
        path: "nCreater",
        options: {
          limit: 1,
        },
        select: {
          _id: 1,
          sProfilePicUrl: 1,
          sWalletAddress: 1,
        },
      })
      .populate({
        path: "nOrders",
        options: {
          limit: 1,
        },
        select: {
          oPrice: 1,
          oType: 1,
          oValidUpto: 1,
          oStatus: 1,
          _id: 0,
        },
      })
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

    results.count = await NFT.countDocuments(NFTSearchObj).exec();
    results.results = data;
    res.header("Access-Control-Max-Age", 600);
    return res.reply(messages.success("Order List"), results);
  } catch (error) {
    console.log("Error:", error);
    return res.reply(messages.error());
  }
};

controllers.getOwnedNFTlist = async (req, res) => {
  try {
    let data = [];
    console.log("req", req.body);
    //sortKey is the column
    const sortKey = req.body.sortKey ? req.body.sortKey : "";

    //sortType will let you choose from ASC 1 or DESC -1
    const sortType = req.body.sortType ? req.body.sortType : -1;

    var sortObject = {};
    var stype = sortKey;
    var sdir = sortType;
    sortObject[stype] = sdir;

    const page = parseInt(req.body.page);
    const limit = parseInt(req.body.limit);

    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;

    const results = {};

    if (req.body.searchType === "owned") {
      if (
        endIndex <
        (await NFT.countDocuments({
          ownedBy: {
            $elemMatch: {
              address: req.body.userWalletAddress,
              quantity: { $gt: 0 },
            },
          },
        }).exec())
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

      await NFT.find({
        ownedBy: {
          $elemMatch: {
            address: req.body.userWalletAddress,
            quantity: { $gt: 0 },
          },
        },
      })
        .select({
          name: 1,
          collectionID: 1,
          hash: 1,
          image: 1,
          lazyMintingStatus: 1,
        })
        .populate("collectionID")
        .populate({
          path: "createdBy",
          options: {
            limit: 1,
          },
          select: {
            _id: 1,
            profileIcon: 1,
            walletAddress: 1,
          },
        })
        .limit(limit)
        .skip(startIndex)
        .exec()
        .then((res) => {
          console.log("dataa", res);
          data.push(res);
        })
        .catch((e) => {
          console.log("Error", e);
        });

      // console.log("ress", resust);
      results.count = await NFT.countDocuments({
        ownedBy: {
          $elemMatch: {
            address: req.body.userWalletAddress,
            quantity: { $gt: 0 },
          },
        },
      }).exec();
    } else {
      if (
        endIndex <
        (await NFT.countDocuments({
          nCreater: { $in: [mongoose.Types.ObjectId(req.body.userId)] },
        }).exec())
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

      await NFT.find({
        createdBy: { $in: [mongoose.Types.ObjectId(req.body.userId)] },
      })
        .select({
          name: 1,
          collectionID: 1,
          hash: 1,
          image: 1,
          lazyMintingStatus: 1,
        })
        .populate("collectionID")
        .populate({
          path: "createdBy",
          options: {
            limit: 1,
          },
          select: {
            _id: 1,
            profileIcon: 1,
            walletAddress: 1,
          },
        })
        .limit(limit)
        .skip(startIndex)
        .exec()
        .then((res) => {
          console.log("dataa", res);
          data.push(res);
        })
        .catch((e) => {
          console.log("Error", e);
        });

      // console.log("ress", resust);
      results.count = await NFT.countDocuments({
        createdBy: { $in: [mongoose.Types.ObjectId(req.body.userId)] },
      }).exec();
    }

    results.results = data;

    return res.reply(messages.success("NFTs List"), results);
  } catch (error) {
    console.log("Error:", error);
    return res.reply(messages.error());
  }
};

controllers.getUserLikedNfts = async (req, res) => {
  try {
    let data = [];

    if (!req.body.userId)
      res.reply(messages.invalid_req("User Id is required"));

    //sortKey is the column
    const sortKey = req.body.sortKey ? req.body.sortKey : "";

    //sortType will let you choose from ASC 1 or DESC -1
    const sortType = req.body.sortType ? req.body.sortType : -1;

    var sortObject = {};
    var stype = sortKey;
    var sdir = sortType;
    sortObject[stype] = sdir;

    const page = parseInt(req.body.page);
    const limit = parseInt(req.body.limit);

    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;

    const results = {};

    if (
      endIndex <
      (await NFT.countDocuments({
        nUser_likes: { $in: [mongoose.Types.ObjectId(req.body.userId)] },
      }).exec())
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

    await NFT.find({
      nUser_likes: { $in: [mongoose.Types.ObjectId(req.body.userId)] },
    })
      .select({
        nTitle: 1,
        nCollection: 1,
        nHash: 1,
        nType: 1,
        nUser_likes: 1,
        nNftImage: 1,
        nLazyMintingStatus: 1,
      })
      .populate({
        path: "nOrders",
        options: {
          limit: 1,
        },
        select: {
          oPrice: 1,
          oType: 1,
          oValidUpto: 1,
          auction_end_date: 1,
          oStatus: 1,
          _id: 0,
        },
      })
      .populate({
        path: "nCreater",
        options: {
          limit: 1,
        },
        select: {
          _id: 1,
          sProfilePicUrl: 1,
          sWalletAddress: 1,
        },
      })
      .limit(limit)
      .skip(startIndex)
      .exec()
      .then((res) => {
        data.push(res);
      })
      .catch((e) => {
        console.log("Error", e);
      });

    results.count = await NFT.countDocuments({
      nUser_likes: { $in: [mongoose.Types.ObjectId(req.body.userId)] },
    }).exec();
    results.results = data;

    return res.reply(messages.success("NFTs List Liked By User"), results);
  } catch (error) {
    console.log("Error:", error);
    return res.reply(messages.error());
  }
};

controllers.getUserOnSaleNfts = async (req, res) => {
  try {
    console.log("req", req.body);
    let data = [];

    let query = {};
    let orderQuery = {};

    orderQuery["oSeller"] = mongoose.Types.ObjectId(req.body.userId);
    orderQuery["oStatus"] = 1; // we are getting only active orders

    if (req.body.hasOwnProperty("search")) {
      for (var key in req.body.search) {
        //could also be req.query and req.params
        req.body.search[key] !== ""
          ? (query[key] = req.body.search[key])
          : null;
      }
    }

    if (req.body.hasOwnProperty("searchOrder")) {
      for (var key in req.body.searchOrder) {
        //could also be req.query and req.params
        req.body.searchOrder[key] !== ""
          ? (orderQuery[key] = req.body.searchOrder[key])
          : null;
      }
    }

    console.log("orderQuery", orderQuery);
    //select unique NFTids for status 1 and userId supplied
    let OrderIdsss = await Order.distinct("oNftId", orderQuery);
    console.log("order idss", OrderIdsss);
    //return if no active orders found
    if (OrderIdsss.length < 1) return res.reply(messages.not_found());

    //set nftQuery
    query["_id"] = { $in: OrderIdsss };

    //sortKey is the column
    const sortKey = req.body.sortKey ? req.body.sortKey : "";

    //sortType will let you choose from ASC 1 or DESC -1
    const sortType = req.body.sortType ? req.body.sortType : -1;

    var sortObject = {};
    var stype = sortKey;
    var sdir = sortType;
    sortObject[stype] = sdir;

    const page = parseInt(req.body.page);
    const limit = parseInt(req.body.limit);

    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;

    const results = {};

    if (
      endIndex < (await NFT.countDocuments({ _id: { $in: OrderIdsss } }).exec())
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

    await NFT.find({ _id: { $in: OrderIdsss } })
      .select({
        nTitle: 1,
        nCollection: 1,
        nHash: 1,
        nType: 1,
        nUser_likes: 1,
        nNftImage: 1,
        nLazyMintingStatus: 1,
      })
      .populate({
        path: "nOrders",
        options: {
          limit: 1,
        },
        select: {
          oPrice: 1,
          oType: 1,
          oValidUpto: 1,
          auction_end_date: 1,
          oStatus: 1,
          _id: 0,
        },
      })
      .populate({
        path: "nCreater",
        options: {
          limit: 1,
        },
        select: {
          _id: 1,
          sProfilePicUrl: 1,
          sWalletAddress: 1,
        },
      })
      .limit(limit)
      .skip(startIndex)
      .exec()
      .then((res) => {
        data.push(res);
      })
      .catch((e) => {
        console.log("Error", e);
      });

    results.count = await NFT.countDocuments({
      _id: { $in: OrderIdsss },
    }).exec();
    results.results = data;

    return res.reply(messages.success("NFTs List Liked By User"), results);
  } catch (error) {
    console.log("Error:", error);
    return res.reply(messages.error());
  }
};

controllers.transferNfts = async (req, res) => {
  //deduct previous owner
  console.log("req", req.body);
  try {
    if (!req.userId) return res.reply(messages.unauthorized());

    let _NFT = await NFT.findOne({
      _id: mongoose.Types.ObjectId(req.body.nftId),
      "nOwnedBy.address": req.body.sender,
    }).select("nOwnedBy -_id");

    console.log("_NFT-------->", _NFT);
    let currentQty = _NFT.nOwnedBy.find(
      (o) => o.address === req.body.sender.toLowerCase()
    ).quantity;
    let boughtQty = parseInt(req.body.qty);
    let leftQty = currentQty - boughtQty;
    if (leftQty < 1) {
      await NFT.findOneAndUpdate(
        { _id: mongoose.Types.ObjectId(req.body.nftId) },
        {
          $pull: {
            nOwnedBy: { address: req.body.sender },
          },
        }
      ).catch((e) => {
        console.log("Error1", e.message);
      });
    } else {
      await NFT.findOneAndUpdate(
        {
          _id: mongoose.Types.ObjectId(req.body.nftId),
          "nOwnedBy.address": req.body.sender,
        },
        {
          $set: {
            "nOwnedBy.$.quantity": parseInt(leftQty),
          },
        }
      ).catch((e) => {
        console.log("Error2", e.message);
      });
    }

    //Credit the buyer
    console.log("Crediting Buyer");

    let subDocId = await NFT.exists({
      _id: mongoose.Types.ObjectId(req.body.nftId),
      "nOwnedBy.address": req.body.receiver,
    });
    if (subDocId) {
      console.log("Subdocument Id", subDocId);

      let _NFTB = await NFT.findOne({
        _id: mongoose.Types.ObjectId(req.body.nftId),
        "nOwnedBy.address": req.body.receiver,
      }).select("nOwnedBy -_id");
      console.log("_NFTB-------->", _NFTB);
      console.log(
        "Quantity found for receiver",
        _NFTB.nOwnedBy.find(
          (o) => o.address === req.body.receiver.toLowerCase()
        ).quantity
      );
      currentQty = _NFTB.nOwnedBy.find(
        (o) => o.address === req.body.receiver.toLowerCase()
      ).quantity
        ? parseInt(
            _NFTB.nOwnedBy.find(
              (o) => o.address === req.body.receiver.toLowerCase()
            ).quantity
          )
        : 0;
      boughtQty = req.body.qty;
      let ownedQty = currentQty + boughtQty;

      await NFT.findOneAndUpdate(
        {
          _id: mongoose.Types.ObjectId(req.body.nftId),
          "nOwnedBy.address": req.body.receiver,
        },
        {
          $set: {
            "nOwnedBy.$.quantity": parseInt(ownedQty),
          },
        },
        { upsert: true, runValidators: true }
      ).catch((e) => {
        console.log("Error1", e.message);
      });
    } else {
      console.log("Subdocument Id not found");
      let dataToadd = {
        address: req.body.receiver,
        quantity: parseInt(req.body.qty),
      };
      await NFT.findOneAndUpdate(
        { _id: mongoose.Types.ObjectId(req.body.nftId) },
        { $addToSet: { nOwnedBy: dataToadd } },
        { upsert: true }
      );
      console.log("wasn't there but added");
    }
    return res.reply(messages.updated("NFT"));
  } catch (e) {
    console.log("errr", e);
    return res.reply(messages.error());
  }
};

controllers.getCollectionNFT = async (req, res) => {
  try {
    let data = [];
    let collection = req.body.collection;

    const sortKey = req.body.sortKey ? req.body.sortKey : "";
    //sortType will let you choose from ASC 1 or DESC -1
    const sortType = req.body.sortType ? req.body.sortType : -1;

    var sortObject = {};
    var stype = sortKey;
    var sdir = sortType;
    sortObject[stype] = sdir;

    const page = parseInt(req.body.page);
    const limit = parseInt(req.body.limit);

    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const results = {};
    let orderQuery = {};

    orderQuery["oStatus"] = 1; // we are getting only active orders

    let OrderIdsss = await Order.distinct("oNftId", orderQuery);

    if (
      endIndex <
      (await NFT.countDocuments({
        nCollection: collection,
        _id: { $in: OrderIdsss },
      }).exec())
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

    await NFT.find({ nCollection: collection, _id: { $in: OrderIdsss } })
      .select({
        nTitle: 1,
        nCollection: 1,
        nHash: 1,
        nCreater: 1,
        nType: 1,
        nUser_likes: 1,
        nNftImage: 1,
        nLazyMintingStatus: 1,
      })
      .populate({
        path: "nOrders",
        options: {
          limit: 1,
        },
        select: {
          oPrice: 1,
          oType: 1,
          oValidUpto: 1,
          auction_end_date: 1,
          oStatus: 1,
          _id: 0,
        },
      })
      .populate({
        path: "nCreater",
        options: {
          limit: 1,
        },
        select: {
          _id: 1,
          sProfilePicUrl: 1,
          sWalletAddress: 1,
        },
      })
      .limit(limit)
      .skip(startIndex)
      .exec()
      .then((res) => {
        data.push(res);
      })
      .catch((e) => {
        console.log("Error", e);
      });
    results.count = await NFT.countDocuments({
      nCollection: collection,
      _id: { $in: OrderIdsss },
    }).exec();
    results.results = data;
    return res.reply(messages.success("Order List"), results);
  } catch (error) {
    console.log("Error:", error);
    return res.reply(messages.error());
  }
};

controllers.getCollectionNFTOwned = async (req, res) => {
  try {
    if (!req.userId) return res.reply(messages.unauthorized());
    let data = [];
    let collection = req.body.collection;
    let userID = req.userId;
    let UserData = await User.findById(userID);
    if (UserData) {
      let userWalletAddress = UserData.sWalletAddress;

      const sortKey = req.body.sortKey ? req.body.sortKey : "";
      //sortType will let you choose from ASC 1 or DESC -1
      const sortType = req.body.sortType ? req.body.sortType : -1;

      var sortObject = {};
      var stype = sortKey;
      var sdir = sortType;
      sortObject[stype] = sdir;

      const page = parseInt(req.body.page);
      const limit = parseInt(req.body.limit);

      const startIndex = (page - 1) * limit;
      const endIndex = page * limit;
      const results = {};
      if (
        endIndex <
        (await NFT.countDocuments({
          nCollection: collection,
          "nOwnedBy.address": userWalletAddress,
        }).exec())
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
      await NFT.find({
        nCollection: collection,
        "nOwnedBy.address": userWalletAddress,
      })
        .select({
          nTitle: 1,
          nCollection: 1,
          nHash: 1,
          nType: 1,
          nUser_likes: 1,
          nNftImage: 1,
          nLazyMintingStatus: 1,
        })
        .populate({
          path: "nOrders",
          options: {
            limit: 1,
          },
          select: {
            oPrice: 1,
            oType: 1,
            oStatus: 1,
            _id: 0,
          },
        })
        .populate({
          path: "nCreater",
          options: {
            limit: 1,
          },
          select: {
            _id: 1,
            sProfilePicUrl: 1,
            sWalletAddress: 1,
          },
        })
        .limit(limit)
        .skip(startIndex)
        .exec()
        .then((res) => {
          data.push(res);
        })
        .catch((e) => {
          console.log("Error", e);
        });
      results.count = await NFT.countDocuments({
        nCollection: collection,
        "nOwnedBy.address": userWalletAddress,
      }).exec();
      results.results = data;
      return res.reply(messages.success("Order List"), results);
    } else {
      console.log("Bid Not found");
      return res.reply("User Not found");
    }
  } catch (error) {
    console.log("Error:", error);
    return res.reply(messages.error());
  }
};

controllers.getSearchedNft = async (req, res) => {
  try {
    let data = [];
    let setConditions = req.body.conditions;

    //sortKey is the column
    const sortKey = req.body.sortKey ? req.body.sortKey : "";

    //sortType will let you choose from ASC 1 or DESC -1
    const sortType = req.body.sortType ? req.body.sortType : -1;

    var sortObject = {};
    var stype = sortKey;
    var sdir = sortType;
    sortObject[stype] = sdir;

    const page = parseInt(req.body.page);
    const limit = parseInt(req.body.limit);

    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;

    const results = {};
    let OrderIdsss = await Order.distinct("oNftId", setConditions);

    if (
      endIndex <
      (await NFT.countDocuments({
        nTitle: { $regex: req.body.sTextsearch, $options: "i" },
        _id: { $in: OrderIdsss.map(String) },
      }).exec())
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

    await NFT.find({
      nTitle: { $regex: req.body.sTextsearch, $options: "i" },
      _id: { $in: OrderIdsss.map(String) },
    })
      .select({
        nTitle: 1,
        nCollection: 1,
        nHash: 1,
        nType: 1,
        nUser_likes: 1,
        nNftImage: 1,
        nLazyMintingStatus: 1,
      })
      .populate({
        path: "nOrders",
        options: {
          limit: 1,
        },
        select: {
          oPrice: 1,
          oType: 1,
          auction_end_date: 1,
          oValidUpto: 1,
          oStatus: 1,
          _id: 0,
        },
      })
      .populate({
        path: "nCreater",
        options: {
          limit: 1,
        },
        select: {
          _id: 0,
        },
      })
      .limit(limit)
      .skip(startIndex)
      .exec()
      .then((res) => {
        data.push(res);
        results.count = res.length;
      })
      .catch((e) => {
        console.log("Error", e);
      });

    results.count = await NFT.countDocuments({
      nTitle: { $regex: req.body.sTextsearch, $options: "i" },
      _id: { $in: OrderIdsss.map(String) },
    }).exec();
    results.results = data;

    return res.reply(messages.success("NFTs List"), results);
  } catch (error) {
    console.log("Error:", error);
    return res.reply(messages.error());
  }
};

// controllers.updateCollectionToken = async (req, res) => {
//   try {
//     if (!req.params.collectionAddress)
//       return res.reply(messages.not_found("Contract Address Not Found"));
//     const contractAddress = req.params.collectionAddress;

//     const collection = await Collection.findOne({
//       sContractAddress: contractAddress,
//     });
//     let nextId = collection.getNextId();

//     collection.nextId = nextId + 1;
//     collection.save();
//     return res.reply(messages.success("Token Updated", nextId + 1));
//   } catch (error) {
//     return res.reply(messages.server_error());
//   }
// };
module.exports = controllers;
