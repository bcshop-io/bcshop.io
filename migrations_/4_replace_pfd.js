let fs = require("fs");

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
let FiatPriceFeePermille = 0;
let FeeDiscountTerm = 86400; //1 day
const MaxDiscountPerToken = OneEther/10;
let FeeDiscountPermille = 600;
let EscrowTime = 3600; //1 hour

const LevelTokens = [OneEther, 2*OneEther, 3*OneEther]; 
const LevelPcts = [100, 200, 300];

module.exports = async function(deployer, network, accounts) {

    let Utils = require("../test/utils.js");
    let utils = new Utils(Utils.createWeb3(network), artifacts);    

    let info = {
        feePolicy: {},
        discountPolicy: {},
        payment: {}
    };

    let config = JSON.parse(fs.readFileSync("products.json"));
    let storage = ProductStorage.at(config.storage.address);    
    let token = Token.at(config.token.address);
    let feePool = EtherFund.at(config.feePool.address);
    let discountPool = ProxyFund.at(config.discountPool.address);    
    let oldPayment = ProductPayment.at(config.payment.address);
    let etherPrice = EtherPriceProvider.at(config.etherPrice.address);

    console.log("Token " + token.address);
    console.log("Storage " + storage.address);
    console.log("Discount pool " + discountPool.address);
    console.log("Fee pool " + feePool.address);
    console.log("Old payment "+  oldPayment.address);

    let convertPath = [
        await oldPayment.convertPath.call(0),
        await oldPayment.convertPath.call(1),
        await oldPayment.convertPath.call(2),
        await oldPayment.convertPath.call(3),
        await oldPayment.convertPath.call(4)
    ];
    console.log(convertPath);
    let quickConverter = await oldPayment.converter.call();
    console.log("Converter " + quickConverter);

    let feePolicy = await utils.createFeePolicy(
        storage, 
        FeePermille, 
        EscrowFeePermille, 
        FiatPriceFeePermille, 
        feePool.address, 
        token,
        MinTokensForFeeDiscount, 
        FeeDiscountTerm, 
        MaxDiscountPerToken, 
        FeeDiscountPermille
    );
    info.feePolicy.address = feePolicy.address;
    info.feePolicy.block = utils._web3.eth.blockNumber;
    info.feePolicy.abi = feePolicy.abi;
    console.log("1. Fee policy " + feePolicy.address);

    let discountPolicy = await utils.createDiscountPolicy(
        MinPoolForDiscount, 
        DiscountsInPool, 
        MaxDiscount, 
        discountPool, 
        token, 
        LevelTokens, 
        LevelPcts
    );
    info.discountPolicy.address = discountPolicy.address;
    info.discountPolicy.block = utils._web3.eth.blockNumber;
    info.discountPolicy.abi = discountPolicy.abi;
    console.log("2. Discount policy " + discountPolicy.address);

    let payment = await utils.createPayment(
        storage, 
        feePolicy, 
        discountPolicy,
        token, 
        etherPrice, 
        EscrowTime
    );

    info.payment.address = payment.address;
    info.payment.block = utils._web3.eth.blockNumber;
    info.payment.abi = payment.abi;
    console.log("3. Payment " + payment.address);

    await payment.setConvertParams(quickConverter, convertPath);
   
    console.log(await payment.convertPath.call(0));
    console.log(await payment.converter.call());
    
    fs.writeFileSync("pfd.json", JSON.stringify(info, null , '\t'));
}