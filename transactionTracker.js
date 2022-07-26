const Web3=require("web3");
const mongoose=require('mongoose');
const config = require("dotenv").config();
const { NFT, Collection, User, Bid, Order, Brand, Category } = require("./app/models");

// TODO: Change the URL to MainNet URL
var web3=new Web3(process.env.NETWORK_RPC_URL);
const ABI=require("./abis/marketplace.json")
// const extendedERC721=require("./frontend/src/environments/Config/abis/extendedERC721.json")
// const extendedERC1155=require("./frontend/src/environments/Config/abis/extendedERC1155.json")
const CONTRACT_ADDRESS='0x8026FEB064ef99d431CDC37a273fb7fADeC30D12';

const BlockchainConnect=require('./blockchainconnect');
const chain=new BlockchainConnect();
const contract=chain.Contract(ABI,CONTRACT_ADDRESS);
// console.log("contract",contract)

const options={
  useUnifiedTopology: true,
  useNewUrlParser: true,
  useCreateIndex: true,
  useFindAndModify: false,
};

mongoose.connect(process.env.DB_URL,options)
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
            resData.forEach(data => {
              console.log(data);
              console.log("Hash", data.hash);
            });
            
          }
        }
    })
  } catch(error) {
    console.log(error);
  }
}

setInterval(() => {
  checkCollection();
},5000);
