//
// Tests bonus token sale process. Creates TokenVendor and TokenProduct.
// Then we donate some ether to product contract from different accounts
//

var Web3 = require("web3");
web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));
var utils = new (require("./timeutils.js"))(web3);

var Token = artifacts.require("BCSPromoToken");
var Vendor = artifacts.require("TokenVendor");
var Product = artifacts.require("TokenProduct");

var token;
var vendor;
var sale1;
var sale2;
var saleStart;
var saleEnd;

var owner;
var beneficiary;
var investor1;
var investor2;
var investor3;
var investor4;
var investor5;
var investor6;
var investor7;
var investor8;
var multiplier = 10000;

function Prepare(accounts) {
    return new Promise(async (resolve, reject) => {
        owner = accounts[0];
        beneficiary = accounts[1];
        investor1 = accounts[2];
        investor2 = accounts[3];
        investor3 = accounts[4];
        investor4 = accounts[5];
        investor5 = accounts[6];
        investor6 = accounts[7];
        investor7 = accounts[8];
        investor8 = accounts[9];
        
        token = await Token.new("BCSBONUS TOKEN", "BB", 0);
        //await token.setLockedState(true);
        vendor = await Vendor.new("", beneficiary, 1, 10, 100, 3, 5);
        await token.setManager(vendor.address, true);
        await vendor.setToken(token.address);

        return resolve(true);
    })
}

contract("BCSPromoToken, TokenVendor, TokenProduct. No time limits", function(accounts) {
    it("create", async function() {
        await Prepare(accounts);
        assert.equal(await vendor.name.call(), "", "Check name");
        assert.equal(await vendor.vendor.call(), beneficiary, "Check vendor wallet");        
    })

    it("create offer 1", async function () {        
        //await vendor.createProduct("S1", 0, true, 7, false, 0, 0);
        await vendor.quickCreatePromo("S1", 7);
        sale1 = Product.at(await vendor.products.call(0));
        assert.equal(await sale1.token.call(), token.address, "Invalid token");
    })

    it("create offer 2", async function() {
        //await vendor.createProduct("S2", 0, true, 12, false, 0, 0);
        await vendor.quickCreatePromo("S2", 12);
        sale2 = Product.at(await vendor.products.call(1));
        assert.equal(await sale2.token.call(), token.address, "Invalid token");
        assert.equal(await sale2.maxUnits.call(), 12, "Invalid max units");
    })

    it("buy tokens", async function() {
        var ownerTokens = (await token.balanceOf.call(owner)).toNumber();
        assert.equal(ownerTokens, 0, "Should be 0 tokens intiially");

        var oldbBalance = await web3.eth.getBalance(beneficiary);
                
        await sale1.buy("", false, 0, {from: investor1, value: 0});
        await sale1.buy("p2", false, 0, {from: investor2, value: 1 * multiplier});
        await sale1.buy("p3", false, 0, {from: investor3, value: 1 * multiplier});
        await sale1.buy("p4", false, 0, {from: investor4, value: 2 * multiplier});
        await sale1.buy("p5", false, 0, {from: investor5, value: 2 * multiplier});
        await sale1.buy("p6", false, 0, {from: investor6, value: 2 * multiplier});
        
        var bBalance = await web3.eth.getBalance(beneficiary);        
        
        assert.equal(await token.balanceOf.call(investor1), 1, "Investor1 should have 1 token");
        assert.equal(await token.balanceOf.call(investor2), 1, "Investor2 should have 1 token");
        assert.equal(await token.balanceOf.call(investor3), 10, "Investor4 should have 10 token");
        assert.equal(await token.balanceOf.call(investor4), 1, "Investor4 should have 1 token");
        assert.equal(await token.balanceOf.call(investor5), 100, "Investor5 should have 100 token");
        assert.equal(await token.balanceOf.call(investor6), 10, "Investor6 should have 10 token");

        var balanceChange = bBalance.minus(oldbBalance).toNumber();
        assert.equal(balanceChange, 8 * multiplier, "Beneficiary should get 8");        
        assert.equal(await web3.eth.getBalance(sale1.address), 0, "There should be no ether on product contract by now");
        assert.equal(await token.totalSupply.call(), 123, "Total tokens sold should be 113");
        assert.equal(await sale1.getTotalPurchases.call(), 6, "Should be 6 purchases");
    })

    it("transfer tokens", async function() {
        await token.transfer(investor4, 1, {from: investor3});
        assert.equal(await token.balanceOf.call(investor4), 2, "Investor4 shouild have 2 tokens");
    })

    it("investor bought earlier", async function() {
        //try to make another purchase from investor1, should fail
        try {
            await sale1.buy("f1", false, 0, {from: investor1, value: 2 * multiplier});
        } catch (e) {            
            return true;
        }
        throw new Error("Should never get here");
    })

    it("buy last, no more tokens", async function() {        
        await sale1.buy("p7", false, 0, {from: investor7, value: 1 * multiplier});
        var purchases = (await sale1.getTotalPurchases.call()).toNumber();
        assert.equal(purchases, 7, "Should be 7 purchases");
        assert.equal(purchases, (await sale1.maxUnits.call()).toNumber(), "Should be sold max units");
    })

    it("buy when no more tokens", async function() {
        try {
            await sale1.buy("f1", false, 0, {from: investor8, value: 1 * multiplier});
        } catch (e) {            
            return true;
        }
        throw new Error("Should never get here");        
    })
})

contract("BCSPromoToken, TokenVendor, TokenProduct. Time limits", function(accounts) {        
    it("create", async function() {
        await Prepare(accounts);
        
        assert.equal(await vendor.vendor.call(), beneficiary, "Check vendor wallet");        
    })

    it("create offer 1", async function () {
        var startTime = utils.currentTime() + 300; //starts in 5 minutes
        var endTime = startTime + 600; //lasts for 10 minutes

        await vendor.createProduct("S10", 0, true, 10, false, startTime, endTime);
        
        sale1 = Product.at(await vendor.products.call(0));
        assert.equal(await sale1.token.call(), token.address, "Invalid token");        
    })

    it("buy too early", async function() {
        try {
            await sale1.buy("f1", false, 0, {from: investor1, value: 1 * multiplier});
        } catch (e) {            
            return true;
        }
        throw new Error("Should never get here");
    })

    it("advance time to the start and buy", async function() {
        await utils.timeTravelAndMine(301);
        await sale1.buy("p1", false, 0,  {from: investor1, value: 1 * multiplier});
        assert.equal(await sale1.getTotalPurchases.call(), 1, "Should be 1 purchases");            
    })

    it("advane time to the end and try to buy", async function() {
        await utils.timeTravelAndMine(601);
        try {
            await sale1.buy("f1", false, 0,  {from: investor2, value: 1 * multiplier});
        } catch (e) {            
            return true;
        }
        throw new Error("Should never get here");
    })
})