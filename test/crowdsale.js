//
//
// Tests crowdsale basic functions
//
//

var Web3 = require("web3");
var web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));
var utils = new (require("./timeutils.js"))(web3);

var Token = artifacts.require("BCSToken");
var token;

var Crowdsale = artifacts.require("BCSCrowdsale");
var sale;

var Pool = artifacts.require("TokenPool");
var pool;


var EtherReject = artifacts.require("EtherReject");

var OneEther = web3.toWei(1, "ether");
var StartTime;
var DurationHours;
var TokenCap = 1000;
var TokensForOneEther = 100;

var owner;
var beneficiary;
var investor1;
var investor2;
var investor3;

//returns real tokens amount considering token decimals
async function _RT(_tokens) {
    return new Promise(async (resolve, reject) =>{
        return resolve((await token.getRealTokenAmount.call(_tokens)).toNumber());
    })
}

//returns given address specifeid token's real balance
async function _TB(_holder) {
    return new Promise(async (resolve, reject) =>{
        return resolve((await token.balanceOf.call(_holder)).toNumber());
    })
}

function Prepare(accounts, _beneficiary) {
    return new Promise(async (resolve, reject) => {
        
        owner = accounts[0];
        beneficiary = _beneficiary;
        investor1 = accounts[2];
        investor2 = accounts[3];
        investor3 = accounts[4];

        token = await Token.new(TokenCap, 0);
        totalTokens = (await token.totalSupply.call()).toNumber();        
        
        pool = await Pool.new(token.address);
        assert.equal(await pool.token(), token.address, "Invalid pool token");
        
        await token.transfer(pool.address, totalTokens);
        var poolTokens = (await token.balanceOf.call(pool.address)).toNumber();
        assert.equal(poolTokens, totalTokens, "Invalid pool tokens amount");

        return resolve(true);
    })
}

contract("BCSCrowdsale. Goal not reached", async function(accounts) {
    it("create", async function() {
        var etherReject = await EtherReject.new();
        await Prepare(accounts, etherReject.address);
        
        StartTime = 0;
        DurationHours = 1;
        sale = await Crowdsale.new(pool.address, 0, beneficiary, StartTime, DurationHours, OneEther * 100, TokensForOneEther, 0);        
        await pool.setTrustee(sale.address, true);
    })

    it("invest", async function() {
        var investment1 = OneEther;
        await sale.invest({from: investor1, value: investment1});         
        assert.equal(await _TB(investor1), await _RT(100), "Investor1 should get 100 tokens");

        var investment2 = OneEther;
        await sale.invest({from: investor2, value: investment2});
        assert.equal(await _TB(investor2), await _RT(100), "Investor2 should get 100 tokens");
    })

    it("advance time to the end, state failed as goal not reached", async function() {
        await utils.timeTravelAndMine(DurationHours * 86400);
        assert.equal((await sale.getState.call()).toNumber(), 4, "State should be failed");
    })
})

contract("BCSCrowdsale. Goal reached. Withdraw throws. Make failed. Investors withdraw", async function(accounts) {
    
    it("create", async function() {
        var etherReject = await EtherReject.new();
        await Prepare(accounts, etherReject.address);
        
        StartTime = 0;
        DurationHours = 1;
        sale = await Crowdsale.new(pool.address, 0, beneficiary, StartTime, DurationHours, OneEther, TokensForOneEther, 0);        
        await pool.setTrustee(sale.address, true);
    })

    it("invest", async function() {
        var investment1 = OneEther;
        await sale.invest({from: investor1, value: investment1});         
        assert.equal(await _TB(investor1), await _RT(100), "Investor1 should get 100 tokens");

        var investment2 = OneEther * 3;
        await sale.invest({from: investor2, value: investment2});
        assert.equal(await _TB(investor2), await _RT(300), "Investor2 should get 300 tokens");
    })

    it("advane time to the end", async function() {
        await utils.timeTravelAndMine(DurationHours * 86400);
        assert.equal((await sale.getState.call()).toNumber(), 3, "State should be finished");
    })

    it("try to refund", async function() {
        try {
            await sale.refund({from: investor1});
        } catch(e) {
            return true;
        }
        assert.isTrue(false, "Should fail to refund");
    })

    it("try to withdraw", async function() {
        try {
            await sale.transferToBeneficiary();
        } catch (e) {
            return true;
        }

        assert.isTrue(false, "Should fail to withdraw");
    })    

    it("make failed", async function() {
        assert.equal((await sale.getState.call()).toNumber(), 3, "State still should be finished");
        await sale.makeFailed(true);
        assert.equal((await sale.getState.call()).toNumber(), 4, "State should be failed");
    })
    
    it("investor withdraw", async function() {
        var oldbalance1 = await web3.eth.getBalance(sale.address);

        await sale.refund({from: investor1});
        await sale.refund({from: investor2});

        var newbalance1 = await web3.eth.getBalance(sale.address);

        assert.equal(oldbalance1.minus(newbalance1).toNumber(), 4 * OneEther, "Sale should have 4E less");

        assert.equal(newbalance1.toNumber(), 0, "Sale should have nothing");
    })
})

contract("BCSCrowdsale. Withdraw throws. Change beneficiary", async function(accounts) {
    var StartOffset = 100;
    it("create", async function() {
        var etherReject = await EtherReject.new();
        await Prepare(accounts, etherReject.address);
        
        StartTime = 0;
        DurationHours = 1;
        sale = await Crowdsale.new(pool.address, 0, beneficiary, StartTime, DurationHours, 0, TokensForOneEther, 0);        
        await pool.setTrustee(sale.address, true);
    })

    it("invest", async function() {
        var investment1 = OneEther;
        await sale.invest({from: investor1, value: investment1});         
        assert.equal(await _TB(investor1), await _RT(100), "Investor1 should get 100 tokens");        
        await utils.timeTravelAndMine(DurationHours * 86400);
        assert.equal((await sale.getState.call()).toNumber(), 3, "State should be finished");
    })

    it("try to withdraw", async function() {
        try {
            await sale.transferToBeneficiary();
        } catch (e) {
            return true;
        }

        assert.isTrue(false, "Should fail to withdraw");
    })    

    it("change beneficiary and withdraw", async function() {
        beneficiary = accounts[1];
        await sale.changeBeneficiary(beneficiary);
        assert.equal(await sale.beneficiary.call(), beneficiary, "Invalid new beneficiary")

        var oldbalance1 = await web3.eth.getBalance(beneficiary);
        await sale.transferToBeneficiary();
        var newbalance1 = await web3.eth.getBalance(beneficiary);

        assert.equal(newbalance1.minus(oldbalance1).toNumber(), 1 * OneEther, "New beneficiary should get 1E");
    })    
})

