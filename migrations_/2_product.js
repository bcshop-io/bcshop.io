let fs = require("fs");

// let Web3 = require("web3");
// let web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));
// let utils = new (require("../test/utils.js"))(web3);

let ProductStorage = artifacts.require("ProductStorage");
let ProductMaker = artifacts.require("ProductMaker");
let Token = artifacts.require("BCSToken");
let EtherFund = artifacts.require("EtherFund");
let ProxyFund = artifacts.require("ProxyFund");
let FeePolicy = artifacts.require("FeePolicy");
let DiscountPolicy = artifacts.require("DiscountPolicy");
let ProductPayment = artifacts.require("ProductPayment");
let EtherPriceProvider = artifacts.require("EtherPriceProvider");
let TokenCap = 10000;
let TokenDecimals = 18;
let OneEther = 1000000000000000000;
let Price1 = OneEther/100;
let ProfitPermille = 200;
let DiscountPermille = 800;
let MinPoolForDiscount = OneEther / 1000;
let DiscountsInPool = 10;
let MaxDiscount = 300; //=30%
let MinTokensForDiscount = 10000000000000000000; //10 bcs

let MinTokensForFeeDiscount = 10000000000000000000; //10 bcs
let FeePermille = 100;
let EscrowFeePermille = 50;
let FiatPriceFeePermille = 50;
let FeeDiscountTerm = 86400; //1 day
const MaxDiscountPerToken = OneEther/10;
let FeeDiscountPermille = 600;
let EscrowTime = 3600; //1 hour
let bancorConverter;
const LevelTokens = [OneEther, 2*OneEther, 3*OneEther]; 
const LevelPcts = [100, 200, 300];

