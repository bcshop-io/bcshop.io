//
//
// Tests parnter crowdsales
//
//

var Web3 = require("web3");
var web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));
var utils = new (require("./timeutils.js"))(web3);

var Token = artifacts.require("BCSToken");
var token;

var Crowdsale = artifacts.require("BCSPartnerCrowdsale");
var sale;

var TokenPool = artifacts.require("TokenPool");
var pool;

var owner, beneficiary, investor1, investor2, partner;

var TokenCap = 1000;
var Decimals = 0;

var StartTime;
var DurationHours = 1;
var TokensForOneEther = 100;
var OneEther = web3.toWei(1, 'ether');
var InvestGasLimit = 170000;

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

function Prepare(accounts, _partner) {
    return new Promise(async (resolve, reject) => {
        
        owner = accounts[0];
        beneficiary = accounts[1];        
        partner = _partner;
        investor1 = accounts[6];
        investor2 = accounts[7];        
        
        token = await Token.new(TokenCap, Decimals);
        pool = await TokenPool.new(token.address);

        StartTime = utils.currentTime() + 100;
        sale = await Crowdsale.new(pool.address, 0, beneficiary, StartTime, DurationHours, 0, TokensForOneEther, 10, partner, 200);
        await token.transfer(pool.address, await _RT(TokenCap));
        await pool.setTrustee(sale.address, true);
        await token.allowTransferFor(pool.address, true);

        return resolve(true);
    })
}

contract("BCSPartnerCrowdsale. Tests partner fee and bonuses.", function(accounts) {
    it("create", async function() {
        await Prepare(accounts, accounts[2]);
        assert.equal(await _TB(pool.address), 1000, "Pool should contain all the tokens");
        assert.equal(await _TB(owner), 0, "Owner shouldn't contain any tokens");
    })

    it("check initial state", async function() {
        assert.equal((await sale.getState.call()).toNumber(), 1, "Sale state should be 'BeforeStart'");
    })

    it("try to invest too early. should fail", async function() {
        try {
            await web3.eth.sendTransaction({from:investor1, to:sale.address, value: OneEther, gas:InvestGasLimit});
        } catch (e) {
            return true;
        }
        assert.isTrue(false, "Investment should fail, too early");
    })

    it("advance time ahead to start and check state", async function() {
        await utils.timeTravelAndMine(101);
        assert.equal((await sale.getState.call()).toNumber(), 2, "Sale state should be 'Active'");
    })

    it("invest", async function() {
        var sBalance1 = await web3.eth.getBalance(sale.address);
        await web3.eth.sendTransaction({from:investor1, to:sale.address, value: OneEther, gas:InvestGasLimit});
        await web3.eth.sendTransaction({from:investor2, to:sale.address, value: 2 * OneEther, gas:InvestGasLimit});
        var sBalance2 = await web3.eth.getBalance(sale.address);

        assert.equal(sBalance2.minus(sBalance1).toNumber(), 3 * OneEther, "Sale should get 3E");
    })

    it("check tokens received", async function() {
        assert.equal(await _TB(investor1), 100 + 10, "Invesotr1 should have 110 tokens");
        assert.equal(await _TB(investor2), 200 + 20, "Invesotr2 should have 220 tokens");
    })

    it("check amounts to partner and benficiary", async function() {
        var bBalance = await sale.amountToBeneficiary.call();
        var pBalance = await sale.amountToPartner.call();

        assert.equal(bBalance, OneEther * 2.4, "Beneficiary can claim 2.4E");
        assert.equal(pBalance, OneEther * 0.6, "Partner can claim 0.6E");
    })

    it("advance time to an end", async function() {
        await utils.timeTravelAndMine(86400);
        assert.equal((await sale.getState.call()).toNumber(), 3, "Sale state should be 'FinishedSuccess'");
    })

    it("partner withdraws", async function() {
        var pBalance1 = await web3.eth.getBalance(partner);
        await sale.transferToPartner();
        var pBalance2 = await web3.eth.getBalance(partner);

        assert.equal(pBalance2.minus(pBalance1).toNumber(), 0.6 * OneEther, "Partner should get 0.6E");
    })

    it("partner tries to withdraw again", async function() {
        try {            
            await sale.transferToPartner();
        } catch (e) {
            return true;
        }
        assert.isFalse(true, "Should fail to withdraw");        
    })

    it("beneficiary withdraws", async function() {
        var pBalance1 = await web3.eth.getBalance(beneficiary);
        await sale.transferToBeneficiary();
        var pBalance2 = await web3.eth.getBalance(beneficiary);

        assert.equal(pBalance2.minus(pBalance1).toNumber(), 2.4 * OneEther, "Partner should get 2.4E");
    })
    
    it("beneficiary tries to withdraw again", async function() {
        try {            
            await sale.transferToBeneficiary();
        } catch (e) {
            return true;
        }
        assert.isFalse(true, "Should fail to withdraw");        
    })
})

contract("BCSPartnerCrowdsale.sol Malicious partner", function(accounts) {
    var ErrorPartner = artifacts.require("ErrorPartner");    

    it("create", async function() {
        var p = await ErrorPartner.new();

        await Prepare(accounts, p.address);
        await utils.timeTravelAndMine(101);
        await web3.eth.sendTransaction({from:investor1, to:sale.address, value: OneEther, gas:InvestGasLimit});
        await web3.eth.sendTransaction({from:investor2, to:sale.address, value: 2 * OneEther, gas:InvestGasLimit});
        await utils.timeTravelAndMine(86400);
    })

    it("check amounts to partner and benficiary", async function() {
        var bBalance = await sale.amountToBeneficiary.call();
        var pBalance = await sale.amountToPartner.call();

        assert.equal(bBalance, OneEther * 2.4, "Beneficiary can claim 2.4E");
        assert.equal(pBalance, OneEther * 0.6, "Partner can claim 0.6E");
    })
    
    it("partner withdraws", async function() {
        try {
            var pBalance1 = await web3.eth.getBalance(partner);
            await sale.transferToPartner();
            var pBalance2 = await web3.eth.getBalance(partner);
        } catch (e) {
            return true;
        }
        assert.isTrue(false, "Should fail");        
    })
})