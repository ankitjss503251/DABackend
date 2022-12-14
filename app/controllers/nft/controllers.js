const fs = require("fs");
const https = require("https");
const http = require("http");
const { NFT, Collection, User, Bid, Order, Brand, Category, MintCollection, } = require("../../models");
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
const { env } = require("process");

const Web3 = require("web3");
var web3 = new Web3(process.env.NETWORK_RPC_URL);
const erc721Abi = require("./../../../abis/extendedERC721.json");
const erc1155Abi = require("./../../../abis/extendedERC1155.json");
const nftMetaBaseURL = process.env.NFT_META_BASE_URL;
const chainID = process.env.CHAIN_ID;
const postAPIURL = process.env.NFT_META_POST_URL;

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
  console.log("Type ", file.mimetype);
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
    fileSize: 200 * 1024 * 1024,
  },
  fileFilter: fileFilter,
};

const upload = multer(oMulterObj).single("nftFile");
const uploadBanner = multer(oMulterObj);

class NFTController {
  constructor() { }

  async createNFT(req, res, next) {
    try {
      if (!req.userId) return res.reply(messages.unauthorized());
      allowedMimes = [
        "image/jpeg",
        "video/mp4",
        "image/jpg",
        "image/webp",
        "image/png",
        "image/gif",
        "model/glTF+json",
        "model/gltf+json",
        "model/gltf-binary",
        "application/octet-stream",
        "audio/mp3",
        "audio/mpeg",
      ];
      errAllowed = "JPG, JPEG, PNG, GIF, GLTF, GLB MP3, WEBP & MPEG";
      uploadBanner.fields([
        { name: "nftFile", maxCount: 1 },
        { name: "previewImg", maxCount: 1 },
      ])(req, res, function (error) {
        if (error) {
          log.red(error);
          return res.reply(messages.bad_request(error.message));
        } else {
          console.log("Here");
          log.green(req.body);
          if (req.files.nftFile != "" && req.files.nftFile != undefined) {
            log.green(req.files.nftFile[0].location);
          }
          if (req.files.previewImg != "" && req.files.previewImg != undefined) {
            log.green(req.files.previewImg[0].location);
          }
          if (!req.body.creatorAddress) {
            return res.reply(messages.not_found("Creator Wallet Address"));
          }
          if (!req.body.name) {
            return res.reply(messages.not_found("Title"));
          }
          if (!validators.isValidString(req.body.name)) {
            return res.reply(messages.invalid("Title"));
          }
          if (!req.body.quantity) {
            return res.reply(messages.not_found("Quantity"));
          }
          if (isNaN(req.body.quantity) || !req.body.quantity > 0) {
            return res.reply(messages.invalid("Quantity"));
          }
          if (req.body.description.trim().length > 1000) {
            return res.reply(messages.invalid("Description"));
          }
          // if (!req.file) {
          //   return res.reply(messages.not_found("File"));
          // }
          // console.log("Files", req.file);
          let nftElement = req.body;

          let previewImgURL = req.files.previewImg ? req.files.previewImg[0].location : "";
          let nftFileURL = req.files.nftFile ? req.files.nftFile[0].location : "";

          let fileAttr = [];
          fileAttr["size"] = nftElement.imageSize;
          fileAttr["type"] = nftElement.imageType;
          fileAttr["dimension"] = nftElement.imageDimension;
          let fileObj = Object.assign({}, fileAttr);

          if (
            nftFileURL.indexOf("http://") == 0 ||
            nftFileURL.indexOf("https://") == 0
          ) {
          } else {
            nftFileURL = "https://" + nftFileURL;
          }
          console.log("fileURL", nftFileURL);

          Collection.find(
            { _id: mongoose.Types.ObjectId(nftElement.collectionID) },
            async function (err, collectionData) {
              if (err) {
                return res.reply(messages.server_error("Collection"));
              } else {
                if (collectionData.length > 0) {
                  NFT.find(
                    {
                      name: nftElement.name,
                      collectionID: mongoose.Types.ObjectId(
                        nftElement.collectionID
                      ),
                      collectionAddress: nftElement.collectionAddress,
                    },
                    async function (err, nftData) {
                      if (err) {
                        return res.reply(messages.server_error("NFT"));
                      } else {
                        if (nftData.length > 0) {
                          return res.reply(messages.already_exists("NFT Name"));
                        } else {
                          let newFileURl = nftFileURL;
                          if (nftElement.fileType === "3D") {
                            newFileURl = newFileURl.replace('https://', 'http://');
                            var prefix = 'http://';
                            if (newFileURl.substr(0, prefix.length) !== prefix) {
                              newFileURl = prefix + newFileURl;
                            }
                          }
                          const iOptions = {
                            pinataMetadata: {
                              name: req.files.nftFile[0].originalname,
                            },
                            pinataOptions: {
                              cidVersion: 0,
                            },
                          };
                          try {
                            const pathString = "/tmp/";
                            console.log("Files Data", req.files.nftFile[0])
                            const file = fs.createWriteStream(pathString + req.files.nftFile[0].originalname);
                            // console.log("file in create is-------->",file)
                            let fileUrl = req.files.nftFile[0].location;
                            var prefix = 'https://';
                            if (fileUrl.substr(0, prefix.length) !== prefix) {
                              fileUrl = prefix + fileUrl;
                            }
                            const request = https.get(`${fileUrl}`, function (response) {
                              var stream = response.pipe(file);
                              // console.log("strema is------>",stream)
                              const readableStreamForFile = fs.createReadStream(
                                pathString + req.files.nftFile[0].originalname
                              );
                              stream.on("finish", async function () {
                                console.log("Finish Here");
                                pinata
                                  .pinFileToIPFS(readableStreamForFile, iOptions)
                                  .then((res) => {
                                    console.log("in pinata ");
                                    console.log("response is----->", res);
                                    let uploadingData = {};
                                    uploadingData = {
                                      id: "#" + nftElement.tokenID,
                                      name: nftElement.name,
                                      token_id: nftElement.tokenID,
                                      description: nftElement.description,
                                      attributes: JSON.parse(nftElement.attributes),
                                      collectionAddress: nftElement.collectionAddress,
                                    };
                                    if (nftElement.fileType === "Image") {
                                      uploadingData.image = process.env.IPFS_URL + res.IpfsHash;
                                    } else {
                                      uploadingData.animation_url = process.env.IPFS_URL + res.IpfsHash;
                                    }
                                    console.log("uploadingData", uploadingData);
                                    const mOptions = {
                                      pinataMetadata: {
                                        name: "DA META",
                                      },
                                      pinataOptions: {
                                        cidVersion: 0,
                                      },
                                    };
                                    console.log("res---", res.IpfsHash);
                                    return pinata.pinJSONToIPFS(uploadingData, mOptions);
                                  })
                                  .then(async (metaHash) => {
                                    console.log("metaHash---", metaHash);
                                    let nft = new NFT({
                                      name: nftElement.name,
                                      description: nftElement.description,
                                      image: newFileURl,
                                      metaDatahash: metaHash.IpfsHash,
                                      fileType: nftElement.fileType,
                                      tokenID: nftElement.tokenID,
                                      collectionID: nftElement.collectionID,
                                      collectionAddress: nftElement.collectionAddress,
                                      totalQuantity: nftElement.quantity,
                                      isImported: nftElement.isImported,
                                      type: nftElement.type,
                                      isMinted: nftElement.isMinted,
                                      assetsInfo: fileObj,
                                      hash: req.body.hash,
                                      previewImg: previewImgURL,
                                      hashStatus: req.body.hashStatus,
                                      ownedBy: [],
                                    });
                                    if (
                                      collectionData[0].brandID !== undefined &&
                                      collectionData[0].brandID !== ""
                                    ) {
                                      nft.brandID = collectionData[0].brandID;
                                    }
                                    if (
                                      collectionData[0].categoryID !== undefined &&
                                      collectionData[0].categoryID !== ""
                                    ) {
                                      nft.categoryID = collectionData[0].categoryID;
                                    }
                                    console.log("Attr1", req.body.attributes);
                                    console.log("Attr", nftElement.attributes);
                                    let NFTAttr = JSON.parse(nftElement.attributes);
                                    console.log("NFTARRAY ", NFTAttr.length);
                                    if (NFTAttr.length > 0) {
                                      NFTAttr.forEach((obj) => {
                                        console.log("OBJ", obj);
                                        nft.attributes.push(obj);
                                      });
                                    }
                                    let NFTlevels = JSON.parse(nftElement.levels);
                                    if (NFTlevels.length > 0) {
                                      NFTlevels.forEach((obj) => {
                                        nft.levels.push(obj);
                                      });
                                    }
                                    nft.ownedBy.push({
                                      address: nftElement.creatorAddress,
                                      quantity: nftElement.quantity,
                                    });
                                    nft
                                      .save()
                                      .then(async (result) => {
                                        const collection = await Collection.findOne({
                                          _id: mongoose.Types.ObjectId(
                                            nftElement.collectionID
                                          ),
                                        });
                                        let nextID = collection.getNextID();
                                        collection.nextID = nextID;
                                        collection.save();
                                        await Collection.findOneAndUpdate(
                                          {
                                            _id: mongoose.Types.ObjectId(
                                              nftElement.collectionID
                                            ),
                                          },
                                          { $inc: { nftCount: 1 } },
                                          function () { }
                                        );
                                        if (
                                          collectionData.categoryID === "" ||
                                          collectionData.categoryID === undefined
                                        ) {
                                        } else {
                                          await Category.findOneAndUpdate(
                                            {
                                              _id: mongoose.Types.ObjectId(
                                                collectionData.categoryID
                                              ),
                                            },
                                            { $inc: { nftCount: 1 } },
                                            function () { }
                                          );
                                        }
                                        if (
                                          collectionData.brandID === "" ||
                                          collectionData.brandID === undefined
                                        ) {
                                        } else {
                                          await Brand.findOneAndUpdate(
                                            {
                                              _id: mongoose.Types.ObjectId(
                                                collectionData.brandID
                                              ),
                                            },
                                            { $inc: { nftCount: 1 } },
                                            function () { }
                                          );
                                        }
                                        return res.reply(messages.created("NFT"), result);
                                      })
                                      .catch((error) => {
                                        console.log("Created NFT error", error);
                                        return res.reply(messages.error());
                                      });

                                  })
                                  .catch((e) => {
                                    console.log("Error is ", e);
                                    return res.reply(messages.error());
                                  });
                              });
                            });
                          } catch (e) {
                            console.log("error in file upload..", e);
                          }
                        }
                      }
                    }
                  );
                } else {
                  return res.reply(messages.not_found("Collection"));
                }
              }
            }
          );


        }
      });
    } catch (error) {
      return res.reply(messages.server_error());
    }
  }

