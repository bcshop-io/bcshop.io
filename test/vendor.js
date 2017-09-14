var Web3 = require("web3");
var web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));
var utils = new (require("./timeutils.js"))(web3);

var Vendor = artifacts.require("NamedVendor");
var Product = artifacts.require("Product");
var vendor, product;

var Fee = 100;
var Price = 100;
var owner, vendor, provider, user1, user2;

function Prepare(accounts) {
    return new Promise(async (resolve, reject) => {
        
        owner = accounts[0];
        vendor = accounts[1];
        provider = accounts[2];
        user1 = accounts[3];
        user2 = accounts[4];

        vendor = await Vendor.new("V1", vendor, provider, Fee);

        return resolve(true);
    })    
}

contract("Product. Overpays and limited supply.", function(accounts) {
    var Limit = 10;
    it("create limited product, 10 units", async function() {
        await Prepare(accounts);
        await vendor.createProduct("PLimited", Price, true, Limit, false, 0, 0);
        product = Product.at(await vendor.products.call(0));
        assert.isTrue(await product.isLimited.call(), "Product should be limited");
        assert.equal((await product.maxUnits.call()).toNumber(), 10, "Product's limit should be 10");
    })

    it("buy 1", async function() {
        await product.buy("C1", true, Price, {from:user1, value: Price});
        assert.equal(await product.soldUnits.call(), 1, "Should have sold 1 unit");
    })    

    it("buy 10, don't accept less, should fail", async function() {        
        try {
            await product.buy("C10", false, Price, {from:user2, value:Price*10});
        } catch (e) {
            return true;
        }
        assert.isTrue(false, "Purchase should fail");
    })

    it("buy 11, accept less, should result in overpay", async function() {
        await product.buy("C10", true, Price, {from:user2, value:Price*11});        
        assert.equal(await product.getTotalPurchases.call(), 2, "Should have 2 purchases");
        
        var purchase = await product.getPurchase.call(1);
        assert.equal(purchase[2].toNumber(), 9, "The latest purchase is 9 units");

        assert.equal((await product.pendingWithdrawals.call(user2)).toNumber(), Price * 2, "User2 should have overpay equal to price of 2 units");
    })

    it("no products left", async function() {
        assert.equal((await product.soldUnits.call()).toNumber(), 
                    (await product.maxUnits.call()).toNumber(), 
                    "Should have sold max units");
    })

    it("try to buy 1, accept less, should fail", async function() {
        try {
            await product.buy("F1", true, Price, {from:user2, value:Price});
        } catch (e) {
            return true;
        }
        assert.isTrue(false, "Purchase should fail");    
    })

    it("try to buy 1, don't accept less, should fail", async function() {
        try {
            await product.buy("F2", false, Price, {from:user2, value:Price});
        } catch (e) {
            return true;
        }
        assert.isTrue(false, "Purchase should fail");    
    })

    it("check overpay", async function() {
        assert.equal((await product.pendingWithdrawals.call(user2)).toNumber(), Price * 2, "User2 should have overpay equal to price of 2 units");
    })
})

contract("Product. Change price.", function(accounts) {    
    it("create product and buy one", async function() {
        await Prepare(accounts);
        await vendor.createProduct("PPrice1", Price, false, 0, false, 0, 0);
        product = Product.at(await vendor.products.call(0));
        
        await product.buy("C1", true, Price, {from:user1, value: Price});
        assert.equal(await product.soldUnits.call(), 1, "Should have sold 1 unit");
    })

    it("change price", async function() {
        await product.setParams("PPrice2", Price * 2, false, 0, false, 0, 0, true);
        assert.equal(await product.price.call(), Price*2, "New price should be old*2");
    })

    it("buy 4 with old price in params, should fail ", async function() {
        try {
            await product.buy("C2", true, Price, {from:user2, value:Price*4});
        } catch(e) {
            return true;
        }
        
        assert.isTrue(false, "Purchase should fail");
    })

    it("buy one with new price", async function() {
        await product.buy("C3", true, Price*2, {from:user2, value: Price * 2});
        assert.equal(await product.soldUnits.call(), 2, "Should have sold 2 units");

        var purchase = await product.getPurchase.call(1);
        assert.equal(purchase[2].toNumber(), 1, "The latest purchase is 1 unit");
    }) 
})

contract("Product. Direct ether send to Product.", function(accounts) {
    it("create product", async function() {
        await Prepare(accounts);
        await vendor.createProduct("P1", Price, false, 0, false, 0, 0);
        product = Product.at(await vendor.products.call(0));
        assert.isTrue(await product.isActive.call(), "Product should be in active state");
    })

    it("try to send ether directly", async function() {
        try {
            await web3.eth.sendTransaction({from: user1, to:product.address, value: Price * 2});            
        } catch (e) {
            return true;
        }
        assert.isTrue(false, "Ether transfer should fail");
    })

    it("check purchases", async function() {
        assert.equal(await product.getTotalPurchases.call(), 0, "Should be 0 purchases");
    })
})
