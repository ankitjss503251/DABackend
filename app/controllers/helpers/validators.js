const EthJSUtil = require('ethereumjs-util');
const Web3 = require('web3');
let _web3 = new Web3();

const { NFT , Collection } = require("../../models");
const mongoose = require("mongoose");

const validators = {};

validators.isValidObjectID = function (sObjectID) {
    return sObjectID.length == 24;
}

validators.isValidUserStatus = function (sUserStatus) {
    const aUserStatuses = ["active", "blocked", "deactivated"];
    return aUserStatuses.includes(sUserStatus);
}

validators.isValidCategoryStatus = function (sUserStatus) {
    const aCategoryStatuses = ["Active", "Deactivated"];
    return aCategoryStatuses.includes(sUserStatus);
}

validators.isValidName = function (sName) {
    const reName = /^[a-zA-Z](( )?[a-zA-Z]+)*$/;
    return reName.test(sName);
}

validators.isValidWalletAddress = function (walletAddress) {
    return _web3.utils.isAddress(walletAddress);
}

validators.isValidSignature = function (signData) {
    try {
        const msgH = `\x19Ethereum Signed Message:\n${signData.message.length}${signData.message}`; // adding prefix
        var addrHex = signData.walletAddress;
        addrHex = addrHex.replace("0x", "").toLowerCase();
        var msgSha = EthJSUtil.keccak256(Buffer.from(msgH));
        var sigDecoded = EthJSUtil.fromRpcSig(signData.signature);
        var recoveredPub = EthJSUtil.ecrecover(msgSha, sigDecoded.v, sigDecoded.r, sigDecoded.s);
        var recoveredAddress = EthJSUtil.pubToAddress(recoveredPub).toString("hex");
        return (addrHex === recoveredAddress);
    } catch (e) {
        return false;
    }
}

validators.isValidTransactionHash = function (sTransactionHash) {
    return /^0x([A-Fa-f0-9]{64})$/.test(sTransactionHash);
}
validators.isValidString = function (sString) {
    return sString.trim().length > 0 && sString.trim().length <= 100;
}

validators.isValidSellingType = (sSellingType) => {
    const aSellingTypes = ['Auction', 'Fixed Sale', 'Unlockable'];
    return aSellingTypes.includes(sSellingType);
}

validators.isBlockedNFT = async function (nftID, callback) {

    return new Promise((resv, rej) => {
        NFT.findOne({ _id: mongoose.Types.ObjectId(nftID) }, (err, nftData) => {
            if(err) {
                rej(-1);
                return;
            }else{
                if (!nftData){
                    rej(-2);
                    return;
                }
                if(nftData.status == 0){
                    rej(0);
                }else{
                    Collection.findOne({ _id: mongoose.Types.ObjectId(nftData.collectionID) }, (errColl, resColl) => {
                        if(errColl) {
                            rej(-1);
                            return;
                        }else{
                            if (!resColl){
                                rej(-2);
                                return;
                            }
                            if(resColl.status == 0){
                                rej(0);
                            }else{
                                resv(1);
                            }
                        }
                    });
                }
            }
        });
    });
    return 1;
}
module.exports = validators;