  async createCollection(req, res) {
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
          if (
            req.files.logoImage != "" &&
            req.files.logoImage != undefined &&
            req.files.coverImage != "" &&
            req.files.coverImage != undefined
          ) {
            log.green(req.files.logoImage[0].location);
            log.green(req.files.coverImage[0].location);
          }

          if (!req.body.name) {
            return res.reply(messages.not_found("Collection Name"));
          }
          if (!validators.isValidString(req.body.name)) {
            return res.reply(messages.invalid("Collection Name"));
          }
          if (req.body.description != "" && req.body.description != undefined)
            if (req.body.description.trim().length > 1000) {
              return res.reply(messages.invalid("Description"));
            }
          const collection = new Collection({
            name: req.body.name,
            symbol: req.body.symbol,
            description: req.body.description,
            type: req.body.type,
            royaltyPercentage: req.body.royalty,
            contractAddress: req.body.contractAddress,
            logoImage: req.files.logoImage
              ? req.files.logoImage[0].location
              : "",
            coverImage: req.files.coverImage
              ? req.files.coverImage[0].location
              : "",
            categoryID: req.body.categoryID,
            brandID: req.body.brandID,
            preSaleStartTime: req.body.preSaleStartTime,
            preSaleEndTime: req.body.preSaleEndTime,
            preSaleTokenAddress: req.body.preSaleTokenAddress,
            totalSupply: req.body.totalSupply,
            nextId: 0,
            price: req.body.price,
            createdBy: req.userId,
            isOnMarketplace: req.body.isOnMarketplace,
            isImported: req.body.isImported,
            isMinted: req.body.isMinted,
            link: req.body.link,
            hash: req.body.hash,
            hashStatus: req.body.hashStatus,
          });
          collection
            .save()
            .then((result) => {
              console.log("collection created", result)
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
  }

  async getCollections(req, res) {
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
      let isOnMarketplace = "";
      if (req.body.isOnMarketplace && req.body.isOnMarketplace !== undefined) {
        isOnMarketplace = req.body.isOnMarketplace;
      }

      let contractAddress = "";
      if (req.body.contractAddress && req.body.contractAddress !== undefined) {
        contractAddress = req.body.contractAddress;
      }

      let searchArray = [];
      searchArray["status"] = 1;
      searchArray["hashStatus"] = 1;
      if (collectionID !== "") {
        searchArray["_id"] = mongoose.Types.ObjectId(collectionID);
      }
      if (contractAddress !== "" && contractAddress != undefined) {
        searchArray["contractAddress"] = contractAddress;
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
      if (isOnMarketplace !== "") {
        searchArray["isOnMarketplace"] = isOnMarketplace;
      }
      if (searchText !== "") {
        let searchKey = new RegExp(searchText, "i");
        searchArray["$or"] = [
          { name: searchKey },
          // { contractAddress: searchKey },
        ];
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
  }

  async myCollections(req, res) {
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
      let collectionID = "";
      if (req.body.collectionID && req.body.collectionID !== undefined) {
        collectionID = req.body.collectionID;
      }
      let searchArray = [];
      searchArray["createdBy"] = mongoose.Types.ObjectId(req.userId);
      if (collectionID !== "") {
        searchArray["_id"] = mongoose.Types.ObjectId(collectionID);
      }
      if (searchText !== "") {
        searchArray["$or"] = [
          { name: { $regex: new RegExp(searchText), $options: "i" } },
          {
            contractAddress: { $regex: new RegExp(searchText), $options: "i" },
          },
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
  }

  async allCollections(req, res) {
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
      if (searchText !== "") {
        searchArray["$or"] = [
          { name: { $regex: new RegExp(searchText), $options: "i" } },
          {
            contractAddress: { $regex: new RegExp(searchText), $options: "i" },
          },
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
  }

  async importNFT(req, res, next) {
    try {
      if (!req.userId) return res.reply(messages.unauthorized());
      let creatorID = req.userId;
      console.log("creatorID", creatorID);
      if (!req.body.nftData) {
        return res.reply(messages.not_found("NFT Data"));
      }
      let nftElement = req.body.nftData;
      if (!nftElement.owner) {
        return res.reply(messages.required_field("Wallet Address"));
      }
      await User.findOne(
        {
          walletAddress: _.toChecksumAddress(nftElement.owner),
        },
        (err, user) => {
          if (err) return res.reply(messages.error());
          if (!user) {
            const user = new User({
              walletAddress: _.toChecksumAddress(
                nftElement.owner?.toLowerCase()
              ),
            });
            user
              .save()
              .then((result) => {
                console.log("User Created", result);
              })
              .catch((error) => {
                console.log("Error in creating User", error);
              });
          }
        }
      );
      console.log("collection ID", nftElement.collectionID);
      Collection.find({ _id: mongoose.Types.ObjectId(nftElement.collectionID) },
        async function (err, collectionData) {
          if (err) {
            return res.reply(messages.server_error("Collection"));
          } else {
            console.log("Collection Data", collectionData.length)
            if (collectionData.length > 0) {
              NFT.find(
                {
                  name: nftElement.name,
                  collectionID: mongoose.Types.ObjectId(
                    nftElement.collectionID
                  ),
                  collectionAddress: nftElement.collectionAddress,
                },
                async function (err, nftData) {
                  console.log("collectionData", collectionData);
                  if (err) {
                    return res.reply(messages.server_error("NFT"));
                  } else {
                    if (nftData?.length > 10) {
                      return res.reply(messages.already_exists("NFT Name"));
                    } else {
                      console.log("collectionData", collectionData);
                      let nft = new NFT({
                        name: nftElement.name,
                        description: nftElement.description,
                        image: nftElement.image,
                        fileType: nftElement.fileType,
                        tokenID: nftElement.tokenID,
                        collectionID: nftElement.collectionID,
                        collectionAddress: nftElement.collectionAddress,
                        isOnMarketplace: nftElement.isOnMarketplace,
                        totalQuantity: nftElement.totalQuantity,
                        totalQuantity: nftElement.quantity,
                        isImported: nftElement.isImported,
                        type: nftElement.type,
                        isMinted: nftElement.isMinted,
                        createdBy: creatorID,
                        hash: "0x0",
                        hashStatus: 1,
                        ownedBy: [],
                      });
                      if (
                        collectionData[0].brandID !== undefined &&
                        collectionData[0].brandID !== ""
                      ) {
                        nft.brandID = collectionData[0].brandID;
                      }
                      if (
                        collectionData[0].categoryID !== undefined &&
                        collectionData[0].categoryID !== ""
                      ) {
                        nft.categoryID = collectionData[0].categoryID;
                      }
                      nft.attributes = nftElement.attributes;
                      // let NFTAttr = nftElement.attributes;
                      // if (NFTAttr.isArray) {
                      //   if (NFTAttr.length > 0) {
                      //     NFTAttr.forEach((obj) => {
                      //       nft.attributes.push(obj);
                      //     });
                      //   }
                      // }
                      nft.ownedBy.push({
                        address: nftElement.owner,
                        quantity: 1,
                      });
                      console.log("nftInsertData", nft);
                      nft
                        .save()
                        .then(async (result) => {
                          console.log("NFT result", result);
                          const collection = await Collection.findOne({
                            _id: mongoose.Types.ObjectId(
                              nftElement.collectionID
                            ),
                          });
                          let nextID = collection.getNextID();
                          collection.nextID = nextID;
                          collection.save();
                          await Collection.findOneAndUpdate(
                            {
                              _id: mongoose.Types.ObjectId(
                                nftElement.collectionID
                              ),
                            },
                            { $inc: { nftCount: 1 } },
                            function () { }
                          );
                          if (
                            collectionData.categoryID === "" ||
                            collectionData.categoryID === undefined
                          ) {
                          } else {
                            await Category.findOneAndUpdate(
                              {
                                _id: mongoose.Types.ObjectId(
                                  collectionData.categoryID
                                ),
                              },
                              { $inc: { nftCount: 1 } },
                              function () { }
                            );
                          }
                          return res.reply(messages.created("NFT"), result);
                        })
                        .catch((error) => {
                          console.log("Created NFT error", error);
                          return res.reply(messages.error());
                        });
                    }
                  }
                }
              );
            } else {
              return res.reply(messages.not_found("Collection"));
            }
          }
        }
      );
    } catch (error) {
      console.log(error);
      return res.reply(messages.server_error());
    }
  }

  async viewNFTs(req, res) {
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
      let isOnMarketplace = "";
      if (req.body.isOnMarketplace !== undefined) {
        isOnMarketplace = req.body.isOnMarketplace;
      }
      let salesType = "";
      if (req.body.salesType !== undefined) {
        if (salesType !== 2) {
          salesType = req.body.salesType;
        }
      }

      let pageName = "";
      if (req.body.pageName && req.body.pageName !== undefined) {
        pageName = req.body.pageName;
      }


      let priceSort = 1;
      if (req.body.priceSort !== undefined) {
        if (req.body.priceSort === "ASC") {
          priceSort = 1;
        } else {
          priceSort = -1;
        }
      }
      let sortArray = [];
      sortArray["OrderData.price"] = priceSort;
      let sortObj = Object.assign({}, sortArray);

      console.log("sortObj", sortObj);

      let searchArray = [];
      searchArray["status"] = 1;
      searchArray["hashStatus"] = 1;
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

      if (isLazyMinted !== "") {
        if (isLazyMinted == true) searchArray["lazyMintingStatus"] = 1;
        else searchArray["lazyMintingStatus"] = 0;
      }
      if (salesType === 2) {
        searchArray["OrderData.0"] = { $exists: false }
      }

      let searchObj = Object.assign({}, searchArray);

      let searchArrayCount = [];
      searchArrayCount["status"] = 1;
      searchArrayCount["hashStatus"] = 1;
      if (pageName === "Brand") {
        if (brandID !== "") {
          searchArrayCount["brandID"] = mongoose.Types.ObjectId(brandID);
        }
      }
      if (pageName === "Collection") {
        if (collectionID !== "") {
          searchArrayCount["collectionID"] = mongoose.Types.ObjectId(collectionID);
        }
      }
      let searchObjCount = Object.assign({}, searchArrayCount);

      let isOnMarketplaceSearchArray = [];
      isOnMarketplaceSearchArray["$match"] = {};
      if (isOnMarketplace === 1 || isOnMarketplace === 0) {
        isOnMarketplaceSearchArray["$match"] = {
          "CollectionData.isOnMarketplace": isOnMarketplace,
          "CollectionData.status": 1,
          "CollectionData.hashStatus": 1,
        };
      } else {
        isOnMarketplaceSearchArray["$match"] = {
          "CollectionData.status": 1,
          "CollectionData.hashStatus": 1,
        };
      }
      let isOnMarketplaceSearchObj = Object.assign(
        {},
        isOnMarketplaceSearchArray
      );

      console.log("isOnMarketplaceSearchObj", isOnMarketplaceSearchObj);

      let salesTypeSearchArray = [];
      salesTypeSearchArray["$match"] = {};
      if (salesType === 1 || salesType === 0) {
        salesTypeSearchArray["$match"] = { "OrderData.salesType": salesType };
      }
      let salesTypeSearchObj = Object.assign({}, salesTypeSearchArray);

      console.log("salesTypeSearchObj", salesTypeSearchObj);

      await NFT.aggregate([
        {
          $lookup: {
            from: "collections",
            localField: "collectionID",
            foreignField: "_id",
            as: "CollectionData",
          },
        },
        isOnMarketplaceSearchObj,
        {
          $lookup: {
            from: "orders",
            localField: "_id",
            foreignField: "nftID",
            as: "OrderData",
          },
        },
        salesTypeSearchObj,
        {
          $lookup: {
            from: "categories",
            localField: "categoryID",
            foreignField: "_id",
            as: "CategoryData",
          },
        },
        {
          $lookup: {
            from: "brands",
            localField: "brandID",
            foreignField: "_id",
            as: "BrandData",
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "createdBy",
            foreignField: "_id",
            as: "UserData",
          },
        },
        { $match: searchObj },
        {
          $project: {
            _id: 1,
            hasOrder: {
              $cond: { if: { $isArray: "$OrderData" }, then: { $size: "$OrderData" }, else: "NA" }
            },
            name: 1,
            type: 1,
            image: 1,
            previewImg: 1,
            description: 1,
            collectionAddress: 1,
            ownedBy: 1,
            user_likes: 1,
            isImported: 1,
            metaDatahash: 1,
            totalQuantity: 1,
            collectionID: 1,
            assetsInfo: 1,
            categoryID: 1,
            tokenID: 1,
            fileType: 1,
            createdBy: 1,
            createdOn: 1,
            attributes: 1,
            totalQuantity: 1,
            "CollectionData._id": 1,
            "CollectionData.name": 1,
            "CollectionData.contractAddress": 1,
            "CollectionData.isOnMarketplace": 1,
            "CollectionData.status": 1,
            "OrderData._id": 1,
            "OrderData.price": 1,
            "OrderData.salesType": 1,
            "OrderData.paymentToken": 1,
            "BrandData._id": 1,
            "BrandData.name": 1,
            "BrandData.logoImage": 1,
            "BrandData.coverImage": 1,
          },
        },
        { $sort: { hasOrder: -1, "OrderData.price": priceSort, createdOn: -1 } },
        { $skip: startIndex },
        { $limit: limit },

      ]).exec(async function (e, nftData) {
        console.log("Error ", e);
        let results = {};
        let count = await NFT.aggregate([
          {
            $lookup: {
              from: "collections",
              localField: "collectionID",
              foreignField: "_id",
              as: "CollectionData",
            },
          },
          isOnMarketplaceSearchObj,
          {
            $lookup: {
              from: "orders",
              localField: "_id",
              foreignField: "nftID",
              as: "OrderData",
            },
          },
          {
            $lookup: {
              from: "categories",
              localField: "categoryID",
              foreignField: "_id",
              as: "CategoryData",
            },
          },
          {
            $lookup: {
              from: "brands",
              localField: "brandID",
              foreignField: "_id",
              as: "BrandData",
            },
          },
          {
            $lookup: {
              from: "users",
              localField: "createdBy",
              foreignField: "_id",
              as: "UserData",
            },
          },
          { $match: searchObjCount },
          {
            $count: "allNFTs"
          }
        ]);
        results.count = count[0]?.allNFTs;
        results.results = nftData;
        console.log("Data Returned");
        return res.reply(messages.success("NFT List"), results);
      });
    } catch (error) {
      console.log("Error " + error);
      return res.reply(messages.server_error());
    }
  }

  async viewNFTDetails(req, res) {
    try {
      let nftID = "";
      if (req.body.nftID && req.body.nftID !== undefined) {
        nftID = req.body.nftID;
      }
      let searchArray = [];
      searchArray["status"] = 1;
      searchArray["hashStatus"] = 1;
      if (nftID !== "") {
        searchArray["_id"] = mongoose.Types.ObjectId(nftID);
      }
      let searchObj = Object.assign({}, searchArray);

      let isOnMarketplaceSearchArray = [];
      isOnMarketplaceSearchArray["$match"] = { "CollectionData.status": 1, "CollectionData.hashStatus": 1 };
      let isOnMarketplaceSearchObj = Object.assign({}, isOnMarketplaceSearchArray);
      console.log("isOnMarketplaceSearchObj", isOnMarketplaceSearchObj);

      let nfts = await NFT.aggregate([
        { $match: searchObj },
        {
          $lookup: {
            from: "collections",
            localField: "collectionID",
            foreignField: "_id",
            as: "CollectionData",
          },
        },
        isOnMarketplaceSearchObj,
        {
          $lookup: {
            from: "orders",
            localField: "_id",
            foreignField: "nftID",
            as: "OrderData",
          },
        },
        {
          $lookup:
          {
            from: 'bids',
            pipeline: [
              {
                $match:
                {
                  bidQuantity: { $gte: 1 },
                  bidStatus: "Bid",
                  nftID: mongoose.Types.ObjectId(nftID)
                }
              },
              { $sort: { createdOn: -1 } },
            ],
            as: 'BidsData'
          },
        },
        {
          $lookup:
          {
            from: 'bids',
            pipeline: [
              {
                $match:
                {
                  bidQuantity: { $gte: 1 },
                  isOffer: true,
                  nftID: mongoose.Types.ObjectId(nftID)
                }
              },
              { $sort: { createdOn: -1 } },
            ],
            as: 'OffersData'
          },
        },
        {
          $lookup:
          {
            from: 'histories',
            pipeline: [
              {
                $match:
                {
                  nftID: mongoose.Types.ObjectId(nftID)
                }
              },
              { $sort: { createdOn: -1 } },
            ],
            as: 'HistoryData'
          },
        },
        {
          $lookup: {
            from: "categories",
            localField: "categoryID",
            foreignField: "_id",
            as: "CategoryData",
          },
        },
        {
          $lookup: {
            from: "brands",
            localField: "brandID",
            foreignField: "_id",
            as: "BrandData",
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "createdBy",
            foreignField: "_id",
            as: "UserData",
          },
        },
      ]).exec(async function (e, nftData) {
        console.log("Error ", e);

        let ContractType = "ERC1155";
        let ContractABI = erc1155Abi ? erc1155Abi.abi : "";
        if (nftData[0]?.type === 1) {
          ContractType = "ERC721";
          ContractABI = erc721Abi ? erc721Abi.abi : "";
        }
        console.log("Contract is", ContractType)
        let contract = new web3.eth.Contract(ContractABI, nftData[0].collectionAddress);
        let tokenID = parseInt(nftData[0].tokenID);
        if (nftData[0].isMinted === 0) {
          console.log("Created on Plateform");
          let tokenURI = await contract.methods.tokenURI(tokenID).call();
          try {
            https.get(tokenURI, (resp) => {
              let body = "";
              resp.on("data", (chunk) => {
                body += chunk;
              });
              resp.on("end", async () => {
                try {
                  let newJSON = JSON.parse(body);
                  nftData[0].name = newJSON.name;
                  nftData[0].description = newJSON.description;
                  nftData[0].image = newJSON.image;
                  nftData[0].attributes = newJSON.attributes;
                  return res.reply(messages.success("NFT List"), nftData);
                } catch (error) {
                  console.log("Error ", error);
                  return res.reply(messages.success("NFT List"), nftData);
                };
              });
            }).on("error", (error) => {
              console.log("Error ", error);
              return res.reply(messages.success("NFT List"), nftData);
            });
          } catch (error) {
            console.log("Error ", error);
            return res.reply(messages.success("NFT List"), nftData);
          }
        } else {
          let tokenURI = nftMetaBaseURL + "tokenDetailsExtended?ChainId=" + chainID + "&ContractAddress=" + nftData[0].collectionAddress + "&TokenId=" + tokenID;
          console.log("tokenURI", tokenURI)
          try {
            http.get(tokenURI, (resp) => {
              let body = "";
              resp.on("data", (chunk) => {
                body += chunk;
              });
              resp.on("end", async () => {
                try {
                  let newJSON = JSON.parse(body);
                  nftData[0].name = newJSON[0].name;
                  nftData[0].description = newJSON[0].description;
                  if(newJSON[0].S3Images.S3Thumb === "" || newJSON[0].S3Images.S3Thumb === undefined){
                    nftData[0].previewImg = newJSON[0].image;
                    nftData[0].image = newJSON[0].image;
                  }else{
                    if (newJSON[0].S3Images.S3Animation === "" || newJSON[0].S3Images.S3Animation === null) {
                      nftData[0].image = newJSON[0].S3Images.S3Image;
                    } else {
                      nftData[0].image = newJSON[0].S3Images.S3Animation;
                    }
                    nftData[0].previewImg = newJSON[0].S3Images.S3Thumb;
                  }
                  if(newJSON[0].rarity.rarity_attributes === "" || newJSON[0].rarity.rarity_attributes === undefined){
                    nftData[0].attributes = newJSON[0].attributes;
                  }else{
                    nftData[0].attributes = newJSON[0].rarity.rarity_attributes;
                  }
                  
                  return res.reply(messages.success("NFT List"), nftData);
                } catch (error) {
                  console.log("Error ", error);
                  return res.reply(messages.success("NFT List"), nftData);
                };
              });
            }).on("error", (error) => {
              console.log("Error ", error);
              return res.reply(messages.success("NFT List"), nftData);
            });
          } catch (error) {
            console.log("Error ", error);
            return res.reply(messages.success("NFT List"), nftData);
          }
        }

      });
    } catch (error) {
      console.log("Error " + error);
      return res.reply(messages.server_error());
    }
  }

  async myNFTs(req, res) {
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
      console.log("req.userId", req.userId);
      User.findOne(
        { _id: mongoose.Types.ObjectId(req.userId) },
        async function (err, userData) {
          console.log("err", err);
          console.log("userData", userData);
          if (err) {
            return res.reply(messages.unauthorized());
          } else {
            let searchArray = [];
            searchArray["status"] = 1;
            searchArray["hashStatus"] = 1;
            searchArray["ownedBy"] = {
              $elemMatch: {
                address: userData.walletAddress?.toLowerCase(),
                quantity: { $gt: 0 },
              },
            };
            if (searchText !== "") {
              searchArray["$or"] = [
                { name: { $regex: new RegExp(searchText), $options: "i" } },
                {
                  contractAddress: {
                    $regex: new RegExp(searchText),
                    $options: "i",
                  },
                },
              ];
            }
            let searchObj = Object.assign({}, searchArray);
            let isOnMarketplaceSearchArray = [];
            isOnMarketplaceSearchArray["$match"] = {
              "CollectionData.status": 1,
            };
            let isOnMarketplaceSearchObj = Object.assign({}, isOnMarketplaceSearchArray);
            console.log("isOnMarketplaceSearchObj", isOnMarketplaceSearchObj);

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
            await NFT.aggregate([
              {
                $lookup: {
                  from: "collections",
                  localField: "collectionID",
                  foreignField: "_id",
                  as: "CollectionData",
                },
              },
              isOnMarketplaceSearchObj,
              { $match: searchObj },
              { $sort: { createdOn: -1 } },
              { $skip: startIndex },
              { $limit: limit },

            ]).exec(function (e, nftData) {
              console.log("Error ", e);
              let nftList = [];
              nftList[0] = nftData;
              let results = {};
              results.count = nftData?.length ? nftData.length : 0;
              results.results = nftList;
              return res.reply(messages.success("NFT List"), results);
            });
          }
        }
      );
    } catch (error) {
      console.log("Error " + error);
      return res.reply(messages.server_error());
    }
  }

  // async updateNftOrder(req, res) {
  //   try {
  //     if (!req.userId) return res.reply(messages.unauthorized());
  //     console.log("request is--->", JSON.stringify(req.body));
  //     console.log("id is--->", req.body._id);

  //     let sId = await NFT.findById(req.body._id);
  //     let nftownerID = req.body.nftownerID;

  //     if (!sId) return res.reply(messages.not_found("NFT"));

  //     await NFTowners.findByIdAndUpdate(nftownerID, {
  //       sOrder: req.body.sOrder,
  //       sSignature: req.body.sSignature,
  //       sTransactionStatus: 1,
  //       nBasePrice: req.body.nBasePrice,
  //     }).then((err, nftowner) => {
  //       console.log("Error Update is " + JSON.stringify(err));
  //     });

  //     NFTowners.findByIdAndUpdate(
  //       nftownerID,
  //       { $inc: { nQuantityLeft: -req.body.putOnSaleQty } },
  //       { new: true },
  //       function (err, response) { }
  //     );
  //     if (req.body.erc721) {
  //       await NFT.findByIdAndUpdate(sId, {
  //         sOrder: req.body.sOrder,
  //         sSignature: req.body.sSignature,
  //         sTransactionStatus: 1,
  //         nBasePrice: req.body.nBasePrice,
  //       }).then((err, nft) => {
  //         console.log("Updating By ID" + nftownerID);
  //         return res.reply(messages.success("Order Created"));
  //       });
  //     } else {
  //       return res.reply(messages.success("Order Created"));
  //     }
  //   } catch (e) {
  //     console.log("Error is " + e);
  //     return res.reply(messages.server_error());
  //   }
  // }

  async getOnSaleItems(req, res) {
    console.log("req", req.body);
    try {
      let data = [];
      const page = parseInt(req.body.page);
      const limit = parseInt(req.body.limit);
      const startIndex = (page - 1) * limit;
      const endIndex = page * limit;


      let ERCType = "";
      if (req.body.ERCType && req.body.ERCType !== undefined) {
        ERCType = req.body.ERCType;
      }
      let searchText = "";
      if (req.body.searchText && req.body.searchText !== undefined) {
        searchText = req.body.searchText;
      }
      let priceSort = 1;
      if (req.body.priceSort !== undefined) {
        if (req.body.priceSort === "ASC") {
          priceSort = 1;
        } else {
          priceSort = -1;
        }
      }
      let sortArray = [];
      sortArray["OrderData.price"] = priceSort;
      // sortArray["createdOn"] = -1;
      let sortObj = Object.assign({}, sortArray);

      console.log("sortObj", sortObj);

      let searchArray = [];
      searchArray["status"] = 1;
      searchArray["hashStatus"] = 1;
      if (ERCType !== "") {
        searchArray["type"] = ERCType;
      }
      if (searchText !== "") {
        searchArray["name"] = { $regex: new RegExp(searchText), $options: "i" };
      }
      searchArray["ownedBy"] = {
        $elemMatch: {
          address: req.body.userWalletAddress?.toLowerCase(),
          quantity: { $gt: 0 },
        },
      };
      searchArray["OrderData.0"] = { $exists: true }
      let searchObj = Object.assign({}, searchArray);

      let searchArrayCount = [];
      searchArrayCount["status"] = 1;
      searchArrayCount["hashStatus"] = 1;
      searchArrayCount["OrderData.0"] = { $exists: true }
      searchArrayCount["ownedBy"] = {
        $elemMatch: {
          address: req.body.userWalletAddress?.toLowerCase(),
          quantity: { $gt: 0 },
        },
      };
      let searchObjCount = Object.assign({}, searchArrayCount);

      let isOnMarketplaceSearchArray = [];
      isOnMarketplaceSearchArray["$match"] = { "CollectionData.status": 1, "CollectionData.hashStatus": 1 };
      let isOnMarketplaceSearchObj = Object.assign(
        {},
        isOnMarketplaceSearchArray
      );
      console.log("isOnMarketplaceSearchObj", isOnMarketplaceSearchObj);
      await NFT.aggregate([
        {
          $lookup: {
            from: "collections",
            localField: "collectionID",
            foreignField: "_id",
            as: "CollectionData",
          },
        },
        isOnMarketplaceSearchObj,
        {
          $lookup: {
            from: "orders",
            localField: "_id",
            foreignField: "nftID",
            as: "OrderData",
          },
        },
        {
          $lookup: {
            from: "categories",
            localField: "categoryID",
            foreignField: "_id",
            as: "CategoryData",
          },
        },
        {
          $lookup: {
            from: "brands",
            localField: "brandID",
            foreignField: "_id",
            as: "BrandData",
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "createdBy",
            foreignField: "_id",
            as: "UserData",
          },
        },
        { $match: searchObj },
        {
          $project: {
            _id: 1,
            hasOrder: {
              $cond: { if: { $isArray: "$OrderData" }, then: { $size: "$OrderData" }, else: "NA" }
            },
            name: 1,
            type: 1,
            image: 1,
            previewImg: 1,
            description: 1,
            collectionAddress: 1,
            ownedBy: 1,
            user_likes: 1,
            totalQuantity: 1,
            collectionID: 1,
            assetsInfo: 1,
            categoryID: 1,
            tokenID: 1,
            fileType: 1,
            createdBy: 1,
            createdOn: 1,
            attributes: 1,
            totalQuantity: 1,
            "CollectionData._id": 1,
            "CollectionData.name": 1,
            "CollectionData.contractAddress": 1,
            "CollectionData.isOnMarketplace": 1,
            "CollectionData.status": 1,
            "OrderData._id": 1,
            "OrderData.price": 1,
            "OrderData.salesType": 1,
            "OrderData.paymentToken": 1,
            "BrandData._id": 1,
            "BrandData.name": 1,
            "BrandData.logoImage": 1,
            "BrandData.coverImage": 1,
          },
        },
        { $sort: { hasOrder: -1, "OrderData.price": priceSort, createdOn: -1 } },
        { $skip: startIndex },
        { $limit: limit },
      ]).exec(async function (e, nftData) {
        console.log("Error ", e);
        let results = {};
        let count = await NFT.aggregate([
          {
            $lookup: {
              from: "collections",
              localField: "collectionID",
              foreignField: "_id",
              as: "CollectionData",
            },
          },
          isOnMarketplaceSearchObj,
          {
            $lookup: {
              from: "orders",
              localField: "_id",
              foreignField: "nftID",
              as: "OrderData",
            },
          },
          {
            $lookup: {
              from: "categories",
              localField: "categoryID",
              foreignField: "_id",
              as: "CategoryData",
            },
          },
          {
            $lookup: {
              from: "brands",
              localField: "brandID",
              foreignField: "_id",
              as: "BrandData",
            },
          },
          {
            $lookup: {
              from: "users",
              localField: "createdBy",
              foreignField: "_id",
              as: "UserData",
            },
          },
          { $match: searchObjCount },
          {
            $count: "allNFTs"
          }
        ]);
        results.count = count[0]?.allNFTs;
        results.results = nftData;
        return res.reply(messages.success("NFT List"), results);
      });
    } catch (error) {
      console.log("Error " + error);
      return res.reply(messages.server_error());
    }
  }

  async getOwnedNFTlist(req, res) {
    console.log("req", req.body);
    try {
      let data = [];
      const page = parseInt(req.body.page);
      const limit = parseInt(req.body.limit);
      const startIndex = (page - 1) * limit;
      const endIndex = page * limit;


      let ERCType = "";
      if (req.body.ERCType && req.body.ERCType !== undefined) {
        ERCType = req.body.ERCType;
      }
      let searchText = "";
      if (req.body.searchText && req.body.searchText !== undefined) {
        searchText = req.body.searchText;
      }


      let priceSort = 1;
      if (req.body.priceSort !== undefined) {
        if (req.body.priceSort === "ASC") {
          priceSort = 1;
        } else {
          priceSort = -1;
        }
      }
      let sortArray = [];
      sortArray["OrderData.price"] = priceSort;
      // sortArray["createdOn"] = -1;
      let sortObj = Object.assign({}, sortArray);

      console.log("sortObj", sortObj);

      let searchArray = [];
      searchArray["status"] = 1;
      searchArray["hashStatus"] = 1;

      if (ERCType !== "") {
        searchArray["type"] = ERCType;
      }

      if (searchText !== "") {
        searchArray["name"] = { $regex: new RegExp(searchText), $options: "i" };
      }

      if (req.body.searchType === "owned") {
        searchArray["ownedBy"] = {
          $elemMatch: {
            address: req.body.userWalletAddress?.toLowerCase(),
            quantity: { $gt: 0 },
          },
        };
      } else {
        searchArray["createdBy"] = {
          $in: [mongoose.Types.ObjectId(req.body.userId)],
        };
      }
      // searchArray["OrderData.0"] = { $exists:true }

      let searchObj = Object.assign({}, searchArray);

      let searchArrayCount = [];
      searchArrayCount["status"] = 1;
      searchArrayCount["hashStatus"] = 1;
      if (req.body.searchType === "owned") {
        searchArrayCount["ownedBy"] = {
          $elemMatch: {
            address: req.body.userWalletAddress?.toLowerCase(),
            quantity: { $gt: 0 },
          },
        };
      } else {
        searchArrayCount["createdBy"] = {
          $in: [mongoose.Types.ObjectId(req.body.userId)],
        };
      }
      let searchObjCount = Object.assign({}, searchArrayCount);

      let isOnMarketplaceSearchArray = [];
      isOnMarketplaceSearchArray["$match"] = { "CollectionData.status": 1, "CollectionData.hashStatus": 1 };
      let isOnMarketplaceSearchObj = Object.assign(
        {},
        isOnMarketplaceSearchArray
      );

      console.log("isOnMarketplaceSearchObj", isOnMarketplaceSearchObj);

      await NFT.aggregate([

        {
          $lookup: {
            from: "collections",
            localField: "collectionID",
            foreignField: "_id",
            as: "CollectionData",
          },
        },
        isOnMarketplaceSearchObj,
        {
          $lookup: {
            from: "orders",
            localField: "_id",
            foreignField: "nftID",
            as: "OrderData",
          },
        },
        {
          $lookup: {
            from: "categories",
            localField: "categoryID",
            foreignField: "_id",
            as: "CategoryData",
          },
        },
        {
          $lookup: {
            from: "brands",
            localField: "brandID",
            foreignField: "_id",
            as: "BrandData",
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "createdBy",
            foreignField: "_id",
            as: "UserData",
          },
        },
        { $match: searchObj },
        {
          $project: {
            _id: 1,
            hasOrder: {
              $cond: { if: { $isArray: "$OrderData" }, then: { $size: "$OrderData" }, else: "NA" }
            },
            name: 1,
            type: 1,
            image: 1,
            previewImg: 1,
            description: 1,
            collectionAddress: 1,
            ownedBy: 1,
            user_likes: 1,
            totalQuantity: 1,
            collectionID: 1,
            assetsInfo: 1,
            categoryID: 1,
            tokenID: 1,
            fileType: 1,
            createdBy: 1,
            createdOn: 1,
            attributes: 1,
            totalQuantity: 1,
            "CollectionData._id": 1,
            "CollectionData.name": 1,
            "CollectionData.contractAddress": 1,
            "CollectionData.isOnMarketplace": 1,
            "CollectionData.status": 1,
            "OrderData._id": 1,
            "OrderData.price": 1,
            "OrderData.salesType": 1,
            "OrderData.paymentToken": 1,
            "BrandData._id": 1,
            "BrandData.name": 1,
            "BrandData.logoImage": 1,
            "BrandData.coverImage": 1,

          },
        },
        { $sort: { hasOrder: -1, "OrderData.price": priceSort, createdOn: -1 } },
        { $skip: startIndex },
        { $limit: limit },

      ]).exec(async function (e, nftData) {
        console.log("Error ", e);
        let results = {};
        let count = await NFT.aggregate([

          {
            $lookup: {
              from: "collections",
              localField: "collectionID",
              foreignField: "_id",
              as: "CollectionData",
            },
          },
          isOnMarketplaceSearchObj,
          {
            $lookup: {
              from: "orders",
              localField: "_id",
              foreignField: "nftID",
              as: "OrderData",
            },
          },
          {
            $lookup: {
              from: "categories",
              localField: "categoryID",
              foreignField: "_id",
              as: "CategoryData",
            },
          },
          {
            $lookup: {
              from: "brands",
              localField: "brandID",
              foreignField: "_id",
              as: "BrandData",
            },
          },
          {
            $lookup: {
              from: "users",
              localField: "createdBy",
              foreignField: "_id",
              as: "UserData",
            },
          },
          { $match: searchObjCount },
          {
            $count: "allNFTs"
          }
        ]);
        results.count = count[0]?.allNFTs;
        results.results = nftData;
        return res.reply(messages.success("NFT List"), results);
      });
    } catch (error) {
      console.log("Error " + error);
      return res.reply(messages.server_error());
    }
  }

  async viewNFTByOrder(req, res) {
    try {
      let data = [];
      const page = parseInt(req.body.page);
      const limit = parseInt(req.body.limit);
      const startIndex = (page - 1) * limit;
      const endIndex = page * limit;
      const salesType = req.body.salesType;
      const sortColumn = req.body.sortColumn;
      const sortOrder = req.body.sortOrder;

      let orderData = [];
      await Order.find()
        .distinct("nftID")
        .exec()
        .then((resData) => {
          resData.forEach((element) => {
            orderData.push(mongoose.Types.ObjectId(element.nftID));
          });
        })
        .catch((e) => {
          console.log("Error", e);
        });

      console.log("orderData ", orderData);
      let searchArray = [];
      searchArray["_id"] = { $in: orderData };
      searchArray["status"] = 1;
      searchArray["hashStatus"] = 1;

      let searchObj = Object.assign({}, searchArray);
      console.log("searchArray", searchArray);

      let nfts = await NFT.aggregate([
        { $match: searchObj },
        {
          $lookup: {
            from: "collections",
            localField: "collectionID",
            foreignField: "_id",
            as: "CollectionData",
          },
        },
        {
          $lookup: {
            from: "categories",
            localField: "categoryID",
            foreignField: "_id",
            as: "CategoryData",
          },
        },
        {
          $lookup: {
            from: "brands",
            localField: "brandID",
            foreignField: "_id",
            as: "BrandData",
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "createdBy",
            foreignField: "_id",
            as: "UserData",
          },
        },
        { $skip: startIndex },
        { $limit: limit },
        { $sort: { createdOn: -1 } },
      ]).exec(function (e, nftData) {
        console.log("Error ", e);
        return res.reply(messages.success("NFT List"), nftData);
      });
    } catch (error) {
      console.log("Error " + error);
      return res.reply(messages.server_error());
    }
  }

  async getUserOnSaleNfts(req, res) {
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
        endIndex <
        (await NFT.countDocuments({ _id: { $in: OrderIdsss } }).exec())
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
  }

  async updateCollection(req, res) {
    try {
      if (!req.userId) return res.reply(messages.unauthorized());
      allowedMimes = ["image/jpeg", "image/jpg", "image/png", "image/gif"];
      errAllowed = "JPG, JPEG, PNG,GIF";
      let collectionAddress = "";

      uploadBanner.fields([
        { name: "logoImage", maxCount: 1 },
        { name: "coverImage", maxCount: 1 },
      ])(req, res, function (error) {
        let updateData = [];
        let nftupdateData = [];
        let collectionID = req.body.id;
        if ( req.files && req.files.logoImage && req.files.logoImage[0] && req.files.logoImage[0].location ) {
          updateData["logoImage"] = req.files.logoImage[0].location;
        }
        if ( req.files && req.files.coverImage && req.files.coverImage[0] && req.files.coverImage[0].location ) {
          updateData["coverImage"] = req.files.coverImage[0].location;
        }
        if (req.body) {
          if (req.body.price) {
            updateData["price"] = req.body.price;
          }

          if (req.body.name) {
            updateData["name"] = req.body.name;
          }

          if (req.body.description) {
            updateData["description"] = req.body.description;
          }

          if (req.body.symbol) {
            updateData["symbol"] = req.body.symbol;
          }

          if (req.body.isHotCollection) {
            updateData["isHotCollection"] = req.body.isHotCollection;
          }

          if (req.body.isExclusive) {
            updateData["isExclusive"] = req.body.isExclusive;
          }

          if (req.body.isMinted) {
            updateData["isMinted"] = req.body.isMinted;
          }

          if (req.body.categoryID) {
            updateData["categoryID"] = req.body.categoryID;
            nftupdateData["categoryID"] = req.body.categoryID;
          }

          if (req.body.brandID) {
            updateData["brandID"] = req.body.brandID;
            nftupdateData["brandID"] = req.body.brandID;
          }
          if (req.body.totalSupply && req.body.totalSupply !== undefined && req.body.totalSupply !== null && req.body.totalSupply !== "null") {
            updateData["totalSupply"] = req.body.totalSupply;
          }
          if (req.body.royalty) {
            updateData["royalty"] = req.body.royalty;
          }
          if (req.body.isImported) {
            updateData["isImported"] = req.body.isImported;
            if (req.body.isImported === 1) {
              updateData["status"] = 1;
              updateData["hashStatus"] = 1;
            }
          }
          if (req.body.preSaleStartTime && req.body.preSaleStartTime !== null && req.body.preSaleStartTime !== "null" && req.body.preSaleStartTime !== undefined) {
            updateData["preSaleStartTime"] = req.body.preSaleStartTime;
          }
          if ( req.body.preSaleEndTime && req.body.preSaleEndTime !== null && req.body.preSaleEndTime !== "null" && req.body.preSaleEndTime !== undefined ) {
            updateData["preSaleEndTime"] = req.body.preSaleEndTime;
          }
          if (req.body.isDeployed !== "" && req.body.isDeployed !== undefined) {
            updateData["isDeployed"] = req.body.isDeployed;
          }
          if (req.body.link !== "" && req.body.link !== undefined) {
            updateData["link"] = req.body.link;
          }
          if ( req.body.contractAddress !== "" && req.body.contractAddress !== undefined ) {
            updateData["contractAddress"] = req.body.contractAddress;
            collectionAddress = req.body.contractAddress;
          }
          if ( req.body.isOnMarketplace !== "" && req.body.isOnMarketplace !== undefined ) {
            updateData["isOnMarketplace"] = req.body.isOnMarketplace;
          }
          updateData["lastUpdatedBy"] = req.userId;
          updateData["lastUpdatedOn"] = Date.now();

          if (req.body.contractName) {
            updateData["contractName"] = req.body.contractName;
          }
          if (req.body.totalSupplyField) {
            updateData["totalSupplyField"] = req.body.totalSupplyField;
          }
        }
        let updateObj = Object.assign({}, updateData);
        console.log("updateObj", updateObj)
        let nftupdateObj = Object.assign({}, nftupdateData);
        if(contractAddress !== ""){
          Collection.find({ contractAddress : collectionAddress })
          .exec().then((res) => {
            if(res.length === 0){
              Collection.findByIdAndUpdate(
                { _id: mongoose.Types.ObjectId(collectionID) },
                { $set: updateObj }
              ).then((collection) => {
                NFT.updateMany(
                  { collectionID: mongoose.Types.ObjectId(collectionID) },
                  nftupdateObj,
                  function (err, docs) {
                    if (err) {
                      console.log(err);
                    } else {
                      console.log("NFT updated");
                    }
                  }
                );
                return res.reply(messages.updated("Collection Updated successfully."), collection);
              });
            }else{
              return res.reply(messages.already_exists("Collection"));
            }
          })
        }else{  
          Collection.findByIdAndUpdate(
            { _id: mongoose.Types.ObjectId(collectionID) },
            { $set: updateObj }
          ).then((collection) => {
            NFT.updateMany(
              { collectionID: mongoose.Types.ObjectId(collectionID) },
              nftupdateObj,
              function (err, docs) {
                if (err) {
                  console.log(err);
                } else {
                  console.log("NFT updated");
                }
              }
            );
            return res.reply(messages.updated("Collection Updated successfully."), collection);
          });
        }
      });
    } catch (error) {
      return res.reply(messages.server_error());
    }
  }

  async getCollectionDetails(req, res) {
    try {
      if (!req.params.collection) {
        return res.reply(messages.not_found("Request"));
      }
      let searchKey = req.params.collection;
      Collection.findOne(
        { $or: [{ name: searchKey }, { contractAddress: searchKey }] },
        (err, collection) => {
          if (err) return res.reply(messages.server_error());
          if (!collection) return res.reply(messages.not_found("Collection"));
          return res.reply(
            messages.successfully("Collection Details Found"),
            collection
          );
        }
      );
    } catch (error) {
      return res.reply(messages.server_error());
    }
  }
  async updateCollectionToken(req, res) {
    try {
      if (!req.params.collectionAddress)
        return res.reply(messages.not_found("Contract Address Not Found"));
      const contractAddress = req.params.collectionAddress;

      const collection = await Collection.findOne({
        contractAddress: contractAddress,
      });
      let nextID = collection.getNextID();

      collection.nextID = nextID + 1;
      collection.save();
      return res.reply(messages.success("Token Updated", nextID + 1));
    } catch (error) {
      return res.reply(messages.server_error());
    }
  }

  // async viewCollection(req, res) {
  //   try {
  //     if (!req.params.collectionID)
  //       return res.reply(messages.not_found("Collection ID"));
  //     if (!validators.isValidObjectID(req.params.collectionID))
  //       res.reply(messages.invalid("Collection ID"));

  //     let collectionData = await Collection.findById(
  //       req.params.collectionID
  //     ).populate({
  //       path: "createdBy",
  //       options: {
  //         limit: 1,
  //       },
  //     });

  //     if (!collectionData) return res.reply(messages.not_found("Collection"));
  //     collectionData = collectionData.toObject();

  //     var token = req.headers.authorization;

  //     req.userId =
  //       req.userId && req.userId != undefined && req.userId != null
  //         ? req.userId
  //         : "";

  //     let likeARY =
  //       aNFT.user_likes && aNFT.user_likes.length
  //         ? aNFT.user_likes.filter((v) => v.toString() == req.userId.toString())
  //         : [];
  //     if (token) {
  //       token = token.replace("Bearer ", "");
  //       jwt.verify(token, process.env.JWT_SECRET, function (err, decoded) {
  //         if (decoded) req.userId = decoded.id;
  //       });

  //       if (aNFT.oCurrentOwner._id != req.userId)
  //         await NFT.findByIdAndUpdate(req.params.nNFTId, {
  //           $inc: {
  //             nView: 1,
  //           },
  //         });
  //     }
  //     aNFT.loggedinUserId = req.userId;
  //     console.log("---------------------------8");

  //     if (!aNFT) {
  //       console.log("---------------------------9");

  //       return res.reply(messages.not_found("NFT"));
  //     }
  //     console.log("---------------------------10");

  //     return res.reply(messages.success(), aNFT);
  //   } catch (error) {
  //     return res.reply(messages.server_error());
  //   }
  // }

  // async getUpcomingCollections(req, res) {
  //   try {
  //     let data = [];
  //     const page = parseInt(req.body.page);
  //     const limit = parseInt(req.body.limit);
  //     const startIndex = (page - 1) * limit;
  //     const endIndex = page * limit;

  //     let searchText = "";
  //     if (req.body.searchText && req.body.searchText !== undefined) {
  //       searchText = req.body.searchText;
  //     }
  //     let searchArray = [];
  //     searchArray["preSaleStartTime"] = { $lt: new Date() };
  //     if (searchText !== "") {
  //       searchArray["$or"] = [
  //         { name: { $regex: new RegExp(searchText), $options: "i" } },
  //         {
  //           contractAddress: { $regex: new RegExp(searchText), $options: "i" },
  //         },
  //       ];
  //     }
  //     let searchObj = Object.assign({}, searchArray);

  //     const results = {};
  //     if (endIndex < (await Collection.countDocuments(searchObj).exec())) {
  //       results.next = {
  //         page: page + 1,
  //         limit: limit,
  //       };
  //     }
  //     if (startIndex > 0) {
  //       results.previous = {
  //         page: page - 1,
  //         limit: limit,
  //       };
  //     }

  //     await Collection.find(searchObj)
  //       .populate("categoryID")
  //       .populate("brandID")
  //       .sort({ createdOn: -1 })
  //       .limit(limit)
  //       .skip(startIndex)
  //       .lean()
  //       .exec()
  //       .then((res) => {
  //         data.push(res);
  //       })
  //       .catch((e) => {
  //         console.log("Error", e);
  //       });
  //     results.count = await Collection.countDocuments(searchObj).exec();
  //     results.results = data;
  //     res.header("Access-Control-Max-Age", 600);
  //     return res.reply(messages.success("Collection List"), results);
  //   } catch (error) {
  //     console.log("Error " + error);
  //     return res.reply(messages.server_error());
  //   }
  // }

  // async likeNFT(req, res) {
  //   try {
  //     if (!req.userId) return res.reply(messages.unauthorized());
  //     let { id } = req.body;
  //     return NFT.findOne({ _id: mongoose.Types.ObjectId(id) }).then(
  //       async (NFTData) => {
  //         if (NFTData && NFTData != null) {
  //           let likeMAINarray = [];
  //           likeMAINarray = NFTData.nUser_likes;
  //           let flag = "";
  //           let likeARY =
  //             likeMAINarray && likeMAINarray.length
  //               ? likeMAINarray.filter(
  //                   (v) => v.toString() == req.userId.toString()
  //                 )
  //               : [];
  //           if (likeARY && likeARY.length) {
  //             flag = "dislike";
  //             var index = likeMAINarray.indexOf(likeARY[0]);
  //             if (index != -1) {
  //               likeMAINarray.splice(index, 1);
  //             }
  //           } else {
  //             flag = "like";
  //             likeMAINarray.push(mongoose.Types.ObjectId(req.userId));
  //           }
  //           await NFT.findByIdAndUpdate(
  //             { _id: mongoose.Types.ObjectId(id) },
  //             { $set: { nUser_likes: likeMAINarray } }
  //           ).then((user) => {
  //             if (flag == "like") {
  //               return res.reply(messages.updated("NFT liked successfully."));
  //             } else {
  //               return res.reply(messages.updated("NFT unliked successfully."));
  //             }
  //           });
  //         } else {
  //           return res.reply(messages.bad_request("NFT not found."));
  //         }
  //       }
  //     );
  //   } catch (error) {
  //     log.red(error);
  //     return res.reply(messages.server_error());
  //   }
  // }

  // async getNftOwner(req, res) {
  //   try {
  //     // if (!req.userId) return res.reply(messages.unauthorized());
  //     // if (!req.params.nNFTId) return res.reply(messages.not_found("NFT ID"));
  //     console.log("user id && NFTId -->", req.userId, req.params.nNFTId);

  //     let nftOwner = {};

  //     nftOwner = await NFTowners.findOne({
  //       nftId: req.params.nNFTId,
  //       oCurrentOwner: req.userId,
  //     });
  //     if (!nftOwner) {
  //       nftOwner = await NFTowners.findOne(
  //         { nftId: req.params.nNFTId },
  //         {},
  //         { sort: { sCreated: -1 } }
  //       );
  //       console.log("nft owner is-->", nftOwner);
  //       return res.reply(messages.success(), nftOwner);
  //     } else {
  //       if (nftOwner.oCurrentOwner) {
  //         users = await User.findOne(nftOwner.oCurrentOwner);
  //         nftOwner.oCurrentOwner = users;
  //       }
  //       console.log("nft owner is-->", nftOwner);
  //       return res.reply(messages.success(), nftOwner);
  //     }
  //   } catch (e) {
  //     console.log("error in getNftOwner is-->", e);
  //     return e;
  //   }
  // }

  // async getAllnftOwner(req, res) {
  //   try {
  //     console.log("All Nft Called -->", req.params.nNFTId);

  //     let nftOwner = {};

  //     nftOwner = await NFTowners.find({ nftId: req.params.nNFTId });
  //     return res.reply(messages.success(), nftOwner);
  //   } catch (e) {
  //     console.log("error in getNftOwner is-->", e);
  //     return e;
  //   }
  // }

  // async mynftlist(req, res) {
  //   try {
  //     if (!req.userId) return res.reply(messages.unauthorized());

  //     var nLimit = parseInt(req.body.length);
  //     var nOffset = parseInt(req.body.start);
  //     let oTypeQuery = {},
  //       oSellingTypeQuery = {},
  //       oSortingOrder = {};
  //     log.red(req.body);
  //     if (req.body.eType[0] != "All" && req.body.eType[0] != "") {
  //       oTypeQuery = {
  //         $or: [],
  //       };
  //       req.body.eType.forEach((element) => {
  //         oTypeQuery["$or"].push({
  //           eType: element,
  //         });
  //       });
  //     }

  //     let oCollectionQuery = {};
  //     if (req.body.sCollection != "All" && req.body.sCollection != "") {
  //       oCollectionQuery = {
  //         sCollection: req.body.sCollection,
  //       };
  //     }

  //     if (req.body.sSellingType != "") {
  //       oSellingTypeQuery = {
  //         eAuctionType: req.body.sSellingType,
  //       };
  //     }

  //     if (req.body.sSortingType == "Recently Added") {
  //       oSortingOrder["sCreated"] = -1;
  //     } else if (req.body.sSortingType == "Most Viewed") {
  //       oSortingOrder["nView"] = -1;
  //     } else if (req.body.sSortingType == "Price Low to High") {
  //       oSortingOrder["nBasePrice"] = 1;
  //     } else if (req.body.sSortingType == "Price High to Low") {
  //       oSortingOrder["nBasePrice"] = -1;
  //     } else {
  //       oSortingOrder["_id"] = -1;
  //     }

  //     let data = await NFT.aggregate([
  //       {
  //         $match: {
  //           $and: [
  //             oTypeQuery,
  //             oCollectionQuery,
  //             oSellingTypeQuery,
  //             {
  //               $or: [
  //                 {
  //                   oCurrentOwner: mongoose.Types.ObjectId(req.userId),
  //                 },
  //               ],
  //             },
  //           ],
  //         },
  //       },
  //       {
  //         $sort: oSortingOrder,
  //       },
  //       {
  //         $project: {
  //           _id: 1,
  //           sName: 1,
  //           eType: 1,
  //           nBasePrice: 1,
  //           collectionImage: 1,
  //           nQuantity: 1,
  //           nTokenID: 1,
  //           oCurrentOwner: 1,
  //           sTransactionStatus: 1,
  //           eAuctionType: 1,

  //           sGenre: 1,
  //           sBpm: 1,
  //           skey_equalTo: 1,
  //           skey_harmonicTo: 1,
  //           track_cover: 1,

  //           user_likes: {
  //             $size: {
  //               $filter: {
  //                 input: "$user_likes",
  //                 as: "user_likes",
  //                 cond: {
  //                   $eq: ["$$user_likes", mongoose.Types.ObjectId(req.userId)],
  //                 },
  //               },
  //             },
  //           },
  //           user_likes_size: {
  //             $cond: {
  //               if: {
  //                 $isArray: "$user_likes",
  //               },
  //               then: {
  //                 $size: "$user_likes",
  //               },
  //               else: 0,
  //             },
  //           },
  //         },
  //       },
  //       {
  //         $project: {
  //           _id: 1,
  //           sName: 1,
  //           eType: 1,
  //           nBasePrice: 1,
  //           collectionImage: 1,
  //           nQuantity: 1,
  //           nTokenID: 1,
  //           oCurrentOwner: 1,
  //           sTransactionStatus: 1,
  //           eAuctionType: 1,
  //           sGenre: 1,
  //           sBpm: 1,
  //           skey_equalTo: 1,
  //           skey_harmonicTo: 1,
  //           track_cover: 1,

  //           is_user_like: {
  //             $cond: {
  //               if: {
  //                 $gte: ["$user_likes", 1],
  //               },
  //               then: "true",
  //               else: "false",
  //             },
  //           },
  //           user_likes_size: 1,
  //         },
  //       },
  //       {
  //         $lookup: {
  //           from: "users",
  //           localField: "oCurrentOwner",
  //           foreignField: "_id",
  //           as: "oUser",
  //         },
  //       },
  //       { $unwind: "$oUser" },
  //       {
  //         $facet: {
  //           nfts: [
  //             {
  //               $skip: +nOffset,
  //             },
  //             {
  //               $limit: +nLimit,
  //             },
  //           ],
  //           totalCount: [
  //             {
  //               $count: "count",
  //             },
  //           ],
  //         },
  //       },
  //     ]);
  //     let iFiltered = data[0].nfts.length;
  //     if (data[0].totalCount[0] == undefined) {
  //       return res.reply(messages.success("Data"), {
  //         data: 0,
  //         draw: req.body.draw,
  //         recordsTotal: 0,
  //         recordsFiltered: iFiltered,
  //       });
  //     } else {
  //       return res.reply(messages.no_prefix("NFT Details"), {
  //         data: data[0].nfts,
  //         draw: req.body.draw,
  //         recordsTotal: data[0].totalCount[0].count,
  //         recordsFiltered: iFiltered,
  //       });
  //     }
  //   } catch (error) {
  //     return res.reply(messages.server_error());
  //   }
  // }

  // async getHotCollections(req, res) {
  //   try {
  //     let data = [];
  //     let setConditions = {};
  //     let sTextsearch = req.body.sTextsearch;
  //     const erc721 = req.body.erc721;

  //     if (req.body.conditions) {
  //       setConditions = req.body.conditions;
  //     }

  //     //sortKey is the column
  //     const sortKey = req.body.sortKey ? req.body.sortKey : "";

  //     //sortType will let you choose from ASC 1 or DESC -1
  //     const sortType = req.body.sortType ? req.body.sortType : -1;

  //     var sortObject = {};
  //     var stype = sortKey;
  //     var sdir = sortType;
  //     sortObject[stype] = sdir;

  //     let CollectionSearchArray = [];
  //     if (sTextsearch !== "") {
  //       CollectionSearchArray["sName"] = {
  //         $regex: new RegExp(sTextsearch),
  //         $options: "<options>",
  //       };
  //     }

  //     if (erc721 !== "" && erc721) {
  //       CollectionSearchArray["erc721"] = true;
  //     }
  //     if (erc721 !== "" && erc721 === false) {
  //       CollectionSearchArray["erc721"] = false;
  //     }
  //     let CollectionSearchObj = Object.assign({}, CollectionSearchArray);

  //     const page = parseInt(req.body.page);
  //     const limit = parseInt(req.body.limit);

  //     const startIndex = (page - 1) * limit;
  //     const endIndex = page * limit;

  //     const results = {};

  //     if (
  //       endIndex < (await Collection.countDocuments(CollectionSearchObj).exec())
  //     ) {
  //       results.next = {
  //         page: page + 1,
  //         limit: limit,
  //       };
  //     }

  //     if (startIndex > 0) {
  //       results.previous = {
  //         page: page - 1,
  //         limit: limit,
  //       };
  //     }

  //     let aCollections = await Collection.aggregate([
  //       {
  //         $lookup: {
  //           from: "users",
  //           localField: "oCreatedBy",
  //           foreignField: "_id",
  //           as: "oUser",
  //         },
  //       },
  //       {
  //         $sort: {
  //           sCreated: req.body.sortType,
  //         },
  //       },
  //       { $match: CollectionSearchObj },
  //       {
  //         $skip: (page - 1) * limit,
  //       },
  //       {
  //         $limit: limit,
  //       },
  //     ]);

  //     results.results = aCollections;
  //     results.count = await Collection.countDocuments(
  //       CollectionSearchObj
  //     ).exec();
  //     console.log("Collections", data);
  //     res.header("Access-Control-Max-Age", 600);
  //     return res.reply(messages.no_prefix("Collections List"), results);
  //   } catch (e) {
  //     return res.reply(messages.error(e));
  //   }
  // }

  // async collectionlistMy(req, res) {
  //   try {
  //     if (!req.userId) return res.reply(messages.unauthorized());

  //     var nLimit = parseInt(req.body.length);
  //     var nOffset = parseInt(req.body.start);

  //     let query = {
  //       oCreatedBy: mongoose.Types.ObjectId(req.userId),
  //     };
  //     if (req && req.body.sTextsearch && req.body.sTextsearch != undefined) {
  //       query["sName"] = new RegExp(req.body.sTextsearch, "i");
  //     }

  //     let aCollections = await Collection.aggregate([
  //       {
  //         $match: query,
  //       },
  //       {
  //         $lookup: {
  //           from: "users",
  //           localField: "oCreatedBy",
  //           foreignField: "_id",
  //           as: "oUser",
  //         },
  //       },
  //       {
  //         $unwind: { preserveNullAndEmptyArrays: true, path: "$oUser" },
  //       },
  //       {
  //         $sort: {
  //           sCreated: -1,
  //         },
  //       },
  //       {
  //         $facet: {
  //           collections: [
  //             {
  //               $skip: +nOffset,
  //             },
  //             {
  //               $limit: +nLimit,
  //             },
  //           ],
  //           totalCount: [
  //             {
  //               $count: "count",
  //             },
  //           ],
  //         },
  //       },
  //     ]);

  //     let iFiltered = aCollections[0].collections.length;
  //     if (aCollections[0].totalCount[0] == undefined) {
  //       return res.reply(messages.success("Data"), {
  //         aCollections: 0,
  //         draw: req.body.draw,
  //         recordsTotal: 0,
  //         recordsFiltered: iFiltered,
  //       });
  //     } else {
  //       return res.reply(messages.no_prefix("Collection Details"), {
  //         data: aCollections[0].collections,
  //         draw: req.body.draw,
  //         recordsTotal: aCollections[0].totalCount[0].count,
  //         recordsFiltered: iFiltered,
  //       });
  //     }
  //   } catch (error) {
  //     return res.reply(messages.server_error());
  //   }
  // }

  // async nftListing(req, res) {
  //   try {
  //     var nLimit = parseInt(req.body.length);
  //     var nOffset = parseInt(req.body.start);
  //     let sBPMQuery = {};
  //     let sGenreQuery = {};
  //     let oTypeQuery = {},
  //       oSellingTypeQuery = {},
  //       oSortingOrder = {};
  //     let oTtextQuery = {
  //       sName: new RegExp(req.body.sTextsearch, "i"),
  //     };
  //     if (req.body.eType[0] != "All" && req.body.eType[0] != "") {
  //       oTypeQuery = {
  //         $or: [],
  //       };
  //       req.body.eType.forEach((element) => {
  //         oTypeQuery["$or"].push({
  //           eType: element,
  //         });
  //       });
  //     }
  //     if (
  //       req.body.sFrom &&
  //       req.body.sFrom != undefined &&
  //       req.body.sFrom != "" &&
  //       req.body.sTo &&
  //       req.body.sTo != undefined &&
  //       req.body.sTo != ""
  //     ) {
  //       sBPMQuery = {
  //         sBpm: {
  //           $gte: parseInt(req.body.sFrom),
  //           $lte: parseInt(req.body.sTo),
  //         },
  //       };
  //     }

  //     if (req.body.sSortingType == "Recently Added") {
  //       oSortingOrder["sCreated"] = -1;
  //     } else if (req.body.sSortingType == "Most Viewed") {
  //       oSortingOrder["nView"] = -1;
  //     } else if (req.body.sSortingType == "Price Low to High") {
  //       oSortingOrder["nBasePrice"] = 1;
  //     } else if (req.body.sSortingType == "Price High to Low") {
  //       oSortingOrder["nBasePrice"] = -1;
  //     } else {
  //       oSortingOrder["_id"] = -1;
  //     }

  //     if (
  //       req.body.sGenre &&
  //       req.body.sGenre != undefined &&
  //       req.body.sGenre.length
  //     ) {
  //       sGenreQuery = {
  //         sGenre: { $in: req.body.sGenre },
  //       };
  //     }

  //     if (req.body.sSellingType != "") {
  //       oSellingTypeQuery = {
  //         $or: [
  //           {
  //             eAuctionType: req.body.sSellingType,
  //           },
  //         ],
  //       };
  //     }

  //     let data = await NFT.aggregate([
  //       {
  //         $match: {
  //           $and: [
  //             {
  //               sTransactionStatus: {
  //                 $eq: 1,
  //               },
  //             },
  //             {
  //               eAuctionType: {
  //                 $ne: "Unlockable",
  //               },
  //             },
  //             oTypeQuery,
  //             oTtextQuery,
  //             oSellingTypeQuery,
  //             sBPMQuery,
  //             sGenreQuery,
  //           ],
  //         },
  //       },
  //       {
  //         $sort: oSortingOrder,
  //       },
  //       {
  //         $project: {
  //           _id: 1,
  //           sName: 1,
  //           eType: 1,
  //           nBasePrice: 1,
  //           collectionImage: 1,
  //           oCurrentOwner: 1,
  //           eAuctionType: 1,
  //           sGenre: 1,
  //           sBpm: 1,
  //           skey_equalTo: 1,
  //           skey_harmonicTo: 1,
  //           track_cover: 1,
  //           user_likes: {
  //             $size: {
  //               $filter: {
  //                 input: "$user_likes",
  //                 as: "user_likes",
  //                 cond: {
  //                   $eq: [
  //                     "$$user_likes",
  //                     req.userId &&
  //                     req.userId != undefined &&
  //                     req.userId != null
  //                       ? mongoose.Types.ObjectId(req.userId)
  //                       : "",
  //                   ],
  //                 },
  //               },
  //             },
  //           },
  //           user_likes_size: {
  //             $cond: {
  //               if: {
  //                 $isArray: "$user_likes",
  //               },
  //               then: {
  //                 $size: "$user_likes",
  //               },
  //               else: 0,
  //             },
  //           },
  //         },
  //       },
  //       {
  //         $project: {
  //           _id: 1,
  //           sName: 1,
  //           eType: 1,
  //           nBasePrice: 1,
  //           collectionImage: 1,
  //           oCurrentOwner: 1,
  //           eAuctionType: 1,
  //           sGenre: 1,
  //           sBpm: 1,
  //           skey_equalTo: 1,
  //           skey_harmonicTo: 1,
  //           track_cover: 1,
  //           is_user_like: {
  //             $cond: {
  //               if: {
  //                 $gte: ["$user_likes", 1],
  //               },
  //               then: "true",
  //               else: "false",
  //             },
  //           },
  //           user_likes_size: 1,
  //         },
  //       },
  //       {
  //         $lookup: {
  //           from: "users",
  //           localField: "oCurrentOwner",
  //           foreignField: "_id",
  //           as: "oUser",
  //         },
  //       },
  //       { $unwind: "$oUser" },
  //       {
  //         $facet: {
  //           nfts: [
  //             {
  //               $skip: +nOffset,
  //             },
  //             {
  //               $limit: +nLimit,
  //             },
  //           ],
  //           totalCount: [
  //             {
  //               $count: "count",
  //             },
  //           ],
  //         },
  //       },
  //     ]);
  //     let iFiltered = data[0].nfts.length;
  //     if (data[0].totalCount[0] == undefined) {
  //       return res.reply(messages.success("Data"), {
  //         data: 0,
  //         draw: req.body.draw,
  //         recordsTotal: 0,
  //         recordsFiltered: iFiltered,
  //       });
  //     } else {
  //       return res.reply(messages.no_prefix("NFT Details"), {
  //         data: data[0].nfts,
  //         draw: req.body.draw,
  //         recordsTotal: data[0].totalCount[0].count,
  //         recordsFiltered: iFiltered,
  //       });
  //     }
  //   } catch (error) {
  //     return res.reply(messages.server_error());
  //   }
  // }

  // async nftID(req, res) {
  //   try {
  //     if (!req.params.nNFTId) return res.reply(messages.not_found("NFT ID"));

  //     if (!validators.isValidObjectID(req.params.nNFTId))
  //       res.reply(messages.invalid("NFT ID"));

  //     let aNFT = await NFT.findById(req.params.nNFTId).populate({
  //       path: "nCreater",
  //       options: {
  //         limit: 1,
  //       },
  //       select: {
  //         sWalletAddress: 1,
  //         _id: 1,
  //         sProfilePicUrl: 1,
  //       },
  //     });

  //     if (!aNFT) return res.reply(messages.not_found("NFT"));
  //     aNFT = aNFT.toObject();
  //     aNFT.sCollectionDetail = {};

  //     aNFT.sCollectionDetail = await Collection.findOne({
  //       sName:
  //         aNFT.sCollection && aNFT.sCollection != undefined
  //           ? aNFT.sCollection
  //           : "-",
  //     });

  //     var token = req.headers.authorization;

  //     req.userId =
  //       req.userId && req.userId != undefined && req.userId != null
  //         ? req.userId
  //         : "";

  //     let likeARY =
  //       aNFT.user_likes && aNFT.user_likes.length
  //         ? aNFT.user_likes.filter((v) => v.toString() == req.userId.toString())
  //         : [];

  //     // if (likeARY && likeARY.length) {
  //     //   aNFT.is_user_like = "true";
  //     // } else {
  //     //   aNFT.is_user_like = "false";
  //     // }

  //     //
  //     if (token) {
  //       token = token.replace("Bearer ", "");
  //       jwt.verify(token, process.env.JWT_SECRET, function (err, decoded) {
  //         if (decoded) req.userId = decoded.id;
  //       });

  //       if (aNFT.oCurrentOwner._id != req.userId)
  //         await NFT.findByIdAndUpdate(req.params.nNFTId, {
  //           $inc: {
  //             nView: 1,
  //           },
  //         });
  //     }
  //     aNFT.loggedinUserId = req.userId;
  //     console.log("---------------------------8");

  //     if (!aNFT) {
  //       console.log("---------------------------9");

  //       return res.reply(messages.not_found("NFT"));
  //     }
  //     console.log("---------------------------10");

  //     return res.reply(messages.success(), aNFT);
  //   } catch (error) {
  //     return res.reply(messages.server_error());
  //   }
  // }

  // async deleteNFT(req, res) {
  //   try {
  //     if (!req.params.nNFTId) return res.reply(messages.not_found("NFT ID"));

  //     if (!validators.isValidObjectID(req.params.nNFTId))
  //       res.reply(messages.invalid("NFT ID"));

  //     await NFT.findByIdAndDelete(req.params.nNFTId);
  //     return res.reply(messages.success("NFT deleted"));
  //   } catch (error) {
  //     return res.reply(messages.server_error());
  //   }
  // }

  // async getCollectionDetails(req, res) {
  //   try {
  //     // if (!req.userId) {
  //     //     return res.reply(messages.unauthorized());
  //     // }
  //     Collection.findOne({ _id: req.body.collectionId }, (err, collection) => {
  //       if (err) return res.reply(messages.server_error());
  //       if (!collection) return res.reply(messages.not_found("Collection"));
  //       return res.reply(messages.no_prefix("Collection Details"), collection);
  //     });
  //   } catch (error) {
  //     return res.reply(messages.server_error());
  //   }
  // }

  // async setTransactionHash(req, res) {
  //   try {
  //     // if (!req.body.nTokenID) return res.reply(messages.not_found("Token ID"));
  //     if (!req.body.nNFTId) return res.reply(messages.not_found("NFT ID"));
  //     if (!req.body.sTransactionHash)
  //       return res.reply(messages.not_found("Transaction Hash"));

  //     if (!validators.isValidObjectID(req.body.nNFTId))
  //       res.reply(messages.invalid("NFT ID"));
  //     // if (req.body.nTokenID <= 0) res.reply(messages.invalid("Token ID"));
  //     if (!validators.isValidTransactionHash(req.body.sTransactionHash))
  //       res.reply(messages.invalid("Transaction Hash"));

  //     NFT.findByIdAndUpdate(
  //       req.body.nNFTId,
  //       {
  //         // nTokenID: req.body.nTokenID,
  //         sTransactionHash: req.body.sTransactionHash,
  //         sTransactionStatus: 0,
  //       },
  //       (err, nft) => {
  //         if (err) return res.reply(messages.server_error());
  //         if (!nft) return res.reply(messages.not_found("NFT"));

  //         return res.reply(messages.updated("NFT Details"));
  //       }
  //     );
  //   } catch (error) {
  //     return res.reply(messages.server_error());
  //   }
  // }

  // async landing(req, res) {
  //   try {
  //     console.log("---------------------1");

  //     req.userId =
  //       req.userId && req.userId != undefined && req.userId != null
  //         ? req.userId
  //         : "";
  //     console.log("---------------------2", req.userId);

  //     let data = await NFT.aggregate([
  //       {
  //         $facet: {
  //           recentlyAdded: [
  //             {
  //               $match: {
  //                 sTransactionStatus: {
  //                   $eq: 1,
  //                 },
  //                 eAuctionType: {
  //                   $ne: "Unlockable",
  //                 },
  //               },
  //             },
  //             {
  //               $sort: {
  //                 _id: -1,
  //               },
  //             },
  //             {
  //               $limit: 10,
  //             },
  //             {
  //               $lookup: {
  //                 from: "users",
  //                 localField: "oCurrentOwner",
  //                 foreignField: "_id",
  //                 as: "aCurrentOwner",
  //               },
  //             },
  //             { $unwind: "$aCurrentOwner" },
  //             {
  //               $project: {
  //                 collectionImage: 1,
  //                 eType: 1,
  //                 sCreated: 1,
  //                 oCurrentOwner: 1,
  //                 oPostedBy: 1,
  //                 sCollection: 1,
  //                 sName: 1,
  //                 sCollaborator: 1,
  //                 sNftdescription: 1,
  //                 nCollaboratorPercentage: 1,
  //                 sSetRRoyaltyPercentage: 1,
  //                 nQuantity: 1,
  //                 nView: 1,
  //                 nBasePrice: 1,
  //                 eAuctionType: 1,
  //                 nTokenID: 1,
  //                 sTransactionHash: 1,
  //                 sTransactionStatus: 1,
  //                 aCurrentOwner: 1,
  //                 sGenre: 1,
  //                 sBpm: 1,
  //                 skey_equalTo: 1,
  //                 skey_harmonicTo: 1,
  //                 track_cover: 1,
  //                 user_likes: {
  //                   $size: {
  //                     $filter: {
  //                       input: "$user_likes",
  //                       as: "user_likes",
  //                       cond: {
  //                         $eq: [
  //                           "$$user_likes",
  //                           req.userId &&
  //                           req.userId != undefined &&
  //                           req.userId != null
  //                             ? mongoose.Types.ObjectId(req.userId)
  //                             : "",
  //                         ],
  //                       },
  //                     },
  //                   },
  //                 },
  //                 user_likes_size: {
  //                   $cond: {
  //                     if: {
  //                       $isArray: "$user_likes",
  //                     },
  //                     then: {
  //                       $size: "$user_likes",
  //                     },
  //                     else: 0,
  //                   },
  //                 },
  //               },
  //             },
  //             {
  //               $project: {
  //                 collectionImage: 1,
  //                 eType: 1,
  //                 sCreated: 1,
  //                 oCurrentOwner: 1,
  //                 oPostedBy: 1,
  //                 sCollection: 1,
  //                 sName: 1,
  //                 sCollaborator: 1,
  //                 sNftdescription: 1,
  //                 nCollaboratorPercentage: 1,
  //                 sSetRRoyaltyPercentage: 1,
  //                 nQuantity: 1,
  //                 nView: 1,
  //                 nBasePrice: 1,
  //                 eAuctionType: 1,
  //                 nTokenID: 1,
  //                 sGenre: 1,
  //                 sBpm: 1,
  //                 skey_equalTo: 1,
  //                 skey_harmonicTo: 1,
  //                 track_cover: 1,
  //                 sTransactionHash: 1,
  //                 sTransactionStatus: 1,
  //                 aCurrentOwner: 1,
  //                 is_user_like: {
  //                   $cond: {
  //                     if: {
  //                       $gte: ["$user_likes", 1],
  //                     },
  //                     then: "true",
  //                     else: "false",
  //                   },
  //                 },
  //                 user_likes_size: 1,
  //               },
  //             },
  //           ],
  //           onSale: [
  //             {
  //               $match: {
  //                 sTransactionStatus: {
  //                   $eq: 1,
  //                 },
  //                 eAuctionType: {
  //                   $eq: "Fixed Sale",
  //                 },
  //               },
  //             },
  //             {
  //               $sort: {
  //                 _id: -1,
  //               },
  //             },
  //             {
  //               $limit: 10,
  //             },
  //             {
  //               $lookup: {
  //                 from: "users",
  //                 localField: "oCurrentOwner",
  //                 foreignField: "_id",
  //                 as: "aCurrentOwner",
  //               },
  //             },
  //             { $unwind: "$aCurrentOwner" },
  //             {
  //               $project: {
  //                 collectionImage: 1,
  //                 eType: 1,
  //                 sCreated: 1,
  //                 oCurrentOwner: 1,
  //                 oPostedBy: 1,
  //                 sCollection: 1,
  //                 sName: 1,
  //                 sCollaborator: 1,
  //                 sNftdescription: 1,
  //                 nCollaboratorPercentage: 1,
  //                 sSetRRoyaltyPercentage: 1,
  //                 nQuantity: 1,
  //                 nView: 1,
  //                 nBasePrice: 1,
  //                 eAuctionType: 1,
  //                 sGenre: 1,
  //                 sBpm: 1,
  //                 skey_equalTo: 1,
  //                 skey_harmonicTo: 1,
  //                 track_cover: 1,
  //                 nTokenID: 1,
  //                 sTransactionHash: 1,
  //                 sTransactionStatus: 1,
  //                 aCurrentOwner: 1,
  //                 user_likes: {
  //                   $size: {
  //                     $filter: {
  //                       input: "$user_likes",
  //                       as: "user_likes",
  //                       cond: {
  //                         $eq: [
  //                           "$$user_likes",
  //                           req.userId &&
  //                           req.userId != undefined &&
  //                           req.userId != null
  //                             ? mongoose.Types.ObjectId(req.userId)
  //                             : "",
  //                         ],
  //                       },
  //                     },
  //                   },
  //                 },
  //                 user_likes_size: {
  //                   $cond: {
  //                     if: {
  //                       $isArray: "$user_likes",
  //                     },
  //                     then: {
  //                       $size: "$user_likes",
  //                     },
  //                     else: 0,
  //                   },
  //                 },
  //               },
  //             },
  //             {
  //               $project: {
  //                 collectionImage: 1,
  //                 eType: 1,
  //                 sCreated: 1,
  //                 oCurrentOwner: 1,
  //                 oPostedBy: 1,
  //                 sCollection: 1,
  //                 sName: 1,
  //                 sCollaborator: 1,
  //                 sNftdescription: 1,
  //                 nCollaboratorPercentage: 1,
  //                 sSetRRoyaltyPercentage: 1,
  //                 nQuantity: 1,
  //                 sGenre: 1,
  //                 sBpm: 1,
  //                 skey_equalTo: 1,
  //                 skey_harmonicTo: 1,
  //                 track_cover: 1,
  //                 nView: 1,
  //                 nBasePrice: 1,
  //                 eAuctionType: 1,
  //                 nTokenID: 1,
  //                 sTransactionHash: 1,
  //                 sTransactionStatus: 1,
  //                 aCurrentOwner: 1,
  //                 is_user_like: {
  //                   $cond: {
  //                     if: {
  //                       $gte: ["$user_likes", 1],
  //                     },
  //                     then: "true",
  //                     else: "false",
  //                   },
  //                 },
  //                 user_likes_size: 1,
  //               },
  //             },
  //           ],
  //           onAuction: [
  //             {
  //               $match: {
  //                 sTransactionStatus: {
  //                   $eq: 1,
  //                 },
  //                 eAuctionType: {
  //                   $eq: "Auction",
  //                 },
  //               },
  //             },
  //             {
  //               $sort: {
  //                 _id: -1,
  //               },
  //             },
  //             {
  //               $limit: 10,
  //             },
  //             {
  //               $lookup: {
  //                 from: "users",
  //                 localField: "oCurrentOwner",
  //                 foreignField: "_id",
  //                 as: "aCurrentOwner",
  //               },
  //             },
  //             { $unwind: "$aCurrentOwner" },
  //             {
  //               $project: {
  //                 collectionImage: 1,
  //                 eType: 1,
  //                 sCreated: 1,
  //                 oCurrentOwner: 1,
  //                 oPostedBy: 1,
  //                 sCollection: 1,
  //                 sName: 1,
  //                 sCollaborator: 1,
  //                 sNftdescription: 1,
  //                 nCollaboratorPercentage: 1,
  //                 sSetRRoyaltyPercentage: 1,
  //                 nQuantity: 1,
  //                 nView: 1,
  //                 sGenre: 1,
  //                 sBpm: 1,
  //                 skey_equalTo: 1,
  //                 skey_harmonicTo: 1,
  //                 track_cover: 1,
  //                 nBasePrice: 1,
  //                 eAuctionType: 1,
  //                 nTokenID: 1,
  //                 sTransactionHash: 1,
  //                 sTransactionStatus: 1,
  //                 aCurrentOwner: 1,
  //                 user_likes: {
  //                   $size: {
  //                     $filter: {
  //                       input: "$user_likes",
  //                       as: "user_likes",
  //                       cond: {
  //                         $eq: [
  //                           "$$user_likes",
  //                           req.userId &&
  //                           req.userId != undefined &&
  //                           req.userId != null
  //                             ? mongoose.Types.ObjectId(req.userId)
  //                             : "",
  //                         ],
  //                       },
  //                     },
  //                   },
  //                 },
  //                 user_likes_size: {
  //                   $cond: {
  //                     if: {
  //                       $isArray: "$user_likes",
  //                     },
  //                     then: {
  //                       $size: "$user_likes",
  //                     },
  //                     else: 0,
  //                   },
  //                 },
  //               },
  //             },
  //             {
  //               $project: {
  //                 collectionImage: 1,
  //                 eType: 1,
  //                 sCreated: 1,
  //                 oCurrentOwner: 1,
  //                 oPostedBy: 1,
  //                 sCollection: 1,
  //                 sName: 1,
  //                 sCollaborator: 1,
  //                 sNftdescription: 1,
  //                 sGenre: 1,
  //                 sBpm: 1,
  //                 skey_equalTo: 1,
  //                 skey_harmonicTo: 1,
  //                 track_cover: 1,
  //                 nCollaboratorPercentage: 1,
  //                 sSetRRoyaltyPercentage: 1,
  //                 nQuantity: 1,
  //                 nView: 1,
  //                 nBasePrice: 1,
  //                 eAuctionType: 1,
  //                 nTokenID: 1,
  //                 sTransactionHash: 1,
  //                 sTransactionStatus: 1,
  //                 aCurrentOwner: 1,
  //                 is_user_like: {
  //                   $cond: {
  //                     if: {
  //                       $gte: ["$user_likes", 1],
  //                     },
  //                     then: "true",
  //                     else: "false",
  //                   },
  //                 },
  //                 user_likes_size: 1,
  //               },
  //             },
  //           ],
  //         },
  //       },
  //     ]);
  //     console.log("---------------------data", data);

  //     data[0].users = [];
  //     data[0].users = await User.find({ sRole: "user" });

  //     let agQuery = [
  //       {
  //         $lookup: {
  //           from: "users",
  //           localField: "oCreatedBy",
  //           foreignField: "_id",
  //           as: "oUser",
  //         },
  //       },
  //       {
  //         $sort: {
  //           sCreated: -1,
  //         },
  //       },
  //       { $unwind: "$oUser" },
  //     ];

  //     data[0].collections = [];
  //     data[0].collections = await Collection.aggregate(agQuery);
  //     return res.reply(messages.success(), data[0]);
  //   } catch (error) {
  //     return res.reply(messages.server_error());
  //   }
  // }

  // async toggleSellingType(req, res) {
  //   try {
  //     if (!req.userId) return res.reply(messages.unauthorized());

  //     if (!req.body.nNFTId) return res.reply(messages.not_found("NFT ID"));
  //     if (!req.body.sSellingType)
  //       return res.reply(messages.not_found("Selling Type"));

  //     if (!validators.isValidObjectID(req.body.nNFTId))
  //       return res.reply(messages.invalid("NFT ID"));
  //     if (!validators.isValidSellingType(req.body.sSellingType))
  //       return res.reply(messages.invalid("Selling Type"));

  //     let oNFT = await NFT.findById(req.body.nNFTId);

  //     if (!oNFT) return res.reply(messages.not_found("NFT"));
  //     if (oNFT.oCurrentOwner != req.userId)
  //       return res.reply(
  //         message.bad_request("Only NFT Owner Can Set Selling Type")
  //       );

  //     let BIdsExist = await Bid.find({
  //       oNFTId: mongoose.Types.ObjectId(req.body.nNFTId),
  //       sTransactionStatus: 1,
  //       eBidStatus: "Bid",
  //     });

  //     if (BIdsExist && BIdsExist != undefined && BIdsExist.length) {
  //       return res.reply(
  //         messages.bad_request("Please Cancel Active bids on this NFT.")
  //       );
  //     } else {
  //       let updObj = {
  //         eAuctionType: req.body.sSellingType,
  //       };

  //       if (
  //         req.body.auction_end_date &&
  //         req.body.auction_end_date != undefined
  //       ) {
  //         updObj.auction_end_date = req.body.auction_end_date;
  //       }
  //       NFT.findByIdAndUpdate(req.body.nNFTId, updObj, (err, nft) => {
  //         if (err) return res.reply(messages.server_error());
  //         if (!nft) return res.reply(messages.not_found("NFT"));

  //         return res.reply(messages.updated("NFT Details"));
  //       });
  //     }
  //   } catch (error) {
  //     return res.reply(messages.server_error());
  //   }
  // }

  // async allCollectionWiselist(req, res) {
  //   console.log("------data--------", req.body);
  //   //    let agQuery = [ {
  //   //         '$lookup': {
  //   //             'from': 'users',
  //   //             'localField': 'oCreatedBy',
  //   //             'foreignField': '_id',
  //   //             'as': 'oUser'
  //   //         }
  //   //     }, {
  //   //         '$sort': {
  //   //             'sCreated': -1
  //   //         }
  //   //     }]

  //   try {
  //     //         let aCollections = await Collection.aggregate(agQuery);

  //     //         if (!aCollections) {
  //     //             return res.reply(messages.not_found('collection'));
  //     //         }

  //     //         return res.reply(messages.no_prefix('Collection Details'), aCollections);

  //     //     } catch (error) {
  //     //         return res.reply(messages.server_error());
  //     //     }

  //     var nLimit = parseInt(req.body.length);
  //     var nOffset = parseInt(req.body.start);
  //     let oTypeQuery = {},
  //       oSellingTypeQuery = {},
  //       oCollectionQuery = {},
  //       oSortingOrder = {};
  //     let oTtextQuery = {
  //       sName: new RegExp(req.body.sTextsearch, "i"),
  //     };
  //     if (req.body.eType[0] != "All" && req.body.eType[0] != "") {
  //       oTypeQuery = {
  //         $or: [],
  //       };
  //       req.body.eType.forEach((element) => {
  //         oTypeQuery["$or"].push({
  //           eType: element,
  //         });
  //       });
  //     }
  //     if (req.body.sCollection != "All" && req.body.sCollection != "") {
  //       oCollectionQuery = {
  //         $or: [],
  //       };
  //       oCollectionQuery["$or"].push({
  //         sCollection: req.body.sCollection,
  //       });
  //     }

  //     if (req.body.sSortingType == "Recently Added") {
  //       oSortingOrder["sCreated"] = -1;
  //     } else if (req.body.sSortingType == "Most Viewed") {
  //       oSortingOrder["nView"] = -1;
  //     } else if (req.body.sSortingType == "Price Low to High") {
  //       oSortingOrder["nBasePrice"] = 1;
  //     } else if (req.body.sSortingType == "Price High to Low") {
  //       oSortingOrder["nBasePrice"] = -1;
  //     } else {
  //       oSortingOrder["_id"] = -1;
  //     }

  //     if (req.body.sSellingType != "") {
  //       oSellingTypeQuery = {
  //         $or: [
  //           {
  //             eAuctionType: req.body.sSellingType,
  //           },
  //         ],
  //       };
  //     }

  //     let data = await NFT.aggregate([
  //       {
  //         $match: {
  //           $and: [
  //             {
  //               sTransactionStatus: {
  //                 $eq: 1,
  //               },
  //             },
  //             {
  //               eAuctionType: {
  //                 $ne: "Unlockable",
  //               },
  //             },
  //             oTypeQuery,
  //             oCollectionQuery,
  //             oTtextQuery,
  //             oSellingTypeQuery,
  //           ],
  //         },
  //       },
  //       {
  //         $sort: oSortingOrder,
  //       },
  //       {
  //         $project: {
  //           _id: 1,
  //           sName: 1,
  //           eType: 1,
  //           nBasePrice: 1,
  //           collectionImage: 1,
  //           oCurrentOwner: 1,
  //           eAuctionType: 1,
  //           sCollection: 1,
  //           sGenre: 1,
  //           sBpm: 1,
  //           skey_equalTo: 1,
  //           skey_harmonicTo: 1,
  //           track_cover: 1,
  //           user_likes: {
  //             $size: {
  //               $filter: {
  //                 input: "$user_likes",
  //                 as: "user_likes",
  //                 cond: {
  //                   $eq: [
  //                     "$$user_likes",
  //                     req.userId &&
  //                     req.userId != undefined &&
  //                     req.userId != null
  //                       ? mongoose.Types.ObjectId(req.userId)
  //                       : "",
  //                   ],
  //                 },
  //               },
  //             },
  //           },
  //           user_likes_size: {
  //             $cond: {
  //               if: {
  //                 $isArray: "$user_likes",
  //               },
  //               then: {
  //                 $size: "$user_likes",
  //               },
  //               else: 0,
  //             },
  //           },
  //         },
  //       },
  //       {
  //         $project: {
  //           _id: 1,
  //           sName: 1,
  //           eType: 1,
  //           nBasePrice: 1,
  //           collectionImage: 1,
  //           oCurrentOwner: 1,
  //           eAuctionType: 1,
  //           sCollection: 1,
  //           sGenre: 1,
  //           sBpm: 1,
  //           skey_equalTo: 1,
  //           skey_harmonicTo: 1,
  //           track_cover: 1,
  //           is_user_like: {
  //             $cond: {
  //               if: {
  //                 $gte: ["$user_likes", 1],
  //               },
  //               then: "true",
  //               else: "false",
  //             },
  //           },
  //           user_likes_size: 1,
  //         },
  //       },
  //       {
  //         $lookup: {
  //           from: "users",
  //           localField: "oCurrentOwner",
  //           foreignField: "_id",
  //           as: "oUser",
  //         },
  //       },
  //       { $unwind: "$oUser" },
  //       {
  //         $facet: {
  //           nfts: [
  //             {
  //               $skip: +nOffset,
  //             },
  //             {
  //               $limit: +nLimit,
  //             },
  //           ],
  //           totalCount: [
  //             {
  //               $count: "count",
  //             },
  //           ],
  //         },
  //       },
  //     ]);
  //     let iFiltered = data[0].nfts.length;
  //     if (data[0].totalCount[0] == undefined) {
  //       return res.reply(messages.success("Data"), {
  //         data: 0,
  //         draw: req.body.draw,
  //         recordsTotal: 0,
  //         recordsFiltered: iFiltered,
  //       });
  //     } else {
  //       return res.reply(messages.no_prefix("NFT Details"), {
  //         data: data[0].nfts,
  //         draw: req.body.draw,
  //         recordsTotal: data[0].totalCount[0].count,
  //         recordsFiltered: iFiltered,
  //       });
  //     }
  //   } catch (error) {
  //     return res.reply(messages.server_error());
  //   }
  // }

  // async updateBasePrice(req, res) {
  //   try {
  //     if (!req.userId) return res.reply(messages.unauthorized());

  //     console.log(req.body);
  //     if (!req.body.nNFTId) return res.reply(messages.not_found("NFT ID"));
  //     if (!req.body.nBasePrice)
  //       return res.reply(messages.not_found("Base Price"));

  //     if (!validators.isValidObjectID(req.body.nNFTId))
  //       return res.reply(messages.invalid("NFT ID"));
  //     if (
  //       isNaN(req.body.nBasePrice) ||
  //       parseFloat(req.body.nBasePrice) <= 0 ||
  //       parseFloat(req.body.nBasePrice) <= 0.000001
  //     )
  //       return res.reply(messages.invalid("Base Price"));

  //     let oNFT = await NFT.findById(req.body.nNFTId);

  //     if (!oNFT) return res.reply(messages.not_found("NFT"));
  //     if (oNFT.oCurrentOwner != req.userId)
  //       return res.reply(
  //         message.bad_request("Only NFT Owner Can Set Base Price")
  //       );

  //     let BIdsExist = await Bid.find({
  //       oNFTId: mongoose.Types.ObjectId(req.body.nNFTId),
  //       sTransactionStatus: 1,
  //       eBidStatus: "Bid",
  //     });

  //     if (BIdsExist && BIdsExist != undefined && BIdsExist.length) {
  //       return res.reply(
  //         messages.bad_request("Please Cancel Active bids on this NFT.")
  //       );
  //     } else {
  //       NFT.findByIdAndUpdate(
  //         req.body.nNFTId,
  //         {
  //           nBasePrice: req.body.nBasePrice,
  //         },
  //         (err, nft) => {
  //           if (err) return res.reply(messages.server_error());
  //           if (!nft) return res.reply(messages.not_found("NFT"));

  //           return res.reply(messages.updated("Price"));
  //         }
  //       );
  //     }
  //   } catch (error) {
  //     console.log(error);
  //     return res.reply(messages.server_error());
  //   }
  // }

  // async uploadImage(req, res) {
  //   try {
  //     allowedMimes = ["image/jpeg", "image/jpg", "image/png", "image/gif"];
  //     errAllowed = "JPG, JPEG, PNG,GIF";

  //     upload(req, res, function (error) {
  //       if (error) {
  //         //instanceof multer.MulterError
  //         fs.unlinkSync(req.file.path);
  //         return res.reply(messages.bad_request(error.message));
  //       } else {
  //         if (!req.file) {
  //           fs.unlinkSync(req.file.path);
  //           return res.reply(messages.not_found("File"));
  //         }

  //         const oOptions = {
  //           pinataMetadata: {
  //             name: req.file.originalname,
  //           },
  //           pinataOptions: {
  //             cidVersion: 0,
  //           },
  //         };
  //         const readableStreamForFile = fs.createReadStream(req.file.path);
  //         let testFile = fs.readFileSync(req.file.path);
  //         //Creating buffer for ipfs function to add file to the system
  //         let testBuffer = new Buffer(testFile);
  //         try {
  //           pinata
  //             .pinFileToIPFS(readableStreamForFile, oOptions)
  //             .then(async (result) => {
  //               fs.unlinkSync(req.file.path);
  //               return res.reply(messages.created("Collection"), {
  //                 track_cover: result.IpfsHash,
  //               });
  //             })
  //             .catch((err) => {
  //               //handle error here
  //               return res.reply(messages.error());
  //             });
  //         } catch (err) {
  //           console.log("err", err);
  //         }
  //       }
  //     });
  //   } catch (error) {
  //     return res.reply(messages.server_error());
  //   }
  // }

  // async setNFTOrder(req, res) {
  //   try {
  //     let aNft = await NFT.findById(req.body.nftId);
  //     if (!aNft) {
  //       return res.reply(messages.not_found("nft"));
  //     }

  //     aNft.nOrders.push(req.body.orderId);
  //     await aNft.save();

  //     return res.reply(messages.updated("nfts List"), aNft);
  //   } catch (e) {
  //     return res.reply(messages.error(e));
  //   }
  // }

  // async getUserLikedNfts(req, res) {
  //   try {
  //     let data = [];

  //     if (!req.body.userId)
  //       res.reply(messages.invalid_req("User Id is required"));

  //     //sortKey is the column
  //     const sortKey = req.body.sortKey ? req.body.sortKey : "";

  //     //sortType will let you choose from ASC 1 or DESC -1
  //     const sortType = req.body.sortType ? req.body.sortType : -1;

  //     var sortObject = {};
  //     var stype = sortKey;
  //     var sdir = sortType;
  //     sortObject[stype] = sdir;

  //     const page = parseInt(req.body.page);
  //     const limit = parseInt(req.body.limit);

  //     const startIndex = (page - 1) * limit;
  //     const endIndex = page * limit;

  //     const results = {};

  //     if (
  //       endIndex <
  //       (await NFT.countDocuments({
  //         nUser_likes: { $in: [mongoose.Types.ObjectId(req.body.userId)] },
  //       }).exec())
  //     ) {
  //       results.next = {
  //         page: page + 1,
  //         limit: limit,
  //       };
  //     }

  //     if (startIndex > 0) {
  //       results.previous = {
  //         page: page - 1,
  //         limit: limit,
  //       };
  //     }

  //     await NFT.find({
  //       nUser_likes: { $in: [mongoose.Types.ObjectId(req.body.userId)] },
  //     })
  //       .select({
  //         nTitle: 1,
  //         nCollection: 1,
  //         nHash: 1,
  //         nType: 1,
  //         nUser_likes: 1,
  //         nNftImage: 1,
  //         nLazyMintingStatus: 1,
  //       })
  //       .populate({
  //         path: "nOrders",
  //         options: {
  //           limit: 1,
  //         },
  //         select: {
  //           oPrice: 1,
  //           oType: 1,
  //           oValidUpto: 1,
  //           auction_end_date: 1,
  //           oStatus: 1,
  //           _id: 0,
  //         },
  //       })
  //       .populate({
  //         path: "nCreater",
  //         options: {
  //           limit: 1,
  //         },
  //         select: {
  //           _id: 1,
  //           sProfilePicUrl: 1,
  //           sWalletAddress: 1,
  //         },
  //       })
  //       .limit(limit)
  //       .skip(startIndex)
  //       .exec()
  //       .then((res) => {
  //         data.push(res);
  //       })
  //       .catch((e) => {
  //         console.log("Error", e);
  //       });

  //     results.count = await NFT.countDocuments({
  //       nUser_likes: { $in: [mongoose.Types.ObjectId(req.body.userId)] },
  //     }).exec();
  //     results.results = data;

  //     return res.reply(messages.success("NFTs List Liked By User"), results);
  //   } catch (error) {
  //     console.log("Error:", error);
  //     return res.reply(messages.error());
  //   }
  // }

  // async transferNfts(req, res) {
  //   //deduct previous owner
  //   console.log("req", req.body);
  //   try {
  //     if (!req.userId) return res.reply(messages.unauthorized());

  //     let _NFT = await NFT.findOne({
  //       _id: mongoose.Types.ObjectId(req.body.nftId),
  //       "nOwnedBy.address": req.body.sender,
  //     }).select("nOwnedBy -_id");

  //     console.log("_NFT-------->", _NFT);
  //     let currentQty = _NFT.nOwnedBy.find(
  //       (o) => o.address === req.body.sender.toLowerCase()
  //     ).quantity;
  //     let boughtQty = parseInt(req.body.qty);
  //     let leftQty = currentQty - boughtQty;
  //     if (leftQty < 1) {
  //       await NFT.findOneAndUpdate(
  //         { _id: mongoose.Types.ObjectId(req.body.nftId) },
  //         {
  //           $pull: {
  //             nOwnedBy: { address: req.body.sender },
  //           },
  //         }
  //       ).catch((e) => {
  //         console.log("Error1", e.message);
  //       });
  //     } else {
  //       await NFT.findOneAndUpdate(
  //         {
  //           _id: mongoose.Types.ObjectId(req.body.nftId),
  //           "nOwnedBy.address": req.body.sender,
  //         },
  //         {
  //           $set: {
  //             "nOwnedBy.$.quantity": parseInt(leftQty),
  //           },
  //         }
  //       ).catch((e) => {
  //         console.log("Error2", e.message);
  //       });
  //     }

  //     //Credit the buyer
  //     console.log("Crediting Buyer");

  //     let subDocId = await NFT.exists({
  //       _id: mongoose.Types.ObjectId(req.body.nftId),
  //       "nOwnedBy.address": req.body.receiver,
  //     });
  //     if (subDocId) {
  //       console.log("Subdocument Id", subDocId);

  //       let _NFTB = await NFT.findOne({
  //         _id: mongoose.Types.ObjectId(req.body.nftId),
  //         "nOwnedBy.address": req.body.receiver,
  //       }).select("nOwnedBy -_id");
  //       console.log("_NFTB-------->", _NFTB);
  //       console.log(
  //         "Quantity found for receiver",
  //         _NFTB.nOwnedBy.find(
  //           (o) => o.address === req.body.receiver.toLowerCase()
  //         ).quantity
  //       );
  //       currentQty = _NFTB.nOwnedBy.find(
  //         (o) => o.address === req.body.receiver.toLowerCase()
  //       ).quantity
  //         ? parseInt(
  //             _NFTB.nOwnedBy.find(
  //               (o) => o.address === req.body.receiver.toLowerCase()
  //             ).quantity
  //           )
  //         : 0;
  //       boughtQty = req.body.qty;
  //       let ownedQty = currentQty + boughtQty;

  //       await NFT.findOneAndUpdate(
  //         {
  //           _id: mongoose.Types.ObjectId(req.body.nftId),
  //           "nOwnedBy.address": req.body.receiver,
  //         },
  //         {
  //           $set: {
  //             "nOwnedBy.$.quantity": parseInt(ownedQty),
  //           },
  //         },
  //         { upsert: true, runValidators: true }
  //       ).catch((e) => {
  //         console.log("Error1", e.message);
  //       });
  //     } else {
  //       console.log("Subdocument Id not found");
  //       let dataToadd = {
  //         address: req.body.receiver,
  //         quantity: parseInt(req.body.qty),
  //       };
  //       await NFT.findOneAndUpdate(
  //         { _id: mongoose.Types.ObjectId(req.body.nftId) },
  //         { $addToSet: { nOwnedBy: dataToadd } },
  //         { upsert: true }
  //       );
  //       console.log("wasn't there but added");
  //     }
  //     return res.reply(messages.updated("NFT"));
  //   } catch (e) {
  //     console.log("errr", e);
  //     return res.reply(messages.error());
  //   }
  // }

  // async getCollectionNFT(req, res) {
  //   try {
  //     let data = [];
  //     let collection = req.body.collection;

  //     const sortKey = req.body.sortKey ? req.body.sortKey : "";
  //     //sortType will let you choose from ASC 1 or DESC -1
  //     const sortType = req.body.sortType ? req.body.sortType : -1;

  //     var sortObject = {};
  //     var stype = sortKey;
  //     var sdir = sortType;
  //     sortObject[stype] = sdir;

  //     const page = parseInt(req.body.page);
  //     const limit = parseInt(req.body.limit);

  //     const startIndex = (page - 1) * limit;
  //     const endIndex = page * limit;
  //     const results = {};
  //     let orderQuery = {};

  //     orderQuery["oStatus"] = 1; // we are getting only active orders

  //     let OrderIdsss = await Order.distinct("oNftId", orderQuery);

  //     if (
  //       endIndex <
  //       (await NFT.countDocuments({
  //         nCollection: collection,
  //         _id: { $in: OrderIdsss },
  //       }).exec())
  //     ) {
  //       results.next = {
  //         page: page + 1,
  //         limit: limit,
  //       };
  //     }
  //     if (startIndex > 0) {
  //       results.previous = {
  //         page: page - 1,
  //         limit: limit,
  //       };
  //     }

  //     await NFT.find({ nCollection: collection, _id: { $in: OrderIdsss } })
  //       .select({
  //         nTitle: 1,
  //         nCollection: 1,
  //         nHash: 1,
  //         nCreater: 1,
  //         nType: 1,
  //         nUser_likes: 1,
  //         nNftImage: 1,
  //         nLazyMintingStatus: 1,
  //       })
  //       .populate({
  //         path: "nOrders",
  //         options: {
  //           limit: 1,
  //         },
  //         select: {
  //           oPrice: 1,
  //           oType: 1,
  //           oValidUpto: 1,
  //           auction_end_date: 1,
  //           oStatus: 1,
  //           _id: 0,
  //         },
  //       })
  //       .populate({
  //         path: "nCreater",
  //         options: {
  //           limit: 1,
  //         },
  //         select: {
  //           _id: 1,
  //           sProfilePicUrl: 1,
  //           sWalletAddress: 1,
  //         },
  //       })
  //       .limit(limit)
  //       .skip(startIndex)
  //       .exec()
  //       .then((res) => {
  //         data.push(res);
  //       })
  //       .catch((e) => {
  //         console.log("Error", e);
  //       });
  //     results.count = await NFT.countDocuments({
  //       nCollection: collection,
  //       _id: { $in: OrderIdsss },
  //     }).exec();
  //     results.results = data;
  //     return res.reply(messages.success("Order List"), results);
  //   } catch (error) {
  //     console.log("Error:", error);
  //     return res.reply(messages.error());
  //   }
  // }

  // async getCollectionNFTOwned(req, res) {
  //   try {
  //     if (!req.userId) return res.reply(messages.unauthorized());
  //     let data = [];
  //     let collection = req.body.collection;
  //     let userID = req.userId;
  //     let UserData = await User.findById(userID);
  //     if (UserData) {
  //       let userWalletAddress = UserData.sWalletAddress;

  //       const sortKey = req.body.sortKey ? req.body.sortKey : "";
  //       //sortType will let you choose from ASC 1 or DESC -1
  //       const sortType = req.body.sortType ? req.body.sortType : -1;

  //       var sortObject = {};
  //       var stype = sortKey;
  //       var sdir = sortType;
  //       sortObject[stype] = sdir;

  //       const page = parseInt(req.body.page);
  //       const limit = parseInt(req.body.limit);

  //       const startIndex = (page - 1) * limit;
  //       const endIndex = page * limit;
  //       const results = {};
  //       if (
  //         endIndex <
  //         (await NFT.countDocuments({
  //           nCollection: collection,
  //           "nOwnedBy.address": userWalletAddress,
  //         }).exec())
  //       ) {
  //         results.next = {
  //           page: page + 1,
  //           limit: limit,
  //         };
  //       }
  //       if (startIndex > 0) {
  //         results.previous = {
  //           page: page - 1,
  //           limit: limit,
  //         };
  //       }
  //       await NFT.find({
  //         nCollection: collection,
  //         "nOwnedBy.address": userWalletAddress,
  //       })
  //         .select({
  //           nTitle: 1,
  //           nCollection: 1,
  //           nHash: 1,
  //           nType: 1,
  //           nUser_likes: 1,
  //           nNftImage: 1,
  //           nLazyMintingStatus: 1,
  //         })
  //         .populate({
  //           path: "nOrders",
  //           options: {
  //             limit: 1,
  //           },
  //           select: {
  //             oPrice: 1,
  //             oType: 1,
  //             oStatus: 1,
  //             _id: 0,
  //           },
  //         })
  //         .populate({
  //           path: "nCreater",
  //           options: {
  //             limit: 1,
  //           },
  //           select: {
  //             _id: 1,
  //             sProfilePicUrl: 1,
  //             sWalletAddress: 1,
  //           },
  //         })
  //         .limit(limit)
  //         .skip(startIndex)
  //         .exec()
  //         .then((res) => {
  //           data.push(res);
  //         })
  //         .catch((e) => {
  //           console.log("Error", e);
  //         });

  //       results.count = await NFT.countDocuments({
  //         nCollection: collection,
  //         "nOwnedBy.address": userWalletAddress,
  //       }).exec();
  //       results.results = data;
  //       return res.reply(messages.success("Order List"), results);
  //     } else {
  //       console.log("Bid Not found");
  //       return res.reply("User Not found");
  //     }
  //   } catch (error) {
  //     console.log("Error:", error);
  //     return res.reply(messages.error());
  //   }
  // }

  // async getSearchedNft(req, res) {
  //   try {
  //     let data = [];
  //     let setConditions = req.body.conditions;

  //     //sortKey is the column
  //     const sortKey = req.body.sortKey ? req.body.sortKey : "";

  //     //sortType will let you choose from ASC 1 or DESC -1
  //     const sortType = req.body.sortType ? req.body.sortType : -1;

  //     var sortObject = {};
  //     var stype = sortKey;
  //     var sdir = sortType;
  //     sortObject[stype] = sdir;

  //     const page = parseInt(req.body.page);
  //     const limit = parseInt(req.body.limit);

  //     const startIndex = (page - 1) * limit;
  //     const endIndex = page * limit;

  //     const results = {};
  //     let OrderIdsss = await Order.distinct("oNftId", setConditions);

  //     if (
  //       endIndex <
  //       (await NFT.countDocuments({
  //         nTitle: { $regex: req.body.sTextsearch, $options: "i" },
  //         _id: { $in: OrderIdsss.map(String) },
  //       }).exec())
  //     ) {
  //       results.next = {
  //         page: page + 1,
  //         limit: limit,
  //       };
  //     }

  //     if (startIndex > 0) {
  //       results.previous = {
  //         page: page - 1,
  //         limit: limit,
  //       };
  //     }

  //     await NFT.find({
  //       nTitle: { $regex: req.body.sTextsearch, $options: "i" },
  //       _id: { $in: OrderIdsss.map(String) },
  //     })
  //       .select({
  //         nTitle: 1,
  //         nCollection: 1,
  //         nHash: 1,
  //         nType: 1,
  //         nUser_likes: 1,
  //         nNftImage: 1,
  //         nLazyMintingStatus: 1,
  //       })
  //       .populate({
  //         path: "nOrders",
  //         options: {
  //           limit: 1,
  //         },
  //         select: {
  //           oPrice: 1,
  //           oType: 1,
  //           auction_end_date: 1,
  //           oValidUpto: 1,
  //           oStatus: 1,
  //           _id: 0,
  //         },
  //       })
  //       .populate({
  //         path: "nCreater",
  //         options: {
  //           limit: 1,
  //         },
  //         select: {
  //           _id: 0,
  //         },
  //       })
  //       .limit(limit)
  //       .skip(startIndex)
  //       .exec()
  //       .then((res) => {
  //         data.push(res);
  //         results.count = res.length;
  //       })
  //       .catch((e) => {
  //         console.log("Error", e);
  //       });

  //     results.count = await NFT.countDocuments({
  //       nTitle: { $regex: req.body.sTextsearch, $options: "i" },
  //       _id: { $in: OrderIdsss.map(String) },
  //     }).exec();
  //     results.results = data;

  //     return res.reply(messages.success("NFTs List"), results);
  //   } catch (error) {
  //     console.log("Error:", error);
  //     return res.reply(messages.error());
  //   }
  // }

  // async updateCollectionMarketplace(req, res) {
  //   try {
  //     if (!req.userId) return res.reply(messages.unauthorized());
  //     if (!req.body.collectionID) {
  //       return res.reply(messages.not_found("Collection ID"));
  //     }
  //     let collectionID = req.body.collectionID;
  //     let isOnMarketplace = req.body.isOnMarketplace;

  //     let updateData = [];
  //     updateData["isOnMarketplace"] = isOnMarketplace;
  //     let updateObj = Object.assign({}, updateData);

  //     Collection.findByIdAndUpdate(
  //       { _id: mongoose.Types.ObjectId(collectionID) },
  //       { $set: updateObj }
  //     ).then((collection) => {
  //       return res.reply(
  //         messages.updated("Collection Updated successfully."),
  //         collection
  //       );
  //     });
  //   } catch (error) {
  //     return res.reply(messages.server_error());
  //   }
  // }

  // async viewCollection(req, res) {
  //   try {
  //     if (!req.params.collectionID)
  //       return res.reply(messages.not_found("Collection ID"));
  //     if (!validators.isValidObjectID(req.params.collectionID))
  //       res.reply(messages.invalid("Collection ID"));

  //     let collectionData = await Collection.findById(
  //       req.params.collectionID
  //     ).populate({
  //       path: "createdBy",
  //       options: {
  //         limit: 1,
  //       },
  //     });

  //     if (!collectionData) return res.reply(messages.not_found("Collection"));
  //     collectionData = collectionData.toObject();

  //     var token = req.headers.authorization;

  //     req.userId =
  //       req.userId && req.userId != undefined && req.userId != null
  //         ? req.userId
  //         : "";

  //     let likeARY =
  //       aNFT.user_likes && aNFT.user_likes.length
  //         ? aNFT.user_likes.filter((v) => v.toString() == req.userId.toString())
  //         : [];
  //     if (token) {
  //       token = token.replace("Bearer ", "");
  //       jwt.verify(token, process.env.JWT_SECRET, function (err, decoded) {
  //         if (decoded) req.userId = decoded.id;
  //       });

  //       if (aNFT.oCurrentOwner._id != req.userId)
  //         await NFT.findByIdAndUpdate(req.params.nNFTId, {
  //           $inc: {
  //             nView: 1,
  //           },
  //         });
  //     }
  //     aNFT.loggedinUserId = req.userId;
  //     console.log("---------------------------8");

  //     if (!aNFT) {
  //       console.log("---------------------------9");

  //       return res.reply(messages.not_found("NFT"));
  //     }
  //     console.log("---------------------------10");

  //     return res.reply(messages.success(), aNFT);
  //   } catch (error) {
  //     return res.reply(messages.server_error());
  //   }
  // }

  // async getUpcomingCollections(req, res) {
  //   try {
  //     let data = [];
  //     const page = parseInt(req.body.page);
  //     const limit = parseInt(req.body.limit);
  //     const startIndex = (page - 1) * limit;
  //     const endIndex = page * limit;

  //     let searchText = "";
  //     if (req.body.searchText && req.body.searchText !== undefined) {
  //       searchText = req.body.searchText;
  //     }
  //     let searchArray = [];
  //     searchArray["preSaleStartTime"] = { $lt: new Date() };
  //     if (searchText !== "") {
  //       searchArray["$or"] = [
  //         { name: { $regex: new RegExp(searchText), $options: "i" } },
  //         {
  //           contractAddress: { $regex: new RegExp(searchText), $options: "i" },
  //         },
  //       ];
  //     }
  //     let searchObj = Object.assign({}, searchArray);

  //     const results = {};
  //     if (endIndex < (await Collection.countDocuments(searchObj).exec())) {
  //       results.next = {
  //         page: page + 1,
  //         limit: limit,
  //       };
  //     }
  //     if (startIndex > 0) {
  //       results.previous = {
  //         page: page - 1,
  //         limit: limit,
  //       };
  //     }

  //     await Collection.find(searchObj)
  //       .populate("categoryID")
  //       .populate("brandID")
  //       .sort({ createdOn: -1 })
  //       .limit(limit)
  //       .skip(startIndex)
  //       .lean()
  //       .exec()
  //       .then((res) => {
  //         data.push(res);
  //       })
  //       .catch((e) => {
  //         console.log("Error", e);
  //       });
  //     results.count = await Collection.countDocuments(searchObj).exec();
  //     results.results = data;
  //     res.header("Access-Control-Max-Age", 600);
  //     return res.reply(messages.success("Collection List"), results);
  //   } catch (error) {
  //     console.log("Error " + error);
  //     return res.reply(messages.server_error());
  //   }
  // }

  // async likeNFT(req, res) {
  //   try {
  //     if (!req.userId) return res.reply(messages.unauthorized());
  //     let { id } = req.body;
  //     return NFT.findOne({ _id: mongoose.Types.ObjectId(id) }).then(
  //       async (NFTData) => {
  //         if (NFTData && NFTData != null) {
  //           let likeMAINarray = [];
  //           likeMAINarray = NFTData.nUser_likes;
  //           let flag = "";
  //           let likeARY =
  //             likeMAINarray && likeMAINarray.length
  //               ? likeMAINarray.filter(
  //                   (v) => v.toString() == req.userId.toString()
  //                 )
  //               : [];
  //           if (likeARY && likeARY.length) {
  //             flag = "dislike";
  //             var index = likeMAINarray.indexOf(likeARY[0]);
  //             if (index != -1) {
  //               likeMAINarray.splice(index, 1);
  //             }
  //           } else {
  //             flag = "like";
  //             likeMAINarray.push(mongoose.Types.ObjectId(req.userId));
  //           }
  //           await NFT.findByIdAndUpdate(
  //             { _id: mongoose.Types.ObjectId(id) },
  //             { $set: { nUser_likes: likeMAINarray } }
  //           ).then((user) => {
  //             if (flag == "like") {
  //               return res.reply(messages.updated("NFT liked successfully."));
  //             } else {
  //               return res.reply(messages.updated("NFT unliked successfully."));
  //             }
  //           });
  //         } else {
  //           return res.reply(messages.bad_request("NFT not found."));
  //         }
  //       }
  //     );
  //   } catch (error) {
  //     log.red(error);
  //     return res.reply(messages.server_error());
  //   }
  // }

  // async getNftOwner(req, res) {
  //   try {
  //     // if (!req.userId) return res.reply(messages.unauthorized());
  //     // if (!req.params.nNFTId) return res.reply(messages.not_found("NFT ID"));
  //     console.log("user id && NFTId -->", req.userId, req.params.nNFTId);

  //     let nftOwner = {};

  //     nftOwner = await NFTowners.findOne({
  //       nftId: req.params.nNFTId,
  //       oCurrentOwner: req.userId,
  //     });
  //     if (!nftOwner) {
  //       nftOwner = await NFTowners.findOne(
  //         { nftId: req.params.nNFTId },
  //         {},
  //         { sort: { sCreated: -1 } }
  //       );
  //       console.log("nft owner is-->", nftOwner);
  //       return res.reply(messages.success(), nftOwner);
  //     } else {
  //       if (nftOwner.oCurrentOwner) {
  //         users = await User.findOne(nftOwner.oCurrentOwner);
  //         nftOwner.oCurrentOwner = users;
  //       }
  //       console.log("nft owner is-->", nftOwner);
  //       return res.reply(messages.success(), nftOwner);
  //     }
  //   } catch (e) {
  //     console.log("error in getNftOwner is-->", e);
  //     return e;
  //   }
  // }

  // async getAllnftOwner(req, res) {
  //   try {
  //     console.log("All Nft Called -->", req.params.nNFTId);

  //     let nftOwner = {};

  //     nftOwner = await NFTowners.find({ nftId: req.params.nNFTId });
  //     return res.reply(messages.success(), nftOwner);
  //   } catch (e) {
  //     console.log("error in getNftOwner is-->", e);
  //     return e;
  //   }
  // }

  // async mynftlist(req, res) {
  //   try {
  //     if (!req.userId) return res.reply(messages.unauthorized());

  //     var nLimit = parseInt(req.body.length);
  //     var nOffset = parseInt(req.body.start);
  //     let oTypeQuery = {},
  //       oSellingTypeQuery = {},
  //       oSortingOrder = {};
  //     log.red(req.body);
  //     if (req.body.eType[0] != "All" && req.body.eType[0] != "") {
  //       oTypeQuery = {
  //         $or: [],
  //       };
  //       req.body.eType.forEach((element) => {
  //         oTypeQuery["$or"].push({
  //           eType: element,
  //         });
  //       });
  //     }

  //     let oCollectionQuery = {};
  //     if (req.body.sCollection != "All" && req.body.sCollection != "") {
  //       oCollectionQuery = {
  //         sCollection: req.body.sCollection,
  //       };
  //     }

  //     if (req.body.sSellingType != "") {
  //       oSellingTypeQuery = {
  //         eAuctionType: req.body.sSellingType,
  //       };
  //     }

  //     if (req.body.sSortingType == "Recently Added") {
  //       oSortingOrder["sCreated"] = -1;
  //     } else if (req.body.sSortingType == "Most Viewed") {
  //       oSortingOrder["nView"] = -1;
  //     } else if (req.body.sSortingType == "Price Low to High") {
  //       oSortingOrder["nBasePrice"] = 1;
  //     } else if (req.body.sSortingType == "Price High to Low") {
  //       oSortingOrder["nBasePrice"] = -1;
  //     } else {
  //       oSortingOrder["_id"] = -1;
  //     }

  //     let data = await NFT.aggregate([
  //       {
  //         $match: {
  //           $and: [
  //             oTypeQuery,
  //             oCollectionQuery,
  //             oSellingTypeQuery,
  //             {
  //               $or: [
  //                 {
  //                   oCurrentOwner: mongoose.Types.ObjectId(req.userId),
  //                 },
  //               ],
  //             },
  //           ],
  //         },
  //       },
  //       {
  //         $sort: oSortingOrder,
  //       },
  //       {
  //         $project: {
  //           _id: 1,
  //           sName: 1,
  //           eType: 1,
  //           nBasePrice: 1,
  //           collectionImage: 1,
  //           nQuantity: 1,
  //           nTokenID: 1,
  //           oCurrentOwner: 1,
  //           sTransactionStatus: 1,
  //           eAuctionType: 1,

  //           sGenre: 1,
  //           sBpm: 1,
  //           skey_equalTo: 1,
  //           skey_harmonicTo: 1,
  //           track_cover: 1,

  //           user_likes: {
  //             $size: {
  //               $filter: {
  //                 input: "$user_likes",
  //                 as: "user_likes",
  //                 cond: {
  //                   $eq: ["$$user_likes", mongoose.Types.ObjectId(req.userId)],
  //                 },
  //               },
  //             },
  //           },
  //           user_likes_size: {
  //             $cond: {
  //               if: {
  //                 $isArray: "$user_likes",
  //               },
  //               then: {
  //                 $size: "$user_likes",
  //               },
  //               else: 0,
  //             },
  //           },
  //         },
  //       },
  //       {
  //         $project: {
  //           _id: 1,
  //           sName: 1,
  //           eType: 1,
  //           nBasePrice: 1,
  //           collectionImage: 1,
  //           nQuantity: 1,
  //           nTokenID: 1,
  //           oCurrentOwner: 1,
  //           sTransactionStatus: 1,
  //           eAuctionType: 1,
  //           sGenre: 1,
  //           sBpm: 1,
  //           skey_equalTo: 1,
  //           skey_harmonicTo: 1,
  //           track_cover: 1,

  //           is_user_like: {
  //             $cond: {
  //               if: {
  //                 $gte: ["$user_likes", 1],
  //               },
  //               then: "true",
  //               else: "false",
  //             },
  //           },
  //           user_likes_size: 1,
  //         },
  //       },
  //       {
  //         $lookup: {
  //           from: "users",
  //           localField: "oCurrentOwner",
  //           foreignField: "_id",
  //           as: "oUser",
  //         },
  //       },
  //       { $unwind: "$oUser" },
  //       {
  //         $facet: {
  //           nfts: [
  //             {
  //               $skip: +nOffset,
  //             },
  //             {
  //               $limit: +nLimit,
  //             },
  //           ],
  //           totalCount: [
  //             {
  //               $count: "count",
  //             },
  //           ],
  //         },
  //       },
  //     ]);
  //     let iFiltered = data[0].nfts.length;
  //     if (data[0].totalCount[0] == undefined) {
  //       return res.reply(messages.success("Data"), {
  //         data: 0,
  //         draw: req.body.draw,
  //         recordsTotal: 0,
  //         recordsFiltered: iFiltered,
  //       });
  //     } else {
  //       return res.reply(messages.no_prefix("NFT Details"), {
  //         data: data[0].nfts,
  //         draw: req.body.draw,
  //         recordsTotal: data[0].totalCount[0].count,
  //         recordsFiltered: iFiltered,
  //       });
  //     }
  //   } catch (error) {
  //     return res.reply(messages.server_error());
  //   }
  // }

  // async getHotCollections(req, res) {
  //   try {
  //     let data = [];
  //     let setConditions = {};
  //     let sTextsearch = req.body.sTextsearch;
  //     const erc721 = req.body.erc721;

  //     if (req.body.conditions) {
  //       setConditions = req.body.conditions;
  //     }

  //     //sortKey is the column
  //     const sortKey = req.body.sortKey ? req.body.sortKey : "";

  //     //sortType will let you choose from ASC 1 or DESC -1
  //     const sortType = req.body.sortType ? req.body.sortType : -1;

  //     var sortObject = {};
  //     var stype = sortKey;
  //     var sdir = sortType;
  //     sortObject[stype] = sdir;

  //     let CollectionSearchArray = [];
  //     if (sTextsearch !== "") {
  //       CollectionSearchArray["sName"] = {
  //         $regex: new RegExp(sTextsearch),
  //         $options: "<options>",
  //       };
  //     }

  //     if (erc721 !== "" && erc721) {
  //       CollectionSearchArray["erc721"] = true;
  //     }
  //     if (erc721 !== "" && erc721 === false) {
  //       CollectionSearchArray["erc721"] = false;
  //     }
  //     let CollectionSearchObj = Object.assign({}, CollectionSearchArray);

  //     const page = parseInt(req.body.page);
  //     const limit = parseInt(req.body.limit);

  //     const startIndex = (page - 1) * limit;
  //     const endIndex = page * limit;

  //     const results = {};

  //     if (
  //       endIndex < (await Collection.countDocuments(CollectionSearchObj).exec())
  //     ) {
  //       results.next = {
  //         page: page + 1,
  //         limit: limit,
  //       };
  //     }

  //     if (startIndex > 0) {
  //       results.previous = {
  //         page: page - 1,
  //         limit: limit,
  //       };
  //     }

  //     let aCollections = await Collection.aggregate([
  //       {
  //         $lookup: {
  //           from: "users",
  //           localField: "oCreatedBy",
  //           foreignField: "_id",
  //           as: "oUser",
  //         },
  //       },
  //       {
  //         $sort: {
  //           sCreated: req.body.sortType,
  //         },
  //       },
  //       { $match: CollectionSearchObj },
  //       {
  //         $skip: (page - 1) * limit,
  //       },
  //       {
  //         $limit: limit,
  //       },
  //     ]);

  //     results.results = aCollections;
  //     results.count = await Collection.countDocuments(
  //       CollectionSearchObj
  //     ).exec();
  //     console.log("Collections", data);
  //     res.header("Access-Control-Max-Age", 600);
  //     return res.reply(messages.no_prefix("Collections List"), results);
  //   } catch (e) {
  //     return res.reply(messages.error(e));
  //   }
  // }

  // async collectionlistMy(req, res) {
  //   try {
  //     if (!req.userId) return res.reply(messages.unauthorized());

  //     var nLimit = parseInt(req.body.length);
  //     var nOffset = parseInt(req.body.start);

  //     let query = {
  //       oCreatedBy: mongoose.Types.ObjectId(req.userId),
  //     };
  //     if (req && req.body.sTextsearch && req.body.sTextsearch != undefined) {
  //       query["sName"] = new RegExp(req.body.sTextsearch, "i");
  //     }

  //     let aCollections = await Collection.aggregate([
  //       {
  //         $match: query,
  //       },
  //       {
  //         $lookup: {
  //           from: "users",
  //           localField: "oCreatedBy",
  //           foreignField: "_id",
  //           as: "oUser",
  //         },
  //       },
  //       {
  //         $unwind: { preserveNullAndEmptyArrays: true, path: "$oUser" },
  //       },
  //       {
  //         $sort: {
  //           sCreated: -1,
  //         },
  //       },
  //       {
  //         $facet: {
  //           collections: [
  //             {
  //               $skip: +nOffset,
  //             },
  //             {
  //               $limit: +nLimit,
  //             },
  //           ],
  //           totalCount: [
  //             {
  //               $count: "count",
  //             },
  //           ],
  //         },
  //       },
  //     ]);

  //     let iFiltered = aCollections[0].collections.length;
  //     if (aCollections[0].totalCount[0] == undefined) {
  //       return res.reply(messages.success("Data"), {
  //         aCollections: 0,
  //         draw: req.body.draw,
  //         recordsTotal: 0,
  //         recordsFiltered: iFiltered,
  //       });
  //     } else {
  //       return res.reply(messages.no_prefix("Collection Details"), {
  //         data: aCollections[0].collections,
  //         draw: req.body.draw,
  //         recordsTotal: aCollections[0].totalCount[0].count,
  //         recordsFiltered: iFiltered,
  //       });
  //     }
  //   } catch (error) {
  //     return res.reply(messages.server_error());
  //   }
  // }

  // async nftListing(req, res) {
  //   try {
  //     var nLimit = parseInt(req.body.length);
  //     var nOffset = parseInt(req.body.start);
  //     let sBPMQuery = {};
  //     let sGenreQuery = {};
  //     let oTypeQuery = {},
  //       oSellingTypeQuery = {},
  //       oSortingOrder = {};
  //     let oTtextQuery = {
  //       sName: new RegExp(req.body.sTextsearch, "i"),
  //     };
  //     if (req.body.eType[0] != "All" && req.body.eType[0] != "") {
  //       oTypeQuery = {
  //         $or: [],
  //       };
  //       req.body.eType.forEach((element) => {
  //         oTypeQuery["$or"].push({
  //           eType: element,
  //         });
  //       });
  //     }
  //     if (
  //       req.body.sFrom &&
  //       req.body.sFrom != undefined &&
  //       req.body.sFrom != "" &&
  //       req.body.sTo &&
  //       req.body.sTo != undefined &&
  //       req.body.sTo != ""
  //     ) {
  //       sBPMQuery = {
  //         sBpm: {
  //           $gte: parseInt(req.body.sFrom),
  //           $lte: parseInt(req.body.sTo),
  //         },
  //       };
  //     }

  //     if (req.body.sSortingType == "Recently Added") {
  //       oSortingOrder["sCreated"] = -1;
  //     } else if (req.body.sSortingType == "Most Viewed") {
  //       oSortingOrder["nView"] = -1;
  //     } else if (req.body.sSortingType == "Price Low to High") {
  //       oSortingOrder["nBasePrice"] = 1;
  //     } else if (req.body.sSortingType == "Price High to Low") {
  //       oSortingOrder["nBasePrice"] = -1;
  //     } else {
  //       oSortingOrder["_id"] = -1;
  //     }

  //     if (
  //       req.body.sGenre &&
  //       req.body.sGenre != undefined &&
  //       req.body.sGenre.length
  //     ) {
  //       sGenreQuery = {
  //         sGenre: { $in: req.body.sGenre },
  //       };
  //     }

  //     if (req.body.sSellingType != "") {
  //       oSellingTypeQuery = {
  //         $or: [
  //           {
  //             eAuctionType: req.body.sSellingType,
  //           },
  //         ],
  //       };
  //     }

  //     let data = await NFT.aggregate([
  //       {
  //         $match: {
  //           $and: [
  //             {
  //               sTransactionStatus: {
  //                 $eq: 1,
  //               },
  //             },
  //             {
  //               eAuctionType: {
  //                 $ne: "Unlockable",
  //               },
  //             },
  //             oTypeQuery,
  //             oTtextQuery,
  //             oSellingTypeQuery,
  //             sBPMQuery,
  //             sGenreQuery,
  //           ],
  //         },
  //       },
  //       {
  //         $sort: oSortingOrder,
  //       },
  //       {
  //         $project: {
  //           _id: 1,
  //           sName: 1,
  //           eType: 1,
  //           nBasePrice: 1,
  //           collectionImage: 1,
  //           oCurrentOwner: 1,
  //           eAuctionType: 1,
  //           sGenre: 1,
  //           sBpm: 1,
  //           skey_equalTo: 1,
  //           skey_harmonicTo: 1,
  //           track_cover: 1,
  //           user_likes: {
  //             $size: {
  //               $filter: {
  //                 input: "$user_likes",
  //                 as: "user_likes",
  //                 cond: {
  //                   $eq: [
  //                     "$$user_likes",
  //                     req.userId &&
  //                     req.userId != undefined &&
  //                     req.userId != null
  //                       ? mongoose.Types.ObjectId(req.userId)
  //                       : "",
  //                   ],
  //                 },
  //               },
  //             },
  //           },
  //           user_likes_size: {
  //             $cond: {
  //               if: {
  //                 $isArray: "$user_likes",
  //               },
  //               then: {
  //                 $size: "$user_likes",
  //               },
  //               else: 0,
  //             },
  //           },
  //         },
  //       },
  //       {
  //         $project: {
  //           _id: 1,
  //           sName: 1,
  //           eType: 1,
  //           nBasePrice: 1,
  //           collectionImage: 1,
  //           oCurrentOwner: 1,
  //           eAuctionType: 1,
  //           sGenre: 1,
  //           sBpm: 1,
  //           skey_equalTo: 1,
  //           skey_harmonicTo: 1,
  //           track_cover: 1,
  //           is_user_like: {
  //             $cond: {
  //               if: {
  //                 $gte: ["$user_likes", 1],
  //               },
  //               then: "true",
  //               else: "false",
  //             },
  //           },
  //           user_likes_size: 1,
  //         },
  //       },
  //       {
  //         $lookup: {
  //           from: "users",
  //           localField: "oCurrentOwner",
  //           foreignField: "_id",
  //           as: "oUser",
  //         },
  //       },
  //       { $unwind: "$oUser" },
  //       {
  //         $facet: {
  //           nfts: [
  //             {
  //               $skip: +nOffset,
  //             },
  //             {
  //               $limit: +nLimit,
  //             },
  //           ],
  //           totalCount: [
  //             {
  //               $count: "count",
  //             },
  //           ],
  //         },
  //       },
  //     ]);
  //     let iFiltered = data[0].nfts.length;
  //     if (data[0].totalCount[0] == undefined) {
  //       return res.reply(messages.success("Data"), {
  //         data: 0,
  //         draw: req.body.draw,
  //         recordsTotal: 0,
  //         recordsFiltered: iFiltered,
  //       });
  //     } else {
  //       return res.reply(messages.no_prefix("NFT Details"), {
  //         data: data[0].nfts,
  //         draw: req.body.draw,
  //         recordsTotal: data[0].totalCount[0].count,
  //         recordsFiltered: iFiltered,
  //       });
  //     }
  //   } catch (error) {
  //     return res.reply(messages.server_error());
  //   }
  // }

  // async nftID(req, res) {
  //   try {
  //     if (!req.params.nNFTId) return res.reply(messages.not_found("NFT ID"));

  //     if (!validators.isValidObjectID(req.params.nNFTId))
  //       res.reply(messages.invalid("NFT ID"));

  //     let aNFT = await NFT.findById(req.params.nNFTId).populate({
  //       path: "nCreater",
  //       options: {
  //         limit: 1,
  //       },
  //       select: {
  //         sWalletAddress: 1,
  //         _id: 1,
  //         sProfilePicUrl: 1,
  //       },
  //     });

  //     if (!aNFT) return res.reply(messages.not_found("NFT"));
  //     aNFT = aNFT.toObject();
  //     aNFT.sCollectionDetail = {};

  //     aNFT.sCollectionDetail = await Collection.findOne({
  //       sName:
  //         aNFT.sCollection && aNFT.sCollection != undefined
  //           ? aNFT.sCollection
  //           : "-",
  //     });

  //     var token = req.headers.authorization;

  //     req.userId =
  //       req.userId && req.userId != undefined && req.userId != null
  //         ? req.userId
  //         : "";

  //     let likeARY =
  //       aNFT.user_likes && aNFT.user_likes.length
  //         ? aNFT.user_likes.filter((v) => v.toString() == req.userId.toString())
  //         : [];

  //     // if (likeARY && likeARY.length) {
  //     //   aNFT.is_user_like = "true";
  //     // } else {
  //     //   aNFT.is_user_like = "false";
  //     // }

  //     //
  //     if (token) {
  //       token = token.replace("Bearer ", "");
  //       jwt.verify(token, process.env.JWT_SECRET, function (err, decoded) {
  //         if (decoded) req.userId = decoded.id;
  //       });

  //       if (aNFT.oCurrentOwner._id != req.userId)
  //         await NFT.findByIdAndUpdate(req.params.nNFTId, {
  //           $inc: {
  //             nView: 1,
  //           },
  //         });
  //     }
  //     aNFT.loggedinUserId = req.userId;
  //     console.log("---------------------------8");

  //     if (!aNFT) {
  //       console.log("---------------------------9");

  //       return res.reply(messages.not_found("NFT"));
  //     }
  //     console.log("---------------------------10");

  //     return res.reply(messages.success(), aNFT);
  //   } catch (error) {
  //     return res.reply(messages.server_error());
  //   }
  // }

  // async deleteNFT(req, res) {
  //   try {
  //     if (!req.params.nNFTId) return res.reply(messages.not_found("NFT ID"));

  //     if (!validators.isValidObjectID(req.params.nNFTId))
  //       res.reply(messages.invalid("NFT ID"));

  //     await NFT.findByIdAndDelete(req.params.nNFTId);
  //     return res.reply(messages.success("NFT deleted"));
  //   } catch (error) {
  //     return res.reply(messages.server_error());
  //   }
  // }

  // async getCollectionDetails(req, res) {
  //   try {
  //     // if (!req.userId) {
  //     //     return res.reply(messages.unauthorized());
  //     // }
  //     Collection.findOne({ _id: req.body.collectionId }, (err, collection) => {
  //       if (err) return res.reply(messages.server_error());
  //       if (!collection) return res.reply(messages.not_found("Collection"));
  //       return res.reply(messages.no_prefix("Collection Details"), collection);
  //     });
  //   } catch (error) {
  //     return res.reply(messages.server_error());
  //   }
  // }

  // async setTransactionHash(req, res) {
  //   try {
  //     // if (!req.body.nTokenID) return res.reply(messages.not_found("Token ID"));
  //     if (!req.body.nNFTId) return res.reply(messages.not_found("NFT ID"));
  //     if (!req.body.sTransactionHash)
  //       return res.reply(messages.not_found("Transaction Hash"));

  //     if (!validators.isValidObjectID(req.body.nNFTId))
  //       res.reply(messages.invalid("NFT ID"));
  //     // if (req.body.nTokenID <= 0) res.reply(messages.invalid("Token ID"));
  //     if (!validators.isValidTransactionHash(req.body.sTransactionHash))
  //       res.reply(messages.invalid("Transaction Hash"));

  //     NFT.findByIdAndUpdate(
  //       req.body.nNFTId,
  //       {
  //         // nTokenID: req.body.nTokenID,
  //         sTransactionHash: req.body.sTransactionHash,
  //         sTransactionStatus: 0,
  //       },
  //       (err, nft) => {
  //         if (err) return res.reply(messages.server_error());
  //         if (!nft) return res.reply(messages.not_found("NFT"));

  //         return res.reply(messages.updated("NFT Details"));
  //       }
  //     );
  //   } catch (error) {
  //     return res.reply(messages.server_error());
  //   }
  // }

  // async landing(req, res) {
  //   try {
  //     console.log("---------------------1");

  //     req.userId =
  //       req.userId && req.userId != undefined && req.userId != null
  //         ? req.userId
  //         : "";
  //     console.log("---------------------2", req.userId);

  //     let data = await NFT.aggregate([
  //       {
  //         $facet: {
  //           recentlyAdded: [
  //             {
  //               $match: {
  //                 sTransactionStatus: {
  //                   $eq: 1,
  //                 },
  //                 eAuctionType: {
  //                   $ne: "Unlockable",
  //                 },
  //               },
  //             },
  //             {
  //               $sort: {
  //                 _id: -1,
  //               },
  //             },
  //             {
  //               $limit: 10,
  //             },
  //             {
  //               $lookup: {
  //                 from: "users",
  //                 localField: "oCurrentOwner",
  //                 foreignField: "_id",
  //                 as: "aCurrentOwner",
  //               },
  //             },
  //             { $unwind: "$aCurrentOwner" },
  //             {
  //               $project: {
  //                 collectionImage: 1,
  //                 eType: 1,
  //                 sCreated: 1,
  //                 oCurrentOwner: 1,
  //                 oPostedBy: 1,
  //                 sCollection: 1,
  //                 sName: 1,
  //                 sCollaborator: 1,
  //                 sNftdescription: 1,
  //                 nCollaboratorPercentage: 1,
  //                 sSetRRoyaltyPercentage: 1,
  //                 nQuantity: 1,
  //                 nView: 1,
  //                 nBasePrice: 1,
  //                 eAuctionType: 1,
  //                 nTokenID: 1,
  //                 sTransactionHash: 1,
  //                 sTransactionStatus: 1,
  //                 aCurrentOwner: 1,
  //                 sGenre: 1,
  //                 sBpm: 1,
  //                 skey_equalTo: 1,
  //                 skey_harmonicTo: 1,
  //                 track_cover: 1,
  //                 user_likes: {
  //                   $size: {
  //                     $filter: {
  //                       input: "$user_likes",
  //                       as: "user_likes",
  //                       cond: {
  //                         $eq: [
  //                           "$$user_likes",
  //                           req.userId &&
  //                           req.userId != undefined &&
  //                           req.userId != null
  //                             ? mongoose.Types.ObjectId(req.userId)
  //                             : "",
  //                         ],
  //                       },
  //                     },
  //                   },
  //                 },
  //                 user_likes_size: {
  //                   $cond: {
  //                     if: {
  //                       $isArray: "$user_likes",
  //                     },
  //                     then: {
  //                       $size: "$user_likes",
  //                     },
  //                     else: 0,
  //                   },
  //                 },
  //               },
  //             },
  //             {
  //               $project: {
  //                 collectionImage: 1,
  //                 eType: 1,
  //                 sCreated: 1,
  //                 oCurrentOwner: 1,
  //                 oPostedBy: 1,
  //                 sCollection: 1,
  //                 sName: 1,
  //                 sCollaborator: 1,
  //                 sNftdescription: 1,
  //                 nCollaboratorPercentage: 1,
  //                 sSetRRoyaltyPercentage: 1,
  //                 nQuantity: 1,
  //                 nView: 1,
  //                 nBasePrice: 1,
  //                 eAuctionType: 1,
  //                 nTokenID: 1,
  //                 sGenre: 1,
  //                 sBpm: 1,
  //                 skey_equalTo: 1,
  //                 skey_harmonicTo: 1,
  //                 track_cover: 1,
  //                 sTransactionHash: 1,
  //                 sTransactionStatus: 1,
  //                 aCurrentOwner: 1,
  //                 is_user_like: {
  //                   $cond: {
  //                     if: {
  //                       $gte: ["$user_likes", 1],
  //                     },
  //                     then: "true",
  //                     else: "false",
  //                   },
  //                 },
  //                 user_likes_size: 1,
  //               },
  //             },
  //           ],
  //           onSale: [
  //             {
  //               $match: {
  //                 sTransactionStatus: {
  //                   $eq: 1,
  //                 },
  //                 eAuctionType: {
  //                   $eq: "Fixed Sale",
  //                 },
  //               },
  //             },
  //             {
  //               $sort: {
  //                 _id: -1,
  //               },
  //             },
  //             {
  //               $limit: 10,
  //             },
  //             {
  //               $lookup: {
  //                 from: "users",
  //                 localField: "oCurrentOwner",
  //                 foreignField: "_id",
  //                 as: "aCurrentOwner",
  //               },
  //             },
  //             { $unwind: "$aCurrentOwner" },
  //             {
  //               $project: {
  //                 collectionImage: 1,
  //                 eType: 1,
  //                 sCreated: 1,
  //                 oCurrentOwner: 1,
  //                 oPostedBy: 1,
  //                 sCollection: 1,
  //                 sName: 1,
  //                 sCollaborator: 1,
  //                 sNftdescription: 1,
  //                 nCollaboratorPercentage: 1,
  //                 sSetRRoyaltyPercentage: 1,
  //                 nQuantity: 1,
  //                 nView: 1,
  //                 nBasePrice: 1,
  //                 eAuctionType: 1,
  //                 sGenre: 1,
  //                 sBpm: 1,
  //                 skey_equalTo: 1,
  //                 skey_harmonicTo: 1,
  //                 track_cover: 1,
  //                 nTokenID: 1,
  //                 sTransactionHash: 1,
  //                 sTransactionStatus: 1,
  //                 aCurrentOwner: 1,
  //                 user_likes: {
  //                   $size: {
  //                     $filter: {
  //                       input: "$user_likes",
  //                       as: "user_likes",
  //                       cond: {
  //                         $eq: [
  //                           "$$user_likes",
  //                           req.userId &&
  //                           req.userId != undefined &&
  //                           req.userId != null
  //                             ? mongoose.Types.ObjectId(req.userId)
  //                             : "",
  //                         ],
  //                       },
  //                     },
  //                   },
  //                 },
  //                 user_likes_size: {
  //                   $cond: {
  //                     if: {
  //                       $isArray: "$user_likes",
  //                     },
  //                     then: {
  //                       $size: "$user_likes",
  //                     },
  //                     else: 0,
  //                   },
  //                 },
  //               },
  //             },
  //             {
  //               $project: {
  //                 collectionImage: 1,
  //                 eType: 1,
  //                 sCreated: 1,
  //                 oCurrentOwner: 1,
  //                 oPostedBy: 1,
  //                 sCollection: 1,
  //                 sName: 1,
  //                 sCollaborator: 1,
  //                 sNftdescription: 1,
  //                 nCollaboratorPercentage: 1,
  //                 sSetRRoyaltyPercentage: 1,
  //                 nQuantity: 1,
  //                 sGenre: 1,
  //                 sBpm: 1,
  //                 skey_equalTo: 1,
  //                 skey_harmonicTo: 1,
  //                 track_cover: 1,
  //                 nView: 1,
  //                 nBasePrice: 1,
  //                 eAuctionType: 1,
  //                 nTokenID: 1,
  //                 sTransactionHash: 1,
  //                 sTransactionStatus: 1,
  //                 aCurrentOwner: 1,
  //                 is_user_like: {
  //                   $cond: {
  //                     if: {
  //                       $gte: ["$user_likes", 1],
  //                     },
  //                     then: "true",
  //                     else: "false",
  //                   },
  //                 },
  //                 user_likes_size: 1,
  //               },
  //             },
  //           ],
  //           onAuction: [
  //             {
  //               $match: {
  //                 sTransactionStatus: {
  //                   $eq: 1,
  //                 },
  //                 eAuctionType: {
  //                   $eq: "Auction",
  //                 },
  //               },
  //             },
  //             {
  //               $sort: {
  //                 _id: -1,
  //               },
  //             },
  //             {
  //               $limit: 10,
  //             },
  //             {
  //               $lookup: {
  //                 from: "users",
  //                 localField: "oCurrentOwner",
  //                 foreignField: "_id",
  //                 as: "aCurrentOwner",
  //               },
  //             },
  //             { $unwind: "$aCurrentOwner" },
  //             {
  //               $project: {
  //                 collectionImage: 1,
  //                 eType: 1,
  //                 sCreated: 1,
  //                 oCurrentOwner: 1,
  //                 oPostedBy: 1,
  //                 sCollection: 1,
  //                 sName: 1,
  //                 sCollaborator: 1,
  //                 sNftdescription: 1,
  //                 nCollaboratorPercentage: 1,
  //                 sSetRRoyaltyPercentage: 1,
  //                 nQuantity: 1,
  //                 nView: 1,
  //                 sGenre: 1,
  //                 sBpm: 1,
  //                 skey_equalTo: 1,
  //                 skey_harmonicTo: 1,
  //                 track_cover: 1,
  //                 nBasePrice: 1,
  //                 eAuctionType: 1,
  //                 nTokenID: 1,
  //                 sTransactionHash: 1,
  //                 sTransactionStatus: 1,
  //                 aCurrentOwner: 1,
  //                 user_likes: {
  //                   $size: {
  //                     $filter: {
  //                       input: "$user_likes",
  //                       as: "user_likes",
  //                       cond: {
  //                         $eq: [
  //                           "$$user_likes",
  //                           req.userId &&
  //                           req.userId != undefined &&
  //                           req.userId != null
  //                             ? mongoose.Types.ObjectId(req.userId)
  //                             : "",
  //                         ],
  //                       },
  //                     },
  //                   },
  //                 },
  //                 user_likes_size: {
  //                   $cond: {
  //                     if: {
  //                       $isArray: "$user_likes",
  //                     },
  //                     then: {
  //                       $size: "$user_likes",
  //                     },
  //                     else: 0,
  //                   },
  //                 },
  //               },
  //             },
  //             {
  //               $project: {
  //                 collectionImage: 1,
  //                 eType: 1,
  //                 sCreated: 1,
  //                 oCurrentOwner: 1,
  //                 oPostedBy: 1,
  //                 sCollection: 1,
  //                 sName: 1,
  //                 sCollaborator: 1,
  //                 sNftdescription: 1,
  //                 sGenre: 1,
  //                 sBpm: 1,
  //                 skey_equalTo: 1,
  //                 skey_harmonicTo: 1,
  //                 track_cover: 1,
  //                 nCollaboratorPercentage: 1,
  //                 sSetRRoyaltyPercentage: 1,
  //                 nQuantity: 1,
  //                 nView: 1,
  //                 nBasePrice: 1,
  //                 eAuctionType: 1,
  //                 nTokenID: 1,
  //                 sTransactionHash: 1,
  //                 sTransactionStatus: 1,
  //                 aCurrentOwner: 1,
  //                 is_user_like: {
  //                   $cond: {
  //                     if: {
  //                       $gte: ["$user_likes", 1],
  //                     },
  //                     then: "true",
  //                     else: "false",
  //                   },
  //                 },
  //                 user_likes_size: 1,
  //               },
  //             },
  //           ],
  //         },
  //       },
  //     ]);
  //     console.log("---------------------data", data);

  //     data[0].users = [];
  //     data[0].users = await User.find({ sRole: "user" });

  //     let agQuery = [
  //       {
  //         $lookup: {
  //           from: "users",
  //           localField: "oCreatedBy",
  //           foreignField: "_id",
  //           as: "oUser",
  //         },
  //       },
  //       {
  //         $sort: {
  //           sCreated: -1,
  //         },
  //       },
  //       { $unwind: "$oUser" },
  //     ];

  //     data[0].collections = [];
  //     data[0].collections = await Collection.aggregate(agQuery);
  //     return res.reply(messages.success(), data[0]);
  //   } catch (error) {
  //     return res.reply(messages.server_error());
  //   }
  // }

  // async toggleSellingType(req, res) {
  //   try {
  //     if (!req.userId) return res.reply(messages.unauthorized());

  //     if (!req.body.nNFTId) return res.reply(messages.not_found("NFT ID"));
  //     if (!req.body.sSellingType)
  //       return res.reply(messages.not_found("Selling Type"));

  //     if (!validators.isValidObjectID(req.body.nNFTId))
  //       return res.reply(messages.invalid("NFT ID"));
  //     if (!validators.isValidSellingType(req.body.sSellingType))
  //       return res.reply(messages.invalid("Selling Type"));

  //     let oNFT = await NFT.findById(req.body.nNFTId);

  //     if (!oNFT) return res.reply(messages.not_found("NFT"));
  //     if (oNFT.oCurrentOwner != req.userId)
  //       return res.reply(
  //         message.bad_request("Only NFT Owner Can Set Selling Type")
  //       );

  //     let BIdsExist = await Bid.find({
  //       oNFTId: mongoose.Types.ObjectId(req.body.nNFTId),
  //       sTransactionStatus: 1,
  //       eBidStatus: "Bid",
  //     });

  //     if (BIdsExist && BIdsExist != undefined && BIdsExist.length) {
  //       return res.reply(
  //         messages.bad_request("Please Cancel Active bids on this NFT.")
  //       );
  //     } else {
  //       let updObj = {
  //         eAuctionType: req.body.sSellingType,
  //       };

  //       if (
  //         req.body.auction_end_date &&
  //         req.body.auction_end_date != undefined
  //       ) {
  //         updObj.auction_end_date = req.body.auction_end_date;
  //       }
  //       NFT.findByIdAndUpdate(req.body.nNFTId, updObj, (err, nft) => {
  //         if (err) return res.reply(messages.server_error());
  //         if (!nft) return res.reply(messages.not_found("NFT"));

  //         return res.reply(messages.updated("NFT Details"));
  //       });
  //     }
  //   } catch (error) {
  //     return res.reply(messages.server_error());
  //   }
  // }

  // async allCollectionWiselist(req, res) {
  //   console.log("------data--------", req.body);
  //   //    let agQuery = [ {
  //   //         '$lookup': {
  //   //             'from': 'users',
  //   //             'localField': 'oCreatedBy',
  //   //             'foreignField': '_id',
  //   //             'as': 'oUser'
  //   //         }
  //   //     }, {
  //   //         '$sort': {
  //   //             'sCreated': -1
  //   //         }
  //   //     }]

  //   try {
  //     //         let aCollections = await Collection.aggregate(agQuery);

  //     //         if (!aCollections) {
  //     //             return res.reply(messages.not_found('collection'));
  //     //         }

  //     //         return res.reply(messages.no_prefix('Collection Details'), aCollections);

  //     //     } catch (error) {
  //     //         return res.reply(messages.server_error());
  //     //     }

  //     var nLimit = parseInt(req.body.length);
  //     var nOffset = parseInt(req.body.start);
  //     let oTypeQuery = {},
  //       oSellingTypeQuery = {},
  //       oCollectionQuery = {},
  //       oSortingOrder = {};
  //     let oTtextQuery = {
  //       sName: new RegExp(req.body.sTextsearch, "i"),
  //     };
  //     if (req.body.eType[0] != "All" && req.body.eType[0] != "") {
  //       oTypeQuery = {
  //         $or: [],
  //       };
  //       req.body.eType.forEach((element) => {
  //         oTypeQuery["$or"].push({
  //           eType: element,
  //         });
  //       });
  //     }
  //     if (req.body.sCollection != "All" && req.body.sCollection != "") {
  //       oCollectionQuery = {
  //         $or: [],
  //       };
  //       oCollectionQuery["$or"].push({
  //         sCollection: req.body.sCollection,
  //       });
  //     }

  //     if (req.body.sSortingType == "Recently Added") {
  //       oSortingOrder["sCreated"] = -1;
  //     } else if (req.body.sSortingType == "Most Viewed") {
  //       oSortingOrder["nView"] = -1;
  //     } else if (req.body.sSortingType == "Price Low to High") {
  //       oSortingOrder["nBasePrice"] = 1;
  //     } else if (req.body.sSortingType == "Price High to Low") {
  //       oSortingOrder["nBasePrice"] = -1;
  //     } else {
  //       oSortingOrder["_id"] = -1;
  //     }

  //     if (req.body.sSellingType != "") {
  //       oSellingTypeQuery = {
  //         $or: [
  //           {
  //             eAuctionType: req.body.sSellingType,
  //           },
  //         ],
  //       };
  //     }

  //     let data = await NFT.aggregate([
  //       {
  //         $match: {
  //           $and: [
  //             {
  //               sTransactionStatus: {
  //                 $eq: 1,
  //               },
  //             },
  //             {
  //               eAuctionType: {
  //                 $ne: "Unlockable",
  //               },
  //             },
  //             oTypeQuery,
  //             oCollectionQuery,
  //             oTtextQuery,
  //             oSellingTypeQuery,
  //           ],
  //         },
  //       },
  //       {
  //         $sort: oSortingOrder,
  //       },
  //       {
  //         $project: {
  //           _id: 1,
  //           sName: 1,
  //           eType: 1,
  //           nBasePrice: 1,
  //           collectionImage: 1,
  //           oCurrentOwner: 1,
  //           eAuctionType: 1,
  //           sCollection: 1,
  //           sGenre: 1,
  //           sBpm: 1,
  //           skey_equalTo: 1,
  //           skey_harmonicTo: 1,
  //           track_cover: 1,
  //           user_likes: {
  //             $size: {
  //               $filter: {
  //                 input: "$user_likes",
  //                 as: "user_likes",
  //                 cond: {
  //                   $eq: [
  //                     "$$user_likes",
  //                     req.userId &&
  //                     req.userId != undefined &&
  //                     req.userId != null
  //                       ? mongoose.Types.ObjectId(req.userId)
  //                       : "",
  //                   ],
  //                 },
  //               },
  //             },
  //           },
  //           user_likes_size: {
  //             $cond: {
  //               if: {
  //                 $isArray: "$user_likes",
  //               },
  //               then: {
  //                 $size: "$user_likes",
  //               },
  //               else: 0,
  //             },
  //           },
  //         },
  //       },
  //       {
  //         $project: {
  //           _id: 1,
  //           sName: 1,
  //           eType: 1,
  //           nBasePrice: 1,
  //           collectionImage: 1,
  //           oCurrentOwner: 1,
  //           eAuctionType: 1,
  //           sCollection: 1,
  //           sGenre: 1,
  //           sBpm: 1,
  //           skey_equalTo: 1,
  //           skey_harmonicTo: 1,
  //           track_cover: 1,
  //           is_user_like: {
  //             $cond: {
  //               if: {
  //                 $gte: ["$user_likes", 1],
  //               },
  //               then: "true",
  //               else: "false",
  //             },
  //           },
  //           user_likes_size: 1,
  //         },
  //       },
  //       {
  //         $lookup: {
  //           from: "users",
  //           localField: "oCurrentOwner",
  //           foreignField: "_id",
  //           as: "oUser",
  //         },
  //       },
  //       { $unwind: "$oUser" },
  //       {
  //         $facet: {
  //           nfts: [
  //             {
  //               $skip: +nOffset,
  //             },
  //             {
  //               $limit: +nLimit,
  //             },
  //           ],
  //           totalCount: [
  //             {
  //               $count: "count",
  //             },
  //           ],
  //         },
  //       },
  //     ]);
  //     let iFiltered = data[0].nfts.length;
  //     if (data[0].totalCount[0] == undefined) {
  //       return res.reply(messages.success("Data"), {
  //         data: 0,
  //         draw: req.body.draw,
  //         recordsTotal: 0,
  //         recordsFiltered: iFiltered,
  //       });
  //     } else {
  //       return res.reply(messages.no_prefix("NFT Details"), {
  //         data: data[0].nfts,
  //         draw: req.body.draw,
  //         recordsTotal: data[0].totalCount[0].count,
  //         recordsFiltered: iFiltered,
  //       });
  //     }
  //   } catch (error) {
  //     return res.reply(messages.server_error());
  //   }
  // }

  // async updateBasePrice(req, res) {
  //   try {
  //     if (!req.userId) return res.reply(messages.unauthorized());

  //     console.log(req.body);
  //     if (!req.body.nNFTId) return res.reply(messages.not_found("NFT ID"));
  //     if (!req.body.nBasePrice)
  //       return res.reply(messages.not_found("Base Price"));

  //     if (!validators.isValidObjectID(req.body.nNFTId))
  //       return res.reply(messages.invalid("NFT ID"));
  //     if (
  //       isNaN(req.body.nBasePrice) ||
  //       parseFloat(req.body.nBasePrice) <= 0 ||
  //       parseFloat(req.body.nBasePrice) <= 0.000001
  //     )
  //       return res.reply(messages.invalid("Base Price"));

  //     let oNFT = await NFT.findById(req.body.nNFTId);

  //     if (!oNFT) return res.reply(messages.not_found("NFT"));
  //     if (oNFT.oCurrentOwner != req.userId)
  //       return res.reply(
  //         message.bad_request("Only NFT Owner Can Set Base Price")
  //       );

  //     let BIdsExist = await Bid.find({
  //       oNFTId: mongoose.Types.ObjectId(req.body.nNFTId),
  //       sTransactionStatus: 1,
  //       eBidStatus: "Bid",
  //     });

  //     if (BIdsExist && BIdsExist != undefined && BIdsExist.length) {
  //       return res.reply(
  //         messages.bad_request("Please Cancel Active bids on this NFT.")
  //       );
  //     } else {
  //       NFT.findByIdAndUpdate(
  //         req.body.nNFTId,
  //         {
  //           nBasePrice: req.body.nBasePrice,
  //         },
  //         (err, nft) => {
  //           if (err) return res.reply(messages.server_error());
  //           if (!nft) return res.reply(messages.not_found("NFT"));

  //           return res.reply(messages.updated("Price"));
  //         }
  //       );
  //     }
  //   } catch (error) {
  //     console.log(error);
  //     return res.reply(messages.server_error());
  //   }
  // }

  // async uploadImage(req, res) {
  //   try {
  //     allowedMimes = ["image/jpeg", "image/jpg", "image/png", "image/gif"];
  //     errAllowed = "JPG, JPEG, PNG,GIF";

  //     upload(req, res, function (error) {
  //       if (error) {
  //         //instanceof multer.MulterError
  //         fs.unlinkSync(req.file.path);
  //         return res.reply(messages.bad_request(error.message));
  //       } else {
  //         if (!req.file) {
  //           fs.unlinkSync(req.file.path);
  //           return res.reply(messages.not_found("File"));
  //         }

  //         const oOptions = {
  //           pinataMetadata: {
  //             name: req.file.originalname,
  //           },
  //           pinataOptions: {
  //             cidVersion: 0,
  //           },
  //         };
  //         const readableStreamForFile = fs.createReadStream(req.file.path);
  //         let testFile = fs.readFileSync(req.file.path);
  //         //Creating buffer for ipfs function to add file to the system
  //         let testBuffer = new Buffer(testFile);
  //         try {
  //           pinata
  //             .pinFileToIPFS(readableStreamForFile, oOptions)
  //             .then(async (result) => {
  //               fs.unlinkSync(req.file.path);
  //               return res.reply(messages.created("Collection"), {
  //                 track_cover: result.IpfsHash,
  //               });
  //             })
  //             .catch((err) => {
  //               //handle error here
  //               return res.reply(messages.error());
  //             });
  //         } catch (err) {
  //           console.log("err", err);
  //         }
  //       }
  //     });
  //   } catch (error) {
  //     return res.reply(messages.server_error());
  //   }
  // }

  // async setNFTOrder(req, res) {
  //   try {
  //     let aNft = await NFT.findById(req.body.nftId);
  //     if (!aNft) {
  //       return res.reply(messages.not_found("nft"));
  //     }

  //     aNft.nOrders.push(req.body.orderId);
  //     await aNft.save();

  //     return res.reply(messages.updated("nfts List"), aNft);
  //   } catch (e) {
  //     return res.reply(messages.error(e));
  //   }
  // }

  // async getUserLikedNfts(req, res) {
  //   try {
  //     let data = [];

  //     if (!req.body.userId)
  //       res.reply(messages.invalid_req("User Id is required"));

  //     //sortKey is the column
  //     const sortKey = req.body.sortKey ? req.body.sortKey : "";

  //     //sortType will let you choose from ASC 1 or DESC -1
  //     const sortType = req.body.sortType ? req.body.sortType : -1;

  //     var sortObject = {};
  //     var stype = sortKey;
  //     var sdir = sortType;
  //     sortObject[stype] = sdir;

  //     const page = parseInt(req.body.page);
  //     const limit = parseInt(req.body.limit);

  //     const startIndex = (page - 1) * limit;
  //     const endIndex = page * limit;

  //     const results = {};

  //     if (
  //       endIndex <
  //       (await NFT.countDocuments({
  //         nUser_likes: { $in: [mongoose.Types.ObjectId(req.body.userId)] },
  //       }).exec())
  //     ) {
  //       results.next = {
  //         page: page + 1,
  //         limit: limit,
  //       };
  //     }

  //     if (startIndex > 0) {
  //       results.previous = {
  //         page: page - 1,
  //         limit: limit,
  //       };
  //     }

  //     await NFT.find({
  //       nUser_likes: { $in: [mongoose.Types.ObjectId(req.body.userId)] },
  //     })
  //       .select({
  //         nTitle: 1,
  //         nCollection: 1,
  //         nHash: 1,
  //         nType: 1,
  //         nUser_likes: 1,
  //         nNftImage: 1,
  //         nLazyMintingStatus: 1,
  //       })
  //       .populate({
  //         path: "nOrders",
  //         options: {
  //           limit: 1,
  //         },
  //         select: {
  //           oPrice: 1,
  //           oType: 1,
  //           oValidUpto: 1,
  //           auction_end_date: 1,
  //           oStatus: 1,
  //           _id: 0,
  //         },
  //       })
  //       .populate({
  //         path: "nCreater",
  //         options: {
  //           limit: 1,
  //         },
  //         select: {
  //           _id: 1,
  //           sProfilePicUrl: 1,
  //           sWalletAddress: 1,
  //         },
  //       })
  //       .limit(limit)
  //       .skip(startIndex)
  //       .exec()
  //       .then((res) => {
  //         data.push(res);
  //       })
  //       .catch((e) => {
  //         console.log("Error", e);
  //       });

  //     results.count = await NFT.countDocuments({
  //       nUser_likes: { $in: [mongoose.Types.ObjectId(req.body.userId)] },
  //     }).exec();
  //     results.results = data;

  //     return res.reply(messages.success("NFTs List Liked By User"), results);
  //   } catch (error) {
  //     console.log("Error:", error);
  //     return res.reply(messages.error());
  //   }
  // }

  // async transferNfts(req, res) {
  //   //deduct previous owner
  //   console.log("req", req.body);
  //   try {
  //     if (!req.userId) return res.reply(messages.unauthorized());

  //     let _NFT = await NFT.findOne({
  //       _id: mongoose.Types.ObjectId(req.body.nftId),
  //       "nOwnedBy.address": req.body.sender,
  //     }).select("nOwnedBy -_id");

  //     console.log("_NFT-------->", _NFT);
  //     let currentQty = _NFT.nOwnedBy.find(
  //       (o) => o.address === req.body.sender.toLowerCase()
  //     ).quantity;
  //     let boughtQty = parseInt(req.body.qty);
  //     let leftQty = currentQty - boughtQty;
  //     if (leftQty < 1) {
  //       await NFT.findOneAndUpdate(
  //         { _id: mongoose.Types.ObjectId(req.body.nftId) },
  //         {
  //           $pull: {
  //             nOwnedBy: { address: req.body.sender },
  //           },
  //         }
  //       ).catch((e) => {
  //         console.log("Error1", e.message);
  //       });
  //     } else {
  //       await NFT.findOneAndUpdate(
  //         {
  //           _id: mongoose.Types.ObjectId(req.body.nftId),
  //           "nOwnedBy.address": req.body.sender,
  //         },
  //         {
  //           $set: {
  //             "nOwnedBy.$.quantity": parseInt(leftQty),
  //           },
  //         }
  //       ).catch((e) => {
  //         console.log("Error2", e.message);
  //       });
  //     }

  //     //Credit the buyer
  //     console.log("Crediting Buyer");

  //     let subDocId = await NFT.exists({
  //       _id: mongoose.Types.ObjectId(req.body.nftId),
  //       "nOwnedBy.address": req.body.receiver,
  //     });
  //     if (subDocId) {
  //       console.log("Subdocument Id", subDocId);

  //       let _NFTB = await NFT.findOne({
  //         _id: mongoose.Types.ObjectId(req.body.nftId),
  //         "nOwnedBy.address": req.body.receiver,
  //       }).select("nOwnedBy -_id");
  //       console.log("_NFTB-------->", _NFTB);
  //       console.log(
  //         "Quantity found for receiver",
  //         _NFTB.nOwnedBy.find(
  //           (o) => o.address === req.body.receiver.toLowerCase()
  //         ).quantity
  //       );
  //       currentQty = _NFTB.nOwnedBy.find(
  //         (o) => o.address === req.body.receiver.toLowerCase()
  //       ).quantity
  //         ? parseInt(
  //             _NFTB.nOwnedBy.find(
  //               (o) => o.address === req.body.receiver.toLowerCase()
  //             ).quantity
  //           )
  //         : 0;
  //       boughtQty = req.body.qty;
  //       let ownedQty = currentQty + boughtQty;

  //       await NFT.findOneAndUpdate(
  //         {
  //           _id: mongoose.Types.ObjectId(req.body.nftId),
  //           "nOwnedBy.address": req.body.receiver,
  //         },
  //         {
  //           $set: {
  //             "nOwnedBy.$.quantity": parseInt(ownedQty),
  //           },
  //         },
  //         { upsert: true, runValidators: true }
  //       ).catch((e) => {
  //         console.log("Error1", e.message);
  //       });
  //     } else {
  //       console.log("Subdocument Id not found");
  //       let dataToadd = {
  //         address: req.body.receiver,
  //         quantity: parseInt(req.body.qty),
  //       };
  //       await NFT.findOneAndUpdate(
  //         { _id: mongoose.Types.ObjectId(req.body.nftId) },
  //         { $addToSet: { nOwnedBy: dataToadd } },
  //         { upsert: true }
  //       );
  //       console.log("wasn't there but added");
  //     }
  //     return res.reply(messages.updated("NFT"));
  //   } catch (e) {
  //     console.log("errr", e);
  //     return res.reply(messages.error());
  //   }
  // }

  // async getCollectionNFT(req, res) {
  //   try {
  //     let data = [];
  //     let collection = req.body.collection;

  //     const sortKey = req.body.sortKey ? req.body.sortKey : "";
  //     //sortType will let you choose from ASC 1 or DESC -1
  //     const sortType = req.body.sortType ? req.body.sortType : -1;

  //     var sortObject = {};
  //     var stype = sortKey;
  //     var sdir = sortType;
  //     sortObject[stype] = sdir;

  //     const page = parseInt(req.body.page);
  //     const limit = parseInt(req.body.limit);

  //     const startIndex = (page - 1) * limit;
  //     const endIndex = page * limit;
  //     const results = {};
  //     let orderQuery = {};

  //     orderQuery["oStatus"] = 1; // we are getting only active orders

  //     let OrderIdsss = await Order.distinct("oNftId", orderQuery);

  //     if (
  //       endIndex <
  //       (await NFT.countDocuments({
  //         nCollection: collection,
  //         _id: { $in: OrderIdsss },
  //       }).exec())
  //     ) {
  //       results.next = {
  //         page: page + 1,
  //         limit: limit,
  //       };
  //     }
  //     if (startIndex > 0) {
  //       results.previous = {
  //         page: page - 1,
  //         limit: limit,
  //       };
  //     }

  //     await NFT.find({ nCollection: collection, _id: { $in: OrderIdsss } })
  //       .select({
  //         nTitle: 1,
  //         nCollection: 1,
  //         nHash: 1,
  //         nCreater: 1,
  //         nType: 1,
  //         nUser_likes: 1,
  //         nNftImage: 1,
  //         nLazyMintingStatus: 1,
  //       })
  //       .populate({
  //         path: "nOrders",
  //         options: {
  //           limit: 1,
  //         },
  //         select: {
  //           oPrice: 1,
  //           oType: 1,
  //           oValidUpto: 1,
  //           auction_end_date: 1,
  //           oStatus: 1,
  //           _id: 0,
  //         },
  //       })
  //       .populate({
  //         path: "nCreater",
  //         options: {
  //           limit: 1,
  //         },
  //         select: {
  //           _id: 1,
  //           sProfilePicUrl: 1,
  //           sWalletAddress: 1,
  //         },
  //       })
  //       .limit(limit)
  //       .skip(startIndex)
  //       .exec()
  //       .then((res) => {
  //         data.push(res);
  //       })
  //       .catch((e) => {
  //         console.log("Error", e);
  //       });
  //     results.count = await NFT.countDocuments({
  //       nCollection: collection,
  //       _id: { $in: OrderIdsss },
  //     }).exec();
  //     results.results = data;
  //     return res.reply(messages.success("Order List"), results);
  //   } catch (error) {
  //     console.log("Error:", error);
  //     return res.reply(messages.error());
  //   }
  // }

  // async getCollectionNFTOwned(req, res) {
  //   try {
  //     if (!req.userId) return res.reply(messages.unauthorized());
  //     let data = [];
  //     let collection = req.body.collection;
  //     let userID = req.userId;
  //     let UserData = await User.findById(userID);
  //     if (UserData) {
  //       let userWalletAddress = UserData.sWalletAddress;

  //       const sortKey = req.body.sortKey ? req.body.sortKey : "";
  //       //sortType will let you choose from ASC 1 or DESC -1
  //       const sortType = req.body.sortType ? req.body.sortType : -1;

  //       var sortObject = {};
  //       var stype = sortKey;
  //       var sdir = sortType;
  //       sortObject[stype] = sdir;

  //       const page = parseInt(req.body.page);
  //       const limit = parseInt(req.body.limit);

  //       const startIndex = (page - 1) * limit;
  //       const endIndex = page * limit;
  //       const results = {};
  //       if (
  //         endIndex <
  //         (await NFT.countDocuments({
  //           nCollection: collection,
  //           "nOwnedBy.address": userWalletAddress,
  //         }).exec())
  //       ) {
  //         results.next = {
  //           page: page + 1,
  //           limit: limit,
  //         };
  //       }
  //       if (startIndex > 0) {
  //         results.previous = {
  //           page: page - 1,
  //           limit: limit,
  //         };
  //       }
  //       await NFT.find({
  //         nCollection: collection,
  //         "nOwnedBy.address": userWalletAddress,
  //       })
  //         .select({
  //           nTitle: 1,
  //           nCollection: 1,
  //           nHash: 1,
  //           nType: 1,
  //           nUser_likes: 1,
  //           nNftImage: 1,
  //           nLazyMintingStatus: 1,
  //         })
  //         .populate({
  //           path: "nOrders",
  //           options: {
  //             limit: 1,
  //           },
  //           select: {
  //             oPrice: 1,
  //             oType: 1,
  //             oStatus: 1,
  //             _id: 0,
  //           },
  //         })
  //         .populate({
  //           path: "nCreater",
  //           options: {
  //             limit: 1,
  //           },
  //           select: {
  //             _id: 1,
  //             sProfilePicUrl: 1,
  //             sWalletAddress: 1,
  //           },
  //         })
  //         .limit(limit)
  //         .skip(startIndex)
  //         .exec()
  //         .then((res) => {
  //           data.push(res);
  //         })
  //         .catch((e) => {
  //           console.log("Error", e);
  //         });

  //       results.count = await NFT.countDocuments({
  //         nCollection: collection,
  //         "nOwnedBy.address": userWalletAddress,
  //       }).exec();
  //       results.results = data;
  //       return res.reply(messages.success("Order List"), results);
  //     } else {
  //       console.log("Bid Not found");
  //       return res.reply("User Not found");
  //     }
  //   } catch (error) {
  //     console.log("Error:", error);
  //     return res.reply(messages.error());
  //   }
  // }

  // async getSearchedNft(req, res) {
  //   try {
  //     let data = [];
  //     let setConditions = req.body.conditions;

  //     //sortKey is the column
  //     const sortKey = req.body.sortKey ? req.body.sortKey : "";

  //     //sortType will let you choose from ASC 1 or DESC -1
  //     const sortType = req.body.sortType ? req.body.sortType : -1;

  //     var sortObject = {};
  //     var stype = sortKey;
  //     var sdir = sortType;
  //     sortObject[stype] = sdir;

  //     const page = parseInt(req.body.page);
  //     const limit = parseInt(req.body.limit);

  //     const startIndex = (page - 1) * limit;
  //     const endIndex = page * limit;

  //     const results = {};
  //     let OrderIdsss = await Order.distinct("oNftId", setConditions);

  //     if (
  //       endIndex <
  //       (await NFT.countDocuments({
  //         nTitle: { $regex: req.body.sTextsearch, $options: "i" },
  //         _id: { $in: OrderIdsss.map(String) },
  //       }).exec())
  //     ) {
  //       results.next = {
  //         page: page + 1,
  //         limit: limit,
  //       };
  //     }

  //     if (startIndex > 0) {
  //       results.previous = {
  //         page: page - 1,
  //         limit: limit,
  //       };
  //     }

  //     await NFT.find({
  //       nTitle: { $regex: req.body.sTextsearch, $options: "i" },
  //       _id: { $in: OrderIdsss.map(String) },
  //     })
  //       .select({
  //         nTitle: 1,
  //         nCollection: 1,
  //         nHash: 1,
  //         nType: 1,
  //         nUser_likes: 1,
  //         nNftImage: 1,
  //         nLazyMintingStatus: 1,
  //       })
  //       .populate({
  //         path: "nOrders",
  //         options: {
  //           limit: 1,
  //         },
  //         select: {
  //           oPrice: 1,
  //           oType: 1,
  //           auction_end_date: 1,
  //           oValidUpto: 1,
  //           oStatus: 1,
  //           _id: 0,
  //         },
  //       })
  //       .populate({
  //         path: "nCreater",
  //         options: {
  //           limit: 1,
  //         },
  //         select: {
  //           _id: 0,
  //         },
  //       })
  //       .limit(limit)
  //       .skip(startIndex)
  //       .exec()
  //       .then((res) => {
  //         data.push(res);
  //         results.count = res.length;
  //       })
  //       .catch((e) => {
  //         console.log("Error", e);
  //       });

  //     results.count = await NFT.countDocuments({
  //       nTitle: { $regex: req.body.sTextsearch, $options: "i" },
  //       _id: { $in: OrderIdsss.map(String) },
  //     }).exec();
  //     results.results = data;

  //     return res.reply(messages.success("NFTs List"), results);
  //   } catch (error) {
  //     console.log("Error:", error);
  //     return res.reply(messages.error());
  //   }
  // }

  // async updateCollectionMarketplace(req, res) {
  //   try {
  //     if (!req.userId) return res.reply(messages.unauthorized());
  //     if (!req.body.collectionID) {
  //       return res.reply(messages.not_found("Collection ID"));
  //     }
  //     let collectionID = req.body.collectionID;
  //     let isOnMarketplace = req.body.isOnMarketplace;

  //     let updateData = [];
  //     updateData["isOnMarketplace"] = isOnMarketplace;
  //     let updateObj = Object.assign({}, updateData);

  //     Collection.findByIdAndUpdate(
  //       { _id: mongoose.Types.ObjectId(collectionID) },
  //       { $set: updateObj }
  //     ).then((collection) => {
  //       return res.reply(
  //         messages.updated("Collection Updated successfully."),
  //         collection
  //       );
  //     });
  //   } catch (error) {
  //     return res.reply(messages.server_error());
  //   }
  // }

  // async getAllNfts(req, res) {
  //   try {
  //     let aNft = await NFT.find({})
  //       .select({
  //         nTitle: 1,
  //         nCollection: 1,
  //         nHash: 1,
  //         nLazyMintingStatus: 1,
  //         nNftImage: 1,
  //       })
  //       .populate({
  //         path: "nOrders",
  //         options: {
  //           limit: 1,
  //         },
  //         select: {
  //           oPrice: 1,
  //           oType: 1,
  //           oValidUpto: 1,
  //           auction_end_date: 1,
  //           oStatus: 1,
  //           _id: 0,
  //         },
  //       })
  //       .populate({
  //         path: "nCreater",
  //         options: {
  //           limit: 1,
  //         },
  //         select: {
  //           _id: 0,
  //         },
  //       })
  //       .limit(limit)
  //       .skip(startIndex)
  //       .exec()
  //       .then((res) => {
  //         data.push(res);
  //       })
  //       .catch((e) => {
  //         console.log("Error", e);
  //       });

  //     results.results = data;
  //     console.log("Collections", aNft);

  //     if (!aNft) {
  //       return res.reply(messages.not_found("nft"));
  //     }
  //     return res.reply(messages.no_prefix("nfts List"), aNft);
  //   } catch (e) {
  //     return res.reply(messages.error(e));
  //   }
  // }

  async getCombinedNfts(req, res) {
    try {
      let collectionAddress = "";
      if (
        req.body.collectionAddress &&
        req.body.collectionAddress !== undefined
      ) {
        collectionAddress = req.body.collectionAddress;
      }
      let tokenID = "";
      if (req.body.tokenID && req.body.tokenID !== undefined) {
        tokenID = req.body.tokenID;
      }

      let ownedBy = "";
      if (req.body.ownedBy && req.body.ownedBy !== undefined) {
        ownedBy = req.body.ownedBy;
      }

      let searchArray = [];
      if (collectionAddress !== "") {
        searchArray["collectionAddress"] = collectionAddress;
      }
      if (tokenID !== "") {
        searchArray["tokenID"] = tokenID;
      }
      // req.userId;
      // if (ownedBy !== "") {
      //   searchArray["ownedBy"]= {
      //     $elemMatch: {
      //       address: ownedBy,
      //       quantity: { $gt: 0 },
      //     }
      //   }
      // }
      searchArray["isImported"] = 1;
      let searchObj = Object.assign({}, searchArray);
      let result = [];
      const nfts = await NFT.find(searchObj);
      if (nfts.length) result.push(nfts);
      const impnfts = await NFT.find(searchObj);
      if (impnfts.length) result.push(impnfts);
      if (result.length)
        return res.reply(messages.success("NFTs/Imported NFTs List"), result);
      else return res.reply(messages.success("NFTs/Imported NFTs List"), []);
    } catch (e) {
      return res.reply(messages.error());
    }
  }

  async blockUnblockCollection(req, res) {
    try {
      if (!req.userId) return res.reply(messages.unauthorized());
      if (!req.body.collectionID) {
        return res.reply(messages.not_found("Collection ID"));
      }
      if (req.body.blockStatus === undefined) {
        return res.reply(messages.not_found("Block Status"));
      }
      let collectionDetails = {};
      collectionDetails = {
        status: req.body.blockStatus,
      };
      await Collection.findByIdAndUpdate(
        req.body.collectionID,
        collectionDetails,
        (err, collectionData) => {
          if (err) return res.reply(messages.server_error());
          if (!collectionData)
            return res.reply(messages.not_found("Collection"));
          return res.reply(
            messages.successfully("Collection Block Status Updated")
          );
        }
      ).catch((e) => {
        return res.reply(messages.error());
      });
    } catch (error) {
      return res.reply(messages.server_error());
    }
  }
  async blockUnblockNFT(req, res) {
    try {
      if (!req.userId) return res.reply(messages.unauthorized());
      if (!req.body.nftID) {
        return res.reply(messages.not_found("NFT ID"));
      }
      if (req.body.blockStatus === undefined) {
        return res.reply(messages.not_found("Block Status"));
      }
      let nftDetails = {};
      nftDetails = {
        status: req.body.blockStatus,
      };
      await NFT.findByIdAndUpdate(
        req.body.nftID,
        nftDetails,
        (err, nftData) => {
          if (err) return res.reply(messages.server_error());
          if (!nftData) return res.reply(messages.not_found("NFT"));
          return res.reply(messages.successfully("NFT Block Status Updated"));
        }
      ).catch((e) => {
        return res.reply(messages.error());
      });
    } catch (error) {
      return res.reply(messages.server_error());
    }
  }

  async insertMintAddress(req, res, next) {
    try {
      if (!req.body.address) {
        return res.reply(messages.not_found("Address"));
      }
      if (!req.body.type) {
        return res.reply(messages.not_found("Collection Type"));
      }
      let mintCollection = new MintCollection({
        address: req.body.address,
        type: req.body.type,
      });
      mintCollection
        .save()
        .then(async (result) => {
          console.log("Result", result);
          return res.reply(messages.created("Mint Collection"), result);
        })
        .catch((error) => {
          console.log("Created Mint Collection error", error);
          return res.reply(messages.error());
        });
    } catch (error) {
      console.log(error);
      return res.reply(messages.server_error());
    }
  }

  async fetchMintAddress(req, res) {
    try {
      console.log("reqq", req.body)
      await MintCollection.findOne({ address: req.body.address })
        .exec()
        .then((result) => {
          return res.reply(messages.success("Mint Collection List"), result);
        })
        .catch((e) => {
          console.log("Error", e);
        });
    } catch (error) {
      console.log("Error " + error);
      return res.reply(messages.server_error());
    }
  }

  async fetchOfferMade(req, res) {
    console.log("req", req.body);
    try {
      let data = [];
      const page = parseInt(req.body.page);
      const limit = parseInt(req.body.limit);
      const startIndex = (page - 1) * limit;
      const endIndex = page * limit;

      let searchArray = [];
      searchArray["nftsData.status"] = 1;
      searchArray["bidStatus"] = "MakeOffer";
      searchArray["bidderID"] = mongoose.Types.ObjectId(req.body.userID);
      let searchObj = Object.assign({}, searchArray);

      let isOnMarketplaceSearchArray = [];
      isOnMarketplaceSearchArray["$match"] = { "CollectionData.status": 1, "CollectionData.hashStatus": 1 };
      let isOnMarketplaceSearchObj = Object.assign(
        {},
        isOnMarketplaceSearchArray
      );
      console.log("isOnMarketplaceSearchObj", isOnMarketplaceSearchObj);

      let bids = await Bid.aggregate([
        {
          $lookup: {
            from: "nfts",
            localField: "nftID",
            foreignField: "_id",
            as: "nftsData",
          },
        },
        {
          $lookup: {
            from: "collections",
            localField: "nftsData.collectionID",
            foreignField: "_id",
            as: "CollectionData",
          },
        },
        isOnMarketplaceSearchObj,
        {
          $lookup: {
            from: "orders",
            localField: "nftsData._id",
            foreignField: "nftID",
            as: "OrderData",
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "owner",
            foreignField: "_id",
            as: "OwnerData",
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "bidderID",
            foreignField: "_id",
            as: "BidderData",
          },
        },
        { $match: searchObj },
        {
          $project: {
            _id: 1,
            bidderID: 1,
            owner: 1,
            bidStatus: 1,
            bidPrice: 1,
            bidDeadline: 1,
            bidQuantity: 1,
            isOffer: 1,
            paymentToken: 1,
            createdOn: 1,
            "nftsData._id": 1,
            "nftsData.name": 1,
            "nftsData.type": 1,
            "nftsData.image": 1,
            "CollectionData._id": 1,
            "CollectionData.name": 1,
            "CollectionData.contractAddress": 1,
            "CollectionData.isOnMarketplace": 1,
            "CollectionData.status": 1,
            "OrderData._id": 1,
            "OrderData.price": 1,
            "OrderData.salesType": 1,
            "OrderData.paymentToken": 1,
            "BrandData._id": 1,
            "BrandData.name": 1,
            "BrandData.logoImage": 1,
            "BrandData.coverImage": 1,
            "OwnerData._id": 1,
            "OwnerData.username": 1,
            "OwnerData.fullname": 1,
            "OwnerData.walletAddress": 1,
            "BidderData._id": 1,
            "BidderData.username": 1,
            "BidderData.fullname": 1,
            "BidderData.walletAddress": 1,
          },
        },
        { $sort: { createdOn: -1 } },
        { $skip: startIndex },
        { $limit: limit },

      ]).exec(function (e, offerData) {
        console.log("Error ", e);
        let results = {};
        results.count = offerData?.length ? offerData.length : 0;
        results.results = offerData;
        return res.reply(messages.success("Offer List"), results);
      });
    } catch (error) {
      console.log("Error " + error);
      return res.reply(messages.server_error());
    }
  }

  async fetchOfferReceived(req, res) {
    console.log("req", req.body);
    try {
      let data = [];
      const page = parseInt(req.body.page);
      const limit = parseInt(req.body.limit);
      const startIndex = (page - 1) * limit;
      const endIndex = page * limit;

      let searchArray = [];
      searchArray["nftsData.status"] = 1;
      searchArray["bidStatus"] = "MakeOffer";
      searchArray["nftsData.ownedBy"] = {
        $elemMatch: {
          address: req.body.userWalletAddress?.toLowerCase(),
          quantity: { $gt: 0 },
        },
      };
      let searchObj = Object.assign({}, searchArray);

      let isOnMarketplaceSearchArray = [];
      isOnMarketplaceSearchArray["$match"] = { "CollectionData.status": 1, "CollectionData.hashStatus": 1 };
      let isOnMarketplaceSearchObj = Object.assign(
        {},
        isOnMarketplaceSearchArray
      );
      console.log("isOnMarketplaceSearchObj", isOnMarketplaceSearchObj);

      let bids = await Bid.aggregate([
        {
          $lookup: {
            from: "nfts",
            localField: "nftID",
            foreignField: "_id",
            as: "nftsData",
          },
        },
        {
          $lookup: {
            from: "collections",
            localField: "nftsData.collectionID",
            foreignField: "_id",
            as: "CollectionData",
          },
        },
        isOnMarketplaceSearchObj,
        {
          $lookup: {
            from: "orders",
            localField: "nftsData._id",
            foreignField: "nftID",
            as: "OrderData",
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "owner",
            foreignField: "_id",
            as: "OwnerData",
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "bidderID",
            foreignField: "_id",
            as: "BidderData",
          },
        },
        { $match: searchObj },
        {
          $project: {
            _id: 1,
            bidderID: 1,
            owner: 1,
            bidStatus: 1,
            bidPrice: 1,
            bidDeadline: 1,
            bidQuantity: 1,
            isOffer: 1,
            paymentToken: 1,
            createdOn: 1,
            "nftsData._id": 1,
            "nftsData.name": 1,
            "nftsData.type": 1,
            "nftsData.image": 1,
            "CollectionData._id": 1,
            "CollectionData.name": 1,
            "CollectionData.contractAddress": 1,
            "CollectionData.isOnMarketplace": 1,
            "CollectionData.status": 1,
            "OrderData._id": 1,
            "OrderData.price": 1,
            "OrderData.salesType": 1,
            "OrderData.paymentToken": 1,
            "BrandData._id": 1,
            "BrandData.name": 1,
            "BrandData.logoImage": 1,
            "BrandData.coverImage": 1,
            "OwnerData._id": 1,
            "OwnerData.username": 1,
            "OwnerData.fullname": 1,
            "OwnerData.walletAddress": 1,
            "BidderData._id": 1,
            "BidderData.username": 1,
            "BidderData.fullname": 1,
            "BidderData.walletAddress": 1,
          },
        },
        { $sort: { createdOn: -1 } },
        { $skip: startIndex },
        { $limit: limit },

      ]).exec(function (e, offerData) {
        console.log("Error ", e);
        let results = {};
        results.count = offerData?.length ? offerData.length : 0;
        results.results = offerData;
        return res.reply(messages.success("Offer List"), results);
      });
    } catch (error) {
      console.log("Error " + error);
      return res.reply(messages.server_error());
    }
  }

  async updateStatus(req, res) {
    try {

      if (!req.userId) return res.reply(messages.unauthorized());
      console.log("Here");
      console.log("req", req.body);
      if (!req.body.recordID) {
        return res.reply(messages.not_found("Record ID"));
      }
      if (!req.body.DBCollection) {
        return res.reply(messages.not_found("Collection Name"));
      }
      if (req.body.hashStatus === undefined) {
        return res.reply(messages.not_found("Hash Status"));
      }
      let hash = "";
      if (req.body.hash !== undefined) {
        hash = req.body.hash;
      }
      let details = {};

      details = {
        hashStatus: req.body.hashStatus,
      };
      if (hash !== "") {
        details.hash = hash;
      }
      let DBCollection = req.body.DBCollection;
      if (DBCollection === "NFT") {
        console.log("Inside NFT");
        await NFT.findByIdAndUpdate(
          req.body.recordID,
          details,
          (err, resData) => {
            if (err) return res.reply(messages.server_error());
            if (!resData) return res.reply(messages.not_found("NFT"));
            if (resData.hashStatus === req.body.hashStatus && (resData.hash !== "" || resData.hash !== "0x0" || resData.hash !== undefined)) return res.reply(messages.already_exists("Same Data"));
            return res.reply(messages.successfully("NFT Hash Status Updated"));
          }
        ).catch((e) => {
          return res.reply(messages.error());
        });
      }
      if (DBCollection === "Collection") {
        console.log("Inside Collection");
        details = {
          hashStatus: req.body.hashStatus,
          contractAddress: req.body.contractAddress,
        };
        await Collection.findByIdAndUpdate(
          req.body.recordID,
          details,
          (err, resData) => {
            if (err) return res.reply(messages.server_error());
            if (!resData) return res.reply(messages.not_found("Collection"));
            if (resData.hashStatus === req.body.hashStatus && (resData.hash !== "" || resData.hash !== "0x0" || resData.hash !== undefined)) return res.reply(messages.already_exists("Same Data"));
            return res.reply(messages.successfully("Collection Hash Status Updated"));
          }
        ).catch((e) => {
          return res.reply(messages.error());
        });
      }
      if (DBCollection === "Order") {
        console.log("Inside Order");
        await Order.findByIdAndUpdate(
          req.body.recordID,
          details,
          (err, resData) => {
            if (err) return res.reply(messages.server_error());
            if (!resData) return res.reply(messages.not_found("Order"));
            console.log("status--------------------------------->", resData.hashStatus, req.body.hashStatus);
            if (resData.hashStatus === req.body.hashStatus && (resData.hash !== "" || resData.hash !== "0x0" || resData.hash !== undefined) && resData.hash?.length >= 66) return res.reply(messages.already_exists("Same Data"));
            return res.reply(messages.successfully("Order Hash Status Updated"));
          }
        ).catch((e) => {
          return res.reply(messages.error());
        });
      }
      if (DBCollection === "Bids") {
        console.log("Inside Bids");
        await Bid.findByIdAndUpdate(
          req.body.recordID,
          details,
          (err, resData) => {
            console.log("data", resData);
            if (err) return res.reply(messages.server_error());
            if (!resData) return res.reply(messages.not_found("Bids"));
            if (resData.hashStatus === req.body.hashStatus && (resData.hash !== "" || resData.hash !== "0x0" || resData.hash !== undefined)) return res.reply(messages.already_exists("Same Data"));
            return res.reply(messages.successfully("Bids Hash Status Updated"));
          }
        ).catch((e) => {
          return res.reply(messages.error());
        });
      }
    } catch (error) {
      console.log("Error", error)
      return res.reply(messages.server_error());
    }
  }

  async nftButtons(req, res) {
    try {
      let results = [];
      let nftID = req.body.nftID;
      let userID = "";
      let isOwner = 0;
      let onMarketPLace = 0;
      let hasBid = 0;
      let hasOffer = 0;
      if (req.body.userID && req.body.userID !== undefined) {
        userID = req.body.userID;
      }
      let walletAddress = "";
      if (req.body.walletAddress && req.body.walletAddress !== undefined) {
        walletAddress = req.body.walletAddress;
        walletAddress = walletAddress?.toLowerCase()
      }
      if (walletAddress !== "" && userID !== "") {
        let searchArray = [];
        searchArray["_id"] = mongoose.Types.ObjectId(nftID);
        searchArray["ownedBy"] = {
          $elemMatch: {
            address: walletAddress?.toLowerCase(),
            quantity: { $gt: 0 },
          }
        }
        let searchObj = Object.assign({}, searchArray);
        isOwner = await NFT.countDocuments(searchObj).exec();
        console.log("Is Owner", isOwner);
        if (isOwner > 0) {
          let searchArray1 = [];
          searchArray1["_id"] = mongoose.Types.ObjectId(nftID);
          searchArray1["OrderData.0"] = { $exists: true }
          let searchObj1 = Object.assign({}, searchArray1);
          console.log("searchObj1", searchObj1)
          await NFT.aggregate([
            {
              $lookup: {
                from: "orders",
                localField: "_id",
                foreignField: "nftID",
                as: "OrderData",
              },
            },
            { $match: searchObj1 },
            {
              $project: {
                _id: 1,
                hasOrder: {
                  $cond: { if: { $isArray: "$OrderData" }, then: { $size: "$OrderData" }, else: "NA" }
                },
              },
            },
          ]).exec(function (e, nftData) {
            onMarketPLace = nftData?.length ? nftData.length : 0;
            if (onMarketPLace === 0) {
              results.push("Put On Marketplace");
            } else {
              results.push("Remove From Sale");
            }
            return res.reply(messages.successfully("Data"), results);
          });
        } else {
          let searchArray = [];
          searchArray["nftID"] = mongoose.Types.ObjectId(nftID);
          if (userID !== "") {
            searchArray["bidderID"] = mongoose.Types.ObjectId(userID);
          }
          searchArray["bidQuantity"] = { $gte: 1 };
          searchArray["bidStatus"] = "Bid";
          let searchObj = Object.assign({}, searchArray);
          hasBid = await Bid.countDocuments(searchObj).exec();

          console.log("hasBid", 0);

          let searchArray1 = [];
          searchArray1["nftID"] = mongoose.Types.ObjectId(nftID);
          if (userID !== "") {
            searchArray1["bidderID"] = mongoose.Types.ObjectId(userID);
          }
          searchArray1["bidQuantity"] = { $gte: 1 };
          searchArray1["bidStatus"] = "MakeOffer";
          searchArray1["isOffer"] = true;
          let searchObj1 = Object.assign({}, searchArray1);
          console.log("searchObj1", searchObj1)
          hasOffer = await Bid.countDocuments(searchObj1).exec();
          console.log("hasOffer", hasOffer);
          if (hasOffer === 0) {
            results.push("Make Offer");
          } else {
            results.push("Update Offer");
          }

          let searchArray2 = [];
          searchArray2["_id"] = mongoose.Types.ObjectId(nftID);
          searchArray2["OrderData.0"] = { $exists: true }
          let searchObj2 = Object.assign({}, searchArray2);
          await NFT.aggregate([
            {
              $lookup: {
                from: "orders",
                localField: "_id",
                foreignField: "nftID",
                as: "OrderData",
              },
            },
            { $match: searchObj2 },
            {
              $project: {
                _id: 1,
                "OrderData.salesType": 1,
                hasOrder: {
                  $cond: { if: { $isArray: "$OrderData" }, then: { $size: "$OrderData" }, else: "NA" }
                },
              },
            },
          ]).exec(function (e, nftData) {
            console.log("nftData", nftData)
            let onMarketPLace = nftData?.length ? nftData.length : 0;
            console.log("onMarketPLace", onMarketPLace)
            if (onMarketPLace === 0) {
              return res.reply(messages.successfully("Data"), results);
            } else {
              if (nftData[0]?.OrderData[0]?.salesType == 0) {
                results.push("Buy Now");
              } else {
                if (hasBid === 0) {
                  results.push("Place a Bid");
                } else {
                  results.push("Update Bid");
                }
              }
              return res.reply(messages.successfully("Data"), results);
            }
          });
        }
      } else {
        results.push("Make Offer");
        let searchArray2 = [];
        searchArray2["_id"] = mongoose.Types.ObjectId(nftID);
        searchArray2["OrderData.0"] = { $exists: true }
        let searchObj2 = Object.assign({}, searchArray2);
        await NFT.aggregate([
          {
            $lookup: {
              from: "orders",
              localField: "_id",
              foreignField: "nftID",
              as: "OrderData",
            },
          },
          { $match: searchObj2 },
          {
            $project: {
              _id: 1,
              "OrderData.salesType": 1,
              hasOrder: {
                $cond: { if: { $isArray: "$OrderData" }, then: { $size: "$OrderData" }, else: "NA" }
              },
            },
          },
        ]).exec(function (e, nftData) {
          let onMarketPLace = nftData?.length ? nftData.length : 0;
          console.log("onMarketPLace", onMarketPLace)
          if (onMarketPLace === 0) {
            return res.reply(messages.successfully("Datafgdh"), results);
          } else {
            if (nftData[0]?.OrderData[0]?.salesType == 0) {
              results.push("Buy Now");
            } else {
              if (hasBid === 0) {
                results.push("Place a Bid");
              } else {
                results.push("Update Bid");
              }
            }
            return res.reply(messages.successfully("Data"), results);
          }
        });
      }

    } catch (error) {
      console.log("Error " + error);
      return res.reply(messages.server_error());
    }
  }

  async refreshMetaData(req, res) {
    try {
      let nftID = req.body.nftID;
      NFT.find({ _id: mongoose.Types.ObjectId(nftID) }, async function (err, nftData) {
        if (err) {
          return res.reply(messages.server_error("NFT"));
        } else {

          if (nftData.length == 0) {
            return res.reply(messages.not_found("NFT"));
          } else {
            let ContractType = "ERC1155";
            let ContractABI = erc1155Abi ? erc1155Abi.abi : "";
            if (nftData[0]?.type === 1) {
              ContractType = "ERC721";
              ContractABI = erc721Abi ? erc721Abi.abi : "";
            }
            console.log("Contract is", ContractType)
            let contract = new web3.eth.Contract(ContractABI, nftData[0].collectionAddress);
            let tokenID = parseInt(nftData[0].tokenID);
            if (nftData[0].isMinted === 0) {
              console.log("Created on Plateform");
              let tokenURI = await contract.methods.tokenURI(tokenID).call();
              try {
                https.get(tokenURI, (resData) => {
                  let body = "";
                  resData.on("data", (chunk) => {
                    body += chunk;
                  });
                  resData.on("end", async () => {
                    try {
                      let newJSON = JSON.parse(body);
                      let updateNFTData = {
                        name: newJSON.name,
                        description: newJSON.description,
                        image: newJSON.image,
                        updatedOn: Date.now()
                      }
                      await NFT.findOneAndUpdate(
                        { _id: mongoose.Types.ObjectId(nftID) },
                        { $set: updateNFTData }, { new: true }, function (err, updateNFT) {
                          if (err) {
                            console.log("Error in Updating NFT" + err);
                            return res.reply(messages.error());
                          } else {
                            console.log("NFT MetaData Updated: ", updateNFT);
                            return res.reply(messages.created("NFT Updated"), updateNFT);
                          }
                        }
                      );
                    } catch (error) {
                      console.log("Error ", error);
                      return res.reply(messages.server_error());
                    };
                  });
                }).on("error", (error) => {
                  console.log("Error ", error);
                  return res.reply(messages.server_error());
                });
              } catch (error) {
                console.log("Error ", error);
                return res.reply(messages.server_error());
              }
            } else {
              console.log("Imported on Plateform");
              let tokenURI = nftMetaBaseURL + "tokenDetailsExtended?ChainId=" + chainID + "&ContractAddress=" + nftData[0].collectionAddress + "&TokenId=" + tokenID;
              try {
                http.get(tokenURI, (resData) => {
                  let body = "";
                  resData.on("data", (chunk) => {
                    body += chunk;
                  });
                  resData.on("end", async () => {
                    try {
                      let newJSON = JSON.parse(body);
                      let lastUpdated = newJSON[0].MetadataLastUpdated;
                      var d = new Date(0);
                      let lastUpdateMetaDB = d.setUTCSeconds(lastUpdated);
                      var d1 = new Date(lastUpdateMetaDB);
                      var d2 = new Date(nftData[0].lastUpdatedOn);
                      if (d1.getTime() === d2.getTime()) {
                        return res.reply(messages.already_updated("NFT"));
                      } else {
                        let updateNFTData = {
                          name: newJSON[0].name,
                          description: newJSON[0].description,
                          previewImg: newJSON[0].S3Images.S3Thumb,
                          lastUpdatedOn: lastUpdateMetaDB
                        }
                        if (newJSON[0].S3Images.S3Animation === "" || newJSON[0].S3Images.S3Animation === null) {
                          updateNFTData.image = newJSON[0].S3Images.S3Image;
                        } else {
                          updateNFTData.image = newJSON[0].S3Images.S3Animation;
                        }
                        await NFT.findOneAndUpdate(
                          { _id: mongoose.Types.ObjectId(nftID) },
                          { $set: updateNFTData }, { new: true }, function (err, updateNFT) {
                            if (err) {
                              console.log("Error in Updating NFT" + err);
                              return res.reply(messages.error());
                            } else {
                              console.log("NFT MetaData Updated: ", updateNFT);
                              return res.reply(messages.created("NFT Updated"), updateNFT);
                            }
                          }
                        );
                      }
                    } catch (error) {
                      console.log("Error ", error);
                      return res.reply(messages.server_error());
                    };
                  });
                }).on("error", (error) => {
                  console.log("Error ", error);
                  return res.reply(messages.server_error());
                });
              } catch (error) {
                console.log("Error ", error);
                return res.reply(messages.server_error());
              }
            }
          }
        }
      });
    } catch (error) {
      console.log("Error " + error);
      return res.reply(messages.server_error());
    }
  }

  async updateOwner(req, res) {
    try {
      let collectionAddress = req.body.collectionAddress;
      let tokenID = req.body.tokenID;
      NFT.find({ collectionAddress: collectionAddress, tokenID: tokenID }, async function (err, nftData) {
        if (err) {
          return res.reply(messages.server_error("NFT"));
        } else {
          if (nftData.length == 0) {
            return res.reply(messages.not_found("NFT"));
          } else {
            let ContractType = "ERC1155";
            let ContractABI = erc1155Abi ? erc1155Abi.abi : "";
            if (nftData[0]?.type === 1) {
              ContractType = "ERC721";
              ContractABI = erc721Abi ? erc721Abi.abi : "";
            }
            let contract = new web3.eth.Contract(ContractABI, nftData[0].collectionAddress);
            let tokenID = parseInt(nftData[0].tokenID);
            try{
              // if (nftData[0]?.type === 1) {
                let ownerAddress = await contract.methods.ownerOf(tokenID).call();
                console.log("Owner is ", ownerAddress);
                let OwnedBy = [];
                let updateNFTData = { ownedBy: OwnedBy }
                await NFT.findOneAndUpdate(
                  { _id: mongoose.Types.ObjectId(nftData[0]._id) },
                  { $set: updateNFTData }, { new: true }, async function (err, updateNFT) {
                    if (err) {
                      console.log("Error in Updating NFT" + err);
                      return res.reply(messages.error());
                    } else {
                      OwnedBy.push({
                        address: ownerAddress,
                        quantity: 1,
                      });
                      updateNFTData = { ownedBy: OwnedBy }
                      await NFT.findOneAndUpdate(
                        { _id: mongoose.Types.ObjectId(nftData[0]._id) },
                        { $set: updateNFTData }, { new: true }, async function (err, updateNFT) {
                          if (err) {
                            console.log("Error in Updating NFT" + err);
                            return res.reply(messages.error());
                          } else {
                            let $request = [];
                            $request["RequestType"] = "";
                            $request["ContractAddress"] = nftData[0].collectionAddress;
                            $request["InternalName"] = "";
                            $request["TokenIds"] = [tokenID]
                            let payload = Object.assign({}, $request);
                            try {
                              let response = await axios.post(postAPIURL + 'refreshOwner/', payload);
                            } catch (error) {
                              console.log("Error ", error);
                            }
                            console.log("NFT MetaData Updated: ", updateNFT);
                            return res.reply(messages.created("NFT Owner Updated"), updateNFT);
                          }
                        }
                      );
                    }
                  }
                );
              // }
            }catch(error){
              console.log("Error is ", error)
            }
          }
        }
      });

    } catch (error) {
      return res.reply(messages.server_error());
    }
  }
}

module.exports = NFTController;