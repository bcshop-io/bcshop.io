var Web3 = require("web3");
var web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));

var Fund = artifacts.require("EtherFund");
var Token = artifacts.require("BCSToken");
var BToken = artifacts.require("BCSBonusToken");
var Store = artifacts.require("BonusStore");
var Generator = artifacts.require("BonusTokenGenerator");
var OneBCS;
var OneEther = 1000000000000000000;
var TokenCap = 1000;
var BonusEtherRate = 1000;
var BonusTokenPrice = 1;
var shareGen = 800;
var shareOwner = 200;
var gasPrice = 20000000000;

//returns real tokens amount considering token decimals
async function _RT(_token, _tokens) {
    return new Promise(async (resolve, reject) =>{
        return resolve((await _token.getRealTokenAmount.call(_tokens)).toNumber());
    })
}

//returns specifeid token's real balance
async function _TB(_token, _holder) {
    return new Promise(async (resolve, reject) =>{
        return resolve((await _token.balanceOf.call(_holder)).toNumber());
    })
}

function ShareGen(ether) {
    return (ether * shareGen) / 1000;
}

function BonusTokensFor(etherPortion, tokenAmount) {
    return (ShareGen(etherPortion) * tokenAmount / TokenCap) * BonusEtherRate;
}

contract("BonusTokenGenerator", function(accounts) {    
    var owner = accounts[0];
    var user1 = accounts[1];
    var user2 = accounts[2];
    var user3 = accounts[3];
    var user4 = accounts[4];
    var spender = accounts[5];
    var fund;
    var token;
    var btoken;    
    var store;
    var gen;
    var tokens1 = 100;
    var tokens2 = 200;
    var tokens3 = 300;    
    var issue1, issue2, issue3;    

    it("create tokens, and transfer them", async function() {
        token = await Token.new(TokenCap, 18);
        await token.setLockedState(false);
        OneBCS = await _RT(token, 1);

        btoken = await BToken.new("BCB Token", "BCB", 18);        

        await token.transfer(user1, await _RT(token, tokens1));
        await token.transfer(user2, await _RT(token, tokens2));
        await token.transfer(user3, await _RT(token, tokens3));        
    })

    
    it("create generator and store, setup tokens", async function() {
        gen = await Generator.new(token.address, btoken.address, BonusEtherRate, BonusTokenPrice);
        store = await Store.new(gen.address);
        fund = await Fund.new(gen.address, shareGen, owner, shareOwner);
        
        await gen.setEtherSpender(spender, true);

        await gen.setFund(fund.address);
        await gen.setEtherSpender(store.address, true);
        await btoken.setMinter(gen.address, true);
        await token.setValueAgent(gen.address);
        await token.setReturnAgent(gen.address);
        await gen.setReturnableToken(token.address);
    })        
    
    it("transfer 1 ether to fund", async function() {
        await web3.eth.sendTransaction({from:owner, to: fund.address, value: OneEther});
        var bcb1 = await gen.bonusTokensToIssue.call(user1);
        
        assert.equal(await fund.etherBalanceOf.call(gen.address), ShareGen(OneEther), "Invalid fund balance for generator");
        var estimate1 = BonusTokensFor(OneEther, tokens1);
        assert.equal(bcb1.toNumber(), estimate1, "Invalid bonus tokens for user1");
    })
    it("get bonus tokens for 1 BCS as user1", async function() {
        assert.equal(await _TB(btoken, user1), 0, "User1 should have 0 BCB");
        await token.transfer(gen.address, OneBCS, {from: user1});        
        assert.equal(await _TB(btoken, user1), BonusTokensFor(OneEther, tokens1), "User1 should get 100 BCB");
        assert.equal(await gen.bonusTokensToIssue.call(user1), 0, "User1 shouldn't get bonus tokens now");
        tokens1--;
    })
    it("transfer another 1 ether to fund", async function() {
        await web3.eth.sendTransaction({from:owner, to: fund.address, value: OneEther});
        assert.equal((await gen.bonusTokensToIssue.call(user1)).toNumber(), 
                    BonusTokensFor(OneEther, tokens1), 
                    "Invalid bonus tokens for user1");
    })

    it("set active to false as not owner, should fail", async function() {
        try {
            await gen.setActive(false, {from: user2});
        } catch(e) {
            return true;
        }
        throw "Should fail";
    })

    it("set active to false", async function() {
        await gen.setActive(false);
        assert.isFalse(await gen.isActive.call(), "Should be inactive");
    })

    it("try to change BCS tokens, should fail", async function() {
        try {
            await token.transfer(gen.address, OneBCS, {from: user3});
        } catch(e) {
            return true;
        }
        throw "Should fail";
    })

    it("set active to true again", async function() {
        await gen.setActive(true);
        assert.isTrue(await gen.isActive.call(), "Should be active");
    })

    it("get bonus tokens for 1 BCS as user2", async function() {
        assert.equal(await _TB(btoken, user2), 0, "User2 should have 0 BCB");
        await token.transfer(gen.address, OneBCS, {from: user2});
        assert.equal(await _TB(btoken, user2), BonusTokensFor(2*OneEther, tokens2), "User2 should get 0.4 BCB");
        tokens2--;
    })

    it("try to send 2 BCS as user3, one should be returned", async function() {
        await token.transfer(gen.address, 2 * OneBCS, {from: user3});
        assert.equal(await _TB(btoken, user3), BonusTokensFor(2*OneEther, tokens3), "User3 should get 0.6 BCB");
        assert.equal(await _TB(token, user3), await _RT(token, tokens3-1), "User3 should have transferred only 1 BCS");
        tokens3--;
    })


    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // manipulating with tokens
    // it("check bonus tokens for generator", async function() {
    //     assert.equal((await gen.bonusTokensToIssue.call(gen.address)).toNumber(), BonusTokensFor(OneEther, 1), "");
    // })

    // it("try to transfer from gen to gen", async function() {
    //     //await gen.withdrawTokens(token.address, gen.address, OneBCS, {from:owner});
    //     await token.transfer(owner, OneBCS);
    // })
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    it("withdraw BCS tokens as not an owner, should fail", async function() {
        try {
            await gen.withdrawTokens(token.address, owner, OneBCS * 3, {from: user1});
        } catch(e) {
            return true;
        }
        throw "withdraw should fail";
    })

    it("withdraw BCS tokens from generator", async function() {
        await gen.withdrawTokens(token.address, owner, OneBCS * 3, {from: owner});
        assert.equal(await _TB(token, owner), await _RT(token, 403), "Owner should have 403 bcs tokens");        
        assert.equal(await _TB(token, gen.address), 0, "Fund should have 0 bcs token");
    })    

    it("try to change BCS tokens, when no BCB available should fail", async function() {
        issue1 = (await gen.bonusTokensToIssue.call(user1)).toNumber();
        issue2 = (await gen.bonusTokensToIssue.call(user2)).toNumber();
        issue3 = (await gen.bonusTokensToIssue.call(user3)).toNumber();

        assert.equal(issue3, 0, "User3 shouldn't get BCB");
        try {
            await token.transfer(gen.address, OneBCS, {from: user3});
        } catch(e) {
            return true;
        }
        throw "Should fail";
    })    

    it("try to request ether as not allowed spender, should fail", async function(){
        try {
            await gen.requestEther(OneEther);
        }catch(e) {
            return true;
        }
        throw "Should fail";
    })
    it("try to request too much ether, should fail", async function(){
        try {
            await gen.requestEther(3*OneEther, {from:spender});
        }catch(e) {
            return true;
        }
        throw "Should fail";
    })
    it("forbid spending and try request ether, should fail", async function(){
        await gen.setEtherSpender(spender, false);
        assert.isFalse(await gen.allowedEtherSpenders.call(spender), "spender should be forbidden");
        try {
            await gen.requestEther(3*OneEther, {from:spender});
        }catch(e) {
            return true;
        }
        throw "Should fail";
    })
    it("allow spending again and request 1ETH as spender", async function() {
        await gen.setEtherSpender(spender, true);
        assert.isTrue(await gen.allowedEtherSpenders.call(spender), "spender should be allowed");

        assert.equal(await fund.etherBalanceOf.call(gen.address), ShareGen(2*OneEther), "We should be able to get 2ETH for store");       

        var oldBalance = await web3.eth.getBalance(spender);        
        var txr = await gen.requestEther(OneEther, {from:spender});             
        var newBalance = await web3.eth.getBalance(spender);
        var gasUsedCost = txr.receipt.gasUsed*gasPrice;        
        assert.equal(newBalance.minus(oldBalance).toNumber() + gasUsedCost, OneEther, "Spender should receive 1ETH");

        assert.equal((await fund.etherBalanceOf.call(gen.address)).toNumber(), ShareGen(2*OneEther)-OneEther, "1 ETH should be left in fund");
    })        
    it("amount of bonus tokens for holders shoudn't be affected", async function() {
        assert.equal((await gen.bonusTokensToIssue.call(user1)).toNumber(), issue1, "Invalid tokens for User1");
        assert.equal((await gen.bonusTokensToIssue.call(user2)).toNumber(), issue2, "Invalid tokens for User2");
        assert.equal((await gen.bonusTokensToIssue.call(user3)).toNumber(), issue3, "Invalid tokens for User3");
    })
    
    it("send 1 ETH to fund, new bonus tokens should be issued", async function() {
        await web3.eth.sendTransaction({from:owner, to: fund.address, value: OneEther});
        assert.equal((await gen.bonusTokensToIssue.call(user1)).toNumber(), 
                issue1 += BonusTokensFor(OneEther, tokens1), 
                "Invalid tokens for User1");
        assert.equal((await gen.bonusTokensToIssue.call(user2)).toNumber(), 
                issue2 += BonusTokensFor(OneEther, tokens2), 
                "Invalid tokens for User2");
        assert.equal((await gen.bonusTokensToIssue.call(user3)).toNumber(), 
                issue3 += BonusTokensFor(OneEther, tokens3), 
                "Invalid tokens for User3");
    })

    it("transfer some tokens from user2 to user3, bonus tokens shouldn't be affected", async function() {
        var amount = 20;
        await token.transfer(user3, await _RT(token, amount), {from:user2});
        assert.equal(await _TB(token, user3), await _RT(token, tokens3+amount), "User3 haven't got his tokens");
        
        tokens2 -= amount;
        tokens3 += amount;

        assert.equal((await gen.bonusTokensToIssue.call(user1)).toNumber(), issue1, "Invalid tokens for User1");
        assert.equal((await gen.bonusTokensToIssue.call(user2)).toNumber(), issue2, "Invalid tokens for User2");
        assert.equal((await gen.bonusTokensToIssue.call(user3)).toNumber(), issue3, "Invalid tokens for User3");
    })

    it("send 1 ETH to fund, transferred tokens should be taken into account now", async function() {
        await web3.eth.sendTransaction({from:owner, to: fund.address, value: OneEther});
        
        issue1 += BonusTokensFor(OneEther, tokens1);
        assert.equal((await gen.bonusTokensToIssue.call(user2)).toNumber(), issue2 += BonusTokensFor(OneEther, tokens2), "Invalid tokens for User2");
        assert.equal((await gen.bonusTokensToIssue.call(user3)).toNumber(), issue3 += BonusTokensFor(OneEther, tokens3), "Invalid tokens for User3");
    })

    it("owner withdraws all its share from fund, bonus tokens shouldn't be affected", async function() {
        var amount = await fund.etherBalanceOf(owner);
        assert.equal(amount, 4 * OneEther * shareOwner / 1000, "Invalid owner's share");

        var oldBalance = await web3.eth.getBalance(owner);        
        var txr = await fund.withdraw(amount, {from: owner});
        var newBalance = await web3.eth.getBalance(owner);
        var gasUsedCost = txr.receipt.gasUsed*gasPrice;      
        
        assert.equal(await fund.etherBalanceOf(owner), 0, "Invalid owner's share left");
        assert.equal(newBalance.minus(oldBalance).toNumber() + gasUsedCost, amount, "Spender should receive the requested amount");

        assert.equal((await gen.bonusTokensToIssue.call(user1)).toNumber(), issue1, "Invalid tokens for User1");
        assert.equal((await gen.bonusTokensToIssue.call(user2)).toNumber(), issue2, "Invalid tokens for User2");
        assert.equal((await gen.bonusTokensToIssue.call(user3)).toNumber(), issue3, "Invalid tokens for User3");
    })

    it("spender requests all posiible ether from fund, bonus tokens shouldn't be changed", async function() {
        var amount = await fund.etherBalanceOf(gen.address);
        assert.equal(amount.toNumber(), ShareGen(4 * OneEther) - OneEther, "Invalid generator's share");

        var oldBalance = await web3.eth.getBalance(spender);
        var txr = await gen.requestEther(amount, {from: spender});
        var newBalance = await web3.eth.getBalance(spender);
        var gasUsedCost = txr.receipt.gasUsed*gasPrice;      
        
        assert.equal(await web3.eth.getBalance(fund.address), 0, "Fund should contain 0 ETH");
        assert.equal(await fund.etherBalanceOf(spender), 0, "Invalid owner's share left");
        assert.equal(newBalance.minus(oldBalance).toNumber() + gasUsedCost, amount, "Spender should receive the requested amount");

        assert.equal((await gen.bonusTokensToIssue.call(user1)).toNumber(), issue1, "Invalid tokens for User1");
        assert.equal((await gen.bonusTokensToIssue.call(user2)).toNumber(), issue2, "Invalid tokens for User2");
        assert.equal((await gen.bonusTokensToIssue.call(user3)).toNumber(), issue3, "Invalid tokens for User3");
    })

    it("user2 exchanges his 1 BCS to BCB", async function() {
        var oldBtokens = await _TB(btoken, user2);
        await token.transfer(gen.address, OneBCS, {from: user2});
        var newBtokens = await _TB(btoken, user2);

        assert.equal(await gen.bonusTokensToIssue.call(user2),0 , "user2 now has no bonus tokens to issue");
        assert.equal(newBtokens-oldBtokens, issue2, "Invalid btokens issued to user2");
        issue2 = 0;
    })       

    it("set reserved as not owner, should fail", async function() {
        try {
            await token.setReserved(gen.address, true, {from:user2});
        } catch (e) {
            return true;
        }
        throw "Should fail";
    })

    it("bonus tokens for generator itself should be > 0", async function() {
        assert.isAbove((await gen.bonusTokensToIssue.call(gen.address)).toNumber(), 0);
    })

    it("set reserved address for BCS token", async function() {
        assert.equal(await token.getValuableTokenAmount.call(), await _RT(token, TokenCap), "Initial valuable amount should be equal to token cap");
        await token.setReserved(gen.address, true);
    })

    it("transfer 1 Ether to the generator, no tokens should be issued for generator itself", async function() {
        
    })
    
})

