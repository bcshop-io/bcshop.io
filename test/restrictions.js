//
//
// Tests restrictions on total investors amount and investor reserve behavior
//
//

var Web3 = require("web3");
web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));

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
        
        await token.allowTransferFor(pool.address, true);
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
        var r = await restrictions.setManager(crowdsale.address, true);
        
        assert.equal(await crowdsale.canInvest.call(investor1, floorEther), true, "investor1 should be able to invest");
        assert.equal(await crowdsale.canInvest.call(investor1, floorEther / 2), false, "investor1 shouldnt be able to invest");
        assert.equal(await crowdsale.canInvest.call(investor2, floorEther), true, "investor2 should be able to invest");        
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

    it("change floor", async function() {
        await restrictions.changeFloor(floorEther / 2);
        assert.equal(await restrictions.floor.call(), floorEther / 2, "New low cap should be half less");
        assert.isTrue(await crowdsale.canInvest.call(investor2, floorEther / 2), "investor2 should be able to invest");
    })

    it("allowed investment from investor2, new floor", async function () {
        await crowdsale.invest({from: investor2, value: floorEther / 2});
        assert.equal(await token.balanceOf(investor2), 100, "investor2 should have 100 tokens");                
    })

    it("unallowed investment from investor3, size too small", async function() {        
        try {
            await crowdsale.invest({from: investor3, value: floorEther / 3});
        } catch (e) {
            //console.log(e);
            return true;
        }
        throw new Error("Should fail withdraw");
    })
})

contract("ParticipantInvestRestrictions: Reserve/unreserve for more than cap. ", function(accounts){    
    it("create", async function() {
        await Prepare(accounts);

        restrictions = await Restrictions.new(floorEther, 3);
        crowdsale = await Crowdsale.new(pool.address, restrictions.address, beneficiary, 0, 1, 0, tokensForOneEther, 0);

        await pool.setTrustee(crowdsale.address, true);
        await restrictions.setManager(crowdsale.address, true);
        await restrictions.setFormula(crowdsale.address);
        
        assert.isTrue(await restrictions.hasFreePlaces.call(), "Should be free places");
    })

    it("reserve 600 tokens for unknown investor", async function() {
         await restrictions.reserve(floorEther * 3);
         assert.equal((await restrictions.tokensReserved.call()).toNumber(), 600, "600 tokens should be reserved");
    })

    it("reserve 800 tokens for unknown investor, should not exceed cap (1000), results in 400 tokens reserve", async function() {
        await restrictions.reserve(floorEther * 4);
        assert.equal((await restrictions.tokensReserved.call()).toNumber(), 1000, "1000 tokens should be reserved");
        assert.equal((await restrictions.unknownInvestors.call(1))[1].toNumber(), 400, "400 tokens should be reserved second time");
    })

    it("now unreserve first (600 tokens), should leave 400 in reserve", async function() {
        await restrictions.unreserve(0);
        assert.equal((await restrictions.tokensReserved.call()).toNumber(), 400, "400 tokens should be reserved");
    })

    it("now unreserve second (800 tokens), should leave 0 in reserve", async function() {
        await restrictions.unreserve(1);
        assert.equal((await restrictions.tokensReserved.call()).toNumber(), 0, "0 tokens should be reserved");
    })

    it("reserve for investor1 200 tokens", async function() {
        await restrictions.reserveFor(investor1, floorEther);
        assert.equal((await restrictions.tokensReserved.call()).toNumber(), 200, "200 tokens should be reserved");
        assert.equal(await restrictions.reservedInvestors.call(investor1), 200, "200 tokens should be reserved for investor1");
    })

    it("reserve for investor1 200 tokens more", async function() {
        await restrictions.reserveFor(investor1, floorEther);
        assert.equal((await restrictions.tokensReserved.call()).toNumber(), 400, "400 tokens should be reserved");
        assert.equal(await restrictions.reservedInvestors.call(investor1), 400, "400 tokens should be reserved for investor1");
    })

    it("reserve for investor2 1000 tokens, results in 600 tokens (not to exceed cap)", async function() {
        await restrictions.reserveFor(investor2, floorEther*5);
        assert.equal((await restrictions.tokensReserved.call()).toNumber(), 1000, "1000 tokens should be reserved");
        assert.equal(await restrictions.reservedInvestors.call(investor2), 600, "400 tokens should be reserved for investor1");
        assert.equal((await restrictions.knownReserved.call()).toNumber(), 2, "2 investors should be reseved");
    })

    it("unreserve for investor2, should have 400 tokens for investor1 reserved still", async function() {
        await restrictions.unreserveFor(investor2);
        assert.equal((await restrictions.tokensReserved.call()).toNumber(), 400, "400 tokens should be reserved");
        assert.equal(await restrictions.reservedInvestors.call(investor1), 400, "400 tokens should be reserved for investor1");
        assert.equal(await restrictions.reservedInvestors.call(investor2), 0, "0 tokens should be reserved for investor2");
    })

    it("unreserve for investor1, should have 0 tokens reserved", async function() {
        await restrictions.unreserveFor(investor1);
        assert.equal((await restrictions.tokensReserved.call()).toNumber(), 0, "0 tokens should be reserved");
        assert.equal(await restrictions.reservedInvestors.call(investor1), 0, "0 tokens should be reserved for investor1");
        assert.equal(await restrictions.reservedInvestors.call(investor2), 0, "0 tokens should be reserved for investor2");
    })


    // DOESN't WORK
    // it("check investor1 investment, should be 0 tokens to buy and rest as overpay", async function() {
    //     assert.isTrue(await crowdsale.canInvest.call(investor1, floorEther));
    //     var res = await crowdsale.howManyTokensForEther.call(floorEther);
    //     assert.equal(res[0].toNumber(), 0, "Should be 0 tokens avaialble for sale");
    //     assert.equal(res[1].toNumber(), floorEther, "Should have all the amount invested as overpay");        
    // })

    // it("investor1 tries to invest, fail as there are 0 tokens to get", async function() {
    //     try {
    //         await crowdsale.invest({from:investor1, value:floorEther});
    //     } catch(e) {
    //         return true;
    //     }
    //     assert.isTrue(false, "Investment should fail");
    // })

    // it("unreserve 800 tokens", async function() {
    //     await restrictions.unreserve(1);
    //     assert.equal((await restrictions.tokensReserved.call()).toNumber(), 600, "600 tokens should be reserved");
    // })

    // it("invest for 800 tokens - more than cap, should get 400", async function() {
    //     await crowdsale.invest({from:investor1, value:floorEther*4});
    //     assert.equal(await token.balanceOf(investor1), 400, "Investor should get only 400 tokens");
    //     assert.equal(await crowdsale.overpays.call(investor1), floorEther*2, "Should have 2E as overpay");
    // })    
})

