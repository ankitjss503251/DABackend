const Web3 = require("web3");
const mongoose = require('mongoose');
const LogsDecoder = require('logs-decoder');
const logsDecoder = LogsDecoder.create()
const config = require("dotenv").config();
const { NFT, Collection, User, Bid, Order, Brand, Category } = require("./app/models");

// TODO: Change the URL to MainNet URL
var web3 = new Web3(process.env.NETWORK_RPC_URL);
const ABI = require("./abis/marketplace.json")
logsDecoder.addABI(ABI);
// const extendedERC721=require("./frontend/src/environments/Config/abis/extendedERC721.json")
// const extendedERC1155=require("./frontend/src/environments/Config/abis/extendedERC1155.json")
const CONTRACT_ADDRESS = '0x8026FEB064ef99d431CDC37a273fb7fADeC30D12';

const BlockchainConnect = require('./blockchainconnect');
const chain = new BlockchainConnect();
const contract = chain.Contract(ABI, CONTRACT_ADDRESS);
console.log("contract", contract)

const options = {
  useUnifiedTopology: true,
  useNewUrlParser: true,
  useCreateIndex: true,
  useFindAndModify: false,
};

mongoose.connect(process.env.DB_URL, options)
  .then(() => console.log('Database conncted'))
  .catch((error) => {
    throw error;
  });

async function checkCollection() {
  try {
    console.log("Checking for Collection Hash...");
    Collection.find({ hashStatus: 0 },
      async function (err, resData) {
        if (err) {
        } else {
          if (resData.length > 0) {
            for (const data of resData) {
              console.log("Hash", data.hash);
              let receipt = await web3.eth.getTransactionReceipt(data.hash);
              console.log("receipt is---->", receipt)
              if (receipt === null) {
                return;
              }
              if (receipt.status === true) {
                let contractAddress = receipt.logs[0].address;
                let updateData = { hashStatus: 1, contractAddress: contractAddress };
                await Collection.findByIdAndUpdate(
                  data._id,
                  updateData,
                  (err, resData) => {
                    if (resData) {
                      console.log("Updated record", data._id)
                    }
                  }
                ).catch((e) => {
                  return;
                });
              }
            }
          }
        }
      })
  } catch (error) {
    console.log(error);
  }
}

async function checkNFTs() {
  try {
    console.log("Checking for NFT Hash...");
    NFT.find({ hashStatus: 0 },
      async function (err, resData) {
        if (err) {
        } else {
          if (resData.length > 0) {
            for (const data of resData) {
              // console.log("Hash", data.hash);
              let receipt = await web3.eth.getTransactionReceipt(data.hash);
              // console.log("receipt is---->",receipt)
              if (receipt === null) {
                return;
              }
              if (receipt.status === true) {
                let updateData = { hashStatus: 1 };
                await NFT.findByIdAndUpdate(
                  data._id,
                  updateData,
                  (err, resData) => {
                    if (resData) {
                      console.log("Updated record", data._id)
                    }
                  }
                ).catch((e) => {
                  return;
                });
              }
            }
          }
        }
      })
  } catch (error) {
    console.log(error);
  }
}

