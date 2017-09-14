//
// Tests restrictions on total investors amount and investor reserve behavior
//

var Web3 = require("web3");
var web3 = new Web3();

var Token = artifacts.require("BCSToken");
var Pool = artifacts.require("TokenPool");
var Crowdsale = artifacts.require("BCSCrowdsale");
var Restrictions = artifacts.require("ParticipantInvestRestrictions");
var FRestrictions = artifacts.require("FloorInvestRestrictions");

var TOKEN_CAP = 1000;
var DECIMALS = 0;

var totalTokens;
var token;
var pool;
var crowdsale;
var restrictions;
var floorEther = web3.toWei(1, "ether");
var tokensForOneEther = 200;
var beneficiary;
var investor1 ;
var investor2;

function Prepare(accounts) {
    return new Promise(async (resolve, reject) => {

        beneficiary = accounts[1];
        investor1 = accounts[1];
        investor2 = accounts[2];

        token = await Token.new(TOKEN_CAP, DECIMALS);
        totalTokens = (await token.totalSupply.call()).toNumber();
        assert.equal(totalTokens, TOKEN_CAP, "Invalid total tokens");
        
        pool = await Pool.new(token.address);    
        assert.equal(await pool.token(), token.address, "Invalid pool token");
        
        await token.transfer(pool.address, totalTokens);
        var poolTokens = (await token.balanceOf.call(pool.address)).toNumber();
        assert.equal(poolTokens, totalTokens, "Invalid pool tokens amount");

        return resolve(true);
    })
}

contract("FloorInvestRestrictions", function(accounts) {
    it("initial allowance", async function() {
        await Prepare(accounts);
        restrictions = await FRestrictions.new(floorEther);
        crowdsale = await Crowdsale.new(pool.address, restrictions.address, beneficiary, 0, 1, 0, tokensForOneEther, 0);

        await pool.setTrustee(crowdsale.address, true);
        await restrictions.setManager(crowdsale.address, true);

        assert.equal(await restrictions.canInvest.call(investor1, floorEther), true, "investor1 should be able to invest");
        assert.equal(await restrictions.canInvest.call(investor1, floorEther / 2), false, "investor1 shouldnt be able to invest");
        assert.equal(await restrictions.canInvest.call(investor2, floorEther), true, "investor2 should be able to invest");        
    })

    it("allowed investment from investor1, size OK", async function () {
        await crowdsale.invest({from: investor1, value: floorEther});
        assert.equal(await token.balanceOf(investor1), 200, "investor1 should have 200 tokens");                
    })

    it("unallowed investment from investor2, size too small", async function() {        
        try {
            await crowdsale.invest({from: investor2, value: floorEther / 2});            
        } catch (e) {
            //console.log(e);
            return true;
        }
        throw new Error("Should fail withdraw");
    })

    it("allowed investment from investor1, size small", async function () {
        await crowdsale.invest({from: investor1, value: floorEther / 2});
        assert.equal(await token.balanceOf(investor1), 300, "investor1 should have 300 tokens");                
    })
})

contract("ParticipantInvestRestrictions: 1 total allowed, 0 reserved", function(accounts) {
    it("initial allowance", async function() {
        await Prepare(accounts);                
        
        restrictions = await Restrictions.new(floorEther, 1, 0);        
        crowdsale = await Crowdsale.new(pool.address, restrictions.address, beneficiary, 0, 1, 0, tokensForOneEther, 0);

        await pool.setTrustee(crowdsale.address, true);
        await restrictions.setManager(crowdsale.address, true);

        assert.equal(await restrictions.canInvest.call(investor1, floorEther), true, "investor1 should be able to invest");
        assert.equal(await restrictions.canInvest.call(investor1, floorEther / 2), false, "investor1 shouldnt be able to invest");
        assert.equal(await restrictions.canInvest.call(investor2, floorEther), true, "investor2 should be able to invest");        
    })

    it("allowed investment from investor1", async function () {
        await crowdsale.invest({from: investor1, value: floorEther});
        assert.equal(await token.balanceOf(investor1), 200, "investor1 should have 200 tokens");                
    })

    it("further allowance from investor1", async function () {        
        assert.equal(await restrictions.canInvest.call(investor2, floorEther), false,  "investor2 now cant invest"); 
        assert.equal(await restrictions.canInvest.call(investor1, floorEther / 10), true, "investor1 now can invest any amount");
        
        await crowdsale.invest({from: investor1, value: floorEther / 10}); //should buy 20 tokens
        assert.equal(await token.balanceOf.call(investor1), 220, "now investor1 should have 220 tokens");
    })

    it("unallowed investment from investor2", async function() {        
        try {
            await crowdsale.invest({from: investor2, value: floorEther});            
        } catch (e) {
            //console.log(e);
            return true;
        }
        throw new Error("Should never get here");
    })
}) 

contract("ParticipantInvestRestrictions: 2 total allowed, 2 reserved", function(accounts){
    it("initial allowance", async function() {
        await Prepare(accounts);
        
        restrictions = await Restrictions.new(floorEther, 1, 1);
        crowdsale = await Crowdsale.new(pool.address, restrictions.address, beneficiary, 0, 1, 0, tokensForOneEther, 0);

        await pool.setTrustee(crowdsale.address, true);
        await restrictions.setManager(crowdsale.address, true);

        assert.equal(await restrictions.canInvest.call(investor1, floorEther), false, "Nobody can invest now");
    })

    it("reserve investor1", async function() {
        await restrictions.reserveFor(investor1);
        assert.equal(await restrictions.canInvest.call(investor1, floorEther), true, "Now investor1 is reserved, can invest"); 
        assert.equal(await restrictions.canInvest.call(investor1, floorEther / 10), false, "Invstor1 cant invest low amount however");

        assert.equal(await restrictions.canInvest.call(investor2, floorEther), false, "investor2 cant invest now");
    })        

    it("unreserve investor1", async function() {
        await restrictions.unreserveFor(investor1);
        assert.equal(await restrictions.canInvest.call(investor1, floorEther), false, "unreserved and cant invest"); 
    })
    
    it("reserve investor1 and invest", async function() {
        await restrictions.reserveFor(investor1); 
        assert.isTrue(await restrictions.canInvest.call(investor1, floorEther * 2), "investor1 can invest"); 

        await crowdsale.invest({from:investor1, value: floorEther}); //should buy 200 tokens
        assert.equal(await token.balanceOf.call(investor1), 200, "investor1 should get 200 tokens");
    })
    
    it("further allowance", async function() {
        assert.isTrue(await restrictions.canInvest.call(investor1, floorEther / 2), "Now investor1 can invest any amount"); 
        assert.isFalse(await restrictions.canInvest.call(investor2, floorEther * 2), "investor2 cant invest, it is not reserved");
    })

    it("cant unreserve investor1 now", async function() {
        try {
            await restrictions.unreserveFor(investor1);            
        } catch (e) {
            //console.log(e);
            return true;
        }
        throw new Error("Should never get here");
    })

    it("cant reserve investor2 now", async function() {        
        try {
            await restrictions.reserveFor(investor2);            
        } catch (e) {
            //console.log(e);
            return true;
        }

        throw new Error("Should never get here");
    })

    it("unallowed investor2 investment", async function() {        
        try {
            await crowdsale.invest({from: investor2, value: floorEther * 2});            
        } catch (e) {
            //console.log(e);
            return true;
        }
        throw new Error("Should never get here");
    })

})
