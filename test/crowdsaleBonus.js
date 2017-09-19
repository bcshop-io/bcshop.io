//
//
// Tests crowdsale bonuses
//
//

var Web3 = require("web3");
var web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));
var utils = new (require("./timeutils.js"))(web3);

var Token = artifacts.require("BCSToken");
var token;

var Crowdsale = artifacts.require("BCSCrowdsale");
var TgeCrowdsale = artifacts.require("BCSTgeCrowdsale");
var sale;

var Pool = artifacts.require("TokenPool");
var pool;

var OneEther = web3.toWei(1, "ether");
var StartTime = 0;
var DurationHours = 1;
var TokenCap = 1210;
var TokensForOneEther = 100;

var owner;
var beneficiary;
var investor1;
var investor2;

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

function Prepare(accounts) {
    return new Promise(async (resolve, reject) => {
        
        owner = accounts[0];
        beneficiary = accounts[1];
        investor1 = accounts[2];
        investor2 = accounts[3];        

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

/*Scenario:
1100 Tokens are being sold with 10% bonus. 100 tokens cost 1 ether. 
Buyer pays 11 ether. It should receive 1000 tokens and 100 bonus.
Also contract keeps 1 ether as an overpay to withdraw later */
contract("Crowdsale flat bonus. Buy tokens to cap.", function(accounts) {
    it("create sale with flat bonus", async function() {
        await Prepare(accounts);
        sale = await Crowdsale.new(pool.address, 0, beneficiary, StartTime, DurationHours, 0, TokensForOneEther, 10);
        await pool.setTrustee(sale.address, true);
    })

    it("invest 1E, get 110 tokens", async function() {
        var investment = OneEther;
        await sale.invest({from: investor2, value: investment});
        assert.equal(await _TB(investor2), await _RT(110), "Investor2 should get 1100 tokens");
        assert.equal((await sale.overpays.call(investor2)).toNumber(), 0, "Should have 0 overpay");
    })

    it("invest, get cap tokens with bonus", async function() {
        var investment = OneEther * 11;
    
        var iBalance1 = await web3.eth.getBalance(investor1);
        var oldBalance2 = await web3.eth.getBalance(beneficiary);        

        var result = await sale.howManyTokensForEther.call(investment);        
        assert.equal(result[0].toNumber(), 1100, "Should be able to buy 1100 tokens");
        assert.equal(result[1].toNumber(), OneEther, "Should be able to get 1E as overpay");
        
        await sale.invest({from: investor1, value: investment});
        
        assert.equal(await _TB(investor1), await _RT(1100), "Investor1 should get 1100 tokens");
        assert.equal((await sale.overpays.call(investor1)).toNumber(), result[1], "Should have 1E overpay");
        assert.equal((await sale.getState.call()).toNumber(), 3, "State should be FinishedSuccess");
    })

    it("withdraw overpay", async function() {
        var b1 = await web3.eth.getBalance(sale.address);
        var t1 = await sale.withdrawOverpay({from:investor1});        
        var b2 = await web3.eth.getBalance(sale.address);

        assert.equal(b1.minus(b2).toNumber(), OneEther * 1, "Sale balance should be less by 1E");        
    })

    it("transfer to beneficiary", async function() {
        var i1 = await web3.eth.getBalance(beneficiary);
        await sale.transferToBeneficiary();
        var b1 = await web3.eth.getBalance(sale.address);
        var i2 = await web3.eth.getBalance(beneficiary);

        assert.equal(i2.minus(i1).toNumber(), 11 * OneEther, "Beneficiary shuold get 11E");
        assert.equal(await web3.eth.getBalance(sale.address), 0, "Sale should have 0E");
    })
})

contract("Crowdsale with variable bonus.", function(accounts) {
    var steps = 3;
    var oneStepD;
    it("create sale with variable bonus. 3 steps: 10% 5% 0%", async function() {
        await Prepare(accounts);
        sale = await TgeCrowdsale.new(pool.address, 0, beneficiary, StartTime, DurationHours, 0, TokensForOneEther, 10, steps);
        await pool.setTrustee(sale.address, true);
        assert.equal(await sale.getCurrentBonusPct.call(), 10, "Current bonus is 10%");
    })

    it("check bonus step", async function() {
        var endTime = await sale.endTime.call();
        var startTime = await sale.startTime.call();
        oneStepD = endTime.minus(startTime).toNumber() / steps;
        assert.equal(oneStepD, 60*20, "One step duration should be 20 minutes");
    })

    it("advance time to less than one period. bonus still should be 10%", async function() {
        await utils.timeTravelAndMine(60);
        assert.equal((await sale.getCurrentBonusPct.call()).toNumber(), 10, "1st step: 10%");
        await sale.invest({from: investor2, value: OneEther});
        assert.equal(await _TB(investor2), 110, "Should get 110 tokens");
    })

    it("advance time to one period. bonus should be 5%", async function() {
        await utils.timeTravelAndMine(oneStepD);
        assert.equal((await sale.getCurrentBonusPct.call()).toNumber(), 5, "2st step: 5%");        
        await sale.invest({from: investor2, value: OneEther});
        assert.equal(await _TB(investor2), 110 + 105, "Should get 215 tokens");
    })

    it("advance time to one period more. bonus should be 0%", async function() {
        await utils.timeTravelAndMine(oneStepD);
        assert.equal((await sale.getCurrentBonusPct.call()).toNumber(), 0, "3st step: 0%");
        await sale.invest({from: investor2, value: OneEther});
        assert.equal(await _TB(investor2), 110 + 105 + 100, "Should get 315 tokens");
    })
})