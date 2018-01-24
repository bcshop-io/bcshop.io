//
//
//  Tests tranche based wallet. 
//
//

var Web3 = require("web3");
var web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));
var utils = new (require("./timeutils.js"))(web3);

var Token = artifacts.require("BCSToken");
var TWallet = artifacts.require("TokenTrancheWallet");
var token;

var Wallet = artifacts.require("EtherTrancheWallet");
var wallet;
var result;
var owner,  beneficiary;
var TRANCHE_AMOUNT_PCT = 8;
var TRANCHE_PERIOD_DAYS = 30;
var FUNDS_COMPLETE_UNLOCK_DAYS = 365;
var OneEther = web3.toWei(1, "ether");
var WalletFunds = OneEther;
var OneTranchePeriod = TRANCHE_PERIOD_DAYS * 86400;

//returns specifeid token's real balance
async function _TB(_holder) {
    return new Promise(async (resolve, reject) =>{
        return resolve((await token.balanceOf.call(_holder)).toNumber());
    })
}

contract("TokenTrancheWallet", function(accounts) {    
    var TokenCap = 1000;
    var WalletTokens = 200;
    var wallet;
    var owner = accounts[0];
    var user = accounts[1];
    let oneTranche;
    let TRANCHE_AMOUNT_PCT = 1;
    let TRANCHE_PERIOD_DAYS = 30;
    let FUNDS_COMPLETE_UNLOCK_DAYS = 2920;
    let OneTranchePeriod = TRANCHE_PERIOD_DAYS * 86400;
    
    it("create wallet and tokens", async function() {
        token = await Token.new(TokenCap, 0);
        wallet = await TWallet.new(token.address, user, TRANCHE_PERIOD_DAYS, TRANCHE_AMOUNT_PCT);
        console.log("Wallet creation gas: "+ web3.eth.getTransactionReceipt(wallet.transactionHash).gasUsed);

        assert.equal(await wallet.beneficiary.call(), user, "Invalid beneficiary");
        assert.equal(await wallet.token.call(), token.address, "Invalid token in wallet");

        await token.setLockedState(false);
    })

    it("transfer tokens to wallet", async function() {
        await token.transfer(wallet.address, WalletTokens);
        assert.equal(await _TB(wallet.address), WalletTokens, "Wallet should contain 200 tokens");
    })

    it("lock wallet", async function() {
        await wallet.lock(FUNDS_COMPLETE_UNLOCK_DAYS);
        var t = (await wallet.completeUnlockTime.call()).minus(await wallet.lockStart.call()).toNumber();
        assert.equal(t, FUNDS_COMPLETE_UNLOCK_DAYS * 24*60*60, "Invalid complete unlock time");
    })

    it("check tranche size", async function() {
        oneTranche = await wallet.oneTrancheAmount.call();        
        assert.equal(oneTranche.toNumber(), 2, "Invalid tranche size, should be 2");
    })

    it("initial 1 tranche", async function() {        
        result = await wallet.amountAvailableToWithdraw.call();
        assert.equal(result[1], 1, "Invalid tranche: should be 1");
        assert.equal(result[0], result[1] * oneTranche, "Invalid amount of 1 tranche");
    })    

    it("advance time on 1 period, 2 tranches", async function() {        
        await utils.timeTravelAndMine(OneTranchePeriod + 1);        

        result = await wallet.amountAvailableToWithdraw.call();
        assert.equal(result[1], 2, "Invalid tranche: should be 2");
        assert.equal(result[0], result[1] * oneTranche, "Invalid amount of 2 tranches");
    })

    it("advance time on less than 1 period, 2 tranches still", async function() {        
        await utils.timeTravelAndMine(OneTranchePeriod / 10);        

        result = await wallet.amountAvailableToWithdraw.call();
        assert.equal(result[1], 2, "Tranches should still equal to 2");
        assert.equal(result[0], result[1] * oneTranche, "Invalid amount of 2 tranches");
    })

    it("send available tranches to beneficiary", async function() {
        var oldBalance = await _TB(user);
        await wallet.sendToBeneficiary();
        var newBalance = await _TB(user);

        assert.equal(newBalance - oldBalance,  2 * oneTranche, "Beneficiary should get 2 tranches");
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

    it("advance time on 1 period, 1 tranche", async function() {
        await utils.timeTravelAndMine(OneTranchePeriod);
        result = await wallet.amountAvailableToWithdraw.call();
        assert.equal(result[1], 1, "Should be 1 tranches now");
        assert.equal(result[0].toNumber(), oneTranche.toNumber(), "Should be nothing to withdraw");
    })

    it("withdraw it, call as beneficiary", async function() {
        var oldBalance = await _TB(user);
        await wallet.sendToBeneficiary({from:user});
        var newBalance = await _TB(user);

        assert.equal(newBalance - oldBalance,  oneTranche, "Beneficiary should get 2 tranches");
    })

    it("advance time on 3 periods, 3 tranches", async function() {
        await utils.timeTravelAndMine(OneTranchePeriod * 3);
        result = await wallet.amountAvailableToWithdraw.call();
        assert.equal(result[1], 3, "Should be 3 tranches now");
        assert.equal(result[0], 3 * oneTranche, "Should be amount of 3 tranches to withdraw");        
    })

    it("advance time on 5 periods, available tranches are 3 and the rest = 8 total", async function() {
        await utils.timeTravelAndMine(OneTranchePeriod * 5);
        result = await wallet.amountAvailableToWithdraw.call();
        assert.equal(result[1].toNumber(), 8, "Should be 8 tranches now");
        assert.equal(result[0], 8 * oneTranche, "Should be amount of 10 tranches to withdraw");
    })

    it("send available tranches to beneficiary again", async function() {
        var oldBalance = await _TB(user);
        await wallet.sendToBeneficiary();
        var newBalance = await _TB(user);

        assert.equal(newBalance - oldBalance,  oneTranche * 8, "Beneficiary should get 8 tranches");
    })

    it("now no tranches are available", async function() {
        result = await wallet.amountAvailableToWithdraw.call();
        assert.equal(result[1], 0, "Should be 0 tranches now");
        assert.equal(result[0], 0, "Should be 0 tranches to withdraw");
    })

    // it("advance amount on one period, less than one tranche available, the remainder", async function() {
    //     await utils.timeTravelAndMine(OneTranchePeriod + 1);

    //     var wBalance = await _TB(wallet.address);
    //     result = await wallet.amountAvailableToWithdraw.call();
        
    //     assert.equal(result[1], 0, "Should be 0 tranches now");
    //     assert.equal(result[0].toNumber(), await _TB(wallet.address), "Should be equal to wallet balance");
    // })
    it("advance time to the end, withdraw everything", async function() {
        await utils.timeTravelAndMine(86400 * 88 * 30);
        var tokens = await _TB(wallet.address);
        result = await wallet.amountAvailableToWithdraw.call();
        assert.equal(result[1], 0, "Should be 0 tranches now");
        assert.equal(result[0].toNumber(), await _TB(wallet.address), "Should be equal to wallet balance");
    });

    it("send remainder to beneficiary", async function() {
        var amount = await _TB(wallet.address)
        var oldBalance = await _TB(user);
        await wallet.sendToBeneficiary();
        var newBalance = await _TB(user);

        assert.equal(newBalance - oldBalance,  amount, "Beneficiary should get the remainder");
    })

    it("wallet is empty", async function() {
        assert.equal(await _TB(wallet.address), 0, "Wallet should be empty");
    })
})

contract("TokenTrancheWallet. Test complete unlock period", async function(accounts) {
    var TokenCap = 1000;
    var WalletTokens = 200;
    var wallet;
    var owner = accounts[0];
    var user = accounts[1];
    
    let TRANCHE_AMOUNT_PCT = 9;
    let TRANCHE_PERIOD_DAYS = 1;
    let FUNDS_COMPLETE_UNLOCK_DAYS = 11;
    let OneTranchePeriod = TRANCHE_PERIOD_DAYS * 86400;
    
    it("create wallet, transfer tokens and lock wallet", async function() {
        token = await Token.new(TokenCap, 0);
        wallet = await TWallet.new(token.address, user, TRANCHE_PERIOD_DAYS, TRANCHE_AMOUNT_PCT);        

        await token.setLockedState(false);
        await token.transfer(wallet.address, WalletTokens);
        await wallet.lock(FUNDS_COMPLETE_UNLOCK_DAYS);
    })
        
    it("unlock period elapsed", async function() {
        await utils.timeTravelAndMine(FUNDS_COMPLETE_UNLOCK_DAYS * 86400 + 1);
        var result = await wallet.amountAvailableToWithdraw.call();

        assert.equal(result[1].toNumber(), 0, "Should return 0 tranches");
        assert.equal(result[0].toNumber(), WalletTokens, "Should return 1E as withdrawable funds");        
    })

    it("transfer to beneficiary", async function() {
        var oldBalance = await _TB(user);
        await wallet.sendToBeneficiary();
        var newBalance = await _TB(user);
        assert.equal(newBalance - oldBalance, WalletTokens, "Should get 200 Tokens");
    })

    it("check withdrawable amount", async function() {
        var result = await wallet.amountAvailableToWithdraw.call();

        assert.equal(result[1], 0, "Should return 0 tranches");
        assert.equal(result[0], 0, "Should return 0E as withdrawable funds");        
    })

    it("wallet is empty", async function() {
        assert.equal(await _TB(wallet.address), 0, "Wallet should be empty");
    })
})
