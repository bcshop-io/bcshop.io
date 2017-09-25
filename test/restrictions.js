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
var investor1, investor2, investor3, investor4;

function Prepare(accounts) {
    return new Promise(async (resolve, reject) => {

        beneficiary = accounts[1];
        investor1 = accounts[1];
        investor2 = accounts[2];
        investor3 = accounts[3];
        investor4 = accounts[4];

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

// contract("FloorInvestRestrictions", function(accounts) {
//     it("initial allowance", async function() {
//         await Prepare(accounts);
//         restrictions = await FRestrictions.new(floorEther);
//         crowdsale = await Crowdsale.new(pool.address, restrictions.address, beneficiary, 0, 1, 0, tokensForOneEther, 0);

//         await pool.setTrustee(crowdsale.address, true);
//         await restrictions.setManager(crowdsale.address, true);

//         assert.equal(await restrictions.canInvest.call(investor1, floorEther), true, "investor1 should be able to invest");
//         assert.equal(await restrictions.canInvest.call(investor1, floorEther / 2), false, "investor1 shouldnt be able to invest");
//         assert.equal(await restrictions.canInvest.call(investor2, floorEther), true, "investor2 should be able to invest");        
//     })

//     it("allowed investment from investor1, size OK", async function () {
//         await crowdsale.invest({from: investor1, value: floorEther});
//         assert.equal(await token.balanceOf(investor1), 200, "investor1 should have 200 tokens");                
//     })

//     it("unallowed investment from investor2, size too small", async function() {        
//         try {
//             await crowdsale.invest({from: investor2, value: floorEther / 2});            
//         } catch (e) {
//             //console.log(e);
//             return true;
//         }
//         throw new Error("Should fail withdraw");
//     })

//     it("allowed investment from investor1, size small", async function () {
//         await crowdsale.invest({from: investor1, value: floorEther / 2});
//         assert.equal(await token.balanceOf(investor1), 300, "investor1 should have 300 tokens");                
//     })
// })

// contract("ParticipantInvestRestrictions: 1 total allowed, 0 reserved", function(accounts) {
//     it("initial allowance", async function() {
//         await Prepare(accounts);                
        
//         restrictions = await Restrictions.new(floorEther, 1, 0);        
//         crowdsale = await Crowdsale.new(pool.address, restrictions.address, beneficiary, 0, 1, 0, tokensForOneEther, 0);

//         await pool.setTrustee(crowdsale.address, true);
//         await restrictions.setManager(crowdsale.address, true);

//         assert.equal(await restrictions.canInvest.call(investor1, floorEther), true, "investor1 should be able to invest");
//         assert.equal(await restrictions.canInvest.call(investor1, floorEther / 2), false, "investor1 shouldnt be able to invest");
//         assert.equal(await restrictions.canInvest.call(investor2, floorEther), true, "investor2 should be able to invest");        
//     })

//     it("allowed investment from investor1", async function () {
//         await crowdsale.invest({from: investor1, value: floorEther});
//         assert.equal(await token.balanceOf(investor1), 200, "investor1 should have 200 tokens");                
//     })

//     it("further allowance from investor1", async function () {        
//         assert.equal(await restrictions.canInvest.call(investor2, floorEther), false,  "investor2 now cant invest"); 
//         assert.equal(await restrictions.canInvest.call(investor1, floorEther / 10), true, "investor1 now can invest any amount");
        
//         await crowdsale.invest({from: investor1, value: floorEther / 10}); //should buy 20 tokens
//         assert.equal(await token.balanceOf.call(investor1), 220, "now investor1 should have 220 tokens");
//     })

//     it("unallowed investment from investor2", async function() {        
//         try {
//             await crowdsale.invest({from: investor2, value: floorEther});            
//         } catch (e) {
//             //console.log(e);
//             return true;
//         }
//         throw new Error("Should never get here");
//     })
// }) 

// contract("ParticipantInvestRestrictions: 1 total allowed, 1 reserved", function(accounts){
//     it("initial allowance", async function() {
//         await Prepare(accounts);
        
//         restrictions = await Restrictions.new(floorEther, 1, 1);
//         crowdsale = await Crowdsale.new(pool.address, restrictions.address, beneficiary, 0, 1, 0, tokensForOneEther, 0);

//         await pool.setTrustee(crowdsale.address, true);
//         await restrictions.setManager(crowdsale.address, true);

//         assert.equal(await restrictions.canInvest.call(investor1, floorEther), false, "Nobody can invest now");
//     })

//     it("reserve investor1", async function() {
//         await restrictions.reserveFor(investor1);
//         assert.equal(await restrictions.canInvest.call(investor1, floorEther), true, "Now investor1 is reserved, can invest"); 
//         assert.equal(await restrictions.canInvest.call(investor1, floorEther / 10), false, "Invstor1 cant invest low amount however");

//         assert.equal(await restrictions.canInvest.call(investor2, floorEther), false, "investor2 cant invest now");
//     })        

//     it("unreserve investor1", async function() {
//         await restrictions.unreserveFor(investor1);
//         assert.equal(await restrictions.canInvest.call(investor1, floorEther), false, "unreserved and cant invest"); 
//     })
    
//     it("reserve investor1 and invest. check sale stats", async function() {
//         await restrictions.reserveFor(investor1); 
//         assert.isTrue(await restrictions.canInvest.call(investor1, floorEther * 2), "investor1 can invest"); 

//         await crowdsale.invest({from:investor1, value: floorEther}); //should buy 200 tokens
//         assert.equal(await token.balanceOf.call(investor1), 200, "investor1 should get 200 tokens");

//         assert.equal(await crowdsale.tokensSold.call(), 200, "TokensSold should be 200");
//         assert.equal(await crowdsale.tokensLeft.call(), 800, "800 tokens should be available for sale" );
//         assert.equal(await restrictions.investorsCount.call(), 0, "Should be 0 unreserved investors");
//         assert.equal(await restrictions.reservedInvestorsCount.call(), 1, "Should be 1 reserved investors");
//         assert.equal(await restrictions.maxInvestors.call(), 0, "Should be 0 max unreserved investors");
//         assert.equal(await restrictions.maxReservedInvestors.call(), 1, "Should be 1 max reserved investors");
//     })
    
//     it("further allowance", async function() {
//         assert.isTrue(await restrictions.canInvest.call(investor1, floorEther / 2), "Now investor1 can invest any amount"); 
//         assert.isFalse(await restrictions.canInvest.call(investor2, floorEther * 2), "investor2 cant invest, it is not reserved");
//     })

//     it("cant unreserve investor1 now", async function() {
//         try {
//             await restrictions.unreserveFor(investor1);            
//         } catch (e) {
//             //console.log(e);
//             return true;
//         }
//         throw new Error("Should never get here");
//     })

//     it("cant reserve investor2 now", async function() {        
//         try {
//             await restrictions.reserveFor(investor2);            
//         } catch (e) {
//             //console.log(e);
//             return true;
//         }

//         throw new Error("Should never get here");
//     })

//     it("unallowed investor2 investment", async function() {        
//         try {
//             await crowdsale.invest({from: investor2, value: floorEther * 2});            
//         } catch (e) {
//             //console.log(e);
//             return true;
//         }
//         throw new Error("Should never get here");
//     })
// })

contract("ParticipantInvestRestrictions: 3 total allowed, 1 reserved", function(accounts){
    it("initial allowance", async function() {
        await Prepare(accounts);
        
        restrictions = await Restrictions.new(floorEther, 3, 1);
        crowdsale = await Crowdsale.new(pool.address, restrictions.address, beneficiary, 0, 1, 0, tokensForOneEther, 0);

        await pool.setTrustee(crowdsale.address, true);
        await restrictions.setManager(crowdsale.address, true);

        assert.isTrue(await restrictions.canInvest.call(investor1, floorEther), "Can invest now");
    })

    it("reserve investor1 and invest", async function() {
        await restrictions.reserveFor(investor1);
        assert.equal(await restrictions.canInvest.call(investor1, floorEther), true, "Now investor1 is reserved, can invest"); 
        assert.equal(await restrictions.canInvest.call(investor1, floorEther / 10), false, "Invstor1 cant invest low amount however");

        assert.equal(await restrictions.canInvest.call(investor2, floorEther), true, "investor2 can invest now");

        await crowdsale.invest({from:investor1, value: floorEther}); //should buy 200 tokens
        assert.equal(await token.balanceOf.call(investor1), 200, "investor1 should get 200 tokens");
    })
    
    it("investor2 invests. check sale stats", async function() {         
        await crowdsale.invest({from:investor2, value: floorEther * 2}); //should buy 400 tokens
        assert.equal(await token.balanceOf.call(investor2), 400, "investor1 should get 400 tokens");

        assert.equal(await crowdsale.tokensSold.call(), 600, "TokensSold should be 600");
        assert.equal(await crowdsale.tokensLeft.call(), 400, "400 tokens should be available for sale" );
        assert.equal(await restrictions.investorsCount.call(), 1, "Should be 1 unreserved investors");
        assert.equal(await restrictions.reservedInvestorsCount.call(), 1, "Should be 1 reserved investors");
        assert.equal(await restrictions.maxInvestors.call(), 2, "Should be 2 max unreserved investors");
        assert.equal(await restrictions.maxReservedInvestors.call(), 1, "Should be 1 max reserved investors");
    })
    
    it("further allowance", async function() {
        assert.isTrue(await restrictions.canInvest.call(investor1, floorEther / 2), "Now investor1 can invest any amount"); 
        assert.isTrue(await restrictions.canInvest.call(investor3, floorEther * 2), "investor3 can invest");
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

    it("cant reserve investor3 now", async function() {        
        try {
            await restrictions.reserveFor(investor3);
        } catch (e) {
            //console.log(e);
            return true;
        }

        throw new Error("Should never get here");
    })

    it("investor3 invests as unrserved. check sale stats", async function() {         
        var investment = parseInt(floorEther) + parseInt(floorEther / 2);        
        await crowdsale.invest({from:investor3, value: investment}); //should buy 300 tokens
        assert.equal(await token.balanceOf.call(investor3), 300, "investor1 should get 300 tokens");

        assert.equal(await crowdsale.tokensSold.call(), 900, "TokensSold should be 900");
        assert.equal(await crowdsale.tokensLeft.call(), 100, "100 tokens should be available for sale" );
        assert.equal(await restrictions.investorsCount.call(), 2, "Should be 1 unreserved investors");
        assert.equal(await restrictions.reservedInvestorsCount.call(), 1, "Should be 1 reserved investors");
        assert.equal(await restrictions.maxInvestors.call(), 2, "Should be 2 max unreserved investors");
        assert.equal(await restrictions.maxReservedInvestors.call(), 1, "Should be 1 max reserved investors");
    })

    it("unallowed investor4 investment", async function() {        
        try {
            await crowdsale.invest({from: investor4, value: floorEther * 2});
        } catch (e) {
            //console.log(e);
            return true;
        }
        throw new Error("Should never get here");
    })
})