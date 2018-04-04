let ProductStorage = artifacts.require("ProductStorage");
let ProductMaker = artifacts.require("ProductMaker");
let Token = artifacts.require("BCSToken");
let EtherFund = artifacts.require("EtherFund");
let ProxyFund = artifacts.require("ProxyFund");
let FeePolicy = artifacts.require("FeePolicy");
let DiscountPolicy = artifacts.require("DiscountPolicy");
let ProductPayment = artifacts.require("ProductPayment");
let EtherPriceProvider = artifacts.require("EtherPriceProvider");

let OneEther = 1000000000000000000;
let Price1 = OneEther/100;

module.exports = async function(deployer, network, accounts) {
    let owner = accounts[0];
    let provider = accounts[1];
    let escrow = accounts[2];
    let user1 = accounts[3];
    let user2 = accounts[4];
    let vendor1 = accounts[5];
    let vendor2 = accounts[6];
    let vendor3 = accounts[7];
    let vendor4 = accounts[8];
    let vendor5 = accounts[9];

    let bancorOwner = accounts[7];

    let storage;
    let factory;
    let payment;

    ProductStorage.deployed().then(function(storageDeployed) {
        storage = storageDeployed;
        return ProductMaker.deployed();
    }).then(function(factoryDeployed) {
        factory = factoryDeployed;        
        return ProductPayment.deployed();
    }).then(function(paymentDeployed) {
        payment = paymentDeployed;
    }).then(async function() {
        console.log("Storage " + storage.address);
        console.log("Factory " + factory.address);
        console.log("Payment " + payment.address);
        
        await factory.createSimpleProductAndVendor(vendor1, Price1, 0, true, 0, 0, false, false, "Product1", "Email", {from:vendor1});
        await factory.createSimpleProduct(Price1 / 2, 2, true, 0, 0, true, false, "Escrowed", "Phone", {from:vendor1});
        await factory.createSimpleProductAndVendor(vendor2, 2000000, 0, true, 123000, 456789, false, false,"Product2", "Address", {from:vendor2});

        await payment.buyWithEth(0, 2, "MyEmail@gmail.com", false, Price1, {from:user1, value:Price1*2});
        await payment.buyWithEth(0, 1, "User@mail.ru", false, Price1, {from:user2, value:Price1});
        await payment.buyWithEth(1, 1, "+0123456789", true, Price1/2, {from:user2, value:Price1/2});
    });
}