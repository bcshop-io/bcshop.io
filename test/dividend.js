//
//
// Tests dividend wallet based on token with floating supply
//
//

var Web3 = require("web3");
var web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));

var Wallet = artifacts.require("DividendWalletFloating");
var wallet;

var Token = artifacts.require("BCSToken");
var token;

var TokenCap = 100;
var OneEther = web3.toWei(1, "ether");

var owner;
var beneficiary;
var investor1;
var investor2;
var investor3;
var investor4;
var reserved;

//returns real tokens amount considering token decimals
async function _RT(_tokens) {
    return new Promise(async (resolve, reject) =>{
        return resolve((await token.getRealTokenAmount.call(_tokens)).toNumber());
    })
}

//returns specifeid token's real balance
async function _TB(_holder) {
    return new Promise(async (resolve, reject) =>{
        return resolve((await token.balanceOf.call(_holder)).toNumber());
    })
}

//returns specifeid holder's wallet share
async function _WB(_holder) {
    return new Promise(async (resolve, reject) =>{
        return resolve((await wallet.etherBalanceOf.call(_holder)).toNumber());
    })
}

function Prepare(accounts) {
    return new Promise(async (resolve, reject) => {
        
        owner = accounts[0];
        beneficiary = accounts[1];
        reserved = accounts[2];
        investor1 = accounts[6];
        investor2 = accounts[7];
        investor3 = accounts[8];
        investor4 = accounts[9];

        token = await Token.new(TokenCap, 18);    
        wallet = await Wallet.new(token.address);
        await token.setValueAgent(wallet.address);

        return resolve(true);
    })
}

/* Scenario:
    Wallet gets some ether. Investor1 withdraws its share and transfers all of his tokens to investor2.
    Wallet gets more ether. Investor2 should be able to claim 1st tranche with his initial tokens and 2nd tranche with 
    sum of tokens. Then owner withdraws all and wallet should be empty */
contract("DividendWallet. Common tests.", function(accounts) {
    var tokens1 = 20;
    var tokens2 = 40;
    var tokens3 = 10;
    var tranche1 = OneEther;
    var tranche2 = 2 * OneEther;

    it("create and distribute token", async function() {
        await Prepare(accounts);
        await token.transfer(investor1, await _RT(tokens1));
        await token.transfer(investor2, await _RT(tokens2));
        await token.transfer(investor3, await _RT(tokens3));

        assert.equal(await _TB(owner), await _RT(30), "Owner should keep 30 tokens");
    })

    it("wallet gets ether 1", async function() {        
        await web3.eth.sendTransaction({from:owner, to:wallet.address, value: tranche1});
        var wBalance = await web3.eth.getBalance(wallet.address);
        assert.equal(wBalance.toNumber(), OneEther, "Wallet should contain 1E");
    })

    it("investor1 claims its share", async function() {
        var oldBalance1 = await web3.eth.getBalance(investor1);
        var wOldBalance1 = await web3.eth.getBalance(wallet.address);

        var estimatedShare = OneEther * 20 / 100;

       // assert.equal(await _WB(investor1), estimatedShare, "Investor1 share should be 0.2E");

        await wallet.withdrawAll({from: investor1}); //should claim 1 * 20 / 100  = 0.2 Ether;

        var newBalance1 = await web3.eth.getBalance(investor1);
        var wNewBalance1 = await web3.eth.getBalance(wallet.address);
        
        assert.isTrue(newBalance1.greaterThan(oldBalance1), true, "Investor1 should get some ether");
        assert.equal(wOldBalance1.minus(wNewBalance1).toNumber(), estimatedShare, "Wallet balance should be less by 0.2E");
        assert.equal(await _WB(investor1), 0, "Investor1 share now should be 0");
    })

    it("transfer tokens to investor2 and check its share", async function() {
        var estimatedShare = OneEther * 40 / 100;
        assert.equal(await _WB(investor2), estimatedShare, "Investor2 share should be 0.4E");

        await token.transfer(investor2, await _TB(investor1), {from:investor1});
        assert.equal(await _TB(investor1), 0, "Investor1 now should have 0 tokens");
        assert.equal(await _WB(investor2), estimatedShare, "Investor2 share still should be 0.4E");
    })

    it("wallet gets ether 2", async function() {
        var wOldBalance = await web3.eth.getBalance(wallet.address);
        await web3.eth.sendTransaction({from:investor1, to:wallet.address, value: tranche2});
        var wNewBalance = await web3.eth.getBalance(wallet.address);
        assert.equal(wNewBalance.minus(wOldBalance).toNumber(), tranche2, "Wallet balance should be greater by 2E");
    })

    it("investor2 claims it share", async function() {
        var wOldBalance1 = await web3.eth.getBalance(wallet.address);
        await wallet.withdrawAll({from: investor2}); //should claim 1 * 0.4 + 2 * 0.6  = 1.6 Ether;
        var wNewBalance1 = await web3.eth.getBalance(wallet.address);

        var estimatedShare = 1.6 * OneEther;
        assert.equal(wOldBalance1.minus(wNewBalance1).toNumber(), estimatedShare, "Wallet balance should be less by 1.6E");        
        assert.equal(await _WB(investor2), 0, "Investor2 share now should be 0");
    })    

    it("owner claims all", async function() {
        var wOldBalance1 = await web3.eth.getBalance(wallet.address);
        await wallet.withdrawAll(); //should claim 3 * 0.3 = 0.9 Ether;
        var wNewBalance1 = await web3.eth.getBalance(wallet.address);

        var estimatedShare = 0.9 * OneEther;
        assert.equal(wOldBalance1.minus(wNewBalance1).toNumber(), estimatedShare, "Wallet balance should be less by 0.9E");        
        assert.equal(await _WB(owner), 0, "Owner share now should be 0");
    })

    it("empty wallet", async function() {
        await wallet.withdrawAll({from:investor3});
        assert.equal(await web3.eth.getBalance(wallet.address), 0, "Wallet should be empty now");
    })    
})


