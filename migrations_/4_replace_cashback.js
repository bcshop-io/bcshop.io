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
    let payment = ProductPayment.at(config.payment.address);
    let etherPrice = EtherPriceProvider.at(config.etherPrice.address);
    let feePolicy = FeePolicy.at(config.feePolicy.address);
    let factory = ProductMaker.at(config.factory.address);

    console.log("Token " + token.address);
    console.log("Storage " + storage.address);
    console.log("Discount pool " + discountPool.address);
    console.log("Fee pool " + feePool.address);
    console.log("Payment "+  payment.address);
    console.log("Fee policy "+ feePolicy.address);    

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
    console.log("1. Discount policy " + discountPolicy.address);

    await discountPolicy.setManager(payment.address, true);
    await payment.setParams(storage.address, feePolicy.address, discountPolicy.address, token.address, etherPrice.address, EscrowTime);

    // await utils.sendEther(accounts[0], feePool.address, MinPoolForDiscount*2);

    // await factory.createSimpleProductAndVendor(accounts[8], Price1, 0, true, 0, 0, false, false, "Product1", "Email", {from:accounts[8]});
    // let tx = await payment.buyWithEth(0, 2, "MyEmail@gmail.com", false, Price1, {from:accounts[3], value:Price1*2});
    // console.log(tx.logs[0].args);

    fs.writeFileSync("cashback.json", JSON.stringify(info, null , '\t'));
}