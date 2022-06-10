const { ethers, upgrades } = require("hardhat");
const { expect } = require('chai');
const { formatEther, parseEther } = require("@ethersproject/units");
const { BigNumber } = require('@ethersproject/bignumber');
const { getImplementationAddress } = require('@openzeppelin/upgrades-core');

const provider = ethers.provider;
let snapshotId, snapshotId_1;

let nftCreator, CreatorV1, marketplace, DecryptMarketplace;
let simpleERC721Deployer, simpleERC1155Deployer, extendedERC721Deployer, extendedERC1155Deployer;
let implementationAddress, implementationNFTCreator1, implementationMarketplace1;
let NFT721, NFT1155, NFT721_e, NFT1155_e, ERC20;
let NFT721_2981, NFT721_noRoyalty, NFT1155_2981;
let signers, owner, addr1, addr2, addr3, addr4, addr5, addr6, addr7, addr8, addr9, Admin, dummy;
let TIME;
const ORDERS = [];
//ABI
let SimpleERC721ABI, SimpleERC1155ABI, ExtendedERC721ABI, ExtendedERC1155ABI;
const privateKey = "0x"+process.env.PRIVATE_KEY;
let signer;

const marketplaceArgs = [
    'Decrypt Marketplace',      //marketplace name
    '1',                        //version
    250,                        //marketplace fee (250 = 2.5%)
    10000,                      //super Admin fee (6000 = 60%)
    "Admin.address",
    9000                        //marketplace royalty limit (9000 = 90%)
];