/* Scenario:
    Wallet gets some ether. Address1 withdraws its share. Then some tokens are burnt.    
    Wallet gets more ether. Now Address1 share should account for new tranche with modified supply */
contract("DividendWallet. Floating supply test.", function(accounts) {
    var tokens1 = 20;
    var tokens2 = 50;
    var tokensToBurn = 20;
    
    var tranche1 = OneEther;
    var tranche2 = 2 * OneEther;

    it("create and distribute tokens", async function() {
        await Prepare(accounts);
        await token.transfer(investor1, await _RT(tokens1));
        await token.transfer(investor2, await _RT(tokens2));        

        assert.equal(await _TB(owner), await _RT(30), "Owner should keep 30 tokens");
    })

    it("wallet gets ether 1", async function() {
        await web3.eth.sendTransaction({from:owner, to:wallet.address, value: tranche1});
        var wBalance = await web3.eth.getBalance(wallet.address);
        assert.equal(wBalance.toNumber(), OneEther, "Wallet should contain 1E");        
    })

    it("investor1 claims its share", async function() {        
        var wOldBalance1 = await web3.eth.getBalance(wallet.address);
        var estimatedShare = tranche1 * 20 / 100;
       
        await wallet.withdrawAll({from: investor1}); //should claim 1 * 20 / 100  = 0.2 Ether;
        
        var wNewBalance1 = await web3.eth.getBalance(wallet.address);
                
        assert.equal(wOldBalance1.minus(wNewBalance1).toNumber(), estimatedShare, "Wallet balance should be less by 0.2E");
        assert.equal(await _WB(investor1), 0, "Investor1 share now should be 0");
    })

    it("burn some tokens from owner", async function() {
        await token.burn(await _RT(tokensToBurn), {from:owner});
        assert.equal(await token.getValuableTokenAmount.call(), await _RT(80), "Valuable tokens should now equal to 90");        
    })

    it("check shares for investor1 and investor2", async function() {
        assert.equal(await _WB(investor1), 0, "Investor1 should still have 0 to claim");
        assert.equal(await _WB(investor2), OneEther * 0.5, "Investor2 should still have 0.5E to claim");
    })

    it("wallet gets ether 2", async function() {
        await web3.eth.sendTransaction({from:owner, to:wallet.address, value: tranche2});
        var wBalance = await web3.eth.getBalance(wallet.address);
        assert.equal(wBalance.toNumber(), OneEther * 2.8, "Wallet should contain 2.8E");
    })

    // it("check share for investor2 after tranche", async function() {
    //     var estimatedShare = OneEther * 1.75; //1 * 50/100 + 2 * 50/80
    //     assert.equal(await _WB(investor2), estimatedShare, "Investor2 share should be 1.75E");
    // })

    it("investor2 claims its share", async function() {        
        var wOldBalance1 = await web3.eth.getBalance(wallet.address);
        var estimatedShare = OneEther * 1.75;

        await wallet.withdrawAll({from: investor2}); //should claim 1.75E

        var wNewBalance1 = await web3.eth.getBalance(wallet.address);

        assert.equal(wOldBalance1.minus(wNewBalance1).toNumber(), estimatedShare, "Wallet balance should be less by 1.75E");
        assert.equal(await _WB(investor2), 0, "Investor2 share now should be 0");
    })

    it("owner withdraws all, check its share", async function() {
        var estimatedShare = OneEther * 55/100; //1*30/100 + 2*10/80

        var wOldBalance1 = await web3.eth.getBalance(wallet.address);        
        await wallet.withdrawAll({from: owner});
        var wNewBalance1 = await web3.eth.getBalance(wallet.address);

        assert.equal(wOldBalance1.minus(wNewBalance1).toNumber(), estimatedShare, "Wallet balance should be less by 0.55E");
        assert.equal(await _WB(owner), 0, "Owner share now should be 0");            
    })

    it("wallet should contain only investor1 share of tranche2", async function() {
        var estimatedShare = OneEther * 2 * 20 / 80;
        var wBalance = await web3.eth.getBalance(wallet.address);
        assert.equal(wBalance, estimatedShare, "wallet should contain only investor1 share of tranche2");
        assert.equal(wBalance, await _WB(investor1), "wallet balance should be equal to investor1 share");
    })
})

