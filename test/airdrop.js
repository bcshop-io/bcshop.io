//
// Tests airdrop campaign 
//

var Web3 = require("web3");
var web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));

var Airdrop = artifacts.require("AirdropCampaign");
var air;
var air2;

var utils = new (require("./timeutils.js"))(web3);
var Token = artifacts.require("BCSPromoToken");
var token;
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

        return resolve(true);
    })
}

contract("BCSPromoToken, TokenVendor, TokenProduct. No time limits", function(accounts) {
    
    it("create offer 1", async function () { 
        await Prepare(accounts);
        air = await Airdrop.new(token.address, "PROMO", 7, 1, 10, 100, 3, 5, true);
        await token.setMinter(air.address, true);                         
        assert.equal(await air.token.call(), token.address, "Invalid token");
    })

    it("create offer 2", async function() {
        air2 = await Airdrop.new(token.address, "PROMO2", 12, 1, 10, 100, 3, 5, true);
        await token.setMinter(air2.address, true);                
        
        assert.equal(await air2.token.call(), token.address, "Invalid token");
        assert.equal(await air2.maxUnits.call(), 12, "Invalid max units");
        assert.equal(await air2.name.call(), "PROMO2", "Invalid offer 2 name");
    })

    it("buy tokens", async function() {
        var ownerTokens = (await token.balanceOf.call(owner)).toNumber();
        assert.equal(ownerTokens, 0, "Should be 0 tokens intiially");
                        
        await air.buy({from: investor1});
        await air.buy({from: investor2});
        await air.buy({from: investor3});
        await air.buy({from: investor4});
        await air.buy({from: investor5});
        await air.buy({from: investor6});
        
        assert.equal(await token.balanceOf.call(investor1), 1, "Investor1 should have 1 token");
        assert.equal(await token.balanceOf.call(investor2), 1, "Investor2 should have 1 token");
        assert.equal(await token.balanceOf.call(investor3), 10, "Investor3 should have 10 token");
        assert.equal(await token.balanceOf.call(investor4), 1, "Investor4 should have 1 token");
        assert.equal(await token.balanceOf.call(investor5), 100, "Investor5 should have 100 token");
        assert.equal(await token.balanceOf.call(investor6), 10, "Investor6 should have 10 token");
        
        assert.equal(await web3.eth.getBalance(air.address), 0, "There should be no ether on product contract by now");
        assert.equal(await token.totalSupply.call(), 123, "Total tokens sold should be 113");
        assert.equal(await air.soldUnits.call(), 6, "Should be 6 purchases");
    })

    it("transfer tokens", async function() {
        await token.transfer(investor4, 1, {from: investor3});
        assert.equal(await token.balanceOf.call(investor4), 2, "Investor4 shouild have 2 tokens");
    })

    it("investor bought again, fail", async function() {
        //try to make another purchase from investor1, should fail
        try {
            await air.buy({from: investor1});
        } catch (e) {            
            return true;
        }
        throw new Error("Should never get here");
    })

    it("try to send money, fail", async function() {
        try {
            await air.buy({from: investor7, value: 100000});
        } catch (e) {            
            return true;
        }
        throw new Error("Should never get here");
    })

    it("buy last, no more tokens", async function() {        
        await air.buy({from: investor7});
        var purchases = (await air.soldUnits.call()).toNumber();
        assert.equal(purchases, 7, "Should be 7 purchases");
        assert.equal(purchases, (await air.maxUnits.call()).toNumber(), "Should be sold max units");
    })

    it("buy when no more tokens", async function() {
        try {
            await air.buy({from: investor8});
        } catch (e) {            
            return true;
        }
        throw new Error("Should never get here");        
    })
})

contract("BCSPromoToken, TokenVendor, TokenProduct. Time limits", function(accounts) {        
    it("create", async function() {
        await Prepare(accounts);
        
        air = await Airdrop.new(token.address, "PROMO", 7, 1, 10, 100, 3, 5, false);
        await token.setMinter(air.address, true);                         
        assert.equal(await air.token.call(), token.address, "Invalid token");
        assert.isFalse(await air.isActive.call(), "Airdrop should be inactive");
    })    

    it("try to buy, fail", async function() {
        try {
            await air.buy({from: investor1});
        } catch (e) {            
            return true;
        }
        throw new Error("Should never get here");
    })
    
    it("buy as investor1", async function() {        
        await air.setActive(true);
        await air.buy({from: investor1});
        assert.equal(await air.soldUnits.call(), 1, "Should be 1 purchases");            
    })  
    
    it("set active to false while not an owner, fail", async function() {
        try {
            await air.setActive(false, {from: investor2});
        } catch (e) {            
            return true;
        }
        throw new Error("Should never get here");
    })

    it("set active to false", async function() {
        await air.setActive(false, {from: owner});
        assert.isFalse(await air.isActive.call(), "active should be false");
    })

    it("buy while campaign is inactive, fail", async function() {
        try {
            await air.buy({from: investor2});
        } catch (e) {            
            return true;
        }
        throw new Error("Should never get here");
    })

    it("set active to true and buy", async function() {
        await air.setActive(true, {from: owner});
        await air.buy({from: investor2});
        assert.equal(await air.soldUnits.call(), 2, "Should be 2 purchases");            

        await air.buy({from: investor3});
        assert.equal(await air.soldUnits.call(), 3, "Should be 3 purchases");            
        assert.equal(await token.balanceOf.call(investor3), 10, "Investor3 should have 10 token");
    })
})