describe('Initiation', () => {
    it("Snapshot EVM", async function () {
        snapshotId = await provider.send("evm_snapshot");
    });

    it("Defining Generals", async function () {
        [owner, addr1, addr2, addr3, addr4, addr5, addr6, addr7, addr8, addr9, Admin] = await ethers.getSigners();
        signers = [owner, addr1, addr2, addr3, addr4, addr5, addr6, addr7, addr8, addr9];
        signer = new ethers.Wallet(privateKey);
        SimpleERC721ABI = (await ethers.getContractFactory("SimpleERC721")).interface;
        SimpleERC1155ABI = (await ethers.getContractFactory("SimpleERC1155")).interface;
        ExtendedERC721ABI = (await ethers.getContractFactory("ExtendedERC721")).interface;
        ExtendedERC1155ABI = (await ethers.getContractFactory("ExtendedERC1155")).interface;

        marketplaceArgs[4] = Admin.address;
    });

});
describe('Deploying contracts', () => {

    it("Should nftCreator (proxy) contract deploy", async function () {
        CreatorV1 = await ethers.getContractFactory("CreatorV1");
        nftCreator = await upgrades.deployProxy(CreatorV1, { kind: 'uups'});
        await nftCreator.deployed();
    });

    it("Connecting to nftCreator implementation contract", async function () {
        implementationAddress = await getImplementationAddress(ethers.provider, nftCreator.address);

        implementationNFTCreator1 = new ethers.Contract(
            implementationAddress,
            CreatorV1.interface,
            provider
        );
    });

    it("Initialize nftCreator implementation! Important security stage!", async function () {
        await implementationNFTCreator1.connect(owner).initialize();
        //proxy should be already initialized
        await expect(nftCreator.connect(owner).initialize())
            .to.be.revertedWith('Initializable: contract is already initialized');
    });

    it("Deploy marketplace", async function () {
        DecryptMarketplace = await ethers.getContractFactory("DecryptMarketplace");
        marketplace = await upgrades.deployProxy(
            DecryptMarketplace,
            marketplaceArgs,
            { kind: 'uups'}
            );
        await marketplace.deployed();
    });

    it("Connecting to marketplace implementation contract", async function () {
        implementationAddress = await getImplementationAddress(ethers.provider, marketplace.address);

        implementationMarketplace1 = new ethers.Contract(
            implementationAddress,
            DecryptMarketplace.interface,
            provider
        );
    });

    it("Initialize marketplace implementation! Important security stage!", async function () {
        await implementationMarketplace1
            .connect(owner)
            .initialize(...marketplaceArgs);
        //proxy should be already initialized
        await expect(marketplace.connect(owner)
            .initialize(...marketplaceArgs))
            .to.be.revertedWith('Initializable: contract is already initialized');
    });

    it("Deploy Dummy", async function () {
        const Dummy = await ethers.getContractFactory("Dummy");
        dummy = await Dummy.deploy();
        await dummy.deployed();
    });

    it("Deploy ERC20 for payment", async function () {
        const TestERC20 = await ethers.getContractFactory("TestERC20");
        ERC20 = await TestERC20.deploy(parseEther('10000.0'));
        await ERC20.deployed();

        for (let i = 1; i <= 9; i++) {
            await ERC20.transfer(signers[i].address, parseEther('1000.0'));
            expect(formatEther(await ERC20.balanceOf(signers[i].address))).to.equal('1000.0');
        }
    });

});
describe('NFT deployers', () => {

    it("SimpleERC721Deployer", async function () {
        const SimpleERC721Deployer = await ethers.getContractFactory("SimpleERC721Deployer");
        simpleERC721Deployer = await SimpleERC721Deployer.deploy(
            nftCreator.address          //setting creator role
        );
        await simpleERC721Deployer.deployed();
    });

    it("ExtendedERC721Deployer", async function () {
        const ExtendedERC721Deployer = await ethers.getContractFactory("ExtendedERC721Deployer");
        extendedERC721Deployer = await ExtendedERC721Deployer.deploy(
            nftCreator.address          //setting creator role
        );
        await extendedERC721Deployer.deployed();
    });

    it("SimpleERC1155Deployer", async function () {
        const SimpleERC1155Deployer = await ethers.getContractFactory("SimpleERC1155Deployer");
        simpleERC1155Deployer = await SimpleERC1155Deployer.deploy(
            nftCreator.address          //setting creator role
        );
        await simpleERC1155Deployer.deployed();
    });

    it("ExtendedERC1155Deployer", async function () {
        const ExtendedERC1155Deployer = await ethers.getContractFactory("ExtendedERC1155Deployer");
        extendedERC1155Deployer = await ExtendedERC1155Deployer.deploy(
            nftCreator.address          //setting creator role
        );
        await extendedERC1155Deployer.deployed();
    });

    it("Setting deployers", async function () {
        await nftCreator.setMarketplaceAndDeployers(
            marketplace.address,
            simpleERC721Deployer.address,
            extendedERC721Deployer.address,
            simpleERC1155Deployer.address,
            extendedERC1155Deployer.address
        );
    });

});
describe('Preparing ERC721', () => {

    it("Should be able to deploy Simple ERC721", async function () {
        const newNftAddress = await nftCreator.connect(addr1).callStatic.deploySimpleERC721(
            'Name',
            'Symbol',
            'http://uri.net/',
            1000
        );
        await nftCreator.connect(addr1).deploySimpleERC721(
            'Name',
            'Symbol',
            'http://uri.net/',
            1000
        );

        NFT721 = new ethers.Contract(
            newNftAddress,
            SimpleERC721ABI,
            provider
        );

        expect(await NFT721.name()).to.equal('Name');
        expect(await NFT721.symbol()).to.equal('Symbol');
        expect(await NFT721.owner()).to.equal(addr1.address);
        expect(await NFT721.decryptMarketplaceAddress()).to.equal(marketplace.address);
    });

    it("Should mint by owner", async function () {
        for (let i = 1; i <= 5; i++) {
            await NFT721.connect(addr1).mint(addr2.address, i);
            expect(await NFT721.tokenURI(i)).to.equal('http://uri.net/'+i);
            expect(await NFT721.ownerOf(i)).to.equal(addr2.address);
        }
        expect(await NFT721.balanceOf(addr2.address)).to.equal(5);
    });

    it("Should be able to deploy Extended ERC721", async function () {
        const newNftAddress = await nftCreator.connect(addr1).callStatic.deployExtendedERC721(
            'Name',
            'Symbol',
            'http://uri.net/',
            1000,
            '0x0000000000000000000000000000000000000000'
        );
        await nftCreator.connect(addr1).deployExtendedERC721(
            'Name',
            'Symbol',
            'http://uri.net/',
            1000,
            '0x0000000000000000000000000000000000000000'
        );

        NFT721_e = new ethers.Contract(
            newNftAddress,
            ExtendedERC721ABI,
            provider
        );

        expect(await NFT721_e.name()).to.equal('Name');
        expect(await NFT721_e.symbol()).to.equal('Symbol');
        expect(await NFT721_e.preSalePaymentToken()).to.equal('0x0000000000000000000000000000000000000000');
        expect(await NFT721_e.owner()).to.equal(addr1.address);
        expect(await NFT721_e.decryptMarketplaceAddress()).to.equal(marketplace.address);
    });

    it("Should mint by owner", async function () {
        for (let i = 1; i <= 5; i++) {
            await NFT721_e.connect(addr1).mint(addr1.address, i);
            expect(await NFT721_e.tokenURI(i)).to.equal('http://uri.net/'+i);
            expect(await NFT721_e.ownerOf(i)).to.equal(addr1.address);
        }
        expect(await NFT721_e.balanceOf(addr1.address)).to.equal(5);
    });

});
describe('Preparing ERC1155', () => {

    it("Should be able to deploy Simple ERC1155", async function () {
        const newNftAddress = await nftCreator.connect(addr3).callStatic.deploySimpleERC1155(
            'http://uri-1155.net/\{id\}.json',
            1000
        );
        await nftCreator.connect(addr3).deploySimpleERC1155(
            'http://uri-1155.net/\{id\}.json',
            1000
        );

        NFT1155 = new ethers.Contract(
            newNftAddress,
            SimpleERC1155ABI,
            provider
        );

        expect(await NFT1155.uri(1)).to.equal('http://uri-1155.net/\{id\}.json');
        expect(await NFT1155.owner()).to.equal(addr3.address);
        expect(await NFT1155.decryptMarketplaceAddress()).to.equal(marketplace.address);
    });

    it("Should mint by owner", async function () {
        for (let i = 1; i <= 5; i++) {
            await NFT1155.connect(addr3).mint(addr2.address, i, 50);
            expect(await NFT1155.balanceOf(addr2.address, i)).to.equal(50);
        }
    });

    it("Should be able to deploy Extended ERC1155", async function () {
        const newNftAddress = await nftCreator.connect(addr3).callStatic.deployExtendedERC1155(
            'http://uri-1155.net/\{id\}.json',
            1000,
            ERC20.address
        );
        await nftCreator.connect(addr3).deployExtendedERC1155(
            'http://uri-1155.net/\{id\}.json',
            1000,
            ERC20.address
        );

        NFT1155_e = new ethers.Contract(
            newNftAddress,
            ExtendedERC1155ABI,
            provider,
            ERC20.address
        );

        expect(await NFT1155_e.uri(1)).to.equal('http://uri-1155.net/\{id\}.json');
        expect(await NFT1155_e.owner()).to.equal(addr3.address);
        expect(await NFT1155_e.preSalePaymentToken()).to.equal(ERC20.address);
        expect(await NFT1155_e.decryptMarketplaceAddress()).to.equal(marketplace.address);
    });

    it("Should mint by owner", async function () {
        for (let i = 1; i <= 5; i++) {
            await NFT1155_e.connect(addr3).mint(addr3.address, i, 50);
            expect(await NFT1155_e.balanceOf(addr3.address, i)).to.equal(50);
        }
    });

});
describe('Buy Now', () => {

    it("Should be able to buy ERC721. Marketing fee and royalty should be distributed", async function () {
        await NFT721.connect(addr2).setApprovalForAll(marketplace.address, true);

        const sellerBalanceBeforeSale = Number (formatEther(await provider.getBalance(addr2.address)));
        const buyerBalanceBeforeSale = Number (formatEther(await provider.getBalance(addr4.address)));
        const royaltyReceiverBalanceBeforeSale = Number (formatEther(await provider.getBalance(addr1.address)));
        const marketplaceBalanceBeforeSale = Number (formatEther(await provider.getBalance(marketplace.address)));

        const TIME = Math.round(new Date()/1000 + 3600);
        const sellerOrder = [
                addr2.address, NFT721.address,
                1,1,0,
                '0x0000000000000000000000000000000000000000',   //ETH
                parseEther('1.0'),
                TIME,[],[],Math.round(Math.random()*1000)
            ];
        const sellerSig = await getSignature(addr2, ...sellerOrder);

        const buyerOrder = [
                addr4.address, NFT721.address,
                1,1,0,
                '0x0000000000000000000000000000000000000000',   //ETH
                parseEther('1.0'),
                TIME,[],[],Math.round(Math.random()*1000)
            ];

        await marketplace.connect(addr4).completeOrder(
            sellerOrder,
            sellerSig,
            buyerOrder,
            sellerSig,      //buyer signature is unnecessary when buy out
            {value: parseEther('1.5')}
            );

        const sellerBalanceAfterSale = Number (formatEther(await provider.getBalance(addr2.address)));
        const buyerBalanceAfterSale = Number (formatEther(await provider.getBalance(addr4.address)));
        const royaltyReceiverBalanceAfterSale = Number (formatEther(await provider.getBalance(addr1.address)));
        const marketplaceBalanceAfterSale = Number (formatEther(await provider.getBalance(marketplace.address)));

        expect(await NFT721.ownerOf(1)).to.equal(addr4.address);

        expect(sellerBalanceAfterSale - sellerBalanceBeforeSale)
          .to.be.closeTo(0.875, 0.01);

        expect(buyerBalanceBeforeSale - buyerBalanceAfterSale)
          .to.be.closeTo(1, 0.01);

        expect(royaltyReceiverBalanceAfterSale - royaltyReceiverBalanceBeforeSale)
          .to.be.closeTo(0.099, 0.01);

        expect(marketplaceBalanceAfterSale - marketplaceBalanceBeforeSale)
          .to.be.closeTo(0.025, 0.001);
    });

    it("Should not be able to buy ERC721 that was already sold", async function () {
        await NFT721.connect(addr2).setApprovalForAll(marketplace.address, true);

        const TIME = Math.round(new Date()/1000 + 3600);
        const sellerOrder = [
                addr2.address, NFT721.address,
                1,1,0,
                '0x0000000000000000000000000000000000000000',   //ETH
                parseEther('1.0'),
                TIME,[],[],Math.round(Math.random()*1000)
            ];
        const sellerSig = await getSignature(addr2, ...sellerOrder);

        const buyerOrder = [
                addr5.address, NFT721.address,
                1,1,0,
                '0x0000000000000000000000000000000000000000',   //ETH
                parseEther('1.0'),
                TIME,[],[],Math.round(Math.random()*1000)
            ];

        await expect(marketplace.connect(addr5).completeOrder(
            sellerOrder,
            sellerSig,
            buyerOrder,
            sellerSig,      //buyer signature is unnecessary when buy out
            {value: parseEther('1.5')}
            )).to.be.reverted;

    });

    it("Should be able to resell ERC721", async function () {
        await NFT721.connect(addr4).setApprovalForAll(marketplace.address, true);

        const sellerBalanceBeforeSale = Number (formatEther(await provider.getBalance(addr4.address)));
        const buyerBalanceBeforeSale = Number (formatEther(await provider.getBalance(addr5.address)));
        const royaltyReceiverBalanceBeforeSale = Number (formatEther(await provider.getBalance(addr1.address)));
        const marketplaceBalanceBeforeSale = Number (formatEther(await provider.getBalance(marketplace.address)));

        const TIME = Math.round(new Date()/1000 + 3600);
        const sellerOrder = [
            addr4.address, NFT721.address,
            1,1,0,
            '0x0000000000000000000000000000000000000000',   //ETH
            parseEther('1.0'),
            TIME,[],[],Math.round(Math.random()*1000)
        ];
        const sellerSig = await getSignature(addr4, ...sellerOrder);

        const buyerOrder = [
            addr5.address, NFT721.address,
            1,1,0,
            '0x0000000000000000000000000000000000000000',   //ETH
            parseEther('1.0'),
            TIME,[],[],Math.round(Math.random()*1000)
        ];

        await marketplace.connect(addr5).completeOrder(
            sellerOrder,
            sellerSig,
            buyerOrder,
            sellerSig,      //buyer signature is unnecessary when buy out
            {value: parseEther('1.0')}
        );

        const sellerBalanceAfterSale = Number (formatEther(await provider.getBalance(addr4.address)));
        const buyerBalanceAfterSale = Number (formatEther(await provider.getBalance(addr5.address)));
        const royaltyReceiverBalanceAfterSale = Number (formatEther(await provider.getBalance(addr1.address)));
        const marketplaceBalanceAfterSale = Number (formatEther(await provider.getBalance(marketplace.address)));

        expect(await NFT721.ownerOf(1)).to.equal(addr5.address);

        expect(sellerBalanceAfterSale - sellerBalanceBeforeSale)
            .to.be.closeTo(0.875, 0.01);
        expect(buyerBalanceBeforeSale - buyerBalanceAfterSale)
            .to.be.closeTo(1, 0.01);
        expect(royaltyReceiverBalanceAfterSale - royaltyReceiverBalanceBeforeSale)
            .to.be.closeTo(0.099, 0.01);
        expect(marketplaceBalanceAfterSale - marketplaceBalanceBeforeSale)
            .to.be.closeTo(0.025, 0.001);
    });

    it("Should be able lazy mint ERC721", async function () {
        await NFT721.connect(addr1).setApprovalForAll(marketplace.address, true);

        const sellerBalanceBeforeSale = Number (formatEther(await provider.getBalance(addr1.address)));
        const buyerBalanceBeforeSale = Number (formatEther(await provider.getBalance(addr4.address)));
        const marketplaceBalanceBeforeSale = Number (formatEther(await provider.getBalance(marketplace.address)));

        const TIME = Math.round(new Date()/1000 + 3600);
        const sellerOrder = [
            addr1.address, NFT721.address,
            6,1,0,
            '0x0000000000000000000000000000000000000000',   //ETH
            parseEther('1.0'),
            TIME,[],[],Math.round(Math.random()*1000)
        ];
        const sellerSig = await getSignature(addr1, ...sellerOrder);

        const buyerOrder = [
            addr4.address, NFT721.address,
            6,1,0,
            '0x0000000000000000000000000000000000000000',   //ETH
            parseEther('1.0'),
            TIME,[],[],Math.round(Math.random()*1000)
        ];

        await marketplace.connect(addr4).completeOrder(
            sellerOrder,
            sellerSig,
            buyerOrder,
            sellerSig,      //buyer signature is unnecessary when buy out
            {value: parseEther('1.0')}
        );

        const sellerBalanceAfterSale = Number (formatEther(await provider.getBalance(addr1.address)));
        const buyerBalanceAfterSale = Number (formatEther(await provider.getBalance(addr4.address)));
        const marketplaceBalanceAfterSale = Number (formatEther(await provider.getBalance(marketplace.address)));

        expect(await NFT721.ownerOf(1)).to.equal(addr5.address);

        expect(sellerBalanceAfterSale - sellerBalanceBeforeSale)
            .to.be.closeTo(0.975, 0.01);
        expect(buyerBalanceBeforeSale - buyerBalanceAfterSale)
            .to.be.closeTo(1, 0.01);
        expect(marketplaceBalanceAfterSale - marketplaceBalanceBeforeSale)
            .to.be.closeTo(0.025, 0.001);
    });

    it("Should be able to buy ERC1155", async function () {
        await NFT1155.connect(addr2).setApprovalForAll(marketplace.address, true);

        const sellerBalanceBeforeSale = Number (formatEther(await provider.getBalance(addr2.address)));
        const buyerBalanceBeforeSale = Number (formatEther(await provider.getBalance(addr4.address)));
        const royaltyReceiverBalanceBeforeSale = Number (formatEther(await provider.getBalance(addr3.address)));
        const marketplaceBalanceBeforeSale = Number (formatEther(await provider.getBalance(marketplace.address)));

        const TIME = Math.round(new Date()/1000 + 3600);
        const sellerOrder = [
            addr2.address, NFT1155.address,
            1,20,0,
            '0x0000000000000000000000000000000000000000',   //ETH
            parseEther('0.1'),
            TIME,[],[],Math.round(Math.random()*1000)
        ];
        const sellerSig = await getSignature(addr2, ...sellerOrder);

        const buyerOrder = [
            addr4.address, NFT1155.address,
            1,10,0,
            '0x0000000000000000000000000000000000000000',   //ETH
            parseEther('1.0'),
            TIME,[],[],Math.round(Math.random()*1000)
        ];

        await marketplace.connect(addr4).completeOrder(
            sellerOrder,
            sellerSig,
            buyerOrder,
            sellerSig,      //buyer signature is unnecessary when buy out
            {value: parseEther('1.5')}
        );

        const sellerBalanceAfterSale = Number (formatEther(await provider.getBalance(addr2.address)));
        const buyerBalanceAfterSale = Number (formatEther(await provider.getBalance(addr4.address)));
        const royaltyReceiverBalanceAfterSale = Number (formatEther(await provider.getBalance(addr3.address)));
        const marketplaceBalanceAfterSale = Number (formatEther(await provider.getBalance(marketplace.address)));

        expect(await NFT1155.balanceOf(addr4.address, 1)).to.equal(10);

        expect(sellerBalanceAfterSale - sellerBalanceBeforeSale)
            .to.be.closeTo(0.875, 0.01);
        expect(buyerBalanceBeforeSale - buyerBalanceAfterSale)
            .to.be.closeTo(1, 0.01);
        expect(royaltyReceiverBalanceAfterSale - royaltyReceiverBalanceBeforeSale)
            .to.be.closeTo(0.099, 0.01);
        expect(marketplaceBalanceAfterSale - marketplaceBalanceBeforeSale)
            .to.be.closeTo(0.025, 0.001);
    });

    it("Should be able to resell ERC1155", async function () {
        await NFT1155.connect(addr4).setApprovalForAll(marketplace.address, true);

        const sellerBalanceBeforeSale = Number (formatEther(await provider.getBalance(addr4.address)));
        const buyerBalanceBeforeSale = Number (formatEther(await provider.getBalance(addr5.address)));
        const royaltyReceiverBalanceBeforeSale = Number (formatEther(await provider.getBalance(addr3.address)));
        const marketplaceBalanceBeforeSale = Number (formatEther(await provider.getBalance(marketplace.address)));

        const TIME = Math.round(new Date()/1000 + 3600);
        const sellerOrder = [
            addr4.address, NFT1155.address,
            1,10,0,
            '0x0000000000000000000000000000000000000000',   //ETH
            parseEther('0.1'),
            TIME,[],[],Math.round(Math.random()*1000)
        ];
        const sellerSig = await getSignature(addr4, ...sellerOrder);

        const buyerOrder = [
            addr5.address, NFT1155.address,
            1,10,0,
            '0x0000000000000000000000000000000000000000',   //ETH
            parseEther('1.0'),
            TIME,[],[],Math.round(Math.random()*1000)
        ];

        await marketplace.connect(addr5).completeOrder(
            sellerOrder,
            sellerSig,
            buyerOrder,
            sellerSig,      //buyer signature is unnecessary when buy out
            {value: parseEther('1')}
        );

        const sellerBalanceAfterSale = Number (formatEther(await provider.getBalance(addr4.address)));
        const buyerBalanceAfterSale = Number (formatEther(await provider.getBalance(addr5.address)));
        const royaltyReceiverBalanceAfterSale = Number (formatEther(await provider.getBalance(addr3.address)));
        const marketplaceBalanceAfterSale = Number (formatEther(await provider.getBalance(marketplace.address)));

        expect(await NFT1155.balanceOf(addr4.address, 1)).to.equal(0);
        expect(await NFT1155.balanceOf(addr5.address, 1)).to.equal(10);

        expect(sellerBalanceAfterSale - sellerBalanceBeforeSale)
            .to.be.closeTo(0.875, 0.01);
        expect(buyerBalanceBeforeSale - buyerBalanceAfterSale)
            .to.be.closeTo(1, 0.01);
        expect(royaltyReceiverBalanceAfterSale - royaltyReceiverBalanceBeforeSale)
            .to.be.closeTo(0.099, 0.01);
        expect(marketplaceBalanceAfterSale - marketplaceBalanceBeforeSale)
            .to.be.closeTo(0.025, 0.001);
    });

    it("Should be able to lazy mint ERC1155", async function () {
        await NFT1155.connect(addr3).setApprovalForAll(marketplace.address, true);
        expect(await NFT1155.balanceOf(addr3.address, 9)).to.equal(0);

        const sellerBalanceBeforeSale = Number (formatEther(await provider.getBalance(addr3.address)));
        const buyerBalanceBeforeSale = Number (formatEther(await provider.getBalance(addr5.address)));
        const marketplaceBalanceBeforeSale = Number (formatEther(await provider.getBalance(marketplace.address)));

        const TIME = Math.round(new Date()/1000 + 3600);
        const sellerOrder = [
            addr3.address, NFT1155.address,
            6,10,0,
            '0x0000000000000000000000000000000000000000',   //ETH
            parseEther('0.1'),
            TIME,[],[],Math.round(Math.random()*1000)
        ];
        const sellerSig = await getSignature(addr3, ...sellerOrder);

        const buyerOrder = [
            addr5.address, NFT1155.address,
            6,10,0,
            '0x0000000000000000000000000000000000000000',   //ETH
            parseEther('1.0'),
            TIME,[],[],Math.round(Math.random()*1000)
        ];

        await marketplace.connect(addr5).completeOrder(
            sellerOrder,
            sellerSig,
            buyerOrder,
            sellerSig,      //buyer signature is unnecessary when buy out
            {value: parseEther('1')}
        );

        const sellerBalanceAfterSale = Number (formatEther(await provider.getBalance(addr3.address)));
        const buyerBalanceAfterSale = Number (formatEther(await provider.getBalance(addr5.address)));
        const marketplaceBalanceAfterSale = Number (formatEther(await provider.getBalance(marketplace.address)));

        expect(await NFT1155.balanceOf(addr5.address, 6)).to.equal(10);

        expect(sellerBalanceAfterSale - sellerBalanceBeforeSale)
            .to.be.closeTo(0.975, 0.01);
        expect(buyerBalanceBeforeSale - buyerBalanceAfterSale)
            .to.be.closeTo(1, 0.01);
        expect(marketplaceBalanceAfterSale - marketplaceBalanceBeforeSale)
            .to.be.closeTo(0.025, 0.001);
    });

});
describe('Auction', () => {

    it("Should be able to accept auction bid or simple offer (ERC721)", async function () {
        const sellerBalanceBeforeSale = Number (formatEther(await ERC20.balanceOf(addr2.address)));
        const buyerBalanceBeforeSale = Number (formatEther(await ERC20.balanceOf(addr4.address)));
        const royaltyReceiverBalanceBeforeSale = Number (formatEther(await ERC20.balanceOf(addr1.address)));
        const marketplaceBalanceBeforeSale = Number (formatEther(await ERC20.balanceOf(marketplace.address)));

        const TIME = Math.round(new Date()/1000 + 3600);
        const sellerOrder = [
            addr2.address, NFT721.address,
            2,1,1,
            ERC20.address,
            parseEther('1.0'),
            TIME,[],[],Math.round(Math.random()*1000)
        ];
        const sellerSig = await getSignature(addr2, ...sellerOrder);

        await ERC20.connect(addr4).approve(marketplace.address, parseEther('3.0'));
        const buyerOrder = [
            addr4.address, NFT721.address,
            2,1,1,
            ERC20.address,
            parseEther('3.0'),
            TIME,[],[],Math.round(Math.random()*1000)
        ];
        const buyerSig = await getSignature(addr4, ...buyerOrder);

        await marketplace.connect(addr2).completeOrder(
            sellerOrder,
            buyerSig,   //accepting offer does not require valid sellers signature
            buyerOrder,
            buyerSig
        );

        const sellerBalanceAfterSale = Number (formatEther(await ERC20.balanceOf(addr2.address)));
        const buyerBalanceAfterSale = Number (formatEther(await ERC20.balanceOf(addr4.address)));
        const royaltyReceiverBalanceAfterSale = Number (formatEther(await ERC20.balanceOf(addr1.address)));
        const marketplaceBalanceAfterSale = Number (formatEther(await ERC20.balanceOf(marketplace.address)));

        expect(await NFT721.ownerOf(2)).to.equal(addr4.address);

        expect(sellerBalanceAfterSale - sellerBalanceBeforeSale)
            .to.be.closeTo(2.625, 0.01);
        expect(buyerBalanceBeforeSale - buyerBalanceAfterSale)
            .to.be.closeTo(3, 0.01);
        expect(royaltyReceiverBalanceAfterSale - royaltyReceiverBalanceBeforeSale)
            .to.be.closeTo(0.3, 0.01);
        expect(marketplaceBalanceAfterSale - marketplaceBalanceBeforeSale)
            .to.be.closeTo(0.075, 0.001);
    });

    it("Should be able to claim auction token (ERC721)", async function () {
        const sellerBalanceBeforeSale = Number (formatEther(await ERC20.balanceOf(addr4.address)));
        const buyerBalanceBeforeSale = Number (formatEther(await ERC20.balanceOf(addr2.address)));
        const royaltyReceiverBalanceBeforeSale = Number (formatEther(await ERC20.balanceOf(addr1.address)));
        const marketplaceBalanceBeforeSale = Number (formatEther(await ERC20.balanceOf(marketplace.address)));

        const TIME = Math.round(new Date()/1000 + 3600);
        const sellerOrder = [
            addr4.address, NFT721.address,
            2,1,1,
            ERC20.address,
            parseEther('1.0'),
            TIME-3700,[],[],Math.round(Math.random()*1000)
        ];
        const sellerSig = await getSignature(addr4, ...sellerOrder);

        await ERC20.connect(addr2).approve(marketplace.address, parseEther('3.0'));
        const buyerOrder = [
            addr2.address, NFT721.address,
            2,1,1,
            ERC20.address,
            parseEther('3.0'),
            TIME,[],[],Math.round(Math.random()*1000)
        ];
        const buyerSig = await getSignature(addr2, ...buyerOrder);

        await marketplace.connect(addr2).completeOrder(
            sellerOrder,
            sellerSig,
            buyerOrder,
            buyerSig
        );

        const sellerBalanceAfterSale = Number (formatEther(await ERC20.balanceOf(addr4.address)));
        const buyerBalanceAfterSale = Number (formatEther(await ERC20.balanceOf(addr2.address)));
        const royaltyReceiverBalanceAfterSale = Number (formatEther(await ERC20.balanceOf(addr1.address)));
        const marketplaceBalanceAfterSale = Number (formatEther(await ERC20.balanceOf(marketplace.address)));

        expect(await NFT721.ownerOf(2)).to.equal(addr2.address);

        expect(sellerBalanceAfterSale - sellerBalanceBeforeSale)
            .to.be.closeTo(2.625, 0.01);
        expect(buyerBalanceBeforeSale - buyerBalanceAfterSale)
            .to.be.closeTo(3, 0.01);
        expect(royaltyReceiverBalanceAfterSale - royaltyReceiverBalanceBeforeSale)
            .to.be.closeTo(0.3, 0.01);
        expect(marketplaceBalanceAfterSale - marketplaceBalanceBeforeSale)
            .to.be.closeTo(0.075, 0.001);
    });

    it("Should be able to lazy mint during auction/offer (ERC721)", async function () {
        expect(await NFT721.exists(9)).to.equal(false);

        const sellerBalanceBeforeSale = Number (formatEther(await ERC20.balanceOf(addr1.address)));
        const buyerBalanceBeforeSale = Number (formatEther(await ERC20.balanceOf(addr4.address)));
        const marketplaceBalanceBeforeSale = Number (formatEther(await ERC20.balanceOf(marketplace.address)));

        const TIME = Math.round(new Date()/1000 + 3600);
        const sellerOrder = [
            addr1.address, NFT721.address,
            9,1,1,
            ERC20.address,
            parseEther('1.0'),
            TIME,[],[],Math.round(Math.random()*1000)
        ];
        const sellerSig = await getSignature(addr1, ...sellerOrder);

        await ERC20.connect(addr4).approve(marketplace.address, parseEther('3.0'));
        const buyerOrder = [
            addr4.address, NFT721.address,
            9,1,1,
            ERC20.address,
            parseEther('2.0'),
            TIME,[],[],Math.round(Math.random()*1000)
        ];
        const buyerSig = await getSignature(addr4, ...buyerOrder);

        await marketplace.connect(addr1).completeOrder(
            sellerOrder,
            buyerSig,   //accepting offer does not require valid sellers signature
            buyerOrder,
            buyerSig
        );

        const sellerBalanceAfterSale = Number (formatEther(await ERC20.balanceOf(addr1.address)));
        const buyerBalanceAfterSale = Number (formatEther(await ERC20.balanceOf(addr4.address)));
        const marketplaceBalanceAfterSale = Number (formatEther(await ERC20.balanceOf(marketplace.address)));

        expect(await NFT721.ownerOf(9)).to.equal(addr4.address);

        expect(sellerBalanceAfterSale - sellerBalanceBeforeSale)
            .to.be.closeTo(1.95, 0.01);
        expect(buyerBalanceBeforeSale - buyerBalanceAfterSale)
            .to.be.closeTo(2, 0.01);
        expect(marketplaceBalanceAfterSale - marketplaceBalanceBeforeSale)
            .to.be.closeTo(0.05, 0.001);
    });

    it("Should be able to accept auction bid or simple offer (ERC1155)", async function () {
        const sellerBalanceBeforeSale = Number (formatEther(await ERC20.balanceOf(addr2.address)));
        const buyerBalanceBeforeSale = Number (formatEther(await ERC20.balanceOf(addr4.address)));
        const royaltyReceiverBalanceBeforeSale = Number (formatEther(await ERC20.balanceOf(addr3.address)));
        const marketplaceBalanceBeforeSale = Number (formatEther(await ERC20.balanceOf(marketplace.address)));

        const TIME = Math.round(new Date()/1000 + 3600);
        const sellerOrder = [
            addr2.address, NFT1155.address,
            3,10,1,
            ERC20.address,
            parseEther('0.1'),
            TIME,[],[],Math.round(Math.random()*1000)
        ];
        const sellerSig = await getSignature(addr2, ...sellerOrder);

        ERC20.connect(addr4).approve(marketplace.address, parseEther('1.0'));
        const buyerOrder = [
            addr4.address, NFT1155.address,
            3,10,1,
            ERC20.address,
            parseEther('1.0'),
            TIME,[],[],Math.round(Math.random()*1000)
        ];
        const buyerSig = await getSignature(addr4, ...buyerOrder);

        await marketplace.connect(addr2).completeOrder(
            sellerOrder,
            buyerSig,   //accepting offer does not require valid sellers signature
            buyerOrder,
            buyerSig
        );

        const sellerBalanceAfterSale = Number (formatEther(await ERC20.balanceOf(addr2.address)));
        const buyerBalanceAfterSale = Number (formatEther(await ERC20.balanceOf(addr4.address)));
        const royaltyReceiverBalanceAfterSale = Number (formatEther(await ERC20.balanceOf(addr3.address)));
        const marketplaceBalanceAfterSale = Number (formatEther(await ERC20.balanceOf(marketplace.address)));

        expect(await NFT1155.balanceOf(addr4.address, 3)).to.equal(10);

        expect(sellerBalanceAfterSale - sellerBalanceBeforeSale)
            .to.be.closeTo(0.875, 0.01);
        expect(buyerBalanceBeforeSale - buyerBalanceAfterSale)
            .to.be.closeTo(1, 0.01);
        expect(royaltyReceiverBalanceAfterSale - royaltyReceiverBalanceBeforeSale)
            .to.be.closeTo(0.099, 0.01);
        expect(marketplaceBalanceAfterSale - marketplaceBalanceBeforeSale)
            .to.be.closeTo(0.025, 0.001);
    });

    it("Should be able to claim auction token (ERC1155)", async function () {
        const sellerBalanceBeforeSale = Number (formatEther(await ERC20.balanceOf(addr2.address)));
        const buyerBalanceBeforeSale = Number (formatEther(await ERC20.balanceOf(addr5.address)));
        const royaltyReceiverBalanceBeforeSale = Number (formatEther(await ERC20.balanceOf(addr3.address)));
        const marketplaceBalanceBeforeSale = Number (formatEther(await ERC20.balanceOf(marketplace.address)));

        const TIME = Math.round(new Date()/1000 + 3600);
        const sellerOrder = [
            addr2.address, NFT1155.address,
            3,10,1,
            ERC20.address,
            parseEther('0.1'),
            TIME-3700,[],[],Math.round(Math.random()*1000)
        ];
        const sellerSig = await getSignature(addr2, ...sellerOrder);

        ERC20.connect(addr5).approve(marketplace.address, parseEther('1.0'));
        const buyerOrder = [
            addr5.address, NFT1155.address,
            3,10,1,
            ERC20.address,
            parseEther('1.0'),
            TIME,[],[],Math.round(Math.random()*1000)
        ];
        const buyerSig = await getSignature(addr5, ...buyerOrder);

        await marketplace.connect(addr5).completeOrder(
            sellerOrder,
            sellerSig,
            buyerOrder,
            buyerSig
        );

        const sellerBalanceAfterSale = Number (formatEther(await ERC20.balanceOf(addr2.address)));
        const buyerBalanceAfterSale = Number (formatEther(await ERC20.balanceOf(addr5.address)));
        const royaltyReceiverBalanceAfterSale = Number (formatEther(await ERC20.balanceOf(addr3.address)));
        const marketplaceBalanceAfterSale = Number (formatEther(await ERC20.balanceOf(marketplace.address)));

        expect(await NFT1155.balanceOf(addr5.address, 3)).to.equal(10);

        expect(sellerBalanceAfterSale - sellerBalanceBeforeSale)
            .to.be.closeTo(0.875, 0.01);
        expect(buyerBalanceBeforeSale - buyerBalanceAfterSale)
            .to.be.closeTo(1, 0.01);
        expect(royaltyReceiverBalanceAfterSale - royaltyReceiverBalanceBeforeSale)
            .to.be.closeTo(0.099, 0.01);
        expect(marketplaceBalanceAfterSale - marketplaceBalanceBeforeSale)
            .to.be.closeTo(0.025, 0.001);
    });

    it("Should be able to lazy mint during auction/offer (ERC1155)", async function () {
        expect(await NFT1155.balanceOf(addr3.address, 9)).to.equal(0);
        expect(await NFT1155.balanceOf(addr4.address, 9)).to.equal(0);

        const sellerBalanceBeforeSale = Number (formatEther(await ERC20.balanceOf(addr3.address)));
        const buyerBalanceBeforeSale = Number (formatEther(await ERC20.balanceOf(addr4.address)));
        const marketplaceBalanceBeforeSale = Number (formatEther(await ERC20.balanceOf(marketplace.address)));

        const TIME = Math.round(new Date()/1000 + 3600);
        const sellerOrder = [
            addr3.address, NFT1155.address,
            9,10,1,
            ERC20.address,
            parseEther('0.05'),
            TIME,[],[],Math.round(Math.random()*1000)
        ];
        const sellerSig = await getSignature(addr3, ...sellerOrder);

        ERC20.connect(addr4).approve(marketplace.address, parseEther('1.0'));
        const buyerOrder = [
            addr4.address, NFT1155.address,
            9,10,1,
            ERC20.address,
            parseEther('1.0'),
            TIME,[],[],Math.round(Math.random()*1000)
        ];
        const buyerSig = await getSignature(addr4, ...buyerOrder);

        await marketplace.connect(addr3).completeOrder(
            sellerOrder,
            buyerSig,   //accepting offer does not require valid sellers signature
            buyerOrder,
            buyerSig
        );

        const sellerBalanceAfterSale = Number (formatEther(await ERC20.balanceOf(addr3.address)));
        const buyerBalanceAfterSale = Number (formatEther(await ERC20.balanceOf(addr4.address)));
        const marketplaceBalanceAfterSale = Number (formatEther(await ERC20.balanceOf(marketplace.address)));

        expect(await NFT1155.balanceOf(addr4.address, 3)).to.equal(10);

        expect(sellerBalanceAfterSale - sellerBalanceBeforeSale)
            .to.be.closeTo(0.975, 0.01);
        expect(buyerBalanceBeforeSale - buyerBalanceAfterSale)
            .to.be.closeTo(1, 0.01);
        expect(marketplaceBalanceAfterSale - marketplaceBalanceBeforeSale)
            .to.be.closeTo(0.025, 0.001);
    });

});
describe('Bid on the floor price of collection', () => {

    it("Should be able to lazy mint during Floor Bid (ERC721)", async function () {
        expect(await NFT721.exists(41)).to.equal(false);

        const sellerBalanceBeforeSale = Number (formatEther(await ERC20.balanceOf(addr1.address)));
        const buyerBalanceBeforeSale = Number (formatEther(await ERC20.balanceOf(addr4.address)));
        const marketplaceBalanceBeforeSale = Number (formatEther(await ERC20.balanceOf(marketplace.address)));

        const TIME = Math.round(new Date()/1000 + 3600);
        const sellerOrder = [
            addr1.address, NFT721.address,
            41,1,2,
            ERC20.address,
            parseEther('1.0'),
            TIME,[],[],Math.round(Math.random()*1000)
        ];
        const sellerSig = await getSignature(addr1, ...sellerOrder);

        await ERC20.connect(addr4).approve(marketplace.address, parseEther('3.0'));
        const buyerOrder = [
            addr4.address, NFT721.address,
            1,1,2,
            ERC20.address,
            parseEther('2.0'),
            TIME,[],[],Math.round(Math.random()*1000)
        ];
        const buyerSig = await getSignature(addr4, ...buyerOrder);

        await marketplace.connect(addr1).completeOrder(
            sellerOrder,
            buyerSig,   //accepting offer does not require valid sellers signature
            buyerOrder,
            buyerSig
        );

        const sellerBalanceAfterSale = Number (formatEther(await ERC20.balanceOf(addr1.address)));
        const buyerBalanceAfterSale = Number (formatEther(await ERC20.balanceOf(addr4.address)));
        const marketplaceBalanceAfterSale = Number (formatEther(await ERC20.balanceOf(marketplace.address)));

        expect(await NFT721.ownerOf(41)).to.equal(addr4.address);

        expect(sellerBalanceAfterSale - sellerBalanceBeforeSale)
            .to.be.closeTo(1.95, 0.01);
        expect(buyerBalanceBeforeSale - buyerBalanceAfterSale)
            .to.be.closeTo(2, 0.01);
        expect(marketplaceBalanceAfterSale - marketplaceBalanceBeforeSale)
            .to.be.closeTo(0.05, 0.001);
    });

    it("Should be able to sell with Floor Bid (ERC721)", async function () {
        expect(await NFT721.ownerOf(41)).to.equal(addr4.address);

        const sellerBalanceBeforeSale = Number (formatEther(await ERC20.balanceOf(addr4.address)));
        const buyerBalanceBeforeSale = Number (formatEther(await ERC20.balanceOf(addr5.address)));
        const royaltyReceiverBalanceBeforeSale = Number (formatEther(await ERC20.balanceOf(addr1.address)));
        const marketplaceBalanceBeforeSale = Number (formatEther(await ERC20.balanceOf(marketplace.address)));

        const TIME = Math.round(new Date()/1000 + 3600);
        const sellerOrder = [
            addr4.address, NFT721.address,
            41,1,2,
            ERC20.address,
            parseEther('1.0'),
            TIME,[],[],Math.round(Math.random()*1000)
        ];
        const sellerSig = await getSignature(addr4, ...sellerOrder);

        await ERC20.connect(addr5).approve(marketplace.address, parseEther('3.0'));
        const buyerOrder = [
            addr5.address, NFT721.address,
            1,1,2,
            ERC20.address,
            parseEther('2.0'),
            TIME,[],[],Math.round(Math.random()*1000)
        ];
        const buyerSig = await getSignature(addr5, ...buyerOrder);

        await expect(marketplace.connect(addr5).completeOrder(sellerOrder, buyerSig, buyerOrder, buyerSig))
            .to.be.revertedWith("Offer should be accepted by the seller");

        await marketplace.connect(addr4).completeOrder(
            sellerOrder,
            buyerSig,   //accepting offer does not require valid sellers signature
            buyerOrder,
            buyerSig
        );

        const sellerBalanceAfterSale = Number (formatEther(await ERC20.balanceOf(addr4.address)));
        const buyerBalanceAfterSale = Number (formatEther(await ERC20.balanceOf(addr5.address)));
        const royaltyReceiverBalanceAfterSale = Number (formatEther(await ERC20.balanceOf(addr1.address)));
        const marketplaceBalanceAfterSale = Number (formatEther(await ERC20.balanceOf(marketplace.address)));

        expect(await NFT721.ownerOf(41)).to.equal(addr5.address);

        expect(sellerBalanceAfterSale - sellerBalanceBeforeSale)
            .to.be.closeTo(1.75, 0.01);
        expect(royaltyReceiverBalanceAfterSale - royaltyReceiverBalanceBeforeSale)
            .to.be.closeTo(0.2, 0.01);
        expect(buyerBalanceBeforeSale - buyerBalanceAfterSale)
            .to.be.closeTo(2, 0.01);
        expect(marketplaceBalanceAfterSale - marketplaceBalanceBeforeSale)
            .to.be.closeTo(0.05, 0.001);
    });

    it("Should be able to lazy mint during Floor Bid (ERC1155)", async function () {
        expect(await NFT1155.balanceOf(addr3.address, 41)).to.equal(0);
        expect(await NFT1155.balanceOf(addr4.address, 41)).to.equal(0);

        const sellerBalanceBeforeSale = Number (formatEther(await ERC20.balanceOf(addr3.address)));
        const buyerBalanceBeforeSale = Number (formatEther(await ERC20.balanceOf(addr4.address)));
        const marketplaceBalanceBeforeSale = Number (formatEther(await ERC20.balanceOf(marketplace.address)));

        const TIME = Math.round(new Date()/1000 + 3600);
        const sellerOrder = [
            addr3.address, NFT1155.address,
            41,10,2,
            ERC20.address,
            parseEther('0.05'),
            TIME,[],[],Math.round(Math.random()*1000)
        ];
        const sellerSig = await getSignature(addr3, ...sellerOrder);

        ERC20.connect(addr4).approve(marketplace.address, parseEther('1.0'));
        const buyerOrder = [
            addr4.address, NFT1155.address,
            0,10,2,
            ERC20.address,
            parseEther('1.0'),
            TIME,[],[],Math.round(Math.random()*1000)
        ];
        const buyerSig = await getSignature(addr4, ...buyerOrder);

        await marketplace.connect(addr3).completeOrder(
            sellerOrder,
            buyerSig,   //accepting offer does not require valid sellers signature
            buyerOrder,
            buyerSig
        );

        const sellerBalanceAfterSale = Number (formatEther(await ERC20.balanceOf(addr3.address)));
        const buyerBalanceAfterSale = Number (formatEther(await ERC20.balanceOf(addr4.address)));
        const marketplaceBalanceAfterSale = Number (formatEther(await ERC20.balanceOf(marketplace.address)));

        expect(await NFT1155.balanceOf(addr4.address, 41)).to.equal(10);

        expect(sellerBalanceAfterSale - sellerBalanceBeforeSale)
            .to.be.closeTo(0.975, 0.01);
        expect(buyerBalanceBeforeSale - buyerBalanceAfterSale)
            .to.be.closeTo(1, 0.01);
        expect(marketplaceBalanceAfterSale - marketplaceBalanceBeforeSale)
            .to.be.closeTo(0.025, 0.001);
    });

    it("Should be able to lazy mint during Floor Bid (ERC1155)", async function () {
        expect(await NFT1155.balanceOf(addr5.address, 41)).to.equal(0);
        expect(await NFT1155.balanceOf(addr4.address, 41)).to.equal(10);

        const sellerBalanceBeforeSale = Number (formatEther(await ERC20.balanceOf(addr4.address)));
        const buyerBalanceBeforeSale = Number (formatEther(await ERC20.balanceOf(addr5.address)));
        const royaltyReceiverBalanceBeforeSale = Number (formatEther(await ERC20.balanceOf(addr3.address)));
        const marketplaceBalanceBeforeSale = Number (formatEther(await ERC20.balanceOf(marketplace.address)));

        TIME = Math.round(new Date()/1000 + 3600);
        const sellerOrder = [
            addr4.address, NFT1155.address,
            41,10,2,
            ERC20.address,
            parseEther('0.05'),
            TIME,[],[],Math.round(Math.random()*1000)
        ];
        const sellerSig = await getSignature(addr4, ...sellerOrder);

        ERC20.connect(addr5).approve(marketplace.address, parseEther('10.0'));
        const buyerOrder = [
            addr5.address, NFT1155.address,
            0,3,2,
            ERC20.address,
            parseEther('1.0'),
            TIME,[],[],Math.round(Math.random()*1000)
        ];
        const buyerSig = await getSignature(addr5, ...buyerOrder);

        await expect(marketplace.connect(addr5).completeOrder(sellerOrder, buyerSig, buyerOrder, buyerSig))
            .to.be.revertedWith("Offer should be accepted by the seller");

        await marketplace.connect(addr4).completeOrder(
            sellerOrder,
            buyerSig,   //accepting offer does not require valid sellers signature
            buyerOrder,
            buyerSig
        );

        const OrderIsCompleted = await marketplace.orderIsCancelledOrCompleted(
            addr5.address, await marketplace.buildHash(buyerOrder));
        expect(OrderIsCompleted).to.equal(true);

        const sellerBalanceAfterSale = Number (formatEther(await ERC20.balanceOf(addr4.address)));
        const buyerBalanceAfterSale = Number (formatEther(await ERC20.balanceOf(addr5.address)));
        const royaltyReceiverBalanceAfterSale = Number (formatEther(await ERC20.balanceOf(addr3.address)));
        const marketplaceBalanceAfterSale = Number (formatEther(await ERC20.balanceOf(marketplace.address)));

        expect(await NFT1155.balanceOf(addr4.address, 41)).to.equal(7);
        expect(await NFT1155.balanceOf(addr5.address, 41)).to.equal(3);

        expect(sellerBalanceAfterSale - sellerBalanceBeforeSale)
            .to.be.closeTo(0.875, 0.01);
        expect(royaltyReceiverBalanceAfterSale - royaltyReceiverBalanceBeforeSale)
            .to.be.closeTo(0.1, 0.01);
        expect(buyerBalanceBeforeSale - buyerBalanceAfterSale)
            .to.be.closeTo(1, 0.01);
        expect(marketplaceBalanceAfterSale - marketplaceBalanceBeforeSale)
            .to.be.closeTo(0.025, 0.001);


        //should not be able to use this order anymore
        const sellerOrder2 = [
            addr4.address, NFT1155.address,
            41,3,2,
            ERC20.address,
            parseEther('0.05'),
            TIME,[],[],Math.round(Math.random()*1000)
        ];
        await expect(marketplace.connect(addr4).completeOrder(
            sellerOrder2,
            buyerSig,   //accepting offer does not require valid sellers signature
            buyerOrder,
            buyerSig
        )).to.be.revertedWith("Cancelled or complete");
        expect(await NFT1155.balanceOf(addr4.address, 41)).to.equal(7);
    });

});
describe('Bundle orders', () => {

    it("Should be able to buy now bundle of ERC721", async function () {
        expect(await NFT721.ownerOf(3)).to.equal(addr2.address);
        expect(await NFT721.ownerOf(4)).to.equal(addr2.address);

        const sellerBalanceBeforeSale = Number (formatEther(await provider.getBalance(addr2.address)));
        const buyerBalanceBeforeSale = Number (formatEther(await provider.getBalance(addr4.address)));
        const royaltyReceiverBalanceBeforeSale = Number (formatEther(await provider.getBalance(addr1.address)));
        const marketplaceBalanceBeforeSale = Number (formatEther(await provider.getBalance(marketplace.address)));

        const TIME = Math.round(new Date()/1000 + 3600);
        const sellerOrder = [
            addr2.address, NFT721.address,
            0,1,3,
            '0x0000000000000000000000000000000000000000',   //ETH
            parseEther('3.0'),
            TIME,[3,4],[1,1],Math.round(Math.random()*1000)
        ];
        const sellerSig = await getSignature(addr2, ...sellerOrder);

        const buyerOrder = [
            addr4.address, NFT721.address,
            0,1,3,
            '0x0000000000000000000000000000000000000000',   //ETH
            parseEther('3.0'),
            TIME,[3,4],[1,1],Math.round(Math.random()*1000)
        ];

        await marketplace.connect(addr4).completeOrder(
            sellerOrder,
            sellerSig,
            buyerOrder,
            sellerSig,      //buyer signature is unnecessary when buy out
            {value: parseEther('4')}
        );

        const sellerBalanceAfterSale = Number (formatEther(await provider.getBalance(addr2.address)));
        const buyerBalanceAfterSale = Number (formatEther(await provider.getBalance(addr4.address)));
        const royaltyReceiverBalanceAfterSale = Number (formatEther(await provider.getBalance(addr1.address)));
        const marketplaceBalanceAfterSale = Number (formatEther(await provider.getBalance(marketplace.address)));

        expect(await NFT721.ownerOf(3)).to.equal(addr4.address);
        expect(await NFT721.ownerOf(4)).to.equal(addr4.address);

        expect(sellerBalanceAfterSale - sellerBalanceBeforeSale)
            .to.be.closeTo(2.625, 0.01);
        expect(buyerBalanceBeforeSale - buyerBalanceAfterSale)
            .to.be.closeTo(3, 0.01);
        expect(royaltyReceiverBalanceAfterSale - royaltyReceiverBalanceBeforeSale)
            .to.be.closeTo(0.3, 0.01);
        expect(marketplaceBalanceAfterSale - marketplaceBalanceBeforeSale)
            .to.be.closeTo(0.075, 0.001);
    });

    it("Should be able to lazy mint bundle of ERC721", async function () {
        expect(await NFT721.exists(7)).to.equal(false);
        expect(await NFT721.exists(8)).to.equal(false);

        const sellerBalanceBeforeSale = Number (formatEther(await provider.getBalance(addr1.address)));
        const buyerBalanceBeforeSale = Number (formatEther(await provider.getBalance(addr4.address)));
        const marketplaceBalanceBeforeSale = Number (formatEther(await provider.getBalance(marketplace.address)));

        const TIME = Math.round(new Date()/1000 + 3600);
        const sellerOrder = [
            addr1.address, NFT721.address,
            0,1,3,
            '0x0000000000000000000000000000000000000000',   //ETH
            parseEther('3.0'),
            TIME,[7,8],[1,1],Math.round(Math.random()*1000)
        ];
        const sellerSig = await getSignature(addr1, ...sellerOrder);

        const buyerOrder = [
            addr4.address, NFT721.address,
            0,1,3,
            '0x0000000000000000000000000000000000000000',   //ETH
            parseEther('3.0'),
            TIME,[7,8],[1,1],Math.round(Math.random()*1000)
        ];

        await marketplace.connect(addr4).completeOrder(
            sellerOrder,
            sellerSig,
            buyerOrder,
            sellerSig,      //buyer signature is unnecessary when buy out
            {value: parseEther('4')}
        );

        const sellerBalanceAfterSale = Number (formatEther(await provider.getBalance(addr1.address)));
        const buyerBalanceAfterSale = Number (formatEther(await provider.getBalance(addr4.address)));
        const marketplaceBalanceAfterSale = Number (formatEther(await provider.getBalance(marketplace.address)));

        expect(await NFT721.ownerOf(7)).to.equal(addr4.address);
        expect(await NFT721.ownerOf(8)).to.equal(addr4.address);

        expect(sellerBalanceAfterSale - sellerBalanceBeforeSale)
            .to.be.closeTo(2.925, 0.01);
        expect(buyerBalanceBeforeSale - buyerBalanceAfterSale)
            .to.be.closeTo(3, 0.01);
        expect(marketplaceBalanceAfterSale - marketplaceBalanceBeforeSale)
            .to.be.closeTo(0.075, 0.001);
    });

    it("Should be able to accept auction offer for bundle of ERC721", async function () {
        expect(await NFT721.ownerOf(3)).to.equal(addr4.address);
        expect(await NFT721.ownerOf(4)).to.equal(addr4.address);

        const sellerBalanceBeforeSale = Number (formatEther(await ERC20.balanceOf(addr4.address)));
        const buyerBalanceBeforeSale = Number (formatEther(await ERC20.balanceOf(addr2.address)));
        const royaltyReceiverBalanceBeforeSale = Number (formatEther(await ERC20.balanceOf(addr1.address)));
        const marketplaceBalanceBeforeSale = Number (formatEther(await ERC20.balanceOf(marketplace.address)));

        const TIME = Math.round(new Date()/1000 + 3600);
        const sellerOrder = [
            addr4.address, NFT721.address,
            0,1,4,
            ERC20.address,   //ETH
            parseEther('1.0'),
            TIME,[3,4],[1,1],Math.round(Math.random()*1000)
        ];
        const sellerSig = await getSignature(addr4, ...sellerOrder);

        const buyerOrder = [
            addr2.address, NFT721.address,
            0,1,4,
            ERC20.address,   //ETH
            parseEther('3.0'),
            TIME,[3,4],[1,1],Math.round(Math.random()*1000)
        ];
        const buyerSig = await getSignature(addr2, ...buyerOrder);

        await ERC20.connect(addr2).approve(marketplace.address, parseEther('3.0'));
        await marketplace.connect(addr4).completeOrder(
            sellerOrder,
            buyerSig,   //accepting offer does not require valid sellers signature
            buyerOrder,
            buyerSig,
        );

        const sellerBalanceAfterSale = Number (formatEther(await ERC20.balanceOf(addr4.address)));
        const buyerBalanceAfterSale = Number (formatEther(await ERC20.balanceOf(addr2.address)));
        const royaltyReceiverBalanceAfterSale = Number (formatEther(await ERC20.balanceOf(addr1.address)));
        const marketplaceBalanceAfterSale = Number (formatEther(await ERC20.balanceOf(marketplace.address)));

        expect(await NFT721.ownerOf(3)).to.equal(addr2.address);
        expect(await NFT721.ownerOf(4)).to.equal(addr2.address);

        expect(sellerBalanceAfterSale - sellerBalanceBeforeSale)
            .to.be.closeTo(2.625, 0.01);
        expect(buyerBalanceBeforeSale - buyerBalanceAfterSale)
            .to.be.closeTo(3, 0.01);
        expect(royaltyReceiverBalanceAfterSale - royaltyReceiverBalanceBeforeSale)
            .to.be.closeTo(0.3, 0.01);
        expect(marketplaceBalanceAfterSale - marketplaceBalanceBeforeSale)
            .to.be.closeTo(0.075, 0.001);
    });

    it("Should be able to claim bundle of ERC721 on auction", async function () {
        expect(await NFT721.ownerOf(3)).to.equal(addr2.address);
        expect(await NFT721.ownerOf(4)).to.equal(addr2.address);

        const sellerBalanceBeforeSale = Number (formatEther(await ERC20.balanceOf(addr2.address)));
        const buyerBalanceBeforeSale = Number (formatEther(await ERC20.balanceOf(addr4.address)));
        const royaltyReceiverBalanceBeforeSale = Number (formatEther(await ERC20.balanceOf(addr1.address)));
        const marketplaceBalanceBeforeSale = Number (formatEther(await ERC20.balanceOf(marketplace.address)));

        const TIME = Math.round(new Date()/1000 + 3600);
        const sellerOrder = [
            addr2.address, NFT721.address,
            1,1,4,
            ERC20.address,   //ETH
            parseEther('1.0'),
            TIME-3700,[3,4],[1,1],Math.round(Math.random()*1000)
        ];
        const sellerSig = await getSignature(addr2, ...sellerOrder);

        const buyerOrder = [
            addr4.address, NFT721.address,
            1,1,4,
            ERC20.address,   //ETH
            parseEther('3.0'),
            TIME,[3,4],[1,1],Math.round(Math.random()*1000)
        ];
        const buyerSig = await getSignature(addr4, ...buyerOrder);

        await ERC20.connect(addr4).approve(marketplace.address, parseEther('3.0'));
        await marketplace.connect(addr4).completeOrder(
            sellerOrder,
            sellerSig,
            buyerOrder,
            buyerSig,
        );

        const sellerBalanceAfterSale = Number (formatEther(await ERC20.balanceOf(addr2.address)));
        const buyerBalanceAfterSale = Number (formatEther(await ERC20.balanceOf(addr4.address)));
        const royaltyReceiverBalanceAfterSale = Number (formatEther(await ERC20.balanceOf(addr1.address)));
        const marketplaceBalanceAfterSale = Number (formatEther(await ERC20.balanceOf(marketplace.address)));

        expect(await NFT721.ownerOf(3)).to.equal(addr4.address);
        expect(await NFT721.ownerOf(4)).to.equal(addr4.address);

        expect(sellerBalanceAfterSale - sellerBalanceBeforeSale)
            .to.be.closeTo(2.625, 0.01);
        expect(buyerBalanceBeforeSale - buyerBalanceAfterSale)
            .to.be.closeTo(3, 0.01);
        expect(royaltyReceiverBalanceAfterSale - royaltyReceiverBalanceBeforeSale)
            .to.be.closeTo(0.3, 0.01);
        expect(marketplaceBalanceAfterSale - marketplaceBalanceBeforeSale)
            .to.be.closeTo(0.075, 0.001);
    });

    it("Should be able to buy now bundle of ERC1155", async function () {
        const sellerBalanceBeforeSale = Number (formatEther(await provider.getBalance(addr2.address)));
        const buyerBalanceBeforeSale = Number (formatEther(await provider.getBalance(addr1.address)));
        const royaltyReceiverBalanceBeforeSale = Number (formatEther(await provider.getBalance(addr3.address)));
        const marketplaceBalanceBeforeSale = Number (formatEther(await provider.getBalance(marketplace.address)));

        const TIME = Math.round(new Date()/1000 + 3600);
        const sellerOrder = [
            addr2.address, NFT1155.address,
            0,1,3,
            '0x0000000000000000000000000000000000000000',   //ETH
            parseEther('5.0'),
            TIME,[3,4,5],[10,15,5],Math.round(Math.random()*1000)
        ];
        const sellerSig = await getSignature(addr2, ...sellerOrder);

        const buyerOrder = [
            addr1.address, NFT1155.address,
            0,1,3,
            '0x0000000000000000000000000000000000000000',   //ETH
            parseEther('5.0'),
            TIME,[3,4,5],[10,15,5],Math.round(Math.random()*1000)
        ];

        await marketplace.connect(addr1).completeOrder(
            sellerOrder,
            sellerSig,
            buyerOrder,
            sellerSig,      //buyer signature is unnecessary when buy out
            {value: parseEther('5')}
        );

        const sellerBalanceAfterSale = Number (formatEther(await provider.getBalance(addr2.address)));
        const buyerBalanceAfterSale = Number (formatEther(await provider.getBalance(addr1.address)));
        const royaltyReceiverBalanceAfterSale = Number(formatEther(await provider.getBalance(addr3.address)));
        const marketplaceBalanceAfterSale = Number(formatEther(await provider.getBalance(marketplace.address)));

        expect(await NFT1155.balanceOf(addr1.address, 3)).to.equal(10);
        expect(await NFT1155.balanceOf(addr1.address, 4)).to.equal(15);
        expect(await NFT1155.balanceOf(addr1.address, 5)).to.equal(5);

        expect(sellerBalanceAfterSale - sellerBalanceBeforeSale)
            .to.be.closeTo(4.375, 0.01);
        expect(buyerBalanceBeforeSale - buyerBalanceAfterSale)
            .to.be.closeTo(5, 0.01);
        expect(royaltyReceiverBalanceAfterSale - royaltyReceiverBalanceBeforeSale)
            .to.be.closeTo(0.5, 0.01);
        expect(marketplaceBalanceAfterSale - marketplaceBalanceBeforeSale)
            .to.be.closeTo(0.125, 0.001);
    });

    it("Should be able to lazy mint bundle of ERC1155", async function () {
        expect(await NFT1155.balanceOf(addr3.address, 7)).to.equal(0);
        expect(await NFT1155.balanceOf(addr3.address, 8)).to.equal(0);
        expect(await NFT1155.balanceOf(addr3.address, 9)).to.equal(0);

        const sellerBalanceBeforeSale = Number (formatEther(await provider.getBalance(addr3.address)));
        const buyerBalanceBeforeSale = Number (formatEther(await provider.getBalance(addr1.address)));
        const marketplaceBalanceBeforeSale = Number (formatEther(await provider.getBalance(marketplace.address)));

        const TIME = Math.round(new Date()/1000 + 3600);
        const sellerOrder = [
            addr3.address, NFT1155.address,
            0,1,3,
            '0x0000000000000000000000000000000000000000',   //ETH
            parseEther('5.0'),
            TIME,[7,8,9],[12,12,12],Math.round(Math.random()*1000)
        ];
        const sellerSig = await getSignature(addr3, ...sellerOrder);

        const buyerOrder = [
            addr1.address, NFT1155.address,
            0,1,3,
            '0x0000000000000000000000000000000000000000',   //ETH
            parseEther('5.0'),
            TIME,[7,8,9],[12,12,12],Math.round(Math.random()*1000)
        ];

        await marketplace.connect(addr1).completeOrder(
            sellerOrder,
            sellerSig,
            buyerOrder,
            sellerSig,      //buyer signature is unnecessary when buy out
            {value: parseEther('5')}
        );

        const sellerBalanceAfterSale = Number (formatEther(await provider.getBalance(addr3.address)));
        const buyerBalanceAfterSale = Number (formatEther(await provider.getBalance(addr1.address)));
        const marketplaceBalanceAfterSale = Number(formatEther(await provider.getBalance(marketplace.address)));

        expect(await NFT1155.balanceOf(addr1.address, 7)).to.equal(12);
        expect(await NFT1155.balanceOf(addr1.address, 8)).to.equal(12);
        expect(await NFT1155.balanceOf(addr1.address, 9)).to.equal(12);

        expect(sellerBalanceAfterSale - sellerBalanceBeforeSale)
            .to.be.closeTo(4.875, 0.01);
        expect(buyerBalanceBeforeSale - buyerBalanceAfterSale)
            .to.be.closeTo(5, 0.01);
        expect(marketplaceBalanceAfterSale - marketplaceBalanceBeforeSale)
            .to.be.closeTo(0.125, 0.001);
    });

    it("Should be able to accept auction offer for bundle of ERC1155", async function () {
        const sellerBalanceBeforeSale = Number (formatEther(await ERC20.balanceOf(addr2.address)));
        const buyerBalanceBeforeSale = Number (formatEther(await ERC20.balanceOf(addr6.address)));
        const royaltyReceiverBalanceBeforeSale = Number (formatEther(await ERC20.balanceOf(addr3.address)));
        const marketplaceBalanceBeforeSale = Number (formatEther(await ERC20.balanceOf(marketplace.address)));

        const TIME = Math.round(new Date()/1000 + 3600);
        const sellerOrder = [
            addr2.address, NFT1155.address,
            0,1,4,
            ERC20.address,   //ETH
            parseEther('5.0'),
            TIME,[3,4,5],[8,9,10],Math.round(Math.random()*1000)
        ];
        const sellerSig = await getSignature(addr2, ...sellerOrder);

        await ERC20.connect(addr6).approve(marketplace.address, parseEther('5.0'));
        const buyerOrder = [
            addr6.address, NFT1155.address,
            0,1,4,
            ERC20.address,
            parseEther('5.0'),
            TIME,[3,4,5],[8,9,10],Math.round(Math.random()*1000)
        ];
        const buyerSig = await getSignature(addr6, ...buyerOrder);

        await marketplace.connect(addr2).completeOrder(
            sellerOrder,
            buyerSig,      //accepting offer does not require valid sellers signature
            buyerOrder,
            buyerSig
        );

        const sellerBalanceAfterSale = Number (formatEther(await ERC20.balanceOf(addr2.address)));
        const buyerBalanceAfterSale = Number (formatEther(await ERC20.balanceOf(addr6.address)));
        const royaltyReceiverBalanceAfterSale = Number(formatEther(await ERC20.balanceOf(addr3.address)));
        const marketplaceBalanceAfterSale = Number(formatEther(await ERC20.balanceOf(marketplace.address)));

        expect(await NFT1155.balanceOf(addr6.address, 3)).to.equal(8);
        expect(await NFT1155.balanceOf(addr6.address, 4)).to.equal(9);
        expect(await NFT1155.balanceOf(addr6.address, 5)).to.equal(10);

        expect(sellerBalanceAfterSale - sellerBalanceBeforeSale)
            .to.be.closeTo(4.375, 0.01);
        expect(buyerBalanceBeforeSale - buyerBalanceAfterSale)
            .to.be.closeTo(5, 0.01);
        expect(royaltyReceiverBalanceAfterSale - royaltyReceiverBalanceBeforeSale)
            .to.be.closeTo(0.5, 0.01);
        expect(marketplaceBalanceAfterSale - marketplaceBalanceBeforeSale)
            .to.be.closeTo(0.125, 0.001);
    });

    it("Should be able to claim bundle of ERC1155 on auction", async function () {
        const sellerBalanceBeforeSale = Number (formatEther(await ERC20.balanceOf(addr2.address)));
        const buyerBalanceBeforeSale = Number (formatEther(await ERC20.balanceOf(addr7.address)));
        const royaltyReceiverBalanceBeforeSale = Number (formatEther(await ERC20.balanceOf(addr3.address)));
        const marketplaceBalanceBeforeSale = Number (formatEther(await ERC20.balanceOf(marketplace.address)));

        const TIME = Math.round(new Date()/1000 + 3600);
        const sellerOrder = [
            addr2.address, NFT1155.address,
            0,1,4,
            ERC20.address,   //ETH
            parseEther('5.0'),
            TIME-3700,[3,4,5],[3,10,5],Math.round(Math.random()*1000)
        ];
        const sellerSig = await getSignature(addr2, ...sellerOrder);

        await ERC20.connect(addr7).approve(marketplace.address, parseEther('5.0'));
        const buyerOrder = [
            addr7.address, NFT1155.address,
            0,1,4,
            ERC20.address,
            parseEther('5.0'),
            TIME,[3,4,5],[3,10,5],Math.round(Math.random()*1000)
        ];
        const buyerSig = await getSignature(addr7, ...buyerOrder);

        await marketplace.connect(addr7).completeOrder(
            sellerOrder,
            sellerSig,
            buyerOrder,
            buyerSig
        );

        const sellerBalanceAfterSale = Number (formatEther(await ERC20.balanceOf(addr2.address)));
        const buyerBalanceAfterSale = Number (formatEther(await ERC20.balanceOf(addr7.address)));
        const royaltyReceiverBalanceAfterSale = Number(formatEther(await ERC20.balanceOf(addr3.address)));
        const marketplaceBalanceAfterSale = Number(formatEther(await ERC20.balanceOf(marketplace.address)));

        expect(await NFT1155.balanceOf(addr7.address, 3)).to.equal(3);
        expect(await NFT1155.balanceOf(addr7.address, 4)).to.equal(10);
        expect(await NFT1155.balanceOf(addr7.address, 5)).to.equal(5);

        expect(sellerBalanceAfterSale - sellerBalanceBeforeSale)
            .to.be.closeTo(4.375, 0.01);
        expect(buyerBalanceBeforeSale - buyerBalanceAfterSale)
            .to.be.closeTo(5, 0.01);
        expect(royaltyReceiverBalanceAfterSale - royaltyReceiverBalanceBeforeSale)
            .to.be.closeTo(0.5, 0.01);
        expect(marketplaceBalanceAfterSale - marketplaceBalanceBeforeSale)
            .to.be.closeTo(0.125, 0.001);
    });

});
describe('Cancelling', () => {

    it("Should be able cancel listing", async function () {
        const TIME = Math.round(new Date()/1000 + 3600);
        const sellerOrder = [
            addr1.address, NFT721.address,
            31,1,0,
            '0x0000000000000000000000000000000000000000',   //ETH
            parseEther('1.0'),
            TIME,[],[],Math.round(Math.random()*1000)
        ];
        const sellerSig = await getSignature(addr1, ...sellerOrder);

        const buyerOrder = [
            addr4.address, NFT721.address,
            31,1,0,
            '0x0000000000000000000000000000000000000000',   //ETH
            parseEther('1.0'),
            TIME,[],[],Math.round(Math.random()*1000)
        ];

        await marketplace.connect(addr1).cancelOrder(sellerOrder, sellerSig);

        await expect(marketplace.connect(addr4).completeOrder(
            sellerOrder,
            sellerSig,
            buyerOrder,
            sellerSig,      //buyer signature is unnecessary when buy out
            {value: parseEther('1.0')}
        )).to.be.revertedWith('Cancelled or complete');
    });

    it("Should be able cancel bid", async function () {
        const TIME = Math.round(new Date()/1000 + 3600);
        const sellerOrder = [
            addr1.address, NFT721.address,
            32,1,1,
            ERC20.address,
            parseEther('1.0'),
            TIME-3700,[],[],Math.round(Math.random()*1000)
        ];
        const sellerSig = await getSignature(addr1, ...sellerOrder);

        await ERC20.connect(addr4).approve(marketplace.address, parseEther('3.0'));
        const buyerOrder = [
            addr4.address, NFT721.address,
            32,1,1,
            ERC20.address,
            parseEther('3.0'),
            TIME,[],[],Math.round(Math.random()*1000)
        ];
        const buyerSig = await getSignature(addr4, ...buyerOrder);

        await marketplace.connect(addr4).cancelOrder(buyerOrder, buyerSig);

        await expect(marketplace.connect(addr1).completeOrder(
            sellerOrder,
            buyerSig,   //accepting offer does not require valid sellers signature
            buyerOrder,
            buyerSig
        )).to.be.revertedWith('Cancelled or complete');
    });

});
describe('Pre Sale', () => {

    it("Snapshot EVM", async function () {
        snapshotId_1 = await provider.send("evm_snapshot");
    });

    it("Should SimpleERC721 not support PreSale", async function () {
        await expect(marketplace.connect(addr5).prePurchase(
            addr1.address,
            NFT721.address,
            10,
            0,
            1
        )).revertedWith('Pre Sale not supported');
    });

    it("Should create Pre Sale Event - ETH (ERC721)", async function () {
        const TimeNow = Math.round(new Date()/1000);
        await expect(NFT721_e.connect(addr1).createPreSaleEvent(
            3,
            TimeNow+100,
            TimeNow + 3600,
            5,
            parseEther('10'),
            false
        ))
            .to.emit(NFT721_e,'NewPreSale')
            .withArgs(
                0,
                3,
                TimeNow+100,
                TimeNow + 3600,
                5,
                parseEther('10'),
                false
            );

        const event = await NFT721_e.preSaleEventInfo(0);
        expect(event.maxTokensPerWallet).to.equal(3);
        expect(event.startTime).to.equal(TimeNow+100);
        expect(event.endTime).to.equal(TimeNow + 3600);
        expect(event.maxTokensForEvent).to.equal(5);
        expect(event.tokensSold).to.equal(0);
        expect(event.price).to.equal(parseEther('10'));
        expect(event.whiteList).to.equal(false);

        await NFT721_e.connect(addr1).setApprovalForAll(marketplace.address, true);
        expect(await NFT721_e.isApprovedForAll(addr1.address, marketplace.address))
            .to.equal(true);
    });

    it("Should token price be correct and buyer won't be able to buy it (ERC721)", async function () {
        const info = await NFT721_e.getTokenInfo(addr2.address, 1, 0);
        expect(formatEther(info.tokenPrice)).to.equal('10.0');
        expect(info.availableForBuyer).to.equal(false);
    });

    it("Should event start and buyer be able to buy the token (ERC721)", async function () {
        await provider.send("evm_increaseTime", [150]);
        await provider.send("evm_mine", []);

        const sellerBalanceBeforeSale = Number (formatEther(await provider.getBalance(addr1.address)));
        const buyerBalanceBeforeSale = Number (formatEther(await provider.getBalance(addr2.address)));
        const marketplaceBalanceBeforeSale = Number (formatEther(await provider.getBalance(marketplace.address)));

        expect(await NFT721_e.ownerOf(1)).to.equal(addr1.address);

        await expect(marketplace.connect(addr2).prePurchase(
            addr1.address,
            NFT721_e.address,
            1,  //tokenId
            0,  //eventId
            1,   //quantity
            {value:parseEther('5')}
        )).to.be.revertedWith('Not enough {value}');

        await marketplace.connect(addr2).prePurchase(
            addr1.address,
            NFT721_e.address,
            1,  //tokenId
            0,  //eventId
            1,   //quantity
            {value:parseEther('15')}
        );

        expect(await NFT721_e.ownerOf(1)).to.equal(addr2.address);

        const sellerBalanceAfterSale = Number (formatEther(await provider.getBalance(addr1.address)));
        const buyerBalanceAfterSale = Number (formatEther(await provider.getBalance(addr2.address)));
        const marketplaceBalanceAfterSale = Number (formatEther(await provider.getBalance(marketplace.address)));

        expect(sellerBalanceAfterSale - sellerBalanceBeforeSale)
            .to.be.closeTo(9.75, 0.01);

        expect(buyerBalanceBeforeSale - buyerBalanceAfterSale)
            .to.be.closeTo(10, 0.01);

        expect(marketplaceBalanceAfterSale - marketplaceBalanceBeforeSale)
            .to.be.closeTo(0.25, 0.001);
    });

    it("Should not be able to buy same token (ERC721)", async function () {
        await expect(marketplace.connect(addr3).prePurchase(
            addr1.address,
            NFT721_e.address,
            1,  //tokenId
            0,  //eventId
            1,   //quantity
            {value:parseEther('5')}
        )).to.be.revertedWith('Not an owner');
    });

    it("Should not be able to buy multiple ERC721", async function () {
        await expect(marketplace.connect(addr2).prePurchase(
            addr1.address,
            NFT721_e.address,
            10,  //tokenId
            0,  //eventId
            2,   //quantity
            {value:parseEther('10')}
        )).to.be.revertedWith('ERC721 is unique');
    });

    it("Should be able to reserve token (ERC721)", async function () {
        await NFT721_e.connect(addr1).reserveToken(addr3.address, 2);
        expect(await NFT721_e.reservedToken(2)).to.equal(addr3.address);
    });

    it("Should not be able to buy token, reserved for someone else (ERC721)", async function () {
        await expect(marketplace.connect(addr2).prePurchase(
            addr1.address,
            NFT721_e.address,
            2,  //tokenId
            0,  //eventId
            1,   //quantity
            {value:parseEther('10')}
        )).to.be.revertedWith('Not allowed');
    });

    it("Should user be able to buy token reserved for him (ERC721)", async function () {
        const sellerBalanceBeforeSale = Number (formatEther(await provider.getBalance(addr1.address)));
        const buyerBalanceBeforeSale = Number (formatEther(await provider.getBalance(addr3.address)));
        const marketplaceBalanceBeforeSale = Number (formatEther(await provider.getBalance(marketplace.address)));

        await marketplace.connect(addr3).prePurchase(
            addr1.address,
            NFT721_e.address,
            2,  //tokenId
            0,  //eventId
            1,   //quantity
            {value:parseEther('10')}
        );

        expect(await NFT721_e.ownerOf(2)).to.equal(addr3.address);

        const sellerBalanceAfterSale = Number (formatEther(await provider.getBalance(addr1.address)));
        const buyerBalanceAfterSale = Number (formatEther(await provider.getBalance(addr3.address)));
        const marketplaceBalanceAfterSale = Number (formatEther(await provider.getBalance(marketplace.address)));

        expect(sellerBalanceAfterSale - sellerBalanceBeforeSale)
            .to.be.closeTo(9.75, 0.01);

        expect(buyerBalanceBeforeSale - buyerBalanceAfterSale)
            .to.be.closeTo(10, 0.01);

        expect(marketplaceBalanceAfterSale - marketplaceBalanceBeforeSale)
            .to.be.closeTo(0.25, 0.001);
    });

    it("Should be able to set default royalty distribution (ERC721)", async function () {
        const collaborators = [addr6.address, addr7.address];
        const shares = [2500, 2500];
        await NFT721_e.connect(addr1).setDefaultRoyaltyDistribution(collaborators, shares);
    });

    it("Should Pre Sale work with distributed royalties (ERC721)", async function () {
        const sellerBalanceBeforeSale = Number (formatEther(await provider.getBalance(addr1.address)));
        const collaborator1BalanceBeforeSale = Number (formatEther(await provider.getBalance(addr6.address)));
        const collaborator2BalanceBeforeSale = Number (formatEther(await provider.getBalance(addr7.address)));
        const buyerBalanceBeforeSale = Number (formatEther(await provider.getBalance(addr2.address)));
        const marketplaceBalanceBeforeSale = Number (formatEther(await provider.getBalance(marketplace.address)));

        await marketplace.connect(addr2).prePurchase(
            addr1.address,
            NFT721_e.address,
            3,  //tokenId
            0,  //eventId
            1,   //quantity
            {value:parseEther('10')}
        );

        expect(await NFT721_e.ownerOf(3)).to.equal(addr2.address);

        const sellerBalanceAfterSale = Number (formatEther(await provider.getBalance(addr1.address)));
        const collaborator1BalanceAfterSale = Number (formatEther(await provider.getBalance(addr6.address)));
        const collaborator2BalanceAfterSale = Number (formatEther(await provider.getBalance(addr7.address)));
        const buyerBalanceAfterSale = Number (formatEther(await provider.getBalance(addr2.address)));
        const marketplaceBalanceAfterSale = Number (formatEther(await provider.getBalance(marketplace.address)));

        expect(sellerBalanceAfterSale - sellerBalanceBeforeSale)
            .to.be.closeTo(9.25, 0.01);

        expect(collaborator1BalanceAfterSale - collaborator1BalanceBeforeSale)
            .to.be.closeTo(0.25, 0.01);

        expect(collaborator2BalanceAfterSale - collaborator2BalanceBeforeSale)
            .to.be.closeTo(0.25, 0.01);

        expect(buyerBalanceBeforeSale - buyerBalanceAfterSale)
            .to.be.closeTo(10, 0.01);

        expect(marketplaceBalanceAfterSale - marketplaceBalanceBeforeSale)
            .to.be.closeTo(0.25, 0.001);
    });

    it("Should be able to pre sale with lazy mint (ERC721)", async function () {
        expect(await NFT721_e.exists(9)).to.equal(false);

        const sellerBalanceBeforeSale = Number (formatEther(await provider.getBalance(addr1.address)));
        const collaborator1BalanceBeforeSale = Number (formatEther(await provider.getBalance(addr6.address)));
        const collaborator2BalanceBeforeSale = Number (formatEther(await provider.getBalance(addr7.address)));
        const buyerBalanceBeforeSale = Number (formatEther(await provider.getBalance(addr2.address)));
        const marketplaceBalanceBeforeSale = Number (formatEther(await provider.getBalance(marketplace.address)));

        await marketplace.connect(addr2).prePurchase(
            addr1.address,
            NFT721_e.address,
            9,  //tokenId
            0,  //eventId
            1,   //quantity
            {value:parseEther('10')}
        );

        expect(await NFT721_e.ownerOf(9)).to.equal(addr2.address);

        const sellerBalanceAfterSale = Number (formatEther(await provider.getBalance(addr1.address)));
        const collaborator1BalanceAfterSale = Number (formatEther(await provider.getBalance(addr6.address)));
        const collaborator2BalanceAfterSale = Number (formatEther(await provider.getBalance(addr7.address)));
        const buyerBalanceAfterSale = Number (formatEther(await provider.getBalance(addr2.address)));
        const marketplaceBalanceAfterSale = Number (formatEther(await provider.getBalance(marketplace.address)));

        expect(sellerBalanceAfterSale - sellerBalanceBeforeSale)
            .to.be.closeTo(9.25, 0.01);

        expect(collaborator1BalanceAfterSale - collaborator1BalanceBeforeSale)
            .to.be.closeTo(0.25, 0.01);

        expect(collaborator2BalanceAfterSale - collaborator2BalanceBeforeSale)
            .to.be.closeTo(0.25, 0.01);

        expect(buyerBalanceBeforeSale - buyerBalanceAfterSale)
            .to.be.closeTo(10, 0.01);

        expect(marketplaceBalanceAfterSale - marketplaceBalanceBeforeSale)
            .to.be.closeTo(0.25, 0.001);
    });

    it("Should not be able to buy over maximum amount per wallet (ERC721)", async function () {
        await expect(marketplace.connect(addr2).prePurchase(
            addr1.address,
            NFT721_e.address,
            4,  //tokenId
            0,  //eventId
            1,   //quantity
            {value:parseEther('10')}
        )).to.be.revertedWith('Not allowed');
    });

    it("Should be able to set special price for token (ERC721)", async function () {
        await NFT721_e.connect(addr1).setSpecialPriceForToken(0, 4, parseEther('30.0'));
        const info = await NFT721_e.getTokenInfo(addr3.address, 4, 0);
        expect(formatEther(info.tokenPrice)).to.equal('30.0');
    });

    it("Should special price for token work properly (ERC721)", async function () {
        const sellerBalanceBeforeSale = Number (formatEther(await provider.getBalance(addr1.address)));
        const collaborator1BalanceBeforeSale = Number (formatEther(await provider.getBalance(addr6.address)));
        const collaborator2BalanceBeforeSale = Number (formatEther(await provider.getBalance(addr7.address)));
        const buyerBalanceBeforeSale = Number (formatEther(await provider.getBalance(addr3.address)));
        const marketplaceBalanceBeforeSale = Number (formatEther(await provider.getBalance(marketplace.address)));

        await expect(marketplace.connect(addr3).prePurchase(
            addr1.address,
            NFT721_e.address,
            4,  //tokenId
            0,  //eventId
            1,   //quantity
            {value:parseEther('10')}
        )).to.be.revertedWith('Not enough {value}');

        await marketplace.connect(addr3).prePurchase(
            addr1.address,
            NFT721_e.address,
            4,  //tokenId
            0,  //eventId
            1,   //quantity
            {value:parseEther('30')}
        )

        expect(await NFT721_e.ownerOf(4)).to.equal(addr3.address);

        const sellerBalanceAfterSale = Number (formatEther(await provider.getBalance(addr1.address)));
        const collaborator1BalanceAfterSale = Number (formatEther(await provider.getBalance(addr6.address)));
        const collaborator2BalanceAfterSale = Number (formatEther(await provider.getBalance(addr7.address)));
        const buyerBalanceAfterSale = Number (formatEther(await provider.getBalance(addr3.address)));
        const marketplaceBalanceAfterSale = Number (formatEther(await provider.getBalance(marketplace.address)));

        expect(sellerBalanceAfterSale - sellerBalanceBeforeSale)
            .to.be.closeTo(27.75, 0.01);

        expect(collaborator1BalanceAfterSale - collaborator1BalanceBeforeSale)
            .to.be.closeTo(0.75, 0.01);

        expect(collaborator2BalanceAfterSale - collaborator2BalanceBeforeSale)
            .to.be.closeTo(0.75, 0.01);

        expect(buyerBalanceBeforeSale - buyerBalanceAfterSale)
            .to.be.closeTo(30, 0.01);

        expect(marketplaceBalanceAfterSale - marketplaceBalanceBeforeSale)
            .to.be.closeTo(0.75, 0.001);
    });

    it("Should not be able to buy over maximum tokens per event (ERC721)", async function () {
        await expect(marketplace.connect(addr3).prePurchase(
            addr1.address,
            NFT721_e.address,
            5,  //tokenId
            0,  //eventId
            1,   //quantity
            {value:parseEther('10')}
        )).to.be.revertedWith('Not allowed');
    });

    it("Should create Pre Sale Event - ERC20, Private (ERC1155)", async function () {
        const TimeNow = Math.round(new Date()/1000);
        await expect(NFT1155_e.connect(addr3).createPreSaleEvent(
            9,
            5,
            TimeNow+300,
            TimeNow + 3600,
            15,
            parseEther('1'),
            true
        ))
            .to.emit(NFT1155_e,'NewPreSale')
            .withArgs(
                0,
                9,
                5,
                TimeNow+300,
                TimeNow + 3600,
                15,
                parseEther('1'),
                true
            );

        const event = await NFT1155_e.preSaleEventInfo(0);
        expect(event.maxTokensPerWallet).to.equal(9);
        expect(event.maxTokensOfSameIdPerWallet).to.equal(5);
        expect(event.startTime).to.equal(TimeNow+300);
        expect(event.endTime).to.equal(TimeNow + 3600);
        expect(event.maxTokensForEvent).to.equal(15);
        expect(event.tokensSold).to.equal(0);
        expect(event.price).to.equal(parseEther('1'));
        expect(event.whiteList).to.equal(true);

        await NFT1155_e.connect(addr3).setApprovalForAll(marketplace.address, true);
        expect(await NFT1155_e.isApprovedForAll(addr3.address, marketplace.address))
            .to.equal(true);
    });

    it("Should token price be correct and buyer won't be able to buy it (ERC1155)", async function () {
        const info = await NFT1155_e.getTokenInfo(addr2.address, 1, 3, 0);
        expect(formatEther(info.tokenPrice)).to.equal('1.0');
        expect(info.availableForBuyer).to.equal(false);
    });

    it("Should be able to whitelist users", async function () {
        await NFT1155_e.connect(addr3).addToWhitelist(0, addr2.address);
        expect(await NFT1155_e.isAddressWhitelisted(addr2.address, 0)).to.equal(true);
        expect(await NFT1155_e.isAddressWhitelisted(addr1.address, 0)).to.equal(false);
        await NFT1155_e.connect(addr3).addToWhitelist(0, addr1.address);
        expect(await NFT1155_e.isAddressWhitelisted(addr1.address, 0)).to.equal(true);
        await NFT1155_e.connect(addr3).addToWhitelist(0, addr4.address);
        expect(await NFT1155_e.isAddressWhitelisted(addr4.address, 0)).to.equal(true);
    });

    it("Should event start and buyer be able to buy the token (ERC1155)", async function () {
        await provider.send("evm_increaseTime", [650]);
        await provider.send("evm_mine", []);

        const sellerBalanceBeforeSale = Number (formatEther(await ERC20.balanceOf(addr3.address)));
        const buyerBalanceBeforeSale = Number (formatEther(await ERC20.balanceOf(addr2.address)));
        const marketplaceBalanceBeforeSale = Number (formatEther(await ERC20.balanceOf(marketplace.address)));

        expect(await NFT1155_e.balanceOf(addr2.address, 1)).to.equal(0);

        await expect(marketplace.connect(addr2).prePurchase(
            addr3.address,
            NFT1155_e.address,
            1,  //tokenId
            0,  //eventId
            5   //quantity
        )).to.be.revertedWith('Not enough allowance');

        await ERC20.connect(addr2).approve(marketplace.address, parseEther('3.0'));
        await marketplace.connect(addr2).prePurchase(
            addr3.address,
            NFT1155_e.address,
            1,  //tokenId
            0,  //eventId
            3,   //quantity
        );

        expect(await NFT1155_e.balanceOf(addr2.address, 1)).to.equal(3);
        expect(await NFT1155_e.balanceOf(addr3.address, 1)).to.equal(47);

        const sellerBalanceAfterSale = Number (formatEther(await ERC20.balanceOf(addr3.address)));
        const buyerBalanceAfterSale = Number (formatEther(await ERC20.balanceOf(addr2.address)));
        const marketplaceBalanceAfterSale = Number (formatEther(await ERC20.balanceOf(marketplace.address)));

        expect(sellerBalanceAfterSale - sellerBalanceBeforeSale)
            .to.be.closeTo(2.925, 0.01);

        expect(buyerBalanceBeforeSale - buyerBalanceAfterSale)
            .to.be.closeTo(3, 0.01);

        expect(marketplaceBalanceAfterSale - marketplaceBalanceBeforeSale)
            .to.be.closeTo(0.075, 0.001);
    });

    it("Should be able set special price for token (ERC1155)", async function () {
        await NFT1155_e.connect(addr3).setSpecialPriceForToken(0, 2, parseEther('3.0'));
        const info = await NFT1155_e.getTokenInfo(addr3.address, 2, 2, 0);
        expect(formatEther(info.tokenPrice)).to.equal('3.0');
    });

    it("Should special price work (ERC1155)", async function () {
        const sellerBalanceBeforeSale = Number (formatEther(await ERC20.balanceOf(addr3.address)));
        const buyerBalanceBeforeSale = Number (formatEther(await ERC20.balanceOf(addr2.address)));
        const marketplaceBalanceBeforeSale = Number (formatEther(await ERC20.balanceOf(marketplace.address)));

        await ERC20.connect(addr2).approve(marketplace.address, parseEther('9.0'));
        await marketplace.connect(addr2).prePurchase(
            addr3.address,
            NFT1155_e.address,
            2,  //tokenId
            0,  //eventId
            3,   //quantity
        );

        expect(await NFT1155_e.balanceOf(addr2.address, 2)).to.equal(3);
        expect(await NFT1155_e.balanceOf(addr3.address, 2)).to.equal(47);

        const sellerBalanceAfterSale = Number (formatEther(await ERC20.balanceOf(addr3.address)));
        const buyerBalanceAfterSale = Number (formatEther(await ERC20.balanceOf(addr2.address)));
        const marketplaceBalanceAfterSale = Number (formatEther(await ERC20.balanceOf(marketplace.address)));

        expect(sellerBalanceAfterSale - sellerBalanceBeforeSale)
            .to.be.closeTo(8.775, 0.01);

        expect(buyerBalanceBeforeSale - buyerBalanceAfterSale)
            .to.be.closeTo(9, 0.01);

        expect(marketplaceBalanceAfterSale - marketplaceBalanceBeforeSale)
            .to.be.closeTo(0.225, 0.001);
    });

    it("Should not be able to buy over maximum tokens ID amount (ERC1155)", async function () {
        await ERC20.connect(addr2).approve(marketplace.address, parseEther('3.0'));
        await expect(marketplace.connect(addr2).prePurchase(
            addr3.address,
            NFT1155_e.address,
            1,  //tokenId
            0,  //eventId
            3,   //quantity
        )).to.be.revertedWith('Not allowed');
    });

    it("Should not be able to buy over maximum tokens per wallet (ERC1155)", async function () {
        await expect(marketplace.connect(addr2).prePurchase(
            addr3.address,
            NFT1155_e.address,
            5,  //tokenId
            0,  //eventId
            4,   //quantity
        )).to.be.revertedWith('Not allowed');
    });

    it("Should be able to buy just the right amount (ERC1155)", async function () {
        const sellerBalanceBeforeSale = Number (formatEther(await ERC20.balanceOf(addr3.address)));
        const buyerBalanceBeforeSale = Number (formatEther(await ERC20.balanceOf(addr2.address)));
        const marketplaceBalanceBeforeSale = Number (formatEther(await ERC20.balanceOf(marketplace.address)));

        await marketplace.connect(addr2).prePurchase(
            addr3.address,
            NFT1155_e.address,
            5,  //tokenId
            0,  //eventId
            3,   //quantity
        );

        expect(await NFT1155_e.balanceOf(addr2.address, 5)).to.equal(3);

        const sellerBalanceAfterSale = Number (formatEther(await ERC20.balanceOf(addr3.address)));
        const buyerBalanceAfterSale = Number (formatEther(await ERC20.balanceOf(addr2.address)));
        const marketplaceBalanceAfterSale = Number (formatEther(await ERC20.balanceOf(marketplace.address)));

        expect(sellerBalanceAfterSale - sellerBalanceBeforeSale)
            .to.be.closeTo(2.925, 0.01);

        expect(buyerBalanceBeforeSale - buyerBalanceAfterSale)
            .to.be.closeTo(3, 0.01);

        expect(marketplaceBalanceAfterSale - marketplaceBalanceBeforeSale)
            .to.be.closeTo(0.075, 0.001);
    });

    it("Should be able to pre sale with lazy minting (ERC1155)", async function () {
        const sellerBalanceBeforeSale = Number (formatEther(await ERC20.balanceOf(addr3.address)));
        const buyerBalanceBeforeSale = Number (formatEther(await ERC20.balanceOf(addr1.address)));
        const marketplaceBalanceBeforeSale = Number (formatEther(await ERC20.balanceOf(marketplace.address)));

        expect(await NFT1155_e.balanceOf(addr1.address, 10)).to.equal(0);
        expect(await NFT1155_e.balanceOf(addr3.address, 10)).to.equal(0);

        await expect(marketplace.connect(addr1).prePurchase(
            addr3.address,
            NFT1155_e.address,
            10,  //tokenId
            0,  //eventId
            2   //quantity
        )).to.be.revertedWith('Not enough allowance');

        await ERC20.connect(addr1).approve(marketplace.address, parseEther('3.0'));
        await marketplace.connect(addr1).prePurchase(
            addr3.address,
            NFT1155_e.address,
            10,  //tokenId
            0,  //eventId
            2,   //quantity
        );

        expect(await NFT1155_e.balanceOf(addr1.address, 10)).to.equal(2);

        const sellerBalanceAfterSale = Number (formatEther(await ERC20.balanceOf(addr3.address)));
        const buyerBalanceAfterSale = Number (formatEther(await ERC20.balanceOf(addr1.address)));
        const marketplaceBalanceAfterSale = Number (formatEther(await ERC20.balanceOf(marketplace.address)));

        expect(sellerBalanceAfterSale - sellerBalanceBeforeSale)
            .to.be.closeTo(1.95, 0.01);

        expect(buyerBalanceBeforeSale - buyerBalanceAfterSale)
            .to.be.closeTo(2, 0.01);

        expect(marketplaceBalanceAfterSale - marketplaceBalanceBeforeSale)
            .to.be.closeTo(0.05, 0.001);
    });

    it("Should not be able to buy over maximum tokens per event (ERC1155)", async function () {
        await ERC20.connect(addr1).approve(marketplace.address, parseEther('5.0'));
        await expect(marketplace.connect(addr1).prePurchase(
            addr3.address,
            NFT1155_e.address,
            4,  //tokenId
            0,  //eventId
            5,   //quantity
        )).to.be.revertedWith('Not allowed');
    });

    it("Should be able to set default royalty distribution (ERC721)", async function () {
        const collaborators = [addr6.address, addr7.address];
        const shares = [2500, 2500];
        await NFT1155_e.connect(addr3).setDefaultRoyaltyDistribution(collaborators, shares);
    });

    it("Should Pre Sale work with distributed royalties (ERC1155)", async function () {
        const sellerBalanceBeforeSale = Number (formatEther(await ERC20.balanceOf(addr3.address)));
        const collaborator1BalanceBeforeSale = Number (formatEther(await ERC20.balanceOf(addr6.address)));
        const collaborator2BalanceBeforeSale = Number (formatEther(await ERC20.balanceOf(addr7.address)));
        const buyerBalanceBeforeSale = Number (formatEther(await ERC20.balanceOf(addr1.address)));
        const marketplaceBalanceBeforeSale = Number (formatEther(await ERC20.balanceOf(marketplace.address)));

        await marketplace.connect(addr1).prePurchase(
            addr3.address,
            NFT1155_e.address,
            4,  //tokenId
            0,  //eventId
            4,   //quantity
        );

        expect(await NFT1155_e.balanceOf(addr1.address, 4)).to.equal(4);

        const sellerBalanceAfterSale = Number (formatEther(await ERC20.balanceOf(addr3.address)));
        const collaborator1BalanceAfterSale = Number (formatEther(await ERC20.balanceOf(addr6.address)));
        const collaborator2BalanceAfterSale = Number (formatEther(await ERC20.balanceOf(addr7.address)));
        const buyerBalanceAfterSale = Number (formatEther(await ERC20.balanceOf(addr1.address)));
        const marketplaceBalanceAfterSale = Number (formatEther(await ERC20.balanceOf(marketplace.address)));

        expect(sellerBalanceAfterSale - sellerBalanceBeforeSale)
            .to.be.closeTo(3.7, 0.01);

        expect(collaborator1BalanceAfterSale - collaborator1BalanceBeforeSale)
            .to.be.closeTo(0.1, 0.01);

        expect(collaborator2BalanceAfterSale - collaborator2BalanceBeforeSale)
            .to.be.closeTo(0.1, 0.01);

        expect(buyerBalanceBeforeSale - buyerBalanceAfterSale)
            .to.be.closeTo(4, 0.01);

        expect(marketplaceBalanceAfterSale - marketplaceBalanceBeforeSale)
            .to.be.closeTo(0.1, 0.001);
    });

    it("Revert EVM state", async function () {
        await provider.send("evm_revert", [snapshotId_1]);
    });

});
describe('Royalty distribution', () => {

    it("Should mint tokens for test", async function () {
        await NFT721.connect(addr1).mint(addr4.address, 21);
        expect(await NFT721.tokenURI(21)).to.equal('http://uri.net/'+21);
        expect(await NFT721.ownerOf(21)).to.equal(addr4.address);

        await NFT1155.connect(addr3).mint(addr7.address, 21, 10);
        expect(await NFT1155.balanceOf(addr7.address, 21)).to.equal(10);
    });

    it("Should user be able to set token royalty distribution (ERC721)", async function () {
        await NFT721.connect(addr1).setTokenRoyaltyDistribution(
            [addr2.address, addr3.address],
            [2500, 2500],
            20
        );

        const tokenRoyaltyDistributions = await NFT721.getTokenRoyaltyDistribution(20);
        expect(tokenRoyaltyDistributions[0].collaborator).to.equal(addr2.address);
        expect(tokenRoyaltyDistributions[0].share).to.equal(2500);
        expect(tokenRoyaltyDistributions[1].collaborator).to.equal(addr3.address);
        expect(tokenRoyaltyDistributions[1].share).to.equal(2500);
    });

    it("Should user be able to set default royalty distribution (ERC721)", async function () {
        await NFT721.connect(addr1).setDefaultRoyaltyDistribution(
            [addr6.address, addr7.address],
            [2500, 2500]
        );

        const defaultRoyaltyDistribution = await NFT721.getDefaultRoyaltyDistribution();
        expect(defaultRoyaltyDistribution[0].collaborator).to.equal(addr6.address);
        expect(defaultRoyaltyDistribution[0].share).to.equal(2500);
        expect(defaultRoyaltyDistribution[1].collaborator).to.equal(addr7.address);
        expect(defaultRoyaltyDistribution[1].share).to.equal(2500);
    });

    it("Should lazy mint of ERC721 (buy now) work with individual token royalty distribution", async function () {
        await NFT721.connect(addr1).setApprovalForAll(marketplace.address, true);

        const sellerBalanceBeforeSale = Number (formatEther(await provider.getBalance(addr1.address)));
        const buyerBalanceBeforeSale = Number (formatEther(await provider.getBalance(addr6.address)));
        const royaltyReceiverN1BalanceBeforeSale = Number (formatEther(await provider.getBalance(addr2.address)));
        const royaltyReceiverN2BalanceBeforeSale = Number (formatEther(await provider.getBalance(addr3.address)));
        const marketplaceBalanceBeforeSale = Number (formatEther(await provider.getBalance(marketplace.address)));

        const TIME = Math.round(new Date()/1000 + 3600);
        const sellerOrder = [
            addr1.address, NFT721.address,
            20,1,0,
            '0x0000000000000000000000000000000000000000',   //ETH
            parseEther('10.0'),
            TIME,[],[],Math.round(Math.random()*1000)
        ];
        const sellerSig = await getSignature(addr1, ...sellerOrder);

        const buyerOrder = [
            addr6.address, NFT721.address,
            20,1,0,
            '0x0000000000000000000000000000000000000000',   //ETH
            parseEther('10.0'),
            TIME,[],[],Math.round(Math.random()*1000)
        ];

        await marketplace.connect(addr6).completeOrder(
            sellerOrder,
            sellerSig,
            buyerOrder,
            sellerSig,      //buyer signature is unnecessary when buy out
            {value: parseEther('10.0')}
        );

        const sellerBalanceAfterSale = Number (formatEther(await provider.getBalance(addr1.address)));
        const buyerBalanceAfterSale = Number (formatEther(await provider.getBalance(addr6.address)));
        const royaltyReceiverN1BalanceAfterSale = Number (formatEther(await provider.getBalance(addr2.address)));
        const royaltyReceiverN2BalanceAfterSale = Number (formatEther(await provider.getBalance(addr3.address)));
        const marketplaceBalanceAfterSale = Number (formatEther(await provider.getBalance(marketplace.address)));

        expect(await NFT721.ownerOf(20)).to.equal(addr6.address);

        expect(sellerBalanceAfterSale - sellerBalanceBeforeSale)
            .to.be.closeTo(9.25, 0.01);
        expect(royaltyReceiverN1BalanceAfterSale - royaltyReceiverN1BalanceBeforeSale)
            .to.be.closeTo(0.25, 0.01);
        expect(royaltyReceiverN2BalanceAfterSale - royaltyReceiverN2BalanceBeforeSale)
            .to.be.closeTo(0.25, 0.01);
        expect(buyerBalanceBeforeSale - buyerBalanceAfterSale)
            .to.be.closeTo(10, 0.01);
        expect(marketplaceBalanceAfterSale - marketplaceBalanceBeforeSale)
            .to.be.closeTo(0.25, 0.001);
    });

    it("Should reselling of ERC721 (auction) work with individual token royalty distribution", async function () {
        await NFT721.connect(addr6).setApprovalForAll(marketplace.address, true);

        const sellerBalanceBeforeSale = Number (formatEther(await ERC20.balanceOf(addr6.address)));
        const buyerBalanceBeforeSale = Number (formatEther(await ERC20.balanceOf(addr5.address)));
        const mainRoyaltyReceiverBalanceBeforeSale = Number (formatEther(await ERC20.balanceOf(addr1.address)));
        const royaltyReceiverN1BalanceBeforeSale = Number (formatEther(await ERC20.balanceOf(addr2.address)));
        const royaltyReceiverN2BalanceBeforeSale = Number (formatEther(await ERC20.balanceOf(addr3.address)));
        const marketplaceBalanceBeforeSale = Number (formatEther(await ERC20.balanceOf(marketplace.address)));

        const TIME = Math.round(new Date()/1000 + 3600);
        const sellerOrder = [
            addr6.address, NFT721.address,
            20,1,1,
            ERC20.address,
            parseEther('10.0'),
            TIME-3700,[],[],Math.round(Math.random()*1000)
        ];
        const sellerSig = await getSignature(addr6, ...sellerOrder);

        await ERC20.connect(addr5).approve(marketplace.address, parseEther('10.0'));
        const buyerOrder = [
            addr5.address, NFT721.address,
            20,1,1,
            ERC20.address,
            parseEther('10.0'),
            TIME,[],[],Math.round(Math.random()*1000)
        ];
        const buyerSig = await getSignature(addr5, ...buyerOrder);

        await marketplace.connect(addr6).completeOrder(
            sellerOrder,
            buyerSig,       //accepting offer does not require valid sellers signature
            buyerOrder,
            buyerSig
        );

        const sellerBalanceAfterSale = Number (formatEther(await ERC20.balanceOf(addr6.address)));
        const buyerBalanceAfterSale = Number (formatEther(await ERC20.balanceOf(addr5.address)));
        const mainRoyaltyReceiverBalanceAfterSale = Number (formatEther(await ERC20.balanceOf(addr1.address)));
        const royaltyReceiverN1BalanceAfterSale = Number (formatEther(await ERC20.balanceOf(addr2.address)));
        const royaltyReceiverN2BalanceAfterSale = Number (formatEther(await ERC20.balanceOf(addr3.address)));
        const marketplaceBalanceAfterSale = Number (formatEther(await ERC20.balanceOf(marketplace.address)));

        expect(await NFT721.ownerOf(20)).to.equal(addr5.address);

        expect(sellerBalanceAfterSale - sellerBalanceBeforeSale)
            .to.be.closeTo(8.75, 0.01);
        expect(mainRoyaltyReceiverBalanceAfterSale - mainRoyaltyReceiverBalanceBeforeSale)
            .to.be.closeTo(0.5, 0.01);
        expect(royaltyReceiverN1BalanceAfterSale - royaltyReceiverN1BalanceBeforeSale)
            .to.be.closeTo(0.25, 0.01);
        expect(royaltyReceiverN2BalanceAfterSale - royaltyReceiverN2BalanceBeforeSale)
            .to.be.closeTo(0.25, 0.01);
        expect(buyerBalanceBeforeSale - buyerBalanceAfterSale)
            .to.be.closeTo(10, 0.01);
        expect(marketplaceBalanceAfterSale - marketplaceBalanceBeforeSale)
            .to.be.closeTo(0.25, 0.001);
    });

    it("Should buy now of ERC721 work with default royalty distribution", async function () {
        expect(await NFT721.ownerOf(21)).to.equal(addr4.address);

        const sellerBalanceBeforeSale = Number (formatEther(await provider.getBalance(addr4.address)));
        const buyerBalanceBeforeSale = Number (formatEther(await provider.getBalance(addr5.address)));
        const mainRoyaltyReceiverBalanceBeforeSale = Number (formatEther(await provider.getBalance(addr1.address)));
        const royaltyReceiverN1BalanceBeforeSale = Number (formatEther(await provider.getBalance(addr6.address)));
        const royaltyReceiverN2BalanceBeforeSale = Number (formatEther(await provider.getBalance(addr7.address)));
        const marketplaceBalanceBeforeSale = Number (formatEther(await provider.getBalance(marketplace.address)));

        const TIME = Math.round(new Date()/1000 + 3600);
        const sellerOrder = [
            addr4.address, NFT721.address,
            21,1,0,
            '0x0000000000000000000000000000000000000000',   //ETH
            parseEther('10.0'),
            TIME,[],[],Math.round(Math.random()*1000)
        ];
        const sellerSig = await getSignature(addr4, ...sellerOrder);

        const buyerOrder = [
            addr5.address, NFT721.address,
            21,1,0,
            '0x0000000000000000000000000000000000000000',   //ETH
            parseEther('10.0'),
            TIME,[],[],Math.round(Math.random()*1000)
        ];

        await marketplace.connect(addr5).completeOrder(
            sellerOrder,
            sellerSig,
            buyerOrder,
            sellerSig,      //buyer signature is unnecessary when buy out
            {value: parseEther('10.0')}
        );

        const sellerBalanceAfterSale = Number (formatEther(await provider.getBalance(addr4.address)));
        const buyerBalanceAfterSale = Number (formatEther(await provider.getBalance(addr5.address)));
        const mainRoyaltyReceiverBalanceAfterSale = Number (formatEther(await provider.getBalance(addr1.address)));
        const royaltyReceiverN1BalanceAfterSale = Number (formatEther(await provider.getBalance(addr6.address)));
        const royaltyReceiverN2BalanceAfterSale = Number (formatEther(await provider.getBalance(addr7.address)));
        const marketplaceBalanceAfterSale = Number (formatEther(await provider.getBalance(marketplace.address)));

        expect(await NFT721.ownerOf(21)).to.equal(addr5.address);

        expect(sellerBalanceAfterSale - sellerBalanceBeforeSale)
            .to.be.closeTo(8.75, 0.01);
        expect(mainRoyaltyReceiverBalanceAfterSale - mainRoyaltyReceiverBalanceBeforeSale)
            .to.be.closeTo(0.5, 0.01);
        expect(royaltyReceiverN1BalanceAfterSale - royaltyReceiverN1BalanceBeforeSale)
            .to.be.closeTo(0.25, 0.01);
        expect(royaltyReceiverN2BalanceAfterSale - royaltyReceiverN2BalanceBeforeSale)
            .to.be.closeTo(0.25, 0.01);
        expect(buyerBalanceBeforeSale - buyerBalanceAfterSale)
            .to.be.closeTo(10, 0.01);
        expect(marketplaceBalanceAfterSale - marketplaceBalanceBeforeSale)
            .to.be.closeTo(0.25, 0.001);
    });

    it("Should be able to set custom royalty for token (ERC721)", async function () {
        await NFT721.connect(addr1).setTokenRoyalty(5000, 22);
    });

    it("Should custom royalty for token work (ERC721)", async function () {
        const sellerBalanceBeforeSale = Number (formatEther(await provider.getBalance(addr1.address)));
        const buyerBalanceBeforeSale = Number (formatEther(await provider.getBalance(addr4.address)));
        const royaltyReceiverN1BalanceBeforeSale = Number (formatEther(await provider.getBalance(addr6.address)));
        const royaltyReceiverN2BalanceBeforeSale = Number (formatEther(await provider.getBalance(addr7.address)));
        const marketplaceBalanceBeforeSale = Number (formatEther(await provider.getBalance(marketplace.address)));

        const TIME = Math.round(new Date()/1000 + 3600);
        const sellerOrder = [
            addr1.address, NFT721.address,
            22,1,0,
            '0x0000000000000000000000000000000000000000',   //ETH
            parseEther('10.0'),
            TIME,[],[],Math.round(Math.random()*1000)
        ];
        const sellerSig = await getSignature(addr1, ...sellerOrder);

        const buyerOrder = [
            addr4.address, NFT721.address,
            22,1,0,
            '0x0000000000000000000000000000000000000000',   //ETH
            parseEther('10.0'),
            TIME,[],[],Math.round(Math.random()*1000)
        ];

        await marketplace.connect(addr4).completeOrder(
            sellerOrder,
            sellerSig,
            buyerOrder,
            sellerSig,      //buyer signature is unnecessary when buy out
            {value: parseEther('10.0')}
        );

        const sellerBalanceAfterSale = Number (formatEther(await provider.getBalance(addr1.address)));
        const buyerBalanceAfterSale = Number (formatEther(await provider.getBalance(addr4.address)));
        const royaltyReceiverN1BalanceAfterSale = Number (formatEther(await provider.getBalance(addr6.address)));
        const royaltyReceiverN2BalanceAfterSale = Number (formatEther(await provider.getBalance(addr7.address)));
        const marketplaceBalanceAfterSale = Number (formatEther(await provider.getBalance(marketplace.address)));

        expect(await NFT721.ownerOf(22)).to.equal(addr4.address);

        expect(sellerBalanceAfterSale - sellerBalanceBeforeSale)
            .to.be.closeTo(7.25, 0.01);
        expect(royaltyReceiverN1BalanceAfterSale - royaltyReceiverN1BalanceBeforeSale)
            .to.be.closeTo(1.25, 0.01);
        expect(royaltyReceiverN2BalanceAfterSale - royaltyReceiverN2BalanceBeforeSale)
            .to.be.closeTo(1.25, 0.01);
        expect(buyerBalanceBeforeSale - buyerBalanceAfterSale)
            .to.be.closeTo(10, 0.01);
        expect(marketplaceBalanceAfterSale - marketplaceBalanceBeforeSale)
            .to.be.closeTo(0.25, 0.001);
    });

    it("Should user be able to set token royalty distribution (ERC1155)", async function () {
        await NFT1155.connect(addr3).setTokenRoyaltyDistribution(
            [addr1.address, addr2.address],
            [2500, 2500],
            20
        );

        const tokenRoyaltyDistributions = await NFT1155.getTokenRoyaltyDistribution(20);
        expect(tokenRoyaltyDistributions[0].collaborator).to.equal(addr1.address);
        expect(tokenRoyaltyDistributions[0].share).to.equal(2500);
        expect(tokenRoyaltyDistributions[1].collaborator).to.equal(addr2.address);
        expect(tokenRoyaltyDistributions[1].share).to.equal(2500);
    });

    it("Should user be able to set default royalty distribution (ERC1155)", async function () {
        await NFT1155.connect(addr3).setDefaultRoyaltyDistribution(
            [addr5.address, addr6.address],
            [2500, 2500]
        );

        const defaultRoyaltyDistribution = await NFT1155.getDefaultRoyaltyDistribution();
        expect(defaultRoyaltyDistribution[0].collaborator).to.equal(addr5.address);
        expect(defaultRoyaltyDistribution[0].share).to.equal(2500);
        expect(defaultRoyaltyDistribution[1].collaborator).to.equal(addr6.address);
        expect(defaultRoyaltyDistribution[1].share).to.equal(2500);
    });

    it("Should lazy mint of ERC1155 (buy now) work with individual token royalty distribution", async function () {
        await NFT1155.connect(addr3).setApprovalForAll(marketplace.address, true);
        expect(await NFT1155.balanceOf(addr3.address, 20)).to.equal(0);
        expect(await NFT1155.balanceOf(addr6.address, 20)).to.equal(0);

        const sellerBalanceBeforeSale = Number (formatEther(await provider.getBalance(addr3.address)));
        const buyerBalanceBeforeSale = Number (formatEther(await provider.getBalance(addr6.address)));
        const royaltyReceiverN1BalanceBeforeSale = Number (formatEther(await provider.getBalance(addr1.address)));
        const royaltyReceiverN2BalanceBeforeSale = Number (formatEther(await provider.getBalance(addr2.address)));
        const marketplaceBalanceBeforeSale = Number (formatEther(await provider.getBalance(marketplace.address)));

        const TIME = Math.round(new Date()/1000 + 3600);
        const sellerOrder = [
            addr3.address, NFT1155.address,
            20,10,0,
            '0x0000000000000000000000000000000000000000',   //ETH
            parseEther('1.0'),
            TIME,[],[],Math.round(Math.random()*1000)
        ];
        const sellerSig = await getSignature(addr3, ...sellerOrder);

        const buyerOrder = [
            addr6.address, NFT1155.address,
            20,10,0,
            '0x0000000000000000000000000000000000000000',   //ETH
            parseEther('10.0'),
            TIME,[],[],Math.round(Math.random()*1000)
        ];

        await marketplace.connect(addr6).completeOrder(
            sellerOrder,
            sellerSig,
            buyerOrder,
            sellerSig,      //buyer signature is unnecessary when buy out
            {value: parseEther('10.0')}
        );

        const sellerBalanceAfterSale = Number (formatEther(await provider.getBalance(addr3.address)));
        const buyerBalanceAfterSale = Number (formatEther(await provider.getBalance(addr6.address)));
        const royaltyReceiverN1BalanceAfterSale = Number (formatEther(await provider.getBalance(addr1.address)));
        const royaltyReceiverN2BalanceAfterSale = Number (formatEther(await provider.getBalance(addr2.address)));
        const marketplaceBalanceAfterSale = Number (formatEther(await provider.getBalance(marketplace.address)));

        expect(await NFT1155.balanceOf(addr6.address, 20)).to.equal(10);

        expect(sellerBalanceAfterSale - sellerBalanceBeforeSale)
            .to.be.closeTo(9.25, 0.01);
        expect(royaltyReceiverN1BalanceAfterSale - royaltyReceiverN1BalanceBeforeSale)
            .to.be.closeTo(0.25, 0.01);
        expect(royaltyReceiverN2BalanceAfterSale - royaltyReceiverN2BalanceBeforeSale)
            .to.be.closeTo(0.25, 0.01);
        expect(buyerBalanceBeforeSale - buyerBalanceAfterSale)
            .to.be.closeTo(10, 0.01);
        expect(marketplaceBalanceAfterSale - marketplaceBalanceBeforeSale)
            .to.be.closeTo(0.25, 0.001);
    });

    it("Should reselling of ERC1155 (auction) work with individual token royalty distribution", async function () {
        await NFT1155.connect(addr6).setApprovalForAll(marketplace.address, true);
        expect(await NFT1155.balanceOf(addr6.address, 20)).to.equal(10);

        const sellerBalanceBeforeSale = Number (formatEther(await ERC20.balanceOf(addr6.address)));
        const buyerBalanceBeforeSale = Number (formatEther(await ERC20.balanceOf(addr5.address)));
        const mainRoyaltyReceiverBalanceBeforeSale = Number (formatEther(await ERC20.balanceOf(addr3.address)));
        const royaltyReceiverN1BalanceBeforeSale = Number (formatEther(await ERC20.balanceOf(addr1.address)));
        const royaltyReceiverN2BalanceBeforeSale = Number (formatEther(await ERC20.balanceOf(addr2.address)));
        const marketplaceBalanceBeforeSale = Number (formatEther(await ERC20.balanceOf(marketplace.address)));

        const TIME = Math.round(new Date()/1000 + 3600);
        const sellerOrder = [
            addr6.address, NFT1155.address,
            20,10,1,
            ERC20.address,
            parseEther('1.0'),
            TIME,[],[],Math.round(Math.random()*1000)
        ];
        const sellerSig = await getSignature(addr6, ...sellerOrder);

        await ERC20.connect(addr5).approve(marketplace.address, parseEther('10.0'));
        const buyerOrder = [
            addr5.address, NFT1155.address,
            20,10,1,
            ERC20.address,
            parseEther('10.0'),
            TIME,[],[],Math.round(Math.random()*1000)
        ];
        const buyerSig = await getSignature(addr5, ...buyerOrder);

        await marketplace.connect(addr6).completeOrder(
            sellerOrder,
            buyerSig,      //accepting offer does not require valid sellers signature
            buyerOrder,
            buyerSig
        );

        const sellerBalanceAfterSale = Number (formatEther(await ERC20.balanceOf(addr6.address)));
        const buyerBalanceAfterSale = Number (formatEther(await ERC20.balanceOf(addr5.address)));
        const mainRoyaltyReceiverBalanceAfterSale = Number (formatEther(await ERC20.balanceOf(addr3.address)));
        const royaltyReceiverN1BalanceAfterSale = Number (formatEther(await ERC20.balanceOf(addr1.address)));
        const royaltyReceiverN2BalanceAfterSale = Number (formatEther(await ERC20.balanceOf(addr2.address)));
        const marketplaceBalanceAfterSale = Number (formatEther(await ERC20.balanceOf(marketplace.address)));

        expect(await NFT1155.balanceOf(addr5.address, 20)).to.equal(10);

        expect(sellerBalanceAfterSale - sellerBalanceBeforeSale)
            .to.be.closeTo(8.75, 0.01);
        expect(mainRoyaltyReceiverBalanceAfterSale - mainRoyaltyReceiverBalanceBeforeSale)
            .to.be.closeTo(0.5, 0.01);
        expect(royaltyReceiverN1BalanceAfterSale - royaltyReceiverN1BalanceBeforeSale)
            .to.be.closeTo(0.25, 0.01);
        expect(royaltyReceiverN2BalanceAfterSale - royaltyReceiverN2BalanceBeforeSale)
            .to.be.closeTo(0.25, 0.01);
        expect(buyerBalanceBeforeSale - buyerBalanceAfterSale)
            .to.be.closeTo(10, 0.01);
        expect(marketplaceBalanceAfterSale - marketplaceBalanceBeforeSale)
            .to.be.closeTo(0.25, 0.001);
    });

    it("Should buy of ERC1155 work with default token royalty distribution", async function () {
        await NFT1155.connect(addr7).setApprovalForAll(marketplace.address, true);
        expect(await NFT1155.balanceOf(addr7.address, 21)).to.equal(10);
        expect(await NFT1155.balanceOf(addr4.address, 21)).to.equal(0);

        const sellerBalanceBeforeSale = Number (formatEther(await provider.getBalance(addr7.address)));
        const buyerBalanceBeforeSale = Number (formatEther(await provider.getBalance(addr4.address)));
        const mainRoyaltyReceiverBalanceBeforeSale = Number (formatEther(await provider.getBalance(addr3.address)));
        const royaltyReceiverN1BalanceBeforeSale = Number (formatEther(await provider.getBalance(addr5.address)));
        const royaltyReceiverN2BalanceBeforeSale = Number (formatEther(await provider.getBalance(addr6.address)));
        const marketplaceBalanceBeforeSale = Number (formatEther(await provider.getBalance(marketplace.address)));

        const TIME = Math.round(new Date()/1000 + 3600);
        const sellerOrder = [
            addr7.address, NFT1155.address,
            21,10,0,
            '0x0000000000000000000000000000000000000000',   //ETH
            parseEther('1.0'),
            TIME,[],[],Math.round(Math.random()*1000)
        ];
        const sellerSig = await getSignature(addr7, ...sellerOrder);

        const buyerOrder = [
            addr4.address, NFT1155.address,
            21,10,0,
            '0x0000000000000000000000000000000000000000',   //ETH
            parseEther('10.0'),
            TIME,[],[],Math.round(Math.random()*1000)
        ];

        await marketplace.connect(addr4).completeOrder(
            sellerOrder,
            sellerSig,
            buyerOrder,
            sellerSig,      //buyer signature is unnecessary when buy out
            {value: parseEther('10.0')}
        );

        const sellerBalanceAfterSale = Number (formatEther(await provider.getBalance(addr7.address)));
        const buyerBalanceAfterSale = Number (formatEther(await provider.getBalance(addr4.address)));
        const mainRoyaltyReceiverBalanceAfterSale = Number (formatEther(await provider.getBalance(addr3.address)));
        const royaltyReceiverN1BalanceAfterSale = Number (formatEther(await provider.getBalance(addr5.address)));
        const royaltyReceiverN2BalanceAfterSale = Number (formatEther(await provider.getBalance(addr6.address)));
        const marketplaceBalanceAfterSale = Number (formatEther(await provider.getBalance(marketplace.address)));

        expect(await NFT1155.balanceOf(addr4.address, 21)).to.equal(10);

        expect(sellerBalanceAfterSale - sellerBalanceBeforeSale)
            .to.be.closeTo(8.75, 0.01);
        expect(mainRoyaltyReceiverBalanceAfterSale - mainRoyaltyReceiverBalanceBeforeSale)
            .to.be.closeTo(0.5, 0.01);
        expect(royaltyReceiverN1BalanceAfterSale - royaltyReceiverN1BalanceBeforeSale)
            .to.be.closeTo(0.25, 0.01);
        expect(royaltyReceiverN2BalanceAfterSale - royaltyReceiverN2BalanceBeforeSale)
            .to.be.closeTo(0.25, 0.01);
        expect(buyerBalanceBeforeSale - buyerBalanceAfterSale)
            .to.be.closeTo(10, 0.01);
        expect(marketplaceBalanceAfterSale - marketplaceBalanceBeforeSale)
            .to.be.closeTo(0.25, 0.001);
    });

    it("Should be able to set custom royalty for token (ERC1155)", async function () {
        await NFT1155.connect(addr3).setTokenRoyalty(5000, 22);
    });

    it("Should custom royalty for token work (ERC1155)", async function () {
        const sellerBalanceBeforeSale = Number (formatEther(await provider.getBalance(addr3.address)));
        const buyerBalanceBeforeSale = Number (formatEther(await provider.getBalance(addr4.address)));
        const royaltyReceiverN1BalanceBeforeSale = Number (formatEther(await provider.getBalance(addr5.address)));
        const royaltyReceiverN2BalanceBeforeSale = Number (formatEther(await provider.getBalance(addr6.address)));
        const marketplaceBalanceBeforeSale = Number (formatEther(await provider.getBalance(marketplace.address)));

        const TIME = Math.round(new Date()/1000 + 3600);
        const sellerOrder = [
            addr3.address, NFT1155.address,
            22,10,0,
            '0x0000000000000000000000000000000000000000',   //ETH
            parseEther('1.0'),
            TIME,[],[],Math.round(Math.random()*1000)
        ];
        const sellerSig = await getSignature(addr3, ...sellerOrder);

        const buyerOrder = [
            addr4.address, NFT1155.address,
            22,10,0,
            '0x0000000000000000000000000000000000000000',   //ETH
            parseEther('10.0'),
            TIME,[],[],Math.round(Math.random()*1000)
        ];

        await marketplace.connect(addr4).completeOrder(
            sellerOrder,
            sellerSig,
            buyerOrder,
            sellerSig,      //buyer signature is unnecessary when buy out
            {value: parseEther('10.0')}
        );

        const sellerBalanceAfterSale = Number (formatEther(await provider.getBalance(addr3.address)));
        const buyerBalanceAfterSale = Number (formatEther(await provider.getBalance(addr4.address)));
        const royaltyReceiverN1BalanceAfterSale = Number (formatEther(await provider.getBalance(addr5.address)));
        const royaltyReceiverN2BalanceAfterSale = Number (formatEther(await provider.getBalance(addr6.address)));
        const marketplaceBalanceAfterSale = Number (formatEther(await provider.getBalance(marketplace.address)));

        expect(await NFT1155.balanceOf(addr4.address, 22)).to.equal(10);

        expect(sellerBalanceAfterSale - sellerBalanceBeforeSale)
            .to.be.closeTo(7.25, 0.01);
        expect(royaltyReceiverN1BalanceAfterSale - royaltyReceiverN1BalanceBeforeSale)
            .to.be.closeTo(1.25, 0.01);
        expect(royaltyReceiverN2BalanceAfterSale - royaltyReceiverN2BalanceBeforeSale)
            .to.be.closeTo(1.25, 0.01);
        expect(buyerBalanceBeforeSale - buyerBalanceAfterSale)
            .to.be.closeTo(10, 0.01);
        expect(marketplaceBalanceAfterSale - marketplaceBalanceBeforeSale)
            .to.be.closeTo(0.25, 0.001);
    });

    it("Should user be able to set individual token royalty amount (ERC721)", async function () {
        await NFT721.connect(addr1).setTokenRoyalty(500, 21);

        expect(await NFT721.tokenRoyalty(21)).to.equal(500);
    });

    it("Should token lower royalty amount work properly (ERC721)", async function () {
        await NFT721.connect(addr5).setApprovalForAll(marketplace.address, true);
        expect(await NFT721.ownerOf(21)).to.equal(addr5.address);

        const sellerBalanceBeforeSale = Number (formatEther(await provider.getBalance(addr5.address)));
        const buyerBalanceBeforeSale = Number (formatEther(await provider.getBalance(addr4.address)));
        const mainRoyaltyReceiverBalanceBeforeSale = Number (formatEther(await provider.getBalance(addr1.address)));
        const royaltyReceiverN1BalanceBeforeSale = Number (formatEther(await provider.getBalance(addr6.address)));
        const royaltyReceiverN2BalanceBeforeSale = Number (formatEther(await provider.getBalance(addr7.address)));
        const marketplaceBalanceBeforeSale = Number (formatEther(await provider.getBalance(marketplace.address)));

        const TIME = Math.round(new Date()/1000 + 3600);
        const sellerOrder = [
            addr5.address, NFT721.address,
            21,1,0,
            '0x0000000000000000000000000000000000000000',   //ETH
            parseEther('10.0'),
            TIME,[],[],Math.round(Math.random()*1000)
        ];
        const sellerSig = await getSignature(addr5, ...sellerOrder);

        const buyerOrder = [
            addr4.address, NFT721.address,
            21,1,0,
            '0x0000000000000000000000000000000000000000',   //ETH
            parseEther('10.0'),
            TIME,[],[],Math.round(Math.random()*1000)
        ];

        await marketplace.connect(addr4).completeOrder(
            sellerOrder,
            sellerSig,
            buyerOrder,
            sellerSig,      //buyer signature is unnecessary when buy out
            {value: parseEther('10.0')}
        );

        const sellerBalanceAfterSale = Number (formatEther(await provider.getBalance(addr5.address)));
        const buyerBalanceAfterSale = Number (formatEther(await provider.getBalance(addr4.address)));
        const mainRoyaltyReceiverBalanceAfterSale = Number (formatEther(await provider.getBalance(addr1.address)));
        const royaltyReceiverN1BalanceAfterSale = Number (formatEther(await provider.getBalance(addr6.address)));
        const royaltyReceiverN2BalanceAfterSale = Number (formatEther(await provider.getBalance(addr7.address)));
        const marketplaceBalanceAfterSale = Number (formatEther(await provider.getBalance(marketplace.address)));

        expect(await NFT721.ownerOf(21)).to.equal(addr4.address);

        expect(sellerBalanceAfterSale - sellerBalanceBeforeSale)
            .to.be.closeTo(9.25, 0.01);
        expect(mainRoyaltyReceiverBalanceAfterSale - mainRoyaltyReceiverBalanceBeforeSale)
            .to.be.closeTo(0.25, 0.01);
        expect(royaltyReceiverN1BalanceAfterSale - royaltyReceiverN1BalanceBeforeSale)
            .to.be.closeTo(0.125, 0.01);
        expect(royaltyReceiverN2BalanceAfterSale - royaltyReceiverN2BalanceBeforeSale)
            .to.be.closeTo(0.125, 0.01);
        expect(buyerBalanceBeforeSale - buyerBalanceAfterSale)
            .to.be.closeTo(10, 0.01);
        expect(marketplaceBalanceAfterSale - marketplaceBalanceBeforeSale)
            .to.be.closeTo(0.25, 0.001);
    });

    it("Should user be able to disable royalty distribution (ERC721)", async function () {
        await NFT721.connect(addr1).disableRoyaltyDistribution();

        expect(await NFT721.royaltyDistributionEnabled()).to.equal(false)
    });

    it("Should token be sold with simple royalty (ERC721)", async function () {
        await NFT721.connect(addr4).setApprovalForAll(marketplace.address, true);
        expect(await NFT721.ownerOf(21)).to.equal(addr4.address);

        const sellerBalanceBeforeSale = Number (formatEther(await provider.getBalance(addr4.address)));
        const buyerBalanceBeforeSale = Number (formatEther(await provider.getBalance(addr5.address)));
        const mainRoyaltyReceiverBalanceBeforeSale = Number (formatEther(await provider.getBalance(addr1.address)));
        const marketplaceBalanceBeforeSale = Number (formatEther(await provider.getBalance(marketplace.address)));

        const TIME = Math.round(new Date()/1000 + 3600);
        const sellerOrder = [
            addr4.address, NFT721.address,
            21,1,0,
            '0x0000000000000000000000000000000000000000',   //ETH
            parseEther('10.0'),
            TIME,[],[],Math.round(Math.random()*1000)
        ];
        const sellerSig = await getSignature(addr4, ...sellerOrder);

        const buyerOrder = [
            addr5.address, NFT721.address,
            21,1,0,
            '0x0000000000000000000000000000000000000000',   //ETH
            parseEther('10.0'),
            TIME,[],[],Math.round(Math.random()*1000)
        ];

        await marketplace.connect(addr5).completeOrder(
            sellerOrder,
            sellerSig,
            buyerOrder,
            sellerSig,      //buyer signature is unnecessary when buy out
            {value: parseEther('10.0')}
        );

        const sellerBalanceAfterSale = Number (formatEther(await provider.getBalance(addr4.address)));
        const buyerBalanceAfterSale = Number (formatEther(await provider.getBalance(addr5.address)));
        const mainRoyaltyReceiverBalanceAfterSale = Number (formatEther(await provider.getBalance(addr1.address)));
        const marketplaceBalanceAfterSale = Number (formatEther(await provider.getBalance(marketplace.address)));

        expect(await NFT721.ownerOf(21)).to.equal(addr5.address);

        expect(sellerBalanceAfterSale - sellerBalanceBeforeSale)
            .to.be.closeTo(9.25, 0.01);
        expect(mainRoyaltyReceiverBalanceAfterSale - mainRoyaltyReceiverBalanceBeforeSale)
            .to.be.closeTo(0.5, 0.01);
        expect(buyerBalanceBeforeSale - buyerBalanceAfterSale)
            .to.be.closeTo(10, 0.01);
        expect(marketplaceBalanceAfterSale - marketplaceBalanceBeforeSale)
            .to.be.closeTo(0.25, 0.001);
    });

    it("Should user be able to disable royalty at all (ERC721)", async function () {
        await NFT721.connect(addr1).disableRoyalty();

        expect(await NFT721.globalRoyaltyEnabled()).to.equal(false)
    });

    it("Should token be sold without royalty (ERC721)", async function () {
        expect(await NFT721.ownerOf(21)).to.equal(addr5.address);

        const sellerBalanceBeforeSale = Number (formatEther(await provider.getBalance(addr5.address)));
        const buyerBalanceBeforeSale = Number (formatEther(await provider.getBalance(addr4.address)));
        const mainRoyaltyReceiverBalanceBeforeSale = Number (formatEther(await provider.getBalance(addr1.address)));
        const marketplaceBalanceBeforeSale = Number (formatEther(await provider.getBalance(marketplace.address)));

        const TIME = Math.round(new Date()/1000 + 3600);
        const sellerOrder = [
            addr5.address, NFT721.address,
            21,1,0,
            '0x0000000000000000000000000000000000000000',   //ETH
            parseEther('10.0'),
            TIME,[],[],Math.round(Math.random()*1000)
        ];
        const sellerSig = await getSignature(addr5, ...sellerOrder);

        const buyerOrder = [
            addr4.address, NFT721.address,
            21,1,0,
            '0x0000000000000000000000000000000000000000',   //ETH
            parseEther('10.0'),
            TIME,[],[],Math.round(Math.random()*1000)
        ];

        await marketplace.connect(addr4).completeOrder(
            sellerOrder,
            sellerSig,
            buyerOrder,
            sellerSig,      //buyer signature is unnecessary when buy out
            {value: parseEther('10.0')}
        );

        const sellerBalanceAfterSale = Number (formatEther(await provider.getBalance(addr5.address)));
        const buyerBalanceAfterSale = Number (formatEther(await provider.getBalance(addr4.address)));
        const mainRoyaltyReceiverBalanceAfterSale = Number (formatEther(await provider.getBalance(addr1.address)));
        const marketplaceBalanceAfterSale = Number (formatEther(await provider.getBalance(marketplace.address)));

        expect(await NFT721.ownerOf(21)).to.equal(addr4.address);

        expect(sellerBalanceAfterSale - sellerBalanceBeforeSale)
            .to.be.closeTo(9.75, 0.01);
        expect(mainRoyaltyReceiverBalanceAfterSale - mainRoyaltyReceiverBalanceBeforeSale)
            .to.be.closeTo(0, 0.01);
        expect(buyerBalanceBeforeSale - buyerBalanceAfterSale)
            .to.be.closeTo(10, 0.01);
        expect(marketplaceBalanceAfterSale - marketplaceBalanceBeforeSale)
            .to.be.closeTo(0.25, 0.001);
    });

    it("Should token with individual distribution be also sold without royalty (ERC721)", async function () {
        expect(await NFT721.ownerOf(20)).to.equal(addr5.address);

        const sellerBalanceBeforeSale = Number (formatEther(await provider.getBalance(addr5.address)));
        const buyerBalanceBeforeSale = Number (formatEther(await provider.getBalance(addr6.address)));
        const mainRoyaltyReceiverBalanceBeforeSale = Number (formatEther(await provider.getBalance(addr1.address)));
        const marketplaceBalanceBeforeSale = Number (formatEther(await provider.getBalance(marketplace.address)));

        const TIME = Math.round(new Date()/1000 + 3600);
        const sellerOrder = [
            addr5.address, NFT721.address,
            20,1,0,
            '0x0000000000000000000000000000000000000000',   //ETH
            parseEther('10.0'),
            TIME,[],[],Math.round(Math.random()*1000)
        ];
        const sellerSig = await getSignature(addr5, ...sellerOrder);

        const buyerOrder = [
            addr6.address, NFT721.address,
            20,1,0,
            '0x0000000000000000000000000000000000000000',   //ETH
            parseEther('10.0'),
            TIME,[],[],Math.round(Math.random()*1000)
        ];

        await marketplace.connect(addr6).completeOrder(
            sellerOrder,
            sellerSig,
            buyerOrder,
            sellerSig,      //buyer signature is unnecessary when buy out
            {value: parseEther('10.0')}
        );

        const sellerBalanceAfterSale = Number (formatEther(await provider.getBalance(addr5.address)));
        const buyerBalanceAfterSale = Number (formatEther(await provider.getBalance(addr6.address)));
        const mainRoyaltyReceiverBalanceAfterSale = Number (formatEther(await provider.getBalance(addr1.address)));
        const marketplaceBalanceAfterSale = Number (formatEther(await provider.getBalance(marketplace.address)));

        expect(await NFT721.ownerOf(20)).to.equal(addr6.address);

        expect(sellerBalanceAfterSale - sellerBalanceBeforeSale)
            .to.be.closeTo(9.75, 0.01);
        expect(mainRoyaltyReceiverBalanceAfterSale - mainRoyaltyReceiverBalanceBeforeSale)
            .to.be.closeTo(0, 0.01);
        expect(buyerBalanceBeforeSale - buyerBalanceAfterSale)
            .to.be.closeTo(10, 0.01);
        expect(marketplaceBalanceAfterSale - marketplaceBalanceBeforeSale)
            .to.be.closeTo(0.25, 0.001);
    });

    it("Should user be able to set individual token royalty amount (ERC1155)", async function () {
        await NFT1155.connect(addr3).setTokenRoyalty(500, 21);

        expect(await NFT1155.tokenRoyalty(21)).to.equal(500);
    });

    it("Should token lower royalty amount work properly (ERC1155)", async function () {
        await NFT1155.connect(addr4).setApprovalForAll(marketplace.address, true);
        expect(await NFT1155.balanceOf(addr4.address, 21)).to.equal(10);

        const sellerBalanceBeforeSale = Number (formatEther(await provider.getBalance(addr4.address)));
        const buyerBalanceBeforeSale = Number (formatEther(await provider.getBalance(addr7.address)));
        const mainRoyaltyReceiverBalanceBeforeSale = Number (formatEther(await provider.getBalance(addr3.address)));
        const royaltyReceiverN1BalanceBeforeSale = Number (formatEther(await provider.getBalance(addr5.address)));
        const royaltyReceiverN2BalanceBeforeSale = Number (formatEther(await provider.getBalance(addr6.address)));
        const marketplaceBalanceBeforeSale = Number (formatEther(await provider.getBalance(marketplace.address)));

        const TIME = Math.round(new Date()/1000 + 3600);
        const sellerOrder = [
            addr4.address, NFT1155.address,
            21,10,0,
            '0x0000000000000000000000000000000000000000',   //ETH
            parseEther('1.0'),
            TIME,[],[],Math.round(Math.random()*1000)
        ];
        const sellerSig = await getSignature(addr4, ...sellerOrder);

        const buyerOrder = [
            addr7.address, NFT1155.address,
            21,10,0,
            '0x0000000000000000000000000000000000000000',   //ETH
            parseEther('10.0'),
            TIME,[],[],Math.round(Math.random()*1000)
        ];

        await marketplace.connect(addr7).completeOrder(
            sellerOrder,
            sellerSig,
            buyerOrder,
            sellerSig,      //buyer signature is unnecessary when buy out
            {value: parseEther('10.0')}
        );

        const sellerBalanceAfterSale = Number (formatEther(await provider.getBalance(addr4.address)));
        const buyerBalanceAfterSale = Number (formatEther(await provider.getBalance(addr7.address)));
        const mainRoyaltyReceiverBalanceAfterSale = Number (formatEther(await provider.getBalance(addr3.address)));
        const royaltyReceiverN1BalanceAfterSale = Number (formatEther(await provider.getBalance(addr5.address)));
        const royaltyReceiverN2BalanceAfterSale = Number (formatEther(await provider.getBalance(addr6.address)));
        const marketplaceBalanceAfterSale = Number (formatEther(await provider.getBalance(marketplace.address)));

        expect(await NFT1155.balanceOf(addr7.address, 21)).to.equal(10);

        expect(sellerBalanceAfterSale - sellerBalanceBeforeSale)
            .to.be.closeTo(9.25, 0.01);
        expect(mainRoyaltyReceiverBalanceAfterSale - mainRoyaltyReceiverBalanceBeforeSale)
            .to.be.closeTo(0.25, 0.01);
        expect(royaltyReceiverN1BalanceAfterSale - royaltyReceiverN1BalanceBeforeSale)
            .to.be.closeTo(0.125, 0.01);
        expect(royaltyReceiverN2BalanceAfterSale - royaltyReceiverN2BalanceBeforeSale)
            .to.be.closeTo(0.125, 0.01);
        expect(buyerBalanceBeforeSale - buyerBalanceAfterSale)
            .to.be.closeTo(10, 0.01);
        expect(marketplaceBalanceAfterSale - marketplaceBalanceBeforeSale)
            .to.be.closeTo(0.25, 0.001);
    });

    it("Should user be able to change main royalty receiver (ERC1155)", async function () {
        await NFT1155.connect(addr3).setRoyaltyReceiver(addr1.address);

        expect(await NFT1155.royaltyReceiver()).to.equal(addr1.address);
    });

    it("Should new royalty receiver receive royalty", async function () {
        await NFT1155.connect(addr7).setApprovalForAll(marketplace.address, true);
        expect(await NFT1155.balanceOf(addr7.address, 21)).to.equal(10);

        const sellerBalanceBeforeSale = Number (formatEther(await provider.getBalance(addr7.address)));
        const buyerBalanceBeforeSale = Number (formatEther(await provider.getBalance(addr4.address)));
        const mainRoyaltyReceiverBalanceBeforeSale = Number (formatEther(await provider.getBalance(addr1.address)));
        const royaltyReceiverN1BalanceBeforeSale = Number (formatEther(await provider.getBalance(addr5.address)));
        const royaltyReceiverN2BalanceBeforeSale = Number (formatEther(await provider.getBalance(addr6.address)));
        const marketplaceBalanceBeforeSale = Number (formatEther(await provider.getBalance(marketplace.address)));

        const TIME = Math.round(new Date()/1000 + 3600);
        const sellerOrder = [
            addr7.address, NFT1155.address,
            21,10,0,
            '0x0000000000000000000000000000000000000000',   //ETH
            parseEther('1.0'),
            TIME,[],[],Math.round(Math.random()*1000)
        ];
        const sellerSig = await getSignature(addr7, ...sellerOrder);

        const buyerOrder = [
            addr4.address, NFT1155.address,
            21,10,0,
            '0x0000000000000000000000000000000000000000',   //ETH
            parseEther('10.0'),
            TIME,[],[],Math.round(Math.random()*1000)
        ];

        await marketplace.connect(addr4).completeOrder(
            sellerOrder,
            sellerSig,
            buyerOrder,
            sellerSig,      //buyer signature is unnecessary when buy out
            {value: parseEther('10.0')}
        );

        const sellerBalanceAfterSale = Number (formatEther(await provider.getBalance(addr7.address)));
        const buyerBalanceAfterSale = Number (formatEther(await provider.getBalance(addr4.address)));
        const mainRoyaltyReceiverBalanceAfterSale = Number (formatEther(await provider.getBalance(addr1.address)));
        const royaltyReceiverN1BalanceAfterSale = Number (formatEther(await provider.getBalance(addr5.address)));
        const royaltyReceiverN2BalanceAfterSale = Number (formatEther(await provider.getBalance(addr6.address)));
        const marketplaceBalanceAfterSale = Number (formatEther(await provider.getBalance(marketplace.address)));

        expect(await NFT1155.balanceOf(addr4.address, 21)).to.equal(10);

        expect(sellerBalanceAfterSale - sellerBalanceBeforeSale)
            .to.be.closeTo(9.25, 0.01);
        expect(mainRoyaltyReceiverBalanceAfterSale - mainRoyaltyReceiverBalanceBeforeSale)
            .to.be.closeTo(0.25, 0.01);
        expect(royaltyReceiverN1BalanceAfterSale - royaltyReceiverN1BalanceBeforeSale)
            .to.be.closeTo(0.125, 0.01);
        expect(royaltyReceiverN2BalanceAfterSale - royaltyReceiverN2BalanceBeforeSale)
            .to.be.closeTo(0.125, 0.01);
        expect(buyerBalanceBeforeSale - buyerBalanceAfterSale)
            .to.be.closeTo(10, 0.01);
        expect(marketplaceBalanceAfterSale - marketplaceBalanceBeforeSale)
            .to.be.closeTo(0.25, 0.001);
    });

    it("Should user be able to disable royalty at all (ERC1155)", async function () {
        await NFT1155.connect(addr3).disableRoyalty();

        expect(await NFT1155.globalRoyaltyEnabled()).to.equal(false)
    });

    it("Should token be sold without royalty (ERC1155)", async function () {
        await NFT1155.connect(addr4).setApprovalForAll(marketplace.address, true);
        expect(await NFT1155.balanceOf(addr4.address, 21)).to.equal(10);

        const sellerBalanceBeforeSale = Number (formatEther(await provider.getBalance(addr4.address)));
        const buyerBalanceBeforeSale = Number (formatEther(await provider.getBalance(addr7.address)));
        const mainRoyaltyReceiverBalanceBeforeSale = Number (formatEther(await provider.getBalance(addr1.address)));
        const royaltyReceiverN1BalanceBeforeSale = Number (formatEther(await provider.getBalance(addr5.address)));
        const royaltyReceiverN2BalanceBeforeSale = Number (formatEther(await provider.getBalance(addr6.address)));
        const marketplaceBalanceBeforeSale = Number (formatEther(await provider.getBalance(marketplace.address)));

        const TIME = Math.round(new Date()/1000 + 3600);
        const sellerOrder = [
            addr4.address, NFT1155.address,
            21,10,0,
            '0x0000000000000000000000000000000000000000',   //ETH
            parseEther('1.0'),
            TIME,[],[],Math.round(Math.random()*1000)
        ];
        const sellerSig = await getSignature(addr4, ...sellerOrder);

        const buyerOrder = [
            addr7.address, NFT1155.address,
            21,10,0,
            '0x0000000000000000000000000000000000000000',   //ETH
            parseEther('10.0'),
            TIME,[],[],Math.round(Math.random()*1000)
        ];

        await marketplace.connect(addr7).completeOrder(
            sellerOrder,
            sellerSig,
            buyerOrder,
            sellerSig,      //buyer signature is unnecessary when buy out
            {value: parseEther('10.0')}
        );

        const sellerBalanceAfterSale = Number (formatEther(await provider.getBalance(addr4.address)));
        const buyerBalanceAfterSale = Number (formatEther(await provider.getBalance(addr7.address)));
        const mainRoyaltyReceiverBalanceAfterSale = Number (formatEther(await provider.getBalance(addr1.address)));
        const royaltyReceiverN1BalanceAfterSale = Number (formatEther(await provider.getBalance(addr5.address)));
        const royaltyReceiverN2BalanceAfterSale = Number (formatEther(await provider.getBalance(addr6.address)));
        const marketplaceBalanceAfterSale = Number (formatEther(await provider.getBalance(marketplace.address)));

        expect(await NFT1155.balanceOf(addr7.address, 21)).to.equal(10);

        expect(sellerBalanceAfterSale - sellerBalanceBeforeSale)
            .to.be.closeTo(9.75, 0.01);
        expect(mainRoyaltyReceiverBalanceAfterSale - mainRoyaltyReceiverBalanceBeforeSale)
            .to.be.closeTo(0.0, 0.01);
        expect(royaltyReceiverN1BalanceAfterSale - royaltyReceiverN1BalanceBeforeSale)
            .to.be.closeTo(0.0, 0.01);
        expect(royaltyReceiverN2BalanceAfterSale - royaltyReceiverN2BalanceBeforeSale)
            .to.be.closeTo(0.0, 0.01);
        expect(buyerBalanceBeforeSale - buyerBalanceAfterSale)
            .to.be.closeTo(10, 0.01);
        expect(marketplaceBalanceAfterSale - marketplaceBalanceBeforeSale)
            .to.be.closeTo(0.25, 0.001);
    });

});
describe('Compatibility with non-native tokens', () => {

    it("Should deploy test ERC721 with 2981 support (simple royalty)", async function () {
        const TestERC721_with2981support = await ethers.getContractFactory('TestERC721_with2981support');
        NFT721_2981 = await TestERC721_with2981support.connect(addr1).deploy("Name", "Symbol", 1500);
        await NFT721_2981.deployed();
        expect(await NFT721_2981.royaltyReceiver()).to.equal(addr1.address);
        expect(await NFT721_2981.globalRoyalty()).to.equal(1500);
    });

    it("Should mint token", async function () {
        await NFT721_2981.connect(addr1).mint(addr2.address, 1);
        expect(await NFT721_2981.ownerOf(1)).to.equal(addr2.address);
    });

    it("Should be able to sale via marketplace and receive royalty (ERC721)", async function () {
        await NFT721_2981.connect(addr2).setApprovalForAll(marketplace.address, true);

        const sellerBalanceBeforeSale = Number (formatEther(await provider.getBalance(addr2.address)));
        const buyerBalanceBeforeSale = Number (formatEther(await provider.getBalance(addr4.address)));
        const royaltyReceiverBalanceBeforeSale = Number (formatEther(await provider.getBalance(addr1.address)));
        const marketplaceBalanceBeforeSale = Number (formatEther(await provider.getBalance(marketplace.address)));

        const TIME = Math.round(new Date()/1000 + 3600);
        const sellerOrder = [
                addr2.address, NFT721_2981.address,
                1,1,0,
                '0x0000000000000000000000000000000000000000',   //ETH
                parseEther('1.0'),
                TIME,[],[],Math.round(Math.random()*1000)
            ];
        const sellerSig = await getSignature(addr2, ...sellerOrder);

        const buyerOrder = [
                addr4.address, NFT721_2981.address,
                1,1,0,
                '0x0000000000000000000000000000000000000000',   //ETH
                parseEther('1.0'),
                TIME,[],[],Math.round(Math.random()*1000)
            ];

        await marketplace.connect(addr4).completeOrder(
            sellerOrder,
            sellerSig,
            buyerOrder,
            sellerSig,      //buyer signature is unnecessary when buy out
            {value: parseEther('1.5')}
            );

        const sellerBalanceAfterSale = Number (formatEther(await provider.getBalance(addr2.address)));
        const buyerBalanceAfterSale = Number (formatEther(await provider.getBalance(addr4.address)));
        const royaltyReceiverBalanceAfterSale = Number (formatEther(await provider.getBalance(addr1.address)));
        const marketplaceBalanceAfterSale = Number (formatEther(await provider.getBalance(marketplace.address)));

        expect(await NFT721_2981.ownerOf(1)).to.equal(addr4.address);

        expect(sellerBalanceAfterSale - sellerBalanceBeforeSale)
          .to.be.closeTo(0.825, 0.01);

        expect(buyerBalanceBeforeSale - buyerBalanceAfterSale)
          .to.be.closeTo(1, 0.01);

        expect(royaltyReceiverBalanceAfterSale - royaltyReceiverBalanceBeforeSale)
          .to.be.closeTo(0.15, 0.01);

        expect(marketplaceBalanceAfterSale - marketplaceBalanceBeforeSale)
          .to.be.closeTo(0.025, 0.001);
    });

    it("Should deploy test ERC1155 with 2981 support (simple royalty)", async function () {
        const TestERC1155_with2981support = await ethers.getContractFactory('TestERC1155_with2981support');
        NFT1155_2981 = await TestERC1155_with2981support.connect(addr1).deploy("uri", 1500);
        await NFT1155_2981.deployed();
        expect(await NFT1155_2981.royaltyReceiver()).to.equal(addr1.address);
        expect(await NFT1155_2981.globalRoyalty()).to.equal(1500);
    });

    it("Should mint some tokens", async function () {
        await NFT1155_2981.connect(addr1).mint(addr2.address, 1, 10);
        expect(await NFT1155_2981.balanceOf(addr2.address, 1)).to.equal(10);
    });

    it("Should be able to sale via marketplace and receive royalty (ERC1155)", async function () {
        await NFT1155_2981.connect(addr2).setApprovalForAll(marketplace.address, true);

        const sellerBalanceBeforeSale = Number (formatEther(await provider.getBalance(addr2.address)));
        const buyerBalanceBeforeSale = Number (formatEther(await provider.getBalance(addr4.address)));
        const royaltyReceiverBalanceBeforeSale = Number (formatEther(await provider.getBalance(addr1.address)));
        const marketplaceBalanceBeforeSale = Number (formatEther(await provider.getBalance(marketplace.address)));

        const TIME = Math.round(new Date()/1000 + 3600);
        const sellerOrder = [
                addr2.address, NFT1155_2981.address,
                1,10,0,
                '0x0000000000000000000000000000000000000000',   //ETH
                parseEther('0.1'),
                TIME,[],[],Math.round(Math.random()*1000)
            ];
        const sellerSig = await getSignature(addr2, ...sellerOrder);

        const buyerOrder = [
                addr4.address, NFT1155_2981.address,
                1,10,0,
                '0x0000000000000000000000000000000000000000',   //ETH
                parseEther('1.0'),
                TIME,[],[],Math.round(Math.random()*1000)
            ];

        await marketplace.connect(addr4).completeOrder(
            sellerOrder,
            sellerSig,
            buyerOrder,
            sellerSig,      //buyer signature is unnecessary when buy out
            {value: parseEther('1.0')}
            );

        const sellerBalanceAfterSale = Number (formatEther(await provider.getBalance(addr2.address)));
        const buyerBalanceAfterSale = Number (formatEther(await provider.getBalance(addr4.address)));
        const royaltyReceiverBalanceAfterSale = Number (formatEther(await provider.getBalance(addr1.address)));
        const marketplaceBalanceAfterSale = Number (formatEther(await provider.getBalance(marketplace.address)));

        expect(await NFT1155_2981.balanceOf(addr4.address, 1)).to.equal(10);

        expect(sellerBalanceAfterSale - sellerBalanceBeforeSale)
          .to.be.closeTo(0.825, 0.01);

        expect(buyerBalanceBeforeSale - buyerBalanceAfterSale)
          .to.be.closeTo(1, 0.01);

        expect(royaltyReceiverBalanceAfterSale - royaltyReceiverBalanceBeforeSale)
          .to.be.closeTo(0.15, 0.01);

        expect(marketplaceBalanceAfterSale - marketplaceBalanceBeforeSale)
          .to.be.closeTo(0.025, 0.001);
    });

    it("Should deploy test ERC721 without royalties", async function () {
        const TestERC721_WithoutRoyalty = await ethers.getContractFactory('TestERC721_WithoutRoyalty');
        NFT721_noRoyalty = await TestERC721_WithoutRoyalty.connect(addr1).deploy("name", "Symbol");
        await NFT721_noRoyalty.deployed();
    });

    it("Should mint some tokens", async function () {
        await NFT721_noRoyalty.connect(addr1).mint(addr2.address, 1);
        expect(await NFT721_noRoyalty.ownerOf(1)).to.equal(addr2.address);
    });

    it("Should be able to sale via marketplace", async function () {
        await NFT721_noRoyalty.connect(addr2).setApprovalForAll(marketplace.address, true);

        const sellerBalanceBeforeSale = Number (formatEther(await provider.getBalance(addr2.address)));
        const buyerBalanceBeforeSale = Number (formatEther(await provider.getBalance(addr4.address)));
        const ownerBalanceBeforeSale = Number (formatEther(await provider.getBalance(addr1.address)));
        const marketplaceBalanceBeforeSale = Number (formatEther(await provider.getBalance(marketplace.address)));

        const TIME = Math.round(new Date()/1000 + 3600);
        const sellerOrder = [
            addr2.address, NFT721_noRoyalty.address,
            1,1,0,
            '0x0000000000000000000000000000000000000000',   //ETH
            parseEther('1.0'),
            TIME,[],[],Math.round(Math.random()*1000)
        ];
        const sellerSig = await getSignature(addr2, ...sellerOrder);

        const buyerOrder = [
            addr4.address, NFT721_noRoyalty.address,
            1,1,0,
            '0x0000000000000000000000000000000000000000',   //ETH
            parseEther('1.0'),
            TIME,[],[],Math.round(Math.random()*1000)
        ];

        await marketplace.connect(addr4).completeOrder(
            sellerOrder,
            sellerSig,
            buyerOrder,
            sellerSig,      //buyer signature is unnecessary when buy out
            {value: parseEther('1.5')}
        );

        const sellerBalanceAfterSale = Number (formatEther(await provider.getBalance(addr2.address)));
        const buyerBalanceAfterSale = Number (formatEther(await provider.getBalance(addr4.address)));
        const ownerBalanceAfterSale = Number (formatEther(await provider.getBalance(addr1.address)));
        const marketplaceBalanceAfterSale = Number (formatEther(await provider.getBalance(marketplace.address)));

        expect(await NFT721_noRoyalty.ownerOf(1)).to.equal(addr4.address);

        expect(sellerBalanceAfterSale - sellerBalanceBeforeSale)
            .to.be.closeTo(0.975, 0.01);

        expect(buyerBalanceBeforeSale - buyerBalanceAfterSale)
            .to.be.closeTo(1, 0.01);

        expect(ownerBalanceAfterSale - ownerBalanceBeforeSale)
            .to.be.closeTo(0, 0.01);

        expect(marketplaceBalanceAfterSale - marketplaceBalanceBeforeSale)
            .to.be.closeTo(0.025, 0.001);
    });

});
describe('Global marketplace settings', () => {

    it("Should royalty and marketplace fee be of correct value", async function () {
        expect(await marketplace.marketplaceFee()).to.equal(250);
        expect(await marketplace.royaltyLimit()).to.equal(9000)
    });

    it("Should be able to change royalty limit", async function () {
        await marketplace.setRoyaltyLimit(2000);
        expect(await marketplace.royaltyLimit()).to.equal(2000);
        await expect(marketplace.setRoyaltyLimit(9501))
            .to.be.revertedWith('Over 95%');
    });

    it("Should be able to change marketplace fee", async function () {
        await marketplace.setMarketplaceFee(500);
        expect(await marketplace.marketplaceFee()).to.equal(500);
        await expect(marketplace.setMarketplaceFee(9501))
            .to.be.revertedWith('Over 95%');
    });

    it("Should set high royalty for contract", async function () {
        await NFT721.connect(addr1).setGlobalRoyalty(8000);
        await NFT721.connect(addr1).enableRoyalty();
        await NFT721.connect(addr1).enableRoyaltyDistribution();
        const collaborators = [addr2.address, addr3.address];
        const shares = [2500, 2500];
        await NFT721.connect(addr1).setDefaultRoyaltyDistribution(collaborators, shares);
        expect(await NFT721.globalRoyalty()).to.equal(8000);
    });

    it("Should new royalty limit and marketplace fee work", async function () {
        await NFT721.connect(addr1).setApprovalForAll(marketplace.address, true);

        const sellerBalanceBeforeSale = Number (formatEther(await provider.getBalance(addr1.address)));
        const buyerBalanceBeforeSale = Number (formatEther(await provider.getBalance(addr6.address)));
        const royaltyReceiverN1BalanceBeforeSale = Number (formatEther(await provider.getBalance(addr2.address)));
        const royaltyReceiverN2BalanceBeforeSale = Number (formatEther(await provider.getBalance(addr3.address)));
        const marketplaceBalanceBeforeSale = Number (formatEther(await provider.getBalance(marketplace.address)));

        const TIME = Math.round(new Date()/1000 + 3600);
        const sellerOrder = [
            addr1.address, NFT721.address,
            23,1,0,
            '0x0000000000000000000000000000000000000000',   //ETH
            parseEther('10.0'),
            TIME,[],[],Math.round(Math.random()*1000)
        ];
        const sellerSig = await getSignature(addr1, ...sellerOrder);

        const buyerOrder = [
            addr6.address, NFT721.address,
            23,1,0,
            '0x0000000000000000000000000000000000000000',   //ETH
            parseEther('10.0'),
            TIME,[],[],Math.round(Math.random()*1000)
        ];

        await marketplace.connect(addr6).completeOrder(
            sellerOrder,
            sellerSig,
            buyerOrder,
            sellerSig,      //buyer signature is unnecessary when buy out
            {value: parseEther('10.0')}
        );

        const sellerBalanceAfterSale = Number (formatEther(await provider.getBalance(addr1.address)));
        const buyerBalanceAfterSale = Number (formatEther(await provider.getBalance(addr6.address)));
        const royaltyReceiverN1BalanceAfterSale = Number (formatEther(await provider.getBalance(addr2.address)));
        const royaltyReceiverN2BalanceAfterSale = Number (formatEther(await provider.getBalance(addr3.address)));
        const marketplaceBalanceAfterSale = Number (formatEther(await provider.getBalance(marketplace.address)));

        expect(await NFT721.ownerOf(23)).to.equal(addr6.address);

        expect(sellerBalanceAfterSale - sellerBalanceBeforeSale)
            .to.be.closeTo(8.5, 0.01);
        expect(royaltyReceiverN1BalanceAfterSale - royaltyReceiverN1BalanceBeforeSale)
            .to.be.closeTo(0.5, 0.01);
        expect(royaltyReceiverN2BalanceAfterSale - royaltyReceiverN2BalanceBeforeSale)
            .to.be.closeTo(0.5, 0.01);
        expect(buyerBalanceBeforeSale - buyerBalanceAfterSale)
            .to.be.closeTo(10, 0.01);
        expect(marketplaceBalanceAfterSale - marketplaceBalanceBeforeSale)
            .to.be.closeTo(0.5, 0.001);
    });

    it("Should disable royalty distribution", async function () {
        await NFT721.connect(addr1).disableRoyaltyDistribution();
        expect(await NFT721.royaltyDistributionEnabled()).to.equal(false);
    });

    it("Should new royalty limit and marketplace fee work with simple royalty", async function () {
        await NFT721.connect(addr6).setApprovalForAll(marketplace.address, true);

        const sellerBalanceBeforeSale = Number (formatEther(await provider.getBalance(addr6.address)));
        const buyerBalanceBeforeSale = Number (formatEther(await provider.getBalance(addr5.address)));
        const royaltyReceiverBalanceBeforeSale = Number (formatEther(await provider.getBalance(addr1.address)));
        const marketplaceBalanceBeforeSale = Number (formatEther(await provider.getBalance(marketplace.address)));

        const TIME = Math.round(new Date()/1000 + 3600);
        const sellerOrder = [
            addr6.address, NFT721.address,
            23,1,0,
            '0x0000000000000000000000000000000000000000',   //ETH
            parseEther('10.0'),
            TIME,[],[],Math.round(Math.random()*1000)
        ];
        const sellerSig = await getSignature(addr6, ...sellerOrder);

        const buyerOrder = [
            addr5.address, NFT721.address,
            23,1,0,
            '0x0000000000000000000000000000000000000000',   //ETH
            parseEther('10.0'),
            TIME,[],[],Math.round(Math.random()*1000)
        ];

        await marketplace.connect(addr5).completeOrder(
            sellerOrder,
            sellerSig,
            buyerOrder,
            sellerSig,      //buyer signature is unnecessary when buy out
            {value: parseEther('10.0')}
        );

        const sellerBalanceAfterSale = Number (formatEther(await provider.getBalance(addr6.address)));
        const buyerBalanceAfterSale = Number (formatEther(await provider.getBalance(addr5.address)));
        const royaltyReceiverBalanceAfterSale = Number (formatEther(await provider.getBalance(addr1.address)));
        const marketplaceBalanceAfterSale = Number (formatEther(await provider.getBalance(marketplace.address)));

        expect(await NFT721.ownerOf(23)).to.equal(addr5.address);

        expect(sellerBalanceAfterSale - sellerBalanceBeforeSale)
            .to.be.closeTo(7.5, 0.01);
        expect(royaltyReceiverBalanceAfterSale - royaltyReceiverBalanceBeforeSale)
            .to.be.closeTo(2, 0.01);
        expect(buyerBalanceBeforeSale - buyerBalanceAfterSale)
            .to.be.closeTo(10, 0.01);
        expect(marketplaceBalanceAfterSale - marketplaceBalanceBeforeSale)
            .to.be.closeTo(0.5, 0.001);
    });

    it("Should set super admin share", async function () {
        await marketplace.setSuperAdminShare(6000);
    });

    it("Should marketplace fee distribute properly", async function () {
        await NFT721.connect(addr5).setApprovalForAll(marketplace.address, true);

        const sellerBalanceBeforeSale = Number (formatEther(await provider.getBalance(addr5.address)));
        const buyerBalanceBeforeSale = Number (formatEther(await provider.getBalance(addr6.address)));
        const royaltyReceiverBalanceBeforeSale = Number (formatEther(await provider.getBalance(addr1.address)));
        const marketplaceBalanceBeforeSale = Number (formatEther(await provider.getBalance(marketplace.address)));
        const adminBalanceBeforeSale = Number (formatEther(await provider.getBalance(Admin.address)));

        const TIME = Math.round(new Date()/1000 + 3600);
        const sellerOrder = [
            addr5.address, NFT721.address,
            23,1,0,
            '0x0000000000000000000000000000000000000000',   //ETH
            parseEther('10.0'),
            TIME,[],[],Math.round(Math.random()*1000)
        ];
        const sellerSig = await getSignature(addr5, ...sellerOrder);

        const buyerOrder = [
            addr6.address, NFT721.address,
            23,1,0,
            '0x0000000000000000000000000000000000000000',   //ETH
            parseEther('10.0'),
            TIME,[],[],Math.round(Math.random()*1000)
        ];

        await marketplace.connect(addr6).completeOrder(
            sellerOrder,
            sellerSig,
            buyerOrder,
            sellerSig,      //buyer signature is unnecessary when buy out
            {value: parseEther('10.0')}
        );

        const sellerBalanceAfterSale = Number (formatEther(await provider.getBalance(addr5.address)));
        const buyerBalanceAfterSale = Number (formatEther(await provider.getBalance(addr6.address)));
        const royaltyReceiverBalanceAfterSale = Number (formatEther(await provider.getBalance(addr1.address)));
        const marketplaceBalanceAfterSale = Number (formatEther(await provider.getBalance(marketplace.address)));
        const adminBalanceAfterSale = Number (formatEther(await provider.getBalance(Admin.address)));

        expect(await NFT721.ownerOf(23)).to.equal(addr6.address);

        expect(sellerBalanceAfterSale - sellerBalanceBeforeSale)
            .to.be.closeTo(7.5, 0.01);
        expect(royaltyReceiverBalanceAfterSale - royaltyReceiverBalanceBeforeSale)
            .to.be.closeTo(2, 0.01);
        expect(buyerBalanceBeforeSale - buyerBalanceAfterSale)
            .to.be.closeTo(10, 0.01);
        expect(marketplaceBalanceAfterSale - marketplaceBalanceBeforeSale)
            .to.be.closeTo(0.5 * 0.6, 0.001);
        expect(adminBalanceAfterSale - adminBalanceBeforeSale)
            .to.be.closeTo(0.5 * 0.4, 0.001);
    });

    it("Should marketplace fee distribute properly with ERC20", async function () {
        await NFT721.connect(addr6).setApprovalForAll(marketplace.address, true);

        const sellerBalanceBeforeSale = Number (formatEther(await ERC20.balanceOf(addr6.address)));
        const buyerBalanceBeforeSale = Number (formatEther(await ERC20.balanceOf(addr5.address)));
        const royaltyReceiverBalanceBeforeSale = Number (formatEther(await ERC20.balanceOf(addr1.address)));
        const marketplaceBalanceBeforeSale = Number (formatEther(await ERC20.balanceOf(marketplace.address)));
        const adminBalanceBeforeSale = Number (formatEther(await ERC20.balanceOf(Admin.address)));

        const TIME = Math.round(new Date()/1000 + 3600);
        const sellerOrder = [
            addr6.address, NFT721.address,
            23,1,0,
            ERC20.address,   //ETH
            parseEther('10.0'),
            TIME,[],[],Math.round(Math.random()*1000)
        ];
        const sellerSig = await getSignature(addr6, ...sellerOrder);

        const buyerOrder = [
            addr5.address, NFT721.address,
            23,1,0,
            ERC20.address,   //ETH
            parseEther('10.0'),
            TIME,[],[],Math.round(Math.random()*1000)
        ];

        await ERC20.connect(addr5).approve(marketplace.address, parseEther("10.0"));
        await marketplace.connect(addr5).completeOrder(
            sellerOrder,
            sellerSig,
            buyerOrder,
            sellerSig,      //buyer signature is unnecessary when buy out
            {value: parseEther('10.0')}
        );

        const sellerBalanceAfterSale = Number (formatEther(await ERC20.balanceOf(addr6.address)));
        const buyerBalanceAfterSale = Number (formatEther(await ERC20.balanceOf(addr5.address)));
        const royaltyReceiverBalanceAfterSale = Number (formatEther(await ERC20.balanceOf(addr1.address)));
        const marketplaceBalanceAfterSale = Number (formatEther(await ERC20.balanceOf(marketplace.address)));
        const adminBalanceAfterSale = Number (formatEther(await ERC20.balanceOf(Admin.address)));

        expect(await NFT721.ownerOf(23)).to.equal(addr5.address);

        expect(sellerBalanceAfterSale - sellerBalanceBeforeSale)
            .to.be.closeTo(7.5, 0.01);
        expect(royaltyReceiverBalanceAfterSale - royaltyReceiverBalanceBeforeSale)
            .to.be.closeTo(2, 0.01);
        expect(buyerBalanceBeforeSale - buyerBalanceAfterSale)
            .to.be.closeTo(10, 0.01);
        expect(marketplaceBalanceAfterSale - marketplaceBalanceBeforeSale)
            .to.be.closeTo(0.5 * 0.6, 0.001);
        expect(adminBalanceAfterSale - adminBalanceBeforeSale)
            .to.be.closeTo(0.5 * 0.4, 0.001);
    });

});
describe('Limitations', () => {

    it("Preparation", async function () {
        await NFT1155.connect(addr3).mint(addr5.address, 25, 10);
        expect(await NFT1155.balanceOf(addr5.address, 25)).to.equal(10);
        await NFT1155.connect(addr5).setApprovalForAll(marketplace.address, true);
    });

    it("Should revert if seller is no longer owner", async function () {
        const TIME = Math.round(new Date()/1000 + 3600);
        const sellerOrder = [
            addr4.address, NFT721.address,
            23,1,0,
            '0x0000000000000000000000000000000000000000',   //ETH
            parseEther('10.0'),
            TIME,[],[],Math.round(Math.random()*1000)
        ];
        const sellerSig = await getSignature(addr4, ...sellerOrder);

        const buyerOrder = [
            addr6.address, NFT721.address,
            23,1,0,
            '0x0000000000000000000000000000000000000000',   //ETH
            parseEther('10.0'),
            TIME,[],[],Math.round(Math.random()*1000)
        ];

        await expect(marketplace.connect(addr6).completeOrder(
            sellerOrder,
            sellerSig,
            buyerOrder,
            sellerSig,
            {value: parseEther('10.0')}
        )).to.be.revertedWith('Not an owner');
    });

    it("Should revert if seller has not enough ERC1155 tokens", async function () {
        const TIME = Math.round(new Date()/1000 + 3600);
        const sellerOrder = [
            addr5.address, NFT1155.address,
            25,11,0,
            '0x0000000000000000000000000000000000000000',   //ETH
            parseEther('10.0'),
            TIME,[],[],Math.round(Math.random()*1000)
        ];
        const sellerSig = await getSignature(addr5, ...sellerOrder);

        const buyerOrder = [
            addr6.address, NFT1155.address,
            25,11,0,
            '0x0000000000000000000000000000000000000000',   //ETH
            parseEther('10.0'),
            TIME,[],[],Math.round(Math.random()*1000)
        ];

        await expect(marketplace.connect(addr6).completeOrder(
            sellerOrder,
            sellerSig,
            buyerOrder,
            sellerSig,
            {value: parseEther('10.0')}
        )).to.be.revertedWith('Not enough tokens');
    });

    it("Should revert if listing type is wrong", async function () {
        const TIME = Math.round(new Date()/1000 + 3600);
        const sellerOrder = [
            addr5.address, NFT721.address,
            23,1,5,
            '0x0000000000000000000000000000000000000000',   //ETH
            parseEther('10.0'),
            TIME,[],[],Math.round(Math.random()*1000)
        ];
        const sellerSig = await getSignature(addr5, ...sellerOrder);

        const buyerOrder = [
            addr6.address, NFT721.address,
            23,1,5,
            '0x0000000000000000000000000000000000000000',   //ETH
            parseEther('10.0'),
            TIME,[],[],Math.round(Math.random()*1000)
        ];

        await expect(marketplace.connect(addr6).completeOrder(
            sellerOrder,
            sellerSig,
            buyerOrder,
            sellerSig,
            {value: parseEther('10.0')}
        )).to.be.reverted;
    });

    it("Should revert if listing type if buyer has removed approval for all", async function () {
        await NFT721.connect(addr5).setApprovalForAll(marketplace.address, false);

        const TIME = Math.round(new Date()/1000 + 3600);
        const sellerOrder = [
            addr5.address, NFT721.address,
            23,1,0,
            '0x0000000000000000000000000000000000000000',   //ETH
            parseEther('10.0'),
            TIME,[],[],Math.round(Math.random()*1000)
        ];
        const sellerSig = await getSignature(addr5, ...sellerOrder);

        const buyerOrder = [
            addr6.address, NFT721.address,
            23,1,0,
            '0x0000000000000000000000000000000000000000',   //ETH
            parseEther('10.0'),
            TIME,[],[],Math.round(Math.random()*1000)
        ];

        await expect(marketplace.connect(addr6).completeOrder(
            sellerOrder,
            sellerSig,
            buyerOrder,
            sellerSig,
            {value: parseEther('10.0')}
        )).to.be.revertedWith('Not approved');

        await NFT721.connect(addr5).setApprovalForAll(marketplace.address, true);
    });

    it("Should revert if users have different token addresses in the order", async function () {
        const TIME = Math.round(new Date()/1000 + 3600);
        const sellerOrder = [
            addr5.address, NFT721.address,
            23,1,0,
            '0x0000000000000000000000000000000000000000',   //ETH
            parseEther('10.0'),
            TIME,[],[],Math.round(Math.random()*1000)
        ];
        const sellerSig = await getSignature(addr5, ...sellerOrder);

        const buyerOrder = [
            addr6.address, NFT721_e.address,
            23,1,0,
            '0x0000000000000000000000000000000000000000',   //ETH
            parseEther('10.0'),
            TIME,[],[],Math.round(Math.random()*1000)
        ];

        await expect(marketplace.connect(addr6).completeOrder(
            sellerOrder,
            sellerSig,
            buyerOrder,
            sellerSig,
            {value: parseEther('10.0')}
        )).to.be.revertedWith('Different tokens');
    });

    it("Should revert if users have different token ID in the order", async function () {
        const TIME = Math.round(new Date()/1000 + 3600);
        const sellerOrder = [
            addr5.address, NFT721.address,
            23,1,0,
            '0x0000000000000000000000000000000000000000',   //ETH
            parseEther('10.0'),
            TIME,[],[],Math.round(Math.random()*1000)
        ];
        const sellerSig = await getSignature(addr5, ...sellerOrder);

        const buyerOrder = [
            addr6.address, NFT721.address,
            22,1,0,
            '0x0000000000000000000000000000000000000000',   //ETH
            parseEther('10.0'),
            TIME,[],[],Math.round(Math.random()*1000)
        ];

        await expect(marketplace.connect(addr6).completeOrder(
            sellerOrder,
            sellerSig,
            buyerOrder,
            sellerSig,
            {value: parseEther('10.0')}
        )).to.be.revertedWith('TokenIDs dont match');
    });

    it("Should revert if users have different listing type in the order", async function () {
        const TIME = Math.round(new Date()/1000 + 3600);
        const sellerOrder = [
            addr5.address, NFT721.address,
            23,1,0,
            '0x0000000000000000000000000000000000000000',   //ETH
            parseEther('10.0'),
            TIME,[],[],Math.round(Math.random()*1000)
        ];
        const sellerSig = await getSignature(addr5, ...sellerOrder);

        const buyerOrder = [
            addr6.address, NFT721.address,
            23,1,1,
            '0x0000000000000000000000000000000000000000',   //ETH
            parseEther('10.0'),
            TIME,[],[],Math.round(Math.random()*1000)
        ];

        await expect(marketplace.connect(addr6).completeOrder(
            sellerOrder,
            sellerSig,
            buyerOrder,
            sellerSig,
            {value: parseEther('10.0')}
        )).to.be.revertedWith('Listing type doesnt match');
    });

    it("Should revert if buyer sends not enough value", async function () {
        const TIME = Math.round(new Date()/1000 + 3600);
        const sellerOrder = [
            addr5.address, NFT721.address,
            23,1,0,
            '0x0000000000000000000000000000000000000000',   //ETH
            parseEther('10.0'),
            TIME,[],[],Math.round(Math.random()*1000)
        ];
        const sellerSig = await getSignature(addr5, ...sellerOrder);

        const buyerOrder = [
            addr6.address, NFT721.address,
            23,1,0,
            '0x0000000000000000000000000000000000000000',   //ETH
            parseEther('10.0'),
            TIME,[],[],Math.round(Math.random()*1000)
        ];

        await expect(marketplace.connect(addr6).completeOrder(
            sellerOrder,
            sellerSig,
            buyerOrder,
            sellerSig,
            {value: parseEther('5.0')}
        )).to.be.revertedWith('Not enough {value}');
    });

    it("Should revert if signature is not valid", async function () {
        const TIME = Math.round(new Date()/1000 + 3600);
        const sellerOrder = [
            addr5.address, NFT721.address,
            23,1,0,
            '0x0000000000000000000000000000000000000000',   //ETH
            parseEther('10.0'),
            TIME,[],[],Math.round(Math.random()*1000)
        ];
        const sellerSig = await getSignature(addr4, ...sellerOrder);

        const buyerOrder = [
            addr6.address, NFT721.address,
            23,1,0,
            '0x0000000000000000000000000000000000000000',   //ETH
            parseEther('10.0'),
            TIME,[],[],Math.round(Math.random()*1000)
        ];

        await expect(marketplace.connect(addr6).completeOrder(
            sellerOrder,
            sellerSig,
            buyerOrder,
            sellerSig,
            {value: parseEther('10.0')}
        )).to.be.revertedWith('Bad signature');
    });

    it("Should revert if wrong user tries to complete the order", async function () {
        const TIME = Math.round(new Date()/1000 + 3600);
        const sellerOrder = [
            addr5.address, NFT721.address,
            23,1,0,
            '0x0000000000000000000000000000000000000000',   //ETH
            parseEther('10.0'),
            TIME,[],[],Math.round(Math.random()*1000)
        ];
        const sellerSig = await getSignature(addr5, ...sellerOrder);

        const buyerOrder = [
            addr6.address, NFT721.address,
            23,1,0,
            '0x0000000000000000000000000000000000000000',   //ETH
            parseEther('10.0'),
            TIME,[],[],Math.round(Math.random()*1000)
        ];

        await expect(marketplace.connect(addr7).completeOrder(
            sellerOrder,
            sellerSig,
            buyerOrder,
            sellerSig,
            {value: parseEther('10.0')}
        )).to.be.revertedWith('Buyer address doesnt match');
    });

    it("Should revert if wrong user tries to complete the order (Auction)", async function () {
        const TIME = Math.round(new Date()/1000 + 3600);
        const sellerOrder = [
            addr5.address, NFT721.address,
            23,1,1,
            ERC20.address,
            parseEther('10.0'),
            TIME,[],[],Math.round(Math.random()*1000)
        ];
        const sellerSig = await getSignature(addr5, ...sellerOrder);

        const buyerOrder = [
            addr6.address, NFT721.address,
            23,1,1,
            ERC20.address,
            parseEther('10.0'),
            TIME,[],[],Math.round(Math.random()*1000)
        ];

        await expect(marketplace.connect(addr7).completeOrder(
            sellerOrder,
            sellerSig,
            buyerOrder,
            sellerSig,
            {value: parseEther('10.0')}
        )).to.be.revertedWith('User address doesnt match');
    });

    it("Should revert if buyer claims NFT before auction has ended", async function () {
        const TIME = Math.round(new Date()/1000 + 3600);
        const sellerOrder = [
            addr5.address, NFT721.address,
            23,1,1,
            ERC20.address,
            parseEther('10.0'),
            TIME,[],[],Math.round(Math.random()*1000)
        ];
        const sellerSig = await getSignature(addr5, ...sellerOrder);

        const buyerOrder = [
            addr6.address, NFT721.address,
            23,1,1,
            ERC20.address,
            parseEther('10.0'),
            TIME,[],[],Math.round(Math.random()*1000)
        ];
        const buyerSig = await getSignature(addr6, ...sellerOrder);

        await expect(marketplace.connect(addr6).completeOrder(
            sellerOrder,
            sellerSig,
            buyerOrder,
            buyerSig
        )).to.be.revertedWith('Auction has not ended');
    });

    it("Should revert if sellers order is overdue", async function () {
        const TIME = Math.round(new Date()/1000 + 3600);
        const sellerOrder = [
            addr5.address, NFT721.address,
            23,1,0,
            '0x0000000000000000000000000000000000000000',   //ETH
            parseEther('10.0'),
            TIME-10000,[],[],Math.round(Math.random()*1000)
        ];
        const sellerSig = await getSignature(addr5, ...sellerOrder);

        const buyerOrder = [
            addr6.address, NFT721.address,
            23,1,0,
            '0x0000000000000000000000000000000000000000',   //ETH
            parseEther('10.0'),
            TIME,[],[],Math.round(Math.random()*1000)
        ];

        await expect(marketplace.connect(addr6).completeOrder(
            sellerOrder,
            sellerSig,
            buyerOrder,
            sellerSig,
            {value: parseEther('10.0')}
        )).to.be.revertedWith('Overdue order');
    });

    it("Should revert if buyer has not enough ERC20 balance", async function () {
        const TIME = Math.round(new Date()/1000 + 3600);
        const sellerOrder = [
            addr5.address, NFT721.address,
            23,1,0,
            ERC20.address,
            parseEther('100000.0'),
            TIME,[],[],Math.round(Math.random()*1000)
        ];
        const sellerSig = await getSignature(addr5, ...sellerOrder);

        const buyerOrder = [
            addr6.address, NFT721.address,
            23,1,0,
            ERC20.address,
            parseEther('100000.0'),
            TIME,[],[],Math.round(Math.random()*1000)
        ];

        await expect(marketplace.connect(addr6).completeOrder(
            sellerOrder,
            sellerSig,
            buyerOrder,
            sellerSig
        )).to.be.revertedWith('Not enough balance');
    });

    it("Should revert if buyer has not enough ERC20 allowance", async function () {
        await ERC20.connect(addr6).approve(marketplace.address, parseEther('9.0'));

        const TIME = Math.round(new Date()/1000 + 3600);
        const sellerOrder = [
            addr5.address, NFT721.address,
            23,1,0,
            ERC20.address,
            parseEther('10.0'),
            TIME,[],[],Math.round(Math.random()*1000)
        ];
        const sellerSig = await getSignature(addr5, ...sellerOrder);

        const buyerOrder = [
            addr6.address, NFT721.address,
            23,1,0,
            ERC20.address,
            parseEther('10.0'),
            TIME,[],[],Math.round(Math.random()*1000)
        ];

        await expect(marketplace.connect(addr6).completeOrder(
            sellerOrder,
            sellerSig,
            buyerOrder,
            sellerSig
        )).to.be.revertedWith('Not enough allowance');
    });

});
describe('Events', () => {

    it("Should emit Sale event", async function () {
        const TIME = Math.round(new Date()/1000 + 3600);
        const sellerOrder = [
            addr5.address, NFT721.address,
            23,1,0,
            '0x0000000000000000000000000000000000000000',   //ETH
            parseEther('10.0'),
            TIME,[],[],Math.round(Math.random()*1000)
        ];
        const sellerSig = await getSignature(addr5, ...sellerOrder);

        const buyerOrder = [
            addr6.address, NFT721.address,
            23,1,0,
            '0x0000000000000000000000000000000000000000',   //ETH
            parseEther('10.0'),
            TIME,[],[],Math.round(Math.random()*1000)
        ];

        await expect(marketplace.connect(addr6).completeOrder(
            sellerOrder,
            sellerSig,
            buyerOrder,
            sellerSig,      //buyer signature is unnecessary when buy out
            {value: parseEther('10.0')}
        )).to.emit(marketplace, "Sale")
            .withArgs(addr6.address, addr5.address, NFT721.address, 23, parseEther('10.0'), 1);
    });

    it("Should emit BundleSale event", async function () {
        const TIME = Math.round(new Date()/1000 + 3600);
        const sellerOrder = [
            addr1.address, NFT721.address,
            0,1,3,
            '0x0000000000000000000000000000000000000000',   //ETH
            parseEther('10.0'),
            TIME,[31,32],[1,1],Math.round(Math.random()*1000)
        ];
        const sellerSig = await getSignature(addr1, ...sellerOrder);

        const buyerOrder = [
            addr6.address, NFT721.address,
            0,1,3,
            '0x0000000000000000000000000000000000000000',   //ETH
            parseEther('10.0'),
            TIME,[31,32],[1,1],Math.round(Math.random()*1000)
        ];

        await expect(marketplace.connect(addr6).completeOrder(
            sellerOrder,
            sellerSig,
            buyerOrder,
            sellerSig,      //buyer signature is unnecessary when buy out
            {value: parseEther('10.0')}
        )).to.emit(marketplace, "BundleSale")
            .withArgs(addr6.address, addr1.address, NFT721.address, [31,32], parseEther('10.0'));
    });

    it("Should emit RoyaltyPaid event", async function () {
        const TIME = Math.round(new Date()/1000 + 3600);
        const sellerOrder = [
            addr1.address, NFT721.address,
            33,1,0,
            '0x0000000000000000000000000000000000000000',   //ETH
            parseEther('10.0'),
            TIME,[],[],Math.round(Math.random()*1000)
        ];
        const sellerSig = await getSignature(addr1, ...sellerOrder);

        const buyerOrder = [
            addr6.address, NFT721.address,
            33,1,0,
            '0x0000000000000000000000000000000000000000',   //ETH
            parseEther('10.0'),
            TIME,[],[],Math.round(Math.random()*1000)
        ];

        await expect(marketplace.connect(addr6).completeOrder(
            sellerOrder,
            sellerSig,
            buyerOrder,
            sellerSig,      //buyer signature is unnecessary when buy out
            {value: parseEther('10.0')}
        )).to.emit(marketplace, "RoyaltyPaid")
            .withArgs(NFT721.address, addr1.address, parseEther('2.0'));
    });

    it("Should emit DistributedRoyaltyPaid event", async function () {
        await NFT721.connect(addr1).enableRoyaltyDistribution();

        const TIME = Math.round(new Date()/1000 + 3600);
        const sellerOrder = [
            addr1.address, NFT721.address,
            34,1,0,
            '0x0000000000000000000000000000000000000000',   //ETH
            parseEther('10.0'),
            TIME,[],[],Math.round(Math.random()*1000)
        ];
        const sellerSig = await getSignature(addr1, ...sellerOrder);

        const buyerOrder = [
            addr6.address, NFT721.address,
            34,1,0,
            '0x0000000000000000000000000000000000000000',   //ETH
            parseEther('10.0'),
            TIME,[],[],Math.round(Math.random()*1000)
        ];

        await expect(marketplace.connect(addr6).completeOrder(
            sellerOrder,
            sellerSig,
            buyerOrder,
            sellerSig,      //buyer signature is unnecessary when buy out
            {value: parseEther('10.0')}
        )).to.emit(marketplace, "DistributedRoyaltyPaid")
            .withArgs(
                NFT721.address,
                addr1.address,
                [/* [ [collaborator, share], [collaborator, share] ] */],
                parseEther('2.0')
            );
    });

    it("Should emit CancelledOrder event", async function () {
        const TIME = Math.round(new Date()/1000 + 3600);

        const sellerOrder = [
            addr1.address, NFT721.address,
            35,1,0,
            '0x0000000000000000000000000000000000000000',   //ETH
            parseEther('1.0'),
            TIME,[],[],Math.round(Math.random()*1000)
        ];
        const sellerSig = await getSignature(addr1, ...sellerOrder);


        await expect(marketplace.connect(addr1).cancelOrder(sellerOrder, sellerSig))
            .to.emit(marketplace, "CancelledOrder")
            .withArgs(addr1.address, NFT721.address, 35, 0);
    });

});
describe('Withdrawing funds', () => {

    it("Should be able to withdraw ETH", async function () {
        const marketplaceETHAmountBeforeWithdrawal = Number(formatEther(await provider.getBalance(marketplace.address)));
        const receiverETHAmountBeforeWithdrawal = Number(formatEther(await provider.getBalance(owner.address)));

        await expect(marketplace.connect(addr1)
            .withdrawETH(await provider.getBalance(marketplace.address), addr1.address))
            .to.be.revertedWith('Ownable: caller is not the owner');

        await marketplace.connect(owner).withdrawETH(await provider.getBalance(marketplace.address), owner.address);

        const marketplaceETHAmountAfterWithdrawal = Number(formatEther(await provider.getBalance(marketplace.address)));
        const receiverETHAmountAfterWithdrawal = Number(formatEther(await provider.getBalance(owner.address)));

        expect(receiverETHAmountAfterWithdrawal - receiverETHAmountBeforeWithdrawal)
            .to.be.closeTo(marketplaceETHAmountBeforeWithdrawal, 0.01);
        expect(marketplaceETHAmountAfterWithdrawal).to.equal(0);
    });

    it("Should be able to withdraw ERC20", async function () {
        const marketplaceETHAmountBeforeWithdrawal = Number(formatEther(await ERC20.balanceOf(marketplace.address)));
        const receiverETHAmountBeforeWithdrawal = Number(formatEther(await ERC20.balanceOf(owner.address)));

        await expect(marketplace.connect(addr1)
            .withdrawERC20(await ERC20.balanceOf(marketplace.address), addr1.address, ERC20.address))
            .to.be.revertedWith('Ownable: caller is not the owner');

        await marketplace.connect(owner)
            .withdrawERC20(await ERC20.balanceOf(marketplace.address), owner.address, ERC20.address);

        const marketplaceETHAmountAfterWithdrawal = Number(formatEther(await ERC20.balanceOf(marketplace.address)));
        const receiverETHAmountAfterWithdrawal = Number(formatEther(await ERC20.balanceOf(owner.address)));

        expect(receiverETHAmountAfterWithdrawal - receiverETHAmountBeforeWithdrawal)
            .to.be.closeTo(marketplaceETHAmountBeforeWithdrawal, 0.01);
        expect(marketplaceETHAmountAfterWithdrawal).to.equal(0);
    });

});
describe('Upgrade proxy', () => {
    it("Should public implementation address change after proxy upgrade", async function () {
        const DecryptMarketplaceV2 = await ethers.getContractFactory("DecryptMarketplaceV2");
        const oldImplementationAddress = await marketplace.implementationAddress();
        marketplace = await upgrades.upgradeProxy(marketplace, DecryptMarketplaceV2);
        expect(await marketplace.implementationAddress() !== oldImplementationAddress).to.equal(true);
        expect(await marketplace.testFunction()).to.equal(123456);
    });


    it("Revert EVM state", async function () {
        await provider.send("evm_revert", [snapshotId]);
    });
});