/* Scenario:
    Wallet gets ether. 
    Address3 becomes reserved. Check valuable tokens. Check Address1 claimable ether
    Tokens are transferred to Address3. Check valuable tokens. Check Address1 claimable ether
    Wallet gets more ether. Check Address1 claimable ether
    Address3 stops being reserved. Check valuable tokens. Check Address1 claimable ether
    Check Address3 claimable ether. It should be 0.
    More tokens are transferred to Address1. 
    Wallet gets more ether. Check Address1 claimable ether
    Everybody withdraws all, check empty wallet */
contract("DividendWallet. Reserved addresses.", function(accounts) {
    var tokens1 = 20;
    var tokens2 = 50;
    var tokensToReserve = 20;
    
    var tranche1 = OneEther;
    var tranche2 = 2 * OneEther;
    var tranche3 = OneEther;

    it("create and distribute tokens", async function() {
        await Prepare(accounts);
        await token.transfer(investor1, await _RT(tokens1));
        await token.transfer(investor2, await _RT(tokens2));        

        assert.equal(await token.getValuableTokenAmount.call(), await _RT(100), "Valuable tokens should equal to cap");
    })

    it("wallet gets some ether and reserve holder", async function() {
        await web3.eth.sendTransaction({from:owner, to:wallet.address, value: tranche1});
        await token.setReserved(reserved, true);
        assert.equal(await token.getValuableTokenAmount.call(), await _RT(100), "Valuable tokens should equal to cap");

        await token.transfer(reserved, await _RT(tokensToReserve));
        assert.equal(await token.getValuableTokenAmount.call(), await _RT(80), "Valuable tokens should equal to 80");
    })

    it("check Investor1 share", async function() {
        var estimatedShare = OneEther * 20 / 100;
        assert.equal(await _WB(investor1), estimatedShare, "Investor1 share should be 0.2E");
    })    

    it("wallet gets more ether, check investors' shares", async function() {
        await web3.eth.sendTransaction({from:owner, to:wallet.address, value: tranche2});
        var estimatedShare1 = OneEther * 7/10; //1 * 20/100 + 2 * 20/80 = 0.7E
        assert.equal(await _WB(investor1), estimatedShare1, "Investor1 share should be 0.7E");
    })    

    it("unreserve holder, check its share", async function() {
        await token.setReserved(reserved, false);
        assert.equal(await _WB(reserved), 0, "Ex-reserved holder share should be 0");
        assert.equal(await token.getValuableTokenAmount.call(), await _RT(100), "Valuable tokens should equal to cap");
    })

    it("transfer more tokens to investor1", async function() {
        await token.transfer(investor1, await _RT(10), {from:owner});
        assert.equal(await _TB(owner), 0, "Owner should have no tokens");
    })

    it("wallet gets even more ether, check investor1 share", async function() {
        await web3.eth.sendTransaction({from:owner, to:wallet.address, value: tranche3});
        var estimatedShare = OneEther; // 1*20/100+2*20/80+1*30/100
        assert.equal(await _WB(investor1), estimatedShare, "Investor1 share should be 1E");
    })

    it("everybody withdraws, empty wallet", async function() {
        await wallet.withdrawAll({from:investor1});
        await wallet.withdrawAll({from:investor2});
        await wallet.withdrawAll({from:investor3});
        await wallet.withdrawAll({from:owner});
        await wallet.withdrawAll({from:reserved});

        var wBalance = await web3.eth.getBalance(wallet.address);
        assert.equal(wBalance.toNumber(), 0, "Wallet should be empty");
    })
})