contract("ParticipantInvestRestrictions: Reserve half of tokens and somebody tries to invest more than other half ", function(accounts){
    it("create", async function() {
        await Prepare(accounts);

        restrictions = await Restrictions.new(floorEther, 3);
        crowdsale = await Crowdsale.new(pool.address, restrictions.address, beneficiary, 0, 1, 0, tokensForOneEther, 0);

        await pool.setTrustee(crowdsale.address, true);
        await restrictions.setManager(crowdsale.address, true);
        await restrictions.setFormula(crowdsale.address);
        
        assert.isTrue(await restrictions.hasFreePlaces.call(), "Should be free places");
    })

    it("reserve half of tokens for unknown investor", async function() {
         await restrictions.reserve(floorEther * 3);
         assert.equal(await restrictions.tokensReserved.call(), 600, "600 tokens should be reserved");
    })

    it("investor1 tries to invest for more than cap, fail", async function() {
        try {
            await crowdsale.invest({from:investor1, value: floorEther * 3});
        } catch(e) {
            return true;
        }
        assert.isTrue(false, "investment should fail");
    })

    it("cancel reservation", async function() {
        await restrictions.unreserve(0);
        assert.isTrue(await crowdsale.canInvest.call(investor1, floorEther * 3), "Investor");
    })

    it("investor1 invests", async function() {
        await crowdsale.invest({from:investor1, value:floorEther*3});
        assert.equal(await token.balanceOf.call(investor1), 600, "Investor1 should have 600 tokens");
    })

    it("investor2 tries to invest for more than cap, OK because no reserves", async function() {
        await crowdsale.invest({from:investor2, value: floorEther * 4});
        assert.equal(await token.balanceOf.call(investor2), 400, "!");
        assert.equal(await crowdsale.overpays.call(investor2), floorEther * 2, "Invalid overpay stored");
    })
})

