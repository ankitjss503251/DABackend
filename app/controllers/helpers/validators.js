const EthJSUtil = require('ethereumjs-util');
const Web3 = require('web3');
let _web3 = new Web3();

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

validators.isValidWalletAddress = function (sWalletAddress) {
    return _web3.utils.isAddress(sWalletAddress);
}

validators.isValidSignature = function (oSigData) {
    try {
        const msgH = `\x19Ethereum Signed Message:\n${oSigData.sMessage.length}${oSigData.sMessage}`; // adding prefix
        var addrHex = oSigData.sWalletAddress;
        addrHex = addrHex.replace("0x", "").toLowerCase();
        var msgSha = EthJSUtil.keccak256(Buffer.from(msgH));
        var sigDecoded = EthJSUtil.fromRpcSig(oSigData.sSignature);
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

module.exports = validators;