/* Scenario
address is reserved
transfer tokens there
Wallet gets ether
transfer tokens from reserved to investor2
wallet gets ether
everybody withdraws
check wallet balance
*/
contract("DividendWallet. Empty wallet with reserved holders.", function(accounts) {
    var tokens1 = 20;
    var tokens2 = 50;
    var tokensToReserve = 20;
    
    var tranche1 = OneEther;
    var tranche2 = OneEther * 9 / 10;
    var tranche3 = OneEther;

    it("create and distribute tokens", async function() {
        await Prepare(accounts);
        await token.transfer(investor1, await _RT(tokens1));
        await token.transfer(investor2, await _RT(tokens2));        

        assert.equal(await token.getValuableTokenAmount.call(), await _RT(100), "Valuable tokens should equal to cap");
    })

    it("reserve holder and transfer there tokens", async function() {
        await token.setReserved(reserved, true);        
        await token.transfer(reserved, await _RT(tokensToReserve));
        assert.equal(await token.getValuableTokenAmount.call(), await _RT(80), "Valuable tokens should equal to 80");                        
    })    
    
    it("wallet gets ether. check Investor1 share", async function() {
        await web3.eth.sendTransaction({from:owner, to:wallet.address, value: tranche1});
        var estimatedShare = OneEther * 20 / 80;
        assert.equal(await _WB(investor1), estimatedShare, "Investor1 share should be 0.25E");
    })    

    it("transfer some tokens from reserved to investor2", async function() {
        await token.transfer(investor2, await _RT(10), {from:reserved});
        assert.equal(await token.getValuableTokenAmount.call(), await _RT(90), "Valuable tokens should equal to 80");
    })

    it("wallet gets more ether, check investors' shares", async function() {
        await web3.eth.sendTransaction({from:owner, to:wallet.address, value: tranche2});
        var share1 = OneEther * 45/100 //1 * 20/80 + 0.9*20/90 = 0.45
        var share2 = OneEther * 1225/1000 //1 * 50/80 + 0.9*60/90 = 1.225

        assert.equal(await _WB(investor1), share1, "Investor1 share should be 0.45E");
        assert.equal(await _WB(investor2), share2, "Investor2 share should be 1.225E");
    })

    it("try withdraw from reserved", async function(){
        try {
            await wallet.withdrawAll({from:reserved});
        } catch (e) {
            return true;
        }
        assert.isTrue(false, "Should never get here");
    })

    it("everybody withdraws, empty wallet", async function() {
        await wallet.withdrawAll({from:investor1});
        await wallet.withdrawAll({from:investor2});
        await wallet.withdrawAll({from:investor3});
        await wallet.withdrawAll({from:owner});       

        var wBalance = await web3.eth.getBalance(wallet.address);
        assert.equal(wBalance.toNumber(), 0, "Wallet should be empty");
    })
})