// contract("measures gas", function(accounts) {
//     it("run", async function() {
//         var owner = accounts[0];
//         var user1 = accounts[1];
//         var user2 = accounts[2];
//         var user3 = accounts[3];
//         var user4 = accounts[4];
//         var spender = accounts[5];
//         var fund;
//         var token;
//         var btoken;    
//         var store;
//         var gen;
//         var tokens1 = 100;
//         var tokens2 = 200;
//         var tokens3 = 300;    

//         token = await Token.new(TokenCap, 18);
//         await token.setLockedState(false);        
//         OneBCS = await _RT(token, 1);
//         btoken = await BToken.new("BCB Token", "BCB", 18);        
//         await token.transfer(user1, await _RT(token, tokens1));
//         await token.transfer(user2, await _RT(token, tokens2));
//         await token.transfer(user3, await _RT(token, tokens3));

//         gen = await Generator.new(token.address, btoken.address, BonusEtherRate, BonusTokenPrice);
//         console.log("Generator: " + web3.eth.getTransactionReceipt(gen.transactionHash).gasUsed);

//         store = await Store.new(gen.address);
//         console.log("Store: " + web3.eth.getTransactionReceipt(store.transactionHash).gasUsed);

//         fund = await Fund.new(gen.address, shareGen, owner, shareOwner);
        