contract("ParticipantInvestRestrictions: 3 total allowed. Everybody invests without reserve. ", function(accounts){
    it("initial allowance", async function() {
        await Prepare(accounts);
        
        restrictions = await Restrictions.new(floorEther, 3);
        crowdsale = await Crowdsale.new(pool.address, restrictions.address, beneficiary, 0, 1, 0, tokensForOneEther, 0);

        await pool.setTrustee(crowdsale.address, true);
        await restrictions.setManager(crowdsale.address, true);
        await restrictions.setFormula(crowdsale.address);

        assert.isTrue(await crowdsale.canInvest.call(investor1, floorEther), "Everybody can invest now");
        assert.isTrue(await restrictions.hasFreePlaces.call(), "Should be 3 free places");  
        assert.equal(await restrictions.getInvestorCount.call(), 0, "Should have 0 investors");
    })

    it("everybody invests", async function() {        
        await crowdsale.invest({from:investor1, value: floorEther}); //should buy 200 tokens
        assert.equal(await token.balanceOf.call(investor1), 200, "investor1 should get 200 tokens");
        assert.equal(await restrictions.getInvestorCount.call(), 1, "Should have 1 investors");
        
        await crowdsale.invest({from:investor2, value: floorEther}); 
        assert.equal(await restrictions.getInvestorCount.call(), 2, "Should have 2 investors");
        assert.isTrue(await restrictions.hasFreePlaces.call(), "Should have free place");
        
        await crowdsale.invest({from:investor3, value: floorEther}); 
        assert.isFalse(await restrictions.hasFreePlaces.call(), "Should have no free places");
        assert.equal(await restrictions.getInvestorCount.call(), 3, "Should have 3 investors");
    })

    it("unallowed investment, max participants already", async function() {
        try {
            await crowdsale.invest({from:investor4, value: floorEther})
        } catch(e) {
            return true;
        }
        asser.isTrue(false, "Investment should be failed");
        assert.equal(await restrictions.getInvestorCount.call(), 3, "Should have 3 investors");
    })
})


contract("ParticipantInvestRestrictions: 3 total allowed, reserve 1 for unknown. reserve 1 for known", function(accounts) {
    it("initial allowance", async function() {
        await Prepare(accounts);
        restrictions = await Restrictions.new(floorEther, 3);
        crowdsale = await Crowdsale.new(pool.address, restrictions.address, beneficiary, 0, 1, 0, tokensForOneEther, 0);

        await pool.setTrustee(crowdsale.address, true);
        await restrictions.setManager(crowdsale.address, true);
        await restrictions.setFormula(crowdsale.address);

        assert.isTrue(await restrictions.hasFreePlaces.call(), "Should have free places");
    })

    it("reserve 1 unknown, should emit ReserveUnknown event", async function() {
        var result = await restrictions.reserve(floorEther * 2);
        assert.equal(await restrictions.tokensReserved.call(), 400, "400 tokens should be reserved");        
        assert.equal(result.logs[0].event, "ReserveUnknown", "Should emit ReserveUnknown event");
        assert.equal(result.logs[0].args.index, 0, "Should emit ReserveUnknown event [0]");
        assert.equal(await restrictions.getInvestorCount.call(), 1, "Should have 1 investors");
    })

    it("reserve for investor2", async function() {
        await restrictions.reserveFor(investor2, floorEther);
        assert.equal((await restrictions.tokensReserved.call()).toNumber(), 600, "200 more tokens should be reserved");
        assert.isTrue(await restrictions.hasFreePlaces.call(), "Should have free places");        
        assert.isTrue(await crowdsale.canInvest.call(investor3, floorEther));
        assert.equal(await restrictions.getInvestorCount.call(), 2, "Should have 2 investors");
    })

    it("try to unreserve more than was reserved", async function() {
        try {
            await restrictions.unreserve(2);
        } catch(e) {
            return true;
        }
        asser.isTrue(false, "Shouldn't be able to unreserve 3rd investor");
    })

    it("investor1 invests less than promised, cancel reservation", async function() {
        await crowdsale.invest({from:investor1, value: floorEther});
        await restrictions.unreserve(0);
        assert.equal(await restrictions.getInvestorCount.call(), 2, "Should have 2 investors");
        assert.equal((await restrictions.tokensReserved.call()).toNumber(), 200, "200 tokens should be reserved");
    })

    it("investor1 invests again, shouldn't affect reserved tokens", async function() {
         await crowdsale.invest({from:investor1, value: floorEther / 2}); 
         assert.equal(await restrictions.getInvestorCount.call(), 2, "Should have 2 investors");
         assert.equal((await restrictions.tokensReserved.call()).toNumber(), 200, "200 tokens should be reserved");
         assert.isTrue(await restrictions.hasFreePlaces.call(), "Should have free places");        
    })

    it("investor3 invests", async function() {
         await crowdsale.invest({from:investor3, value: floorEther});

         assert.equal(await crowdsale.tokensLeft.call(), 500, "500 tokens should be left for sale");
         assert.isFalse(await restrictions.hasFreePlaces.call(), "Should have no free places");                 
         assert.isFalse(await crowdsale.canInvest.call(investor4, floorEther));
         assert.equal(await restrictions.getInvestorCount.call(), 3, "Should have 3 investors");
    })

    it("unallowed investment from investor4, already max investors", async function() {
        try {
            await crowdsale.invest({from:investor4, value: floorEther});
        } catch(e) {
            return true;
        }
        assert.isTrue(false, "investor4 should fail to invest");
    })

    it("invest from reserved investor2", async function() {
        await crowdsale.invest({from:investor2, value: floorEther});
        assert.equal((await restrictions.tokensReserved.call()).toNumber(), 0, "0 tokens should be reserved");
        assert.isFalse(await restrictions.hasFreePlaces.call(), "Should have no free places");        
        assert.equal(await restrictions.getInvestorCount.call(), 3, "Should have 3 investors");
    })
})