/*****************      Helper Functions     *****************/

/*
 * Convert order data to typed data for signing
 */
const toTypedOrder = async (
    userAddress, tokenAddress, id, quantity, listingType, paymentTokenAddress, valueToPay, deadline, bundleTokens, bundleTokensQuantity, salt
) => {
    const domain = {
        chainId: 4,
        name: 'Decrypt Marketplace',
        verifyingContract: marketplace.address,
        version: '1',
    };

    const types = {
        Order: [
            { name: 'user', type: 'address' },
            { name: 'tokenAddress', type: 'address' },
            { name: 'tokenId', type: 'uint256' },
            { name: 'quantity', type: 'uint256' },
            { name: 'listingType', type: 'uint256' },
            { name: 'paymentToken', type: 'address' },
            { name: 'value', type: 'uint256' },
            { name: 'deadline', type: 'uint256' },
            { name: 'bundleTokens', type: 'uint256[]' },
            { name: 'bundleTokensQuantity', type: 'uint256[]' },
            { name: 'salt', type: 'uint256' },
        ],
    };

    const value = {
        user: userAddress,
        tokenAddress: tokenAddress,
        tokenId: id,
        quantity: quantity,
        listingType: listingType,
        paymentToken: paymentTokenAddress,
        value: valueToPay,
        deadline: deadline,
        bundleTokens: bundleTokens,
        bundleTokensQuantity: bundleTokensQuantity,
        salt: salt,
    };

    return { domain, types, value };
}


/*
 * Returns split signature, generated by signing typed data by signer
 */
const getSignature = async (signer,...args) => {
    const order = await toTypedOrder(...args);

    const signedTypedHash =  await signer._signTypedData(
        order.domain,
        order.types,
        order.value
    );
    const sig = ethers.utils.splitSignature(signedTypedHash);

    return [sig.v, sig.r, sig.s];
}


/*
 * Returns hashed typed data, generated with raw data
 */
const getHashedTypedData = async (...args) => {
    const order = await toTypedOrder(...args);

    return ethers.utils._TypedDataEncoder.hash(
        order.domain,
        order.types,
        order.value
    );
}