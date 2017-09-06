//
//
// Tests preTge tokens crowdsale - number of investors is restricted. Some investors can be resered
// 
//

var Web3 = require("web3");
var web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));
var utils = new (require("./timeutils.js"))(web3);

var Token = artifacts.require("BCSPreTgeToken");
var token;

var Crowdsale = artifacts.require("BCSPartnerCrowdsale");
var sale;
var sale2;

var TokenPool = artifacts.require("TokenPool");
var pool;

var Restrictions = artifacts.require("ParticipantInvestRestrictions");
var restrictions;

var OneEther = web3.toWei(1, "ether");

var TokenCap = 15;
var MaxInvestors = 5;
var ReservedInvestors = 3;
var MinInvest = 2 * OneEther;
var TokensForOneEther = 1;

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

//returns real tokens amount considering token decimals
async function _RT(tokens) {
    return new Promise(async (resolve, reject) =>{
        return resolve((await token.getRealTokenAmount.call(tokens)).toNumber());
    })
}

function Prepare(accounts, maxReservedInvestors) {
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
        
        token = await Token.new(TokenCap, "BCS PRETGE TOKEN", "BPT", 18);
        pool = await TokenPool.new(token.address);
        restrictions = await Restrictions.new(MinInvest, MaxInvestors, maxReservedInvestors);
        //create crowdsale with no bonus, no partner
        sale = await Crowdsale.new(pool.address, restrictions.address, beneficiary, 0, 1, 0, TokensForOneEther, 0, 0x0, 0);
        sale2 = await Crowdsale.new(pool.address, restrictions.address, beneficiary, 0, 1, 0, TokensForOneEther, 0, 0x0, 0);
        
        await restrictions.setManager(sale.address, true);
        await restrictions.setManager(sale2.address, true);

        var totalTokens = await token.totalSupply.call();
        await token.transfer(pool.address, totalTokens.toNumber());

        await pool.setTrustee(sale.address, true);
        await pool.setTrustee(sale2.address, true);

        return resolve(true);
    })
}

contract("BCSPreTgeToken, BCSPartnerCrowdsale, no reserved, one sale", function(accounts) {
    it("create", async function() {
        await Prepare(accounts, 0);
        var totalTokens = await _RT(TokenCap);
        //console.log(totalTokens);
        var b1 = await token.balanceOf.call(pool.address);        
        assert.equal(b1.toNumber(), totalTokens, "Owner should have all the tokens");
    })

    it("sale 1", async function() {

        var investment1 = 2 * OneEther;
        var res = await restrictions.canInvest.call(investor1, investment1);
        assert.equal(res, true, "Should be able to invest");
        
        var state = await sale.getState.call();
        assert.equal(state, 2, "State should be active");

        var arr = await sale.howManyTokensForEther.call(investment1);        

        var tokensLeft = (await sale.tokensLeft.call()).toNumber();
        assert.isAbove(tokensLeft, arr[0].toNumber(), "There are enough tokens to buy");

        await sale.invest({from: investor1, value: investment1}); 
        var b1 = await token.balanceOf.call(investor1);
        assert.equal(b1.toNumber(), await _RT(2), "Investor1 should get 2 tokens");

        var investment2 = MinInvest / 2;
        await sale.invest({from: investor1, value: investment2});  //allow small investment after the allowed one
        b1 = await token.balanceOf.call(investor1);
        assert.equal(b1.toNumber(), await _RT(3), "Investor1 should get 1 tokens more");
    })

    it("too low investment", async function() {
        var investment1 = MinInvest / 2;
        try {
            await sale.invest({from: investor2, value: investment1});
        } catch(e) {
            return true;
        }
        assert.isTrue(false, "Should never get here");
    })

    it("sale up to maximum of investors", async function() {
        var investment1 = MinInvest;

        await sale.invest({from: investor2, value: 2 * investment1});
        await sale.invest({from: investor3, value: investment1});
        await sale.invest({from: investor4, value: investment1});
        await sale.invest({from: investor5, value: investment1});

        var tokensLeft = (await sale.tokensLeft.call()).toNumber();
        assert.equal(tokensLeft, await _RT(2), "Should have left 2 tokens unsold by now");
    })

    it("can't take new investor", async function() {
        var res = await restrictions.canInvest.call(investor6, MinInvest);
        assert.equal(res, false, "Shouldn't be able to invest");

        try {
            await sale.invest({from: investor6, value: MinInvest});
        } catch(e) {
            return true;
        }
        assert.isTrue(false, "Should never get here");
    })

    it("sale up to cap", async function() {
        await sale.invest({from: investor3, value: MinInvest});

        var b1 = await token.balanceOf.call(investor3);
        assert.equal(b1.toNumber(), await _RT(4), "Investor3 should get 1 tokens more");
        assert.equal(await sale.tokensLeft.call(), 0, "Should have no more tokens for sale");
        assert.equal(await token.balanceOf.call(pool.address), 0, "Should have no more tokens in pool");
    })

    it("try invest when no tokens", async function() {
        try {
            await sale.invest({from: investor3, value: MinInvest});
        } catch(e) {
            return true;
        }
        assert.isTrue(false, "Should never get here");        
    })
    
    it('final state', async function() {
        var state = await sale.getState.call();
        assert.equal(state, 3, "State should be finished");
    })

    it('transfer to beneficiary', async function() {
        var oldbBalance = await web3.eth.getBalance(beneficiary);

        await sale.transferToBeneficiary();

        var bBalance = await web3.eth.getBalance(beneficiary);  
        var balanceChange = bBalance.minus(oldbBalance).toNumber();

        assert.equal(balanceChange, 15 * OneEther, "Beneficiary should get 15 ether");
    })    
})

