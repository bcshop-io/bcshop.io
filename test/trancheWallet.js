//
//
//  Tests tranche based wallet. 
//
//

var Web3 = require("web3");
var web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));
var utils = new (require("./timeutils.js"))(web3);

var Wallet = artifacts.require("TrancheWallet");
var wallet;
var result;
var owner,  beneficiary;
var TRANCHE_AMOUNT_PCT = 8;
var TRANCHE_PERIOD_DAYS = 30;
var FUNDS_COMPLETE_UNLOCK_DAYS = 365;
var OneEther = web3.toWei(1, "ether");
var WalletFunds = OneEther;
var OneTranchePeriod = TRANCHE_PERIOD_DAYS * 86400;

function Prepare(accounts) {
    return new Promise(async (resolve, reject) => {
        
        owner = accounts[0];
        beneficiary = accounts[1];
        
        wallet = await Wallet.new(beneficiary, TRANCHE_PERIOD_DAYS, TRANCHE_AMOUNT_PCT);
        assert.equal(await wallet.beneficiary.call(), beneficiary, "Invalid beneficiary");
                
        await web3.eth.sendTransaction({from:owner, to:wallet.address, value: WalletFunds});        
        var wBalance = await web3.eth.getBalance(wallet.address);
        assert.equal(wBalance, WalletFunds, "Wallet balance should be 1E");

        await wallet.lock(FUNDS_COMPLETE_UNLOCK_DAYS);
        var t = (await wallet.completeUnlockTime.call()).minus(await wallet.lockStart.call()).toNumber();
        assert.equal(t, FUNDS_COMPLETE_UNLOCK_DAYS * 24*60*60, "Invalid complete unlock");

        return resolve(true);
    })    
}

// contract("TrancheWallet. Test complete unlock period", async function(accounts) {
//     it("create", async function() {
//         await Prepare(accounts);
//     })

//     it("unlock period elapsed", async function() {
//         await utils.timeTravelAndMine(FUNDS_COMPLETE_UNLOCK_DAYS * 86400 + 1);
//         var result = await wallet.amountAvailableToWithdraw.call();

//         assert.equal(result[1].toNumber(), 0, "Should return 0 tranches");
//         assert.equal(result[0].toNumber(), WalletFunds, "Should return 1E as withdrawable funds");        
//     })

//     it("transfer to beneficiary", async function() {
//         var oldBalance = await web3.eth.getBalance(beneficiary);
//         await wallet.sendToBeneficiary();
//         var newBalance = await web3.eth.getBalance(beneficiary);
//         assert.equal(newBalance.minus(oldBalance).toNumber(), WalletFunds, "Should be get 1E");        
//     })

//     it("check withdrawable amount", async function() {
//         var result = await wallet.amountAvailableToWithdraw.call();

//         assert.equal(result[1], 0, "Should return 0 tranches");
//         assert.equal(result[0], 0, "Should return 0E as withdrawable funds");        
//     })
// })

contract("TrancheWallet. Test tranches", async function(accounts) {
    var oneTranche;

    it("create", async function() {
        await Prepare(accounts);
    })

    it("check tranche size", async function() {
        oneTranche = await wallet.oneTrancheAmount.call();
        assert.equal(oneTranche.toNumber(), OneEther * 0.08, "Invalid tranche size");
    })

    it("initial 1 tranche", async function() {        
        result = await wallet.amountAvailableToWithdraw.call();
        assert.equal(result[1], 1, "Invalid tranche: 1");
        assert.equal(result[0], result[1] * oneTranche, "Invalid amount of 1 tranche");
    })

    it("advance time on 1 period, 2 tranches", async function() {        
        await utils.timeTravelAndMine(OneTranchePeriod + 1);        

        result = await wallet.amountAvailableToWithdraw.call();
        assert.equal(result[1], 2, "Invalid tranche: 2");
        assert.equal(result[0], result[1] * oneTranche, "Invalid amount of 2 tranches");
    })

    it("advance time on less than 1 period, 2 tranches still", async function() {        
        await utils.timeTravelAndMine(OneTranchePeriod / 10);        

        result = await wallet.amountAvailableToWithdraw.call();
        assert.equal(result[1], 2, "Tranches should still equal to 2");
        assert.equal(result[0], result[1] * oneTranche, "Invalid amount of 2 tranches");
    })

    it("send available tranches to beneficiary", async function() {
        var oldBalance = await web3.eth.getBalance(beneficiary);
        await wallet.sendToBeneficiary();
        var newBalance = await web3.eth.getBalance(beneficiary);

        assert.equal(newBalance.minus(oldBalance).toNumber(),  OneEther * 0.16, "Beneficiary should get 2 tranches");
    })

    it("now no tranches are available", async function() {
        result = await wallet.amountAvailableToWithdraw.call();
        assert.equal(result[1], 0, "Should be 0 tranches now");
        assert.equal(result[0], 0, "Should be nothing to withdraw");
    })

    it("advance time on less than 1 period, still no tranches", async function() {
        await utils.timeTravelAndMine(OneTranchePeriod / 10);
        result = await wallet.amountAvailableToWithdraw.call();
        assert.equal(result[1], 0, "Should be 0 tranches now");
        assert.equal(result[0], 0, "Should be nothing to withdraw");
    })

    it("advance time on 3 periods, 3 tranches", async function() {
        await utils.timeTravelAndMine(OneTranchePeriod * 3);
        result = await wallet.amountAvailableToWithdraw.call();
        assert.equal(result[1], 3, "Should be 3 tranches now");
        assert.equal(result[0], 3 * oneTranche, "Should be amount of 3 tranches to withdraw");
    })

    it("advance time on 7 periods, available tranches are 3 and the rest = 10 total", async function() {
        await utils.timeTravelAndMine(OneTranchePeriod * 7);
        result = await wallet.amountAvailableToWithdraw.call();
        assert.equal(result[1], 10, "Should be 10 tranches now");
        assert.equal(result[0], 10 * oneTranche, "Should be amount of 10 tranches to withdraw");
    })

    it("send available tranches to beneficiary again", async function() {
        var oldBalance = await web3.eth.getBalance(beneficiary);
        await wallet.sendToBeneficiary();
        var newBalance = await web3.eth.getBalance(beneficiary);

        assert.equal(newBalance.minus(oldBalance).toNumber(),  OneEther * 0.8, "Beneficiary should get 10 tranches");
    })

    it("now no tranches are available", async function() {
        result = await wallet.amountAvailableToWithdraw.call();
        assert.equal(result[1], 0, "Should be 0 tranches now");
        assert.equal(result[0], 0, "Should be 0 tranches to withdraw");
    })

    it("advance amount on one period, less than one tranche available", async function() {
        await utils.timeTravelAndMine(OneTranchePeriod + 1);

        var wBalance = await web3.eth.getBalance(wallet.address);
        result = await wallet.amountAvailableToWithdraw.call();
        
        assert.equal(result[1], 0, "Should be 0 tranches now");
        assert.equal(result[0].toNumber(), wBalance.toNumber(), "Should be equal to wallet balance");
    })
})