contract("ParticipantInvestRestrictions. Reserve for 1 all the tokens so that nobody can buy", function(accounts) {
    it("initial allowance", async function() {
        await Prepare(accounts);
        restrictions = await Restrictions.new(floorEther, 3);
        crowdsale = await Crowdsale.new(pool.address, restrictions.address, beneficiary, 0, 1, 0, tokensForOneEther, 0);

        await pool.setTrustee(crowdsale.address, true);
        await restrictions.setManager(crowdsale.address, true);
        await restrictions.setFormula(crowdsale.address);

        assert.isTrue(await restrictions.hasFreePlaces.call(), "Should have free places");
    })

    it("reserve all the tokens for investor1", async function() {
        await restrictions.reserveFor(investor1, floorEther * 5); //1000 tokens
        assert.equal((await restrictions.tokensReserved.call()).toNumber(), 1000, "1000 tokens should be reserved");
        assert.equal(await restrictions.getInvestorCount.call(), 1, "Should have 1 investors");
    })

    it("there should be places but nobody can invest due to floor restrictions", async function() {
        assert.isTrue(await restrictions.hasFreePlaces.call(), "Should have free places");
        assert.isFalse(await crowdsale.canInvest(investor2, floorEther), "Investor2 shouldn't be able to invest: all tokens are reserved");
        assert.isFalse(await crowdsale.canInvest(investor2, floorEther/2), "Investor2 shouldn't be able to invest: low amount");
        assert.isTrue(await crowdsale.canInvest(investor1, floorEther), "Investor1 should be able to invest");
    })

    it("unallowed investment from investor2", async function() {
        try {
            await crowdsale.invest({from:investor2, value: floorEther});
        } catch(e) {
            return true;
        }
        assert.isTrue(false, "Investment from investor2 should fail");
    })

    it("invest from reserved investor1, less than promised", async function() {
        await crowdsale.invest({from:investor1, value: floorEther * 3}); //600 tokens
        assert.equal(await restrictions.tokensReserved.call(), 0, "0 tokens should be reserved");
        assert.equal(await token.balanceOf.call(investor1), 600, "investor1 should get 600 tokens");        
        assert.equal(await restrictions.getInvestorCount.call(), 1, "Should have 1 investors still");
    })
    
    it("now investor2 should be able to invest", async function() {
        assert.equal(await crowdsale.tokensLeft.call(), 400, "Should have 400 tokens for sale");
        assert.isTrue(await crowdsale.canInvest(investor2, floorEther), "Investor2 should be able to invest");
    })

    it("investor2 invests", async function() {
        await crowdsale.invest({from:investor2, value: floorEther * 2}); 
        assert.equal(await token.balanceOf.call(investor2), 400, "investor2 should get 400 tokens");
        assert.equal(await crowdsale.tokensLeft.call(), 0, "Should have 0 tokens for sale");
        assert.equal(await restrictions.getInvestorCount.call(), 2, "Should have 2 investors");
    })

    it("there should be places but all tokens are sold and nobody can invest", async function() {
        assert.isTrue(await restrictions.hasFreePlaces.call(), "Should be free places");
        assert.equal((await crowdsale.getState.call()).toNumber(), 3, "State should be FinishedSuccess");
        assert.isFalse(await crowdsale.canInvest(investor3, floorEther), "Investor3 shouldn't be able to invest");
    })
})


