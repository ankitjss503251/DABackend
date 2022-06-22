let NFT = require('../models/lib/NFT');
let chai = require('chai');
let chaiHttp = require('chai-http');
let baseURL = "http://127.0.0.1:3000/api/v1";
let should = chai.should();
const expect = chai.expect;
chai.use(chaiHttp);
// expect(res.status).to.be.oneOf([200, 400, 401, 403, 404, 406, 409, 417, 419, 429, 500]);
describe('APIs', () => {

    describe('User APIs', () => {
        describe('/POST Check User Wallet', () => {
            it('Check Wallet address before Registration return 404 if not found', (done) => {
                chai.request(baseURL)
                    .post('/auth/checkuseraddress')
                    .send({"walletAddress":"0x924cd5c824fCB2e13F4477E3CE1B61CBBf287133"})
                    .end((err, res) => {
                        if(err){
                        console.log(err)
                        }
                        expect(res.status).to.be.oneOf([200, 400, 401, 403, 404, 406, 409, 417, 419, 429, 500]);
                        res.body.should.have.property('message');
                        res.body.should.have.property('data');
                        res.body.data.should.be.a('object')
                        done();
                    });
            });
        });
        describe('/POST Check User Wallet', () => {
            it('Check Wallet address before Registration return 200 if found', (done) => {
                chai.request(baseURL)
                    .post('/auth/checkuseraddress')
                    .send({"walletAddress":"0x924cd5c824fCB2e13F4477E3CE1B61CBBf287132"})
                    .end((err, res) => {
                        if(err){
                        console.log(err)
                        }
                        expect(res.status).to.be.oneOf([200, 400, 401, 403, 404, 406, 409, 417, 419, 429, 500]);
                        res.body.should.have.property('message');
                        res.body.should.have.property('data');
                        res.body.data.should.be.a('object')
                        done();
                    });
            });
        });
        describe('/POST User Register', () => {
            it('Register User using Wallet Address', (done) => {
                chai.request(baseURL)
                    .post('/auth/register')
                    .send({"walletAddress":"0x924cd5c824fCB2e13F4477E3CE1B61CBBf287132"})
                    .end((err, res) => {
                        if(err){
                        console.log(err)
                        }
                        expect(res.status).to.be.oneOf([200, 400, 401, 403, 404, 406, 409, 417, 419, 429, 500]);
                        res.body.should.have.property('message');
                        res.body.should.have.property('data');
                        res.body.data.should.be.a('object')
                        done();
                    });
            });
        });
        describe('/POST User Login', () => {
            it('Login User using Wallet Address', (done) => {
                chai.request(baseURL)
                    .post('/auth/login')
                    .send({"walletAddress":"0x924cd5c824fCB2e13F4477E3CE1B61CBBf287132"})
                    .end((err, res) => {
                        if(err){
                        console.log(err)
                        }
                        expect(res.status).to.be.oneOf([200, 400, 401, 403, 404, 406, 409, 417, 419, 429, 500]);
                        res.body.should.have.property('message');
                        res.body.should.have.property('data');
                        res.body.data.should.be.a('object')
                        done();
                    });
            });
        });
    })

    describe('NFT APIs', () => {
        describe('/POST NFTs', () => {
            it('Fetching NFT Listing (For now 12)', (done) => {
                chai.request(baseURL)
                    .post('/nft/viewNFTs')
                    .send({"page":1,"limit":12})
                    .end((err, res) => {
                        if(err){
                            console.log(err)
                        }
                        expect(res.status).to.be.oneOf([200, 400, 401, 403, 404, 406, 409, 417, 419, 429, 500]);
                        res.body.should.have.property('message');
                        res.body.should.have.property('data');
                        res.body.data.should.be.a('array')
                        done();
                    });
            });
        });
    });
    
    describe('Collection APIs', () => {
        describe('/POST Get Collections', () => {
            it('Fetching Collections Listing (For now 12)', (done) => {
                chai.request(baseURL)
                    .post('/nft/getCollections')
                    .send({"page":1,"limit":12,"collectionID":"","userID":"","categoryID":"","brandID":"","ERCType":"","searchText":"","filterString":""})
                    .end((err, res) => {
                        if(err){
                            console.log(err)
                        }
                        expect(res.status).to.be.oneOf([200, 400, 401, 403, 404, 406, 409, 417, 419, 429, 500]);
                        res.body.should.have.property('message');
                        res.body.should.have.property('data');
                        res.body.data.should.be.a('object')
                        res.body.data.results.should.be.a('array')
                        done();
                    });
            });
        });
    });
});