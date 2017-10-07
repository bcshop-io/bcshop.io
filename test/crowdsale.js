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

var EtherCharity = artifacts.require("EtherCharity");
var EtherReject = artifacts.require("EtherReject");
var injector;
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
        await token.allowTransferFor(pool.address, true);
        
        await token.transfer(pool.address, totalTokens);
        
        var poolTokens = (await token.balanceOf.call(pool.address)).toNumber();
        assert.equal(poolTokens, totalTokens, "Invalid pool tokens amount");

        return resolve(true);
    })
}


contract("BCSCrowdsale. Tests too early and too late investments.", function(accounts) {
    it("create", async function() {
        await Prepare(accounts, accounts[1]);
        
        StartTime = utils.currentTime() + 100;
        DurationHours = 1;
        sale = await Crowdsale.new(pool.address, 0, beneficiary, StartTime, DurationHours, 0, TokensForOneEther, 0);                
        await pool.setTrustee(sale.address, true);
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

    it("advance time to end", async function() {
        await utils.timeTravelAndMine(3600);
        assert.equal((await sale.getState.call()).toNumber(), 3, "Sale state should be 'Finished Success'");
    })

    it("try to invest too late. should fail", async function() {
        try {
            await web3.eth.sendTransaction({from:investor3, to:sale.address, value: OneEther, gas:InvestGasLimit});
        } catch (e) {
            return true;
        }
        assert.isTrue(false, "Investment should fail, too late");
    })    
})

contract("BCSCrowdsale. Investor1 invests half of cap, Investor2 tries to invest more than half", function(accounts) {
    it("create", async function() {
        await Prepare(accounts, accounts[1]);
        
        StartTime = 0;
        DurationHours = 1;
        sale = await Crowdsale.new(pool.address, 0, beneficiary, StartTime, DurationHours, 0, TokensForOneEther, 0);                
        await pool.setTrustee(sale.address, true);
    })

    it("investor1 invests half", async function() {
        var investment1 = 5 * OneEther;
        await sale.invest({from: investor1, value: investment1});         
        assert.equal(await _TB(investor1), await _RT(500), "Investor1 should get 500 tokens");
    })

    it("investor2 invests more than half", async function() {
        var investment1 = 7 * OneEther;
        await sale.invest({from: investor2, value: investment1});         
        assert.equal(await _TB(investor2), await _RT(500), "Investor1 should get 500 tokens");
    })

    it("investor2 should have 2E as overpay", async function() {
        assert.equal(await sale.overpays.call(investor2), OneEther * 2, "Invalid overpay");
        var oldBalance = await web3.eth.getBalance(investor2);
        await sale.withdrawOverpay({from:investor2});
        var newBalance = await web3.eth.getBalance(investor2);
        assert.closeTo(newBalance.minus(oldBalance).toNumber(), Number(2 * OneEther), Number(OneEther/100), "Invalid overpay received");
        assert.equal(await sale.overpays.call(investor2), 0, "Invalid 0 overpay");
    })
})

contract("BCSCrowdsale. Inject ether via selfdestruct", function(accounts) {
    it("create", async function() {
        await Prepare(accounts, accounts[1]);
        
        StartTime = 0;
        DurationHours = 1;
        sale = await Crowdsale.new(pool.address, 0, beneficiary, StartTime, DurationHours, 0, TokensForOneEther, 0);                
        await pool.setTrustee(sale.address, true);
    })

    it("invest", async function() {
        var investment1 = OneEther;
        await sale.invest({from: investor1, value: investment1});         
        assert.equal(await _TB(investor1), await _RT(100), "Investor1 should get 100 tokens");
    })

    it("inject 1E", async function() {

        var tokensLeft1 = await sale.tokensLeft.call();
        var balance1 = await web3.eth.getBalance(sale.address);
        injector = await EtherCharity.new();
        await web3.eth.sendTransaction({from:owner, to:injector.address, value:OneEther});
        await injector.donate(sale.address);
        var balance2 = await web3.eth.getBalance(sale.address);
        var tokensLeft2 = await sale.tokensLeft.call();

        assert.equal(balance2.minus(balance1).toNumber(), OneEther, "Sale should get 1E");
        assert.equal(tokensLeft2.minus(tokensLeft1).toNumber(), 0, "Sale should sell 0 tokens");
    })
    
    it("advance time to the end and withdraw", async function() {
        await utils.timeTravelAndMine(DurationHours * 86400);
        assert.equal((await sale.getState.call()).toNumber(), 3, "State should be finished");

        var oldbalance1 = await web3.eth.getBalance(beneficiary);
        await sale.transferToBeneficiary();
        var newbalance1 = await web3.eth.getBalance(beneficiary);

        assert.equal(newbalance1.minus(oldbalance1).toNumber(), 1 * OneEther, "Beneficiary should get 1E");
        assert.equal((await web3.eth.getBalance(sale.address)).toNumber(), OneEther, "Sale should have 1E from inject");
    })    

    it("check injector's state", async function() {
        assert.equal(await sale.investedFrom.call(injector.address), 0, "Injector should have 0 invested");
        assert.equal(await sale.overpays.call(injector.address), 0, "Injector should have 0 overpays");        
    })
})

contract("BCSCrowdsale. Goal not reached", function(accounts) {
    it("create", async function() {        
        await Prepare(accounts, accounts[1]);
        
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

    it("advance time to the end", async function() {
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

contract("BCSCrowdsale. Overpays", function(accounts) {
    var tokensForEther = 1;
    it("create", async function() {
        await Prepare(accounts, accounts[1]);
        
        StartTime = 0;
        DurationHours = 1;        
        sale = await Crowdsale.new(pool.address, 0, beneficiary, StartTime, DurationHours, 0, tokensForEther, 0);
        await pool.setTrustee(sale.address, true);
    })

    it("invest with overpay from investor1 and investor2", async function() {
        var investment1 = OneEther*1.5;        
        await sale.invest({from: investor1, value: investment1});         
        assert.equal(await _TB(investor1), await _RT(1), "Investor1 should get 1 token");
        assert.equal((await sale.overpays.call(investor1)).toNumber(), OneEther / 2, "Overpay should be 0.5E");    

        await sale.invest({from: investor2, value: investment1});
        assert.equal(await _TB(investor2), await _RT(1), "Investor2 should get 1 token");
        assert.equal((await sale.overpays.call(investor2)).toNumber(), OneEther / 2, "Overpay should be 0.5E");

        var investment2 = OneEther*2.5;        
        await sale.invest({from: investor1, value: investment2});
        assert.equal(await _TB(investor1), await _RT(3), "Investor1 should have 3 token");
        assert.equal((await sale.overpays.call(investor1)).toNumber(), OneEther, "Overpay should be 1E");    
    })

    it("withdraw before sale end", async function() {
        var b1 = await web3.eth.getBalance(sale.address);
        var t1 = await sale.withdrawOverpay({from:investor2});
        var t2 = await sale.withdrawOverpay({from:investor2});
        var b2 = await web3.eth.getBalance(sale.address);

        assert.equal(b1.minus(b2).toNumber(), OneEther / 2, "Sale balance should be less by 0.5E");
        assert.equal(t1.logs[0].event, "OverpayRefund", "OverpayRefund event should be fired");
        assert.equal(t2.logs.length, 0, "OverpayRefund event shouldn't be fired");
    })

    it("advance time to the end", async function() {
        await utils.timeTravelAndMine(DurationHours * 86400);
        assert.equal((await sale.getState.call()).toNumber(), 3, "State should be finished");
    })

    it("withdraw after sale end", async function() {
        var b1 = await web3.eth.getBalance(sale.address);
        var t1 = await sale.withdrawOverpay({from:investor1});
        var t2 = await sale.withdrawOverpay({from:investor1});
        var b2 = await web3.eth.getBalance(sale.address);

        assert.equal(b1.minus(b2).toNumber(), OneEther, "Sale balance should be less by 1E");
        assert.equal(t1.logs[0].event, "OverpayRefund", "OverpayRefund event should be fired");

        assert.equal(await web3.eth.getBalance(sale.address), 4 * OneEther, "Sale should have 4E - invested amount");
    })

    it("transfer to beneficiary", async function() {
        var i1 = await web3.eth.getBalance(beneficiary);
        await sale.transferToBeneficiary();
        var b1 = await web3.eth.getBalance(sale.address);
        var i2 = await web3.eth.getBalance(beneficiary);

        assert.equal(i2.minus(i1).toNumber(), 4 * OneEther, "Beneficiary shuold get 4E");
        assert.equal(await web3.eth.getBalance(sale.address), 0, "Sale should have 0E");
    })
})