async function checkOrders() {
  try {
    console.log("Checking for Order Hash...");
    Order.find({ hashStatus: 0 },
      async function (err, resData) {
        if (err) {
        } else {
          if (resData.length > 0) {
            for (const data of resData) {
              console.log("Hash", data.hash);

              web3.eth.getTransactionReceipt(data.hash, async function (e, receipt) {
                if (receipt === null) {
                  console.log("Rec Null")
                  return;
                }
                if (receipt.status === true) {
                  const decodedLogs = logsDecoder.decodeLogs(receipt.logs);
                  // console.log("result is---->",decodedLogs[7].events);
                  let saleData = decodedLogs[7].events;

                  let orderID = data._id;
                  let nftID = data.nftID;
                  let buyer = "";
                  let seller = "";
                  let tokenAddress = "";
                  let tokenId = "";
                  let amount = "";
                  let quantity = "";

                  for (const sales of saleData) {
                    if (sales.name === "buyer") {
                      buyer = sales.value;
                    }
                    if (sales.name === "seller") {
                      seller = sales.value;
                    }
                    if (sales.name === "tokenAddress") {
                      tokenAddress = sales.value;
                    }
                    if (sales.name === "tokenId") {
                      tokenId = sales.value;
                    }
                    if (sales.name === "amount") {
                      amount = sales.value;
                    }
                    if (sales.name === "quantity") {
                      quantity = sales.value;
                    }
                  }

                  console.log("Order", seller + " " + buyer)


                  Order.findById(orderID, async (err, orderData) => {
                    if (err) {
                      return;
                    }
                    if (!orderData) {
                      return;
                    } else {
                      await Order.updateOne(
                        { _id: orderID },
                        { $set: { quantity_sold: quantity } },
                        (err) => {
                          return;
                        }
                      );
                      let NFTData = await NFT.find({
                        _id: mongoose.Types.ObjectId(nftID),
                        "ownedBy.address": seller.toLowerCase(),
                      }).select("ownedBy -_id");
                      console.log("NFTData-------->", NFTData);
                      let currentQty;
                      if (NFTData.length > 0) {
                        currentQty = NFTData[0].ownedBy.find(
                          (o) => o.address === seller.toLowerCase()
                        ).quantity;
                      }
                      let boughtQty = parseInt(quantity);
                      let leftQty = currentQty - boughtQty;
                      console.log("leftQty", leftQty);
                      if (leftQty < 1) {
                        console.log("leftQty is less than 1");
                        await NFT.findOneAndUpdate(
                          { _id: mongoose.Types.ObjectId(nftID) },
                          {
                            $pull: {
                              ownedBy: { address: seller },
                            },
                          }
                        ).catch((e) => {
                          return;
                        });
                      } else {
                        console.log("leftQty is greater than 1");
                        await NFT.findOneAndUpdate(
                          {
                            _id: mongoose.Types.ObjectId(nftID),
                            "ownedBy.address": seller,
                          },
                          {
                            $set: {
                              "ownedBy.$.quantity": parseInt(leftQty),
                            },
                          }
                        ).catch((e) => {
                          return;
                        });
                      }
                      console.log("Crediting Buyer");
                      let subDocId = await NFT.exists({
                        _id: mongoose.Types.ObjectId(nftID),
                        "ownedBy.address": buyer,
                      });
                      if (subDocId) {
                        let NFTData_Buyer = await NFT.findOne({
                          _id: mongoose.Types.ObjectId(nftID),
                          "ownedBy.address": buyer,
                        }).select("ownedBy -_id");
                        console.log("NFTData_Buyer-------->", NFTData_Buyer);
                        console.log(
                          "Quantity found for buyers",
                          NFTData_Buyer.ownedBy.find(
                            (o) => o.address === buyer.toLowerCase()
                          ).quantity
                        );
                        currentQty = NFTData_Buyer.ownedBy.find(
                          (o) => o.address === buyer.toLowerCase()
                        ).quantity
                          ? parseInt(
                            NFTData_Buyer.ownedBy.find(
                              (o) => o.address === buyer.toLowerCase()
                            ).quantity
                          )
                          : 0;
                        boughtQty = quantity;
                        let ownedQty = parseInt(currentQty) + parseInt(boughtQty);
                        console.log("777");
                        console.log("ownedQty", ownedQty);
                        console.log("buyer", buyer);
                        await NFT.findOneAndUpdate(
                          {
                            _id: mongoose.Types.ObjectId(nftID),
                            "ownedBy.address": buyer,
                          },
                          {
                            $set: {
                              "ownedBy.$.quantity": parseInt(ownedQty),
                            },
                          },
                          { upsert: true, runValidators: true }
                        ).catch((e) => {
                          console.log("Error1", e.message);
                        });
                      } else {
                        console.log("Subdocument Id not found");
                        let dataToadd = {
                          address: buyer,
                          quantity: parseInt(quantity),
                        };
                        await NFT.findOneAndUpdate(
                          { _id: mongoose.Types.ObjectId(nftID) },
                          { $addToSet: { ownedBy: dataToadd } },

                          { upsert: true }
                        );
                        console.log("wasn't there but added");
                      }
                      await NFT.findOneAndUpdate(
                        { _id: mongoose.Types.ObjectId(nftID) },
                        {
                          $set: {
                            quantity_minted: Number(quantity),
                          },
                        }
                      ).catch((e) => {
                        return;
                      });
                      let updateData = { hashStatus: 1 };
                      await Order.findByIdAndUpdate(
                        data._id,
                        updateData,
                        (err, resData) => {
                          if (resData) {
                            console.log("Updated record", data._id)
                          }
                        }
                      ).catch((e) => {
                        return;
                      });
                    }
                  });
                }
              });

            }
          }
        }
      })
  } catch (error) {
    console.log(error);
  }
}

setInterval(() => {
  checkCollection();
  checkNFTs();
  checkOrders();
}, 10000);
