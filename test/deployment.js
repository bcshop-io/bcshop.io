let fs = require("fs");
let Web3 = require("web3");
let web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));
let utils = new (require("./utils.js"))(web3);

let ProductStorage = artifacts.require("ProductStorage");
let ProductMaker = artifacts.require("ProductMaker");
let ProductPayment = artifacts.require("ProductPayment");
let FeePolicy = artifacts.require("FeePolicy");
let DiscountPolicy = artifacts.require("DiscountPolicy");
let EtherPrice = artifacts.require("EtherPriceProvider");
let EtherFund = artifacts.require("EtherFund");
let ProxyFund = artifacts.require("ProxyFund");
let Token = artifacts.require("BCSToken");

let token;
let storage;
let factory;
let payment;
let feePolicy;
let discountPolicy;
let etherPrice;
let feePool;
let discountPool;
let config;
contract("Deployment", function(accounts) {

    before(async function() {
        config = JSON.parse(fs.readFileSync("./products.json")); 

        token = Token.at(config.token.address);
        storage = ProductStorage.at(config.storage.address);
        factory = ProductMaker.at(config.factory.address);
        feePolicy = FeePolicy.at(config.feePolicy.address);
        discountPolicy = DiscountPolicy.at(config.discountPolicy.address);
        payment = ProductPayment.at(config.payment.address);
        discountPool = ProxyFund.at(config.discountPool.address);
        etherPrice = EtherPrice.at(config.etherPrice.address);
        feePool = EtherFund.at(config.feePool.address);
    });    

    it("", async function() {
        assert.equal(
            storage.address, 
            await factory.productStorage.call(), 
            "Invalid storage in factory"
        );
    
        assert.isAbove(
            await feePool.sharePermille.call(discountPool.address),
            0,
            "Invalid DiscountPool's share"
        );

        assert.equal(
            feePool.address,
            await discountPool.baseFund.call(),
            "Invalid base fund in discount pool"
        );

        assert.equal(
            discountPool.address, 
            await discountPolicy.pool.call(), 
            "Invalid pool in discount policy"
        );
        assert.equal(
            token.address,
            await discountPolicy.token.call(),
            "Invalid token in discount policy"
        );

        assert.equal(
            storage.address, 
            await feePolicy.productStorage.call(), 
            "Invalid storage in fee policy"
        );
        assert.equal(
            feePool.address, 
            await feePolicy.feeWallet.call(), 
            "Invalid wallet in fee policy"
        );
        assert.equal(
            token.address,
            await feePolicy.token.call(),
            "Invalid token in fee policy"
        );
        

        assert.equal(
            storage.address,
            await payment.productStorage.call(),
            "Invalid storage in payment"
        );
        assert.equal(
            feePolicy.address,
            await payment.feePolicy.call(),
            "Invalid fee policy in payment"
        );
        assert.equal(
            discountPolicy.address,
            await payment.discountPolicy.call(),
            "Invalid discount policy in payment"
        );
        assert.equal(
            etherPrice.address,
            await payment.etherPriceProvider.call(),
            "Invalid storage in payment"
        );
        assert.equal(
            token.address,
            await payment.token.call(),
            "Invalid token in payment"
        );

        assert.isTrue(
            await storage.managers.call(factory.address),
            "Factory should be manager in the storage"
        );
        assert.isTrue(
            await storage.managers.call(payment.address),
            "Payment should be manager in the storage"
        );
        assert.isTrue(
            await discountPool.managers.call(discountPolicy.address),
            "Discount Policy should be manager in the discount pool"
        );
        assert.isTrue(
            await discountPolicy.managers.call(payment.address),
            "Payment should be manager in discount policy"
        );
        assert.isTrue(
            await feePolicy.managers.call(payment.address),
            "Payment should be manager in the fee policy"
        );

        assert.equal(
            config.bcsConverter.address,
            await payment.converter.call(),
            "Invalid bancor converter"
        );

        assert.equal(
            token.address,
            await payment.convertPath.call(0),
            "Invalid convert path[0]"
        );
        assert.equal(
            config.relayToken.address,
            await payment.convertPath.call(1),
            "Invalid convert path[1]"
        );
        assert.equal(
            config.bntToken.address,
            await payment.convertPath.call(2),
            "Invalid convert path[2]"
        );
        assert.equal(
            config.bntToken.address,
            await payment.convertPath.call(3),
            "Invalid convert path[3]"
        );
        assert.equal(
            config.ethToken.address,
            await payment.convertPath.call(4),
            "Invalid convert path[4]"
        );
        
    });

    it("Check convert path length", async function() {
        try {
            await payment.convertPath.call(6);
        } catch(e) {
            return true;
        }
        throw "!";
    });
});