contract("BCSPreTgeToken, BCSPartnerCrowdsale, reserved, 2 sales with common pool", function(accounts) {
    it("create", async function() {
        await Prepare(accounts, ReservedInvestors);
        var totalTokens = await _RT(TokenCap);
        var b1 = await token.balanceOf.call(pool.address);        
        assert.equal(b1.toNumber(), totalTokens, "Owner should have all the tokens");
    })

    it("unreserved sale 1", async function() {
        await sale.invest({from: investor1, value: MinInvest});
        assert.equal((await token.balanceOf.call(investor1)).toNumber(), await _RT(2), "Investor1 should have 2 tokens");
    })

    it("reserve and invest in sale 1", async function() {
        await restrictions.reserveFor(investor2);
        await sale.invest({from: investor2, value: MinInvest});
        assert.equal((await token.balanceOf.call(investor2)).toNumber(), await _RT(2), "Investor2 should have 2 tokens");        
    })

    it("try to reserve from unauthorized sender", async function() {
        try {
            await restrictions.reserveFor(investor2, {from: accounts[1]});
        } catch(e) {
            return true;
        }
        assert.isTrue(false, "Should never get here");
    })

    it("make last unreserved invest in sale 2", async function() {
        await sale2.invest({from: investor3, value: MinInvest});
        assert.equal((await token.balanceOf.call(investor3)).toNumber(), await _RT(2), "Investor3 should have 2 tokens");
    })

    it("can't invest in sale 1 if not reserved", async function() {
        try {
            await sale.invest({from: investor4, value: MinInvest});
        } catch(e) {
            return true;
        }
        asser.isTrue(false, "Should never get here");
    })

    it("can't invest in sale 2 if not reserved", async function() {
        try {
            await sale2.invest({from: investor4, value: MinInvest});
        } catch(e) {
            return true;
        }
        asser.isTrue(false, "Should never get here");
    })

    it("already invested still can invest anywhere", async function() {
        await sale.invest({from: investor3, value: MinInvest});
        assert.equal((await token.balanceOf.call(investor3)).toNumber(), await _RT(4), "Investor3 should have 4 tokens");
    })

    it("reserve 2 more", async function() {
        await restrictions.reserveFor(investor4);
        await sale.invest({from: investor4, value: MinInvest});
        assert.equal((await token.balanceOf.call(investor4)).toNumber(), await _RT(2), "Investor4 should have 2 tokens");
    })

    it("try to unreserve invested", async function() {
        try {
            await restrictions.unreserveFor(investor4);
        } catch(e) {
            return true;
        }
        assert.isTrue(false, "Should never get here");
    })

    it("reserve and unreserve if not invested yet", async function() {
        await restrictions.reserveFor(investor5);        
        assert.isTrue(await restrictions.canInvest.call(investor5, MinInvest), "Should be able to invest");

        await restrictions.unreserveFor(investor5);        
        assert.isFalse(await restrictions.canInvest.call(investor5, MinInvest), "Should be able to unreserve");

        await restrictions.reserveFor(investor5);        
        assert.isTrue(await restrictions.canInvest.call(investor5, MinInvest), "Should be able to invest at last");

        await sale2.invest({from: investor5, value: MinInvest});
        assert.equal((await token.balanceOf.call(investor5)).toNumber(), await _RT(2), "Investor2 should have 2 tokens");        
    })

    it("check max investors", async function() {
        var totalInvestors = (await restrictions.investorsCount.call()).toNumber() + 
                        (await restrictions.reservedInvestorsCount.call()).toNumber();

        assert.equal(totalInvestors, MaxInvestors, "Should have max investors by now");
        assert.equal((await sale.tokensLeft.call()).toNumber(), await _RT(3), "Sale1 should have 3 tokens for sale");
        assert.equal((await sale2.tokensLeft.call()).toNumber(), await _RT(3), "Sale2 should have 3 tokens for sale");
    })

    it("can't reserve more", async function() {
        try {
            await restrictions.reserveFor(investor5);
        } catch(e) {
            return true;
        }
        assert.isTrue(false, "Should never get here");
    })

    it("advance time to the end of sale", async function() {
        await utils.timeTravelAndMine(3800);

        assert.equal(await sale.getState.call(), 3, "State should be finished");        
    })

    it("try invest after the end", async function() {
        try {
            await sale2.invest({from: investor3, value: MinInvest});
            assert.equal((await token.balanceOf.call(investor3)).toNumber(), await _RT(4), "Investor3 should have 4 tokens");
        } catch (e) {
            return true;
        }
        assert.isTrue(false, "Should never get here");
    })

    it('transfer to beneficiary', async function() {
        var oldbBalance = await web3.eth.getBalance(beneficiary);

        await sale2.transferToBeneficiary();

        var bBalance = await web3.eth.getBalance(beneficiary);  
        var balanceChange = bBalance.minus(oldbBalance).toNumber();

        assert.equal(balanceChange, 4 * OneEther, "Beneficiary should get 4 ether from sale2");

        await sale.transferToBeneficiary();
        
        bBalance = await web3.eth.getBalance(beneficiary);  
        balanceChange = bBalance.minus(oldbBalance).toNumber();

        assert.equal(balanceChange, 12 * OneEther, "Beneficiary should get 8 ether from sale1");
    })
})