module.exports = async function(deployer, network, accounts) {

    let Utils = require("../test/utils.js");
    let utils = new Utils(Utils.createWeb3(network));
  
    let info = {
        storage: {},
        factory: {},
        token: {},
        feePool: {},
        discountPool: {},
        feePolicy: {},
        discountPolicy: {},
        payment: {},
        etherPrice: {},
        bcsConverter: {},
        bntConverter: {},
        bntToken: {},
        ethToken: {},
        relayToken: {}
    };

    let owner = accounts[0];
    let provider = accounts[1];
    let escrow = accounts[2];
    let user1 = accounts[3];
    let user2 = accounts[4];
    let vendor1 = accounts[5];
    let vendor2 = accounts[6];
    let bancorOwner = accounts[7];

    let storage;
    let factory;
    let token;
    let feePool;
    let discountPool;
    let feePolicy;
    let discountPolicy;
    let payment;
    let etherPrice;

    deployer.deploy(ProductStorage, {gas:2700000}).then(function() {        
        return ProductStorage.deployed();
    }).then(function(storageDeployed) {
        storage = storageDeployed;        
        info.storage.address = storage.address;
        info.storage.block = utils._web3.eth.blockNumber;
        info.storage.abi = ProductStorage.abi;        
        return deployer.deploy(Token, TokenCap, TokenDecimals);
    }).then(function() {
        return Token.deployed();
    }).then(function(tokenDeployed) {
        token = tokenDeployed;
        info.token.address = token.address;
        info.token.block = utils._web3.eth.blockNumber;
        info.token.abi = Token.abi;
        return deployer.deploy(ProductMaker, storage.address);
    }).then(function() {
        return ProductMaker.deployed();
    }).then(function(factoryDeployed) {
        factory = factoryDeployed;
        info.factory.address = factory.address;
        info.factory.block = utils._web3.eth.blockNumber;
        info.factory.abi = factory.abi;        
    }).then(function() {
        return deployer.deploy(ProxyFund);
    }).then(function() {
        return ProxyFund.deployed();
    }).then(function(fundDeployed) {
        discountPool = fundDeployed;
        info.discountPool.address = discountPool.address;
        info.discountPool.block = utils._web3.eth.blockNumber;
        info.discountPool.abi = discountPool.abi;
    }).then(function() {
        return deployer.deploy(EtherFund, discountPool.address, 1000 - ProfitPermille, provider, ProfitPermille);
    }).then(function() {
        return EtherFund.deployed();
    }).then(function(fundDeployed) {
        feePool = fundDeployed;
        info.feePool.address = feePool.address;
        info.feePool.block = utils._web3.eth.blockNumber;
        info.feePool.abi = feePool.abi;
    }).then(function() {
        return deployer.deploy(DiscountPolicy, MinPoolForDiscount, DiscountsInPool, MaxDiscount, 
                                discountPool.address, token.address, LevelTokens, LevelPcts);
    }).then(function() {
        return DiscountPolicy.deployed();
    }).then(function(discountPolicyDeployed) {
        discountPolicy = discountPolicyDeployed;
        info.discountPolicy.address = discountPolicy.address;
        info.discountPolicy.block = utils._web3.eth.blockNumber;
        info.discountPolicy.abi = discountPolicy.abi;
    }).then(function() {
        return deployer.deploy(FeePolicy, storage.address, FeePermille, EscrowFeePermille, FiatPriceFeePermille, feePool.address, token.address, 
                                MinTokensForFeeDiscount, FeeDiscountTerm, MaxDiscountPerToken, FeeDiscountPermille);
    }).then(function() {
        return FeePolicy.deployed();
    }).then(function(feePolicyDeployed) {
        feePolicy = feePolicyDeployed;
        info.feePolicy.address = feePolicy.address;
        info.feePolicy.block = utils._web3.eth.blockNumber;
        info.feePolicy.abi = feePolicy.abi;
    }).then(function() {
        return deployer.deploy(EtherPriceProvider);
    }).then(function() {
        return EtherPriceProvider.deployed();
    }).then(function(etherPriceDeployed) {
        etherPrice = etherPriceDeployed;
        info.etherPrice.address = etherPrice.address;
        info.etherPrice.block = utils._web3.eth.blockNumber;
        info.etherPrice.abi = etherPrice.abi;
    }).then(function() {
        return deployer.deploy(ProductPayment, storage.address, feePolicy.address, discountPolicy.address, 
                                token.address, etherPrice.address, EscrowTime, {gas:3000000});
    }).then(function() {
        return ProductPayment.deployed();
    }).then(function(paymentDeployed) {
        payment = paymentDeployed;
        //console.log("Payment gas used: " + utils._web3.eth.getTransactionReceipt(payment.transactionHash).gasUsed);
        info.payment.address = payment.address;
        info.payment.block = utils._web3.eth.blockNumber;
        info.payment.abi = payment.abi;
    }).then(async function(){
        //1eth = 1000$
        await etherPrice.updateRate(10000000000000);

        let tokens = 1000000000000000000;
        await token.setLockedState(false);
        await token.transfer(accounts[1], tokens);
        await token.transfer(accounts[2], 2 * tokens);
        await token.transfer(accounts[3], 3 * tokens);

        await discountPool.setBaseFund(feePool.address);

        await storage.setManager(factory.address, true);    
        await storage.setManager(payment.address, true);
        
        await discountPool.setManager(discountPolicy.address, true);
        await discountPolicy.setManager(payment.address, true);
        await feePolicy.setManager(payment.address, true);     

        let bancorData = await utils.createBancor(bancorOwner, owner, token, payment, artifacts);
        info.bcsConverter.address = bancorData.bcsConverter.address;
        info.bcsConverter.abi = bancorData.bcsConverter.abi;
        info.bntConverter.address = bancorData.bntConverter.address;
        info.bntConverter.abi = bancorData.bntConverter.abi;
        info.bntToken.address = bancorData.bntToken.address;
        info.bntToken.abi = bancorData.bntToken.abi;
        info.ethToken.abi = bancorData.ethToken.abi;
        info.ethToken.address = bancorData.ethToken.address;
        info.relayToken.address = bancorData.relayToken.address;
        info.relayToken.abi = bancorData.relayToken.abi;

        // await factory.createSimpleProductAndVendor(vendor1, Price1, 0, true, 0, 0, false, false, "Product1", "Email", {from:vendor1});
        // await factory.createSimpleProduct(Price1 / 2, 2, true, 0, 0, true, false, "Escrowed", "Phone", {from:vendor1});
        // await factory.createSimpleProductAndVendor(vendor2, 2000000, 0, true, 123000, 456789, false, false,"Product2", "Address", {from:vendor2});

        // await payment.buyWithEth(0, 2, "MyEmail@gmail.com", false, Price1, {from:user1, value:Price1*2});
        // await payment.buyWithEth(0, 1, "User@mail.ru", false, Price1, {from:user2, value:Price1});
        // await payment.buyWithEth(1, 1, "+0123456789", true, Price1/2, {from:user2, value:Price1/2});

        // await token.approve(payment.address, TokenCap * OneEther);
        // let tokensSpend = 1.2 * OneEther;
        // let tx = await payment.buyWithTokens(tokensSpend, 0, 1, "ID", true, Price1);
        
        fs.writeFileSync("products.json", JSON.stringify(info, null , '\t'));
    });
}