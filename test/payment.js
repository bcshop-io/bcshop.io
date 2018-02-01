let Web3 = require("web3");
let web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));
let utils = new (require("./timeutils.js"))(web3);

let Storage = artifacts.require("ProductStorage");
let FeePolicy = artifacts.require("FeePolicy");
let Payment = artifacts.require("ProductPayment");

contract("ProductPayment. Fully unlimited offer", function(accounts) {

    let storage;
    let factory;
    let feePolicy;
    let payment;
    let owner = accounts[0];
    let provider = accounts[1];
    let vendor = accounts[2];
    let buyer = accounts[3];
    let feePromille = 100;
    let price = 100000000000000;
    let expectedFee = price * feePromille / 1000;

    before(async function() {
        storage = await Storage.new();        
        feePolicy = await FeePolicy.new(feePromille, provider);
        payment = await Payment.new(storage.address, feePolicy.address);

        await storage.setManager(payment.address, true);
        await storage.createProduct(vendor, vendor, price, 0, 0, 0, 0, "", "");
    });

    it("verifies data after purchase of 2 units", async function() {
        await payment.buy(0, buyer, "ID1", false, price, {from:buyer, value:2*price});
        
        let data = await storage.getProductData.call(0);
        assert.equal(data[2], 2, "invalid sold units");
        assert.equal(await storage.getTotalPurchases.call(0), 1, "invalid total purchases");

        // let purchase = await storage.getPurchase.call(0, 0);
        // assert.equal(purchase[0], buyer, "Invalid buyer");
        // assert.equal(purchase[1], "ID1", "Invalid id");
        // assert.equal(purchase[2], price, "Invalid price");
        // assert.equal(purchase[3], 2, "Invalid amount");
    });

    it("verifies fee and payment amounts", async function() {
        let oldProviderBalance = await web3.eth.getBalance(provider);
        let oldVendorBalance = await web3.eth.getBalance(vendor);

        await payment.buy(0, buyer, "ID1", false, price, {from:buyer, value:price});

        let newProviderBalance = await web3.eth.getBalance(provider);
        let newVendorBalance = await web3.eth.getBalance(vendor);

        assert.equal(newProviderBalance.minus(oldProviderBalance), expectedFee, "Invalid fee received");
        assert.equal(newVendorBalance.minus(oldVendorBalance), price - expectedFee, "Invalid payment received");
    });

    it("verifies withdraw overpay", async function() {
        let overpay = price / 10;
        let oldOverpay = await payment.pendingWithdrawals.call(buyer);
        await payment.buy(0, buyer, "ID1", false, price, {from:buyer, value:+price+price/10});

        assert.equal(await payment.pendingWithdrawals.call(buyer), +oldOverpay+overpay, "Invalid overpay amount");

        let oldBalance = await web3.eth.getBalance(buyer);
        let gasPrice = 100;
        let tx = await payment.withdrawOverpay({from:buyer, gasPrice:gasPrice});
       // console.log(tx);
        let newBalance = await web3.eth.getBalance(buyer);
        assert.equal(newBalance.minus(oldBalance).toNumber(), overpay - tx.receipt.gasUsed*gasPrice);
    });

    //TODO check all the purchase constraints (time, active flag, banned, maxUnits, acceptLess, invalid price)
});


contract("Measure gas usage", function(accounts) {
    let storage;    
    let feePolicy;
    let payment;
    let owner = accounts[0];
    let provider = accounts[1];
    let vendor = accounts[2];
    let buyer = accounts[3];
    let feePromille = 100;
    let price = 10000;
    let expectedFee = price * feePromille / 1000;
    let startTime = utils.currentTime() - 1;
    let endTime = utils.currentTime() + 100000;

    before(async function() {
        storage = await Storage.new();        
        feePolicy = await FeePolicy.new(feePromille, provider);
        payment = await Payment.new(storage.address, feePolicy.address);

        await storage.setManager(payment.address, true);
        
        await storage.createProduct(vendor, vendor, price, 10, startTime, endTime, 0, "", "");
    });

    it("measure", async function() {
        assert.isTrue(await storage.isProductActive.call(0), "!");
        let tx = await payment.buy(0, buyer, "ID1", false, price, {from:buyer, value:price});
        console.log("Purchase gas used: " + tx.receipt.gasUsed);

        tx = await payment.buy(0, buyer, "ID1", false, price, {from:buyer, value:price});
        console.log("Purchase gas used: " + tx.receipt.gasUsed);
    });
});