//         await gen.setEtherSpender(spender, true);

//         await gen.setFund(fund.address);
//         await gen.setEtherSpender(store.address, true);
//         await btoken.setMinter(gen.address, true);
//         await token.setValueAgent(gen.address);
//         await token.setReturnAgent(gen.address);
//         await gen.setReturnableToken(token.address);

//         var txrhash = web3.eth.sendTransaction({from:owner, to:fund.address, value:OneEther});
//         var txr = web3.eth.getTransactionReceipt(txrhash);
//         console.log("Send ether to fund: ", txr.gasUsed);

//         txr = await token.transfer(gen.address, OneBCS, {from:user1});
//         console.log("Exchange 1 BCS for BCB: ", txr.receipt.gasUsed);

//         txr = await token.transfer(user2, OneBCS, {from:user1});
//         console.log("BCS transfer 1->2: ", txr.receipt.gasUsed);

//         txr = await token.transfer(user2, OneBCS, {from:user1});
//         console.log("BCS transfer 1->2: ", txr.receipt.gasUsed);
        
//         txr = await token.transfer(user3, OneBCS, {from:user1});
//         console.log("BCS transfer 1->3: ", txr.receipt.gasUsed);

//         txr = await token.transfer(user3, OneBCS, {from:user2});
//         console.log("BCS transfer 2->3: ", txr.receipt.gasUsed);
//     })
// })