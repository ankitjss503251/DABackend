const Web3 = require("web3");
const mongoose = require('mongoose');
const LogsDecoder = require('logs-decoder');
const http = require("http");
const https = require("https");
const logsDecoder = LogsDecoder.create()
const config = require("dotenv").config();
const { NFT, Collection, User, Bid, Order, History } = require("./app/models");
// TODO: Change the URL to MainNet URL
var web3 = new Web3(process.env.NETWORK_RPC_URL);
const ABI = require("./abis/marketplace.json")
logsDecoder.addABI(ABI);
const CONTRACT_ADDRESS = '0x8026FEB064ef99d431CDC37a273fb7fADeC30D12';
const BlockchainConnect = require('./blockchainconnect');
const chain = new BlockchainConnect();
const contract = chain.Contract(ABI, CONTRACT_ADDRESS);

const nftMetaBaseURL = process.env.NFT_META_BASE_URL;
const chainID = process.env.CHAIN_ID;

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
              if (data.hash !== undefined && data.hash !== "0x0") {
                console.log("Collection Hash is", data.hash)
                let receipt = await web3.eth.getTransactionReceipt(data.hash);
                console.log("receipt is---->", receipt)
                if (receipt === null) {
                  return;
                } else if (receipt.status === false) {
                  let updateData = { hashStatus: 2 };
                  await Collection.findByIdAndUpdate(
                    data._id,
                    updateData,
                    (err, resData) => {
                      if (resData) {
                        console.log("Updated Collection record", data._id)
                      }
                    }
                  ).catch((e) => {
                    return;
                  });
                } else if (receipt.status === true) {
                  let contractAddress = receipt.logs[0].address;
                  let updateData = { hashStatus: 1, contractAddress: contractAddress };
                  await Collection.findByIdAndUpdate(
                    data._id,
                    updateData,
                    (err, resData) => {
                      if (resData) {
                        console.log("Updated Collection record", data._id)
                      }
                    }
                  ).catch((e) => {
                    return;
                  });
                }
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
              if (data.hash !== undefined && data.hash !== "0x0") {
                console.log("NFT Hash is", data.hash)
                let receipt = await web3.eth.getTransactionReceipt(data.hash);
                if (receipt === null) {
                  return;
                } else if (receipt.status === false) {
                  let updateData = { hashStatus: 2 };
                  await NFT.findByIdAndUpdate(
                    data._id,
                    updateData,
                    (err, resData) => {
                      if (resData) {
                        console.log("Updated NFT record", data._id)
                      }
                    }
                  ).catch((e) => {
                    return;
                  });
                } else if (receipt.status === true) {
                  let updateData = { hashStatus: 1 };
                  await NFT.findByIdAndUpdate(
                    data._id,
                    updateData,
                    (err, resData) => {
                      if (resData) {
                        console.log("Updated NFT record", data._id)
                      }
                    }
                  ).catch((e) => {
                    return;
                  });
                }
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
    // console.log("Checking for Order Hash...");
    let currentTime = new Date().getTime();
    let minutes = 2 * 60 * 1000;
    let newDateTime = new Date(currentTime + minutes);
    Order.find({ hashStatus: 0 },
      async function (err, resData) {
        if (err) {
        } else {
          if (resData.length > 0) {
            for (const data of resData) {
              if (data.hash !== undefined && data.hash !== "0x0" && data.hash !== "" && data.hash?.length >= 66) {
                console.log("Order Hash", data.hash);
                web3.eth.getTransactionReceipt(data.hash, async function (e, receipt) {
                  if (receipt === null) {
                    console.log("Rec Null")
                    return;
                  } else if (receipt.status === false) {
                    console.log("Inside false");
                    let updateData = { hashStatus: 2 };
                    await Order.findByIdAndUpdate(
                      data._id,
                      updateData,
                      (err, resData) => {
                        if (resData) {
                          console.log("Updated Order record", data._id)
                        }
                      }
                    ).catch((e) => {
                      return;
                    });
                  } else if (receipt.status === true) {
                    console.log("Inside True");
                    const decodedLogs = logsDecoder.decodeLogs(receipt.logs);

                    let saleData = "";
                    if (data.salesType === 1) {
                      saleData = decodedLogs[11].events;
                    } else {
                      saleData = decodedLogs[7].events
                    }


                    let orderID = data._id;
                    let nftID = data.nftID;
                    let buyer = "";
                    let seller = "";
                    let tokenAddress = "";
                    let tokenId = "";
                    let amount = "";
                    let bidsamount = "";
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
                        bidsamount = sales.value;
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
                        console.log("quantity", quantity)
                        await Order.updateOne(
                          { _id: orderID },
                          { $set: { quantity_sold: parseInt(quantity) } },
                          (err) => {
                            return;
                          }
                        );
                        let NFTData = await NFT.find({
                          _id: mongoose.Types.ObjectId(nftID),
                          "ownedBy.address": seller.toLowerCase(),
                        }).select("ownedBy -_id");
                        // console.log("NFTData-------->", NFTData);
                        let currentQty;
                        if (NFTData.length > 0) {
                          currentQty = NFTData[0].ownedBy.find(
                            (o) => o.address === seller.toLowerCase()
                          ).quantity;
                        }
                        let boughtQty = parseInt(quantity);
                        console.log("boughtQty", boughtQty)
                        let leftQty = parseInt(currentQty) - parseInt(boughtQty);
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

                      }
                    });

                    if (data.salesType === 1) {
                      let sellerID = "";
                      let buyerID = "";
                      User.findOne(
                        {
                          walletAddress: _.toChecksumAddress(seller)?.toLowerCase(),
                        },
                        (err, user) => {
                          if (err) {
                            return;
                          }
                          if (!user) {
                            return;
                          }
                          sellerID = user._id;
                          User.findOne(
                            {
                              walletAddress: _.toChecksumAddress(buyer)?.toLowerCase(),
                            },
                            (err, user2) => {
                              if (err) {
                                return;
                              }
                              if (!user2) {
                                return;
                              }
                              buyerID = user2._id;
                              Bid.findOneAndUpdate(
                                {
                                  orderID: mongoose.Types.ObjectId(orderID),
                                  nftID: mongoose.Types.ObjectId(nftID),
                                  owner: mongoose.Types.ObjectId(sellerID),
                                  bidderID: mongoose.Types.ObjectId(buyerID),
                                },
                                { bidStatus: "Accepted" },
                                function (err, acceptBid) {
                                  if (err) {
                                    return;
                                  } else {
                                    console.log("Bid Accepted ");
                                    return;
                                  }
                                });
                              Bid.deleteMany({
                                orderID: mongoose.Types.ObjectId(orderID),
                                nftID: mongoose.Types.ObjectId(nftID),
                                owner: mongoose.Types.ObjectId(sellerID),
                                bidStatus: "Bid",
                              }).then(function () {
                                console.log("Bid Data deleted");
                              }).catch(function (error) {
                                console.log(error);
                              });
                            }
                          );
                        }
                      );
                    }

                    let updateData = { hashStatus: 1 };
                    console.log("start")
                    await Order.findByIdAndUpdate(
                      orderID,
                      updateData,
                      async (err, resData) => {
                        console.log("resData", resData)
                        if (resData) {
                          console.log("Updated Order record", orderID)
                          await User.findOne({ walletAddress: _.toChecksumAddress(buyer) },
                            (err, user) => {
                              if (err) {
                                return;
                              }
                              if (!user) {
                                return;
                              }
                              let buyerID = user._id;
                              let sellerID = data.sellerID;
                              let action = "";
                              let price = "";
                              let type = "";
                              if (data.salesType === 1) {
                                action = "Bid";
                                price = bidsamount;
                                type = "Accepted";
                              } else {
                                action = "Sold";
                                price = data.price;
                              }
                              console.log("after user.findone")
                              let paymentToken = data.paymentToken;
                              let createdBy = "";
                              if (data.salesType === 1) {
                                createdBy = user._id;
                              } else {
                                createdBy = data.sellerID;
                              }

                              console.log("before new history")
                              const insertData = new History({
                                nftID: nftID,
                                buyerID: buyerID,
                                sellerID: sellerID,
                                action: action,
                                type: type,
                                paymentToken: paymentToken,
                                price: price,
                                quantity: quantity,
                                createdBy: createdBy
                              });
                              console.log("after new history")
                              insertData.save().then(async (result) => {
                                console.log("Record Added in adding History....");
                              }).catch((error) => {
                                console.log("Error in adding History...", error);
                              });
                            });
                        }
                      }
                    ).catch((e) => {
                      return;
                    });
                    await Order.deleteMany({ _id: mongoose.Types.ObjectId(orderID) }).then(function () {
                      console.log("Order Data Deleted Cronjon");
                    }).catch(function (error) {
                      console.log("Error in Order Data Deleted Cronjon", error);
                    });
                    await Bid.deleteMany({ orderID: mongoose.Types.ObjectId(orderID), bidStatus: "Bid", }).then(function () {
                      console.log("Order Bid Deleted Cronjon");
                    }).catch(function (error) {
                      console.log("Error in Bid Data Deleted Cronjon", error);
                    });
                    await Bid.deleteMany({ nftID: mongoose.Types.ObjectId(nftID), bidStatus: "MakeOffer" }).then(function () {
                      console.log("Bid Offer Data Deleted Cronjon");
                    }).catch(function (error) {
                      console.log("Error in Bid Offer Data Deleted Cronjon", error);
                    });
                  }
                })
              }
            }
          }
        }
      })
    console.log("updated through cron")
  } catch (error) {
    console.log("Error is", error);
  }
}

async function checkOffers() {
  try {
    console.log("Checking for Offer Hash...");
    let currentTime = new Date().getTime();
    let minutes = 2 * 60 * 1000;
    let newDateTime = new Date(currentTime + minutes);
    Bid.find({ hashStatus: 0, bidStatus: "MakeOffer" },
      async function (err, resData) {
        if (err) {
        } else {
          if (resData.length > 0) {
            for (const data of resData) {
              if (data.hash !== undefined && data.hash !== "0x0" && data.hashStatus !== 1) {
                console.log("Offer Hash", data.hash);

                web3.eth.getTransactionReceipt(data.hash, async function (e, receipt) {
                  if (receipt === null) {
                    console.log("Rec Null")
                    return;
                  } else if (receipt.status === false) {
                    let updateData = { hashStatus: 2 };
                    await Bid.findByIdAndUpdate(
                      data._id,
                      updateData,
                      (err, resData) => {
                        if (resData) {
                          console.log("Updated Bid record", data._id)
                        }
                      }
                    ).catch((e) => {
                      return;
                    });
                  } else if (receipt.status === true) {
                    const decodedLogs = logsDecoder.decodeLogs(receipt.logs);
                    let saleData = decodedLogs[11].events;

                    let bidID = data._id;
                    let nftID = data.nftID;
                    let owner = data.owner;
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
                    let boughtQty = parseInt(quantity);
                    console.log("boughtQty", boughtQty)
                    console.log("seller", seller, " buyer ", buyer, " NFT ", nftID);
                    //deduct previous owner
                    let _NFT = await NFT.find({
                      _id: mongoose.Types.ObjectId(nftID),
                      "ownedBy.address": seller,
                    }).select("ownedBy -_id");
                    console.log("_NFT-------->", _NFT);
                    let currentQty;
                    if (_NFT.length > 0)
                      currentQty = _NFT[0].ownedBy.find(
                        (o) => o.address === seller.toLowerCase()
                      ).quantity;
                    console.log("currentQty", currentQty)

                    let leftQty = parseInt(currentQty) - parseInt(boughtQty);
                    console.log("leftQty", leftQty)
                    if (leftQty < 1) {
                      await NFT.findOneAndUpdate(
                        { _id: mongoose.Types.ObjectId(nftID) },
                        {
                          $pull: {
                            ownedBy: { address: seller },
                          },
                        }
                      ).catch((e) => {
                        console.log("Error1", e.message);
                      });
                    } else {
                      console.log("leftQty", leftQty)
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
                        console.log("Error2", e.message);
                      });
                    }
                    //Credit the buyer
                    console.log("Crediting Buyer");
                    let subDocId = await NFT.exists({
                      _id: mongoose.Types.ObjectId(nftID),
                      "ownedBy.address": buyer,
                    });
                    if (subDocId) {
                      console.log("Subdocument Id", subDocId);
                      let NFTNewData = await NFT.findOne({
                        _id: mongoose.Types.ObjectId(nftID),
                        "ownedBy.address": buyer,
                      }).select("ownedBy -_id");
                      console.log("NFTNewData-------->", NFTNewData);
                      console.log(
                        "Quantity found for buyers",
                        NFTNewData.ownedBy.find((o) => o.address === buyer.toLowerCase())
                          .quantity
                      );

                      currentQty = NFTNewData.ownedBy.find(
                        (o) => o.address === buyer.toLowerCase()
                      ).quantity
                        ? parseInt(
                          NFTNewData.ownedBy.find(
                            (o) => o.address === buyer.toLowerCase()
                          ).quantity
                        )
                        : 0;

                      let ownedQty = parseInt(currentQty) + parseInt(boughtQty);
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
                        quantity: parseInt(boughtQty),
                      };
                      await NFT.findOneAndUpdate(
                        { _id: mongoose.Types.ObjectId(nftID) },
                        { $addToSet: { ownedBy: dataToadd } },
                        { upsert: true }
                      );
                      console.log("wasn't there but added");
                    }

                    await Bid.findOneAndUpdate(
                      {
                        _id: mongoose.Types.ObjectId(bidID),
                      },
                      { bidStatus: "Accepted" },
                      function (err, acceptBid) {
                        if (err) {
                          // console.log("Error in Accepting Offer" + err);
                          return res.reply(messages.error());
                        } else {
                          console.log("Offer Accepted : ", acceptBid);
                        }
                      }
                    );

                    await Bid.deleteMany({
                      owner: mongoose.Types.ObjectId(owner),
                      nftID: mongoose.Types.ObjectId(nftID),
                      bidStatus: "Bid",
                    }).then(function () {
                      // console.log("Data deleted");
                    }).catch(function (error) {
                      console.log(error);
                    });

                    await Bid.deleteMany({
                      nftID: mongoose.Types.ObjectId(nftID),
                      bidStatus: "MakeOffer",
                    }).then(function () {
                      // console.log("Makeoffer deleted cronjob 1");
                    }).catch(function (error) {
                      console.log("Error  in Makeoffer deleted cronjob 1", error);
                    });

                    await Order.deleteMany({
                      nftID: mongoose.Types.ObjectId(nftID),
                      sellerID: mongoose.Types.ObjectId(owner)
                    }).then(function () {
                      // console.log("Data deleted");
                    }).catch(function (error) {
                      console.log(error);
                    });
                    let updateData = { hashStatus: 1 };
                    await Bid.findByIdAndUpdate(
                      data._id,
                      updateData,
                      async (err, resData) => {
                        if (resData) {
                          console.log("Updated Bid record", data._id)
                          let buyerID = data.bidderID;
                          let sellerID = data.owner;
                          let action = "Offer";
                          let type = "Accepted";
                          let paymentToken = data.paymentToken;
                          let price = data.bidPrice;
                          let createdBy = data.bidderID;

                          const insertData = new History({
                            nftID: nftID,
                            buyerID: buyerID,
                            sellerID: sellerID,
                            action: action,
                            type: type,
                            paymentToken: paymentToken,
                            price: price,
                            quantity: quantity,
                            createdBy: createdBy
                          });
                          insertData.save().then(async (result) => {
                            console.log("Record Added in adding History");
                          }).catch((error) => {
                            console.log("Error in adding History");
                          });
                        }
                      }
                    ).catch((e) => {
                      console.log("Error 1212", e);
                    });

                  }
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

async function checkCollectionStatus() {
  try {
    console.log("Check Collection Status Import FAST API....");
    Collection.find({ isImported: 1, progressStatus: 0 },
      async function (err, resData) {
        if (err) {
        } else {
          if (resData.length > 0) {
            for (const data of resData) {
              console.log("Category ID", data._id)
              if(data.contractAddress !== "0x"){
                let tokenURI = nftMetaBaseURL + "collections?ChainId=" + chainID + "&ContractAddress=" + data.contractAddress;
                console.log("tokenURI", tokenURI)
                try {
                  http.get(tokenURI, (res) => { 
                    let body = "";
                    res.on("data", (chunk) => {
                      body += chunk;
                    });
                    res.on("end", async () => {
                      try {
                        let newJSON = JSON.parse(body);
                        let apiStatus = newJSON.apiStatus;
                        let updateCollectionData = {
                          apiStatus: apiStatus
                        }
                        if (apiStatus === "available" && data.progressStatus === 0) {
                          updateCollectionData.progressStatus = 1;
                        }
                        await Collection.findOneAndUpdate(
                          { _id: mongoose.Types.ObjectId(data._id) },
                          { updateCollectionData }, function (err, updateCollection) {
                            if (err) {
                              console.log("Error in Updating Collection" + err);
                            } else {
                              console.log("Collection status Updated");
                            }
                          }
                        );
                      } catch (error) {
                        console.log("Error ", error);
                      };
                    });
                  }).on("error", (error) => {
                    console.log("Error ", error);
                  });
                } catch (error) {
                  console.log("Error ", error);
                }
              }
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
  checkOffers();
}, 20000);

setInterval(() => {
  checkCollectionStatus();
}, 10000);