contract("ParticipantInvestRestrictions. Reserve 2 for unknown, so 1 is available. ", function(accounts) {
    it("initial allowance", async function() {
        await Prepare(accounts);
        restrictions = await Restrictions.new(floorEther, 3);
        crowdsale = await Crowdsale.new(pool.address, restrictions.address, beneficiary, 0, 1, 0, tokensForOneEther, 0);

        await pool.setTrustee(crowdsale.address, true);
        await restrictions.setManager(crowdsale.address, true);
        await restrictions.setFormula(crowdsale.address);

        assert.isTrue(await restrictions.hasFreePlaces.call(), "Should have free places");
    })

    it("reserve 2 for unknown", async function() {
        await restrictions.reserve(floorEther);
        await restrictions.reserve(floorEther * 2);

        assert.isTrue(await restrictions.hasFreePlaces.call(), "Should be free places");
        assert.equal(await restrictions.tokensReserved.call(), 600, "600 tokens should be reserved");
        assert.equal(await restrictions.getInvestorCount.call(), 2, "Should have 2 investors");
    })

    it("investor1 invests, dont cancel reserve", async function() {
        await crowdsale.invest({from:investor1, value: floorEther}); 
        assert.isFalse(await restrictions.hasFreePlaces.call(), "Should be no free places");
        assert.equal(await restrictions.getInvestorCount.call(), 3, "Should have 3 investors (before unreservation)");
    })

    it("unallowed investment from investor2", async function() {
        try {
            await crowdsale.invest({from:investor2, value: floorEther});
        } catch(e) {
            return true;
        }
        assert.isTrue(false, "Investment from investor2 should fail");
    })

    it("cancel one reserve, investor2 should be able to invest", async function() {
        await restrictions.unreserve(1);
        assert.equal(await restrictions.tokensReserved.call(), 200, "200 tokens should be reserved");
        assert.isTrue(await restrictions.hasFreePlaces.call(), "Should be free places");
        assert.isTrue(await crowdsale.canInvest(investor2, floorEther));
        assert.equal(await restrictions.getInvestorCount.call(), 2, "Should have 2 investors");
    })
})


contract("ParticipantInvestRestrictions. Reserve and unreserve without investment", function(accounts) {
    it("initial allowance", async function() {
        await Prepare(accounts);
        restrictions = await Restrictions.new(floorEther, 3);
        crowdsale = await Crowdsale.new(pool.address, restrictions.address, beneficiary, 0, 1, 0, tokensForOneEther, 0);

        await pool.setTrustee(crowdsale.address, true);
        await restrictions.setManager(crowdsale.address, true);
        await restrictions.setFormula(crowdsale.address);

        assert.isTrue(await restrictions.hasFreePlaces.call(), "Should have free places");
    })

    it("reserve for investor1", async function() {
        await restrictions.reserveFor(investor1, floorEther);
        assert.equal(await restrictions.getInvestorCount.call(), 1, "Should have 1 investors");
    })

    it("unreserve investor1", async function() {
        await restrictions.unreserveFor(investor1);
        assert.equal(await restrictions.getInvestorCount.call(), 0, "Should have 0 investors");
    })

    it("reserve for investor1 and invest", async function() {
        await restrictions.reserveFor(investor1, floorEther * 2);
        await crowdsale.invest({from:investor1, value: floorEther*2});
        assert.equal(await restrictions.getInvestorCount.call(), 1, "Should have 1 investors");
    })

    it("should fail to unreserve investor1 now", async function() {
        try {
            await restrictions.unreserve(investor1);
        } catch(e) {
            return true;
        }

        assert.isTrue(false, "Unreservation should fail");
    })

    it("investor1 invests again", async function() {
        await crowdsale.invest({from:investor1, value: floorEther});
        assert.equal(await restrictions.getInvestorCount.call(), 1, "Should have 1 investors");
    })

    it("investor2 invests through send", async function() {       
       await web3.eth.sendTransaction({from:investor2, to:crowdsale.address, value:floorEther, gas: 250000});
       assert.equal(await restrictions.getInvestorCount.call(), 2, "Should have 2 investors");
    })
})