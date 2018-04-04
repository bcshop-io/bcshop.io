//
//
// Tests changing one token to another
//
//

var Web3 = require("web3");
var web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));

var BCSToken = artifacts.require("BCSToken");
var BCSTokenCap = 1000;
var BCSTokenBurn = 100;
var BCSDecimals = 18;

var Token = artifacts.require("BCSPromoToken");
var token1, token2;

var TokenUpdater = artifacts.require("TokenUpdater");
var updater;

var owner, holder1, holder2, reserve;

//returns real tokens amount considering token decimals
async function _RT(_tokens) {
    return new Promise(async (resolve, reject) =>{
        return resolve((await token1.getRealTokenAmount.call(_tokens)).toNumber());
    })
}

//returns specifeid token's real balance
async function _TB(_token, _holder) {
    return new Promise(async (resolve, reject) =>{
        return resolve((await _token.balanceOf.call(_holder)).toNumber());
    })
}

function Prepare(accounts) {
    return new Promise(async (resolve, reject) => {
        
        owner = accounts[0];
        holder1 = accounts[1];
        holder2 = accounts[2];
        reserve = accounts[3];
        token1 = await Token.new("TOKEN1", "T1", 18);
        await token1.setMinter(owner, true);        
        await token1.mint(holder1, await _RT(20));
        await token1.mint(holder2, await _RT(10));
        await token1.mint(owner, await _RT(30));
        return resolve(true);
    })    
}

contract("TokenUpdater, BCSPRomo Token", function(accounts) {
    it("create", async function() {
        await Prepare(accounts);

        assert.equal(await _TB(token1, holder1), await _RT(20), "Holder1 should have 20 tokens");
    })

    it("transfer some tokens", async function() {
        await token1.transfer(holder2, await _RT(5), {from:owner});
        assert.equal(await _TB(token1, holder2), await _RT(15), "Holder2 should have 15 tokens");
    })

    it("lock transfer for everybody", async function() {        
        assert.isFalse(await token1.transferLocked.call(), "Transfer should be unlocked");
        await token1.setLockedState(true);
        assert.isTrue(await token1.transferLocked.call(), "Transfer should be locked");
    })    

    it("try to transfer something", async function() {
        try {
            await token1.transfer(holder2, await _RT(10), {from:owner});
        } catch (e) {
            return true;
        }

        assert.isTrue(false, "Should never get here");
    })

    it("create new token", async function() {
        token2 = await Token.new("TOKEN2", "T2", await token1.decimals.call());
        await token2.setMinter(owner, true);

        assert.equal(await token2.decimals.call(), 18, "New token decimals should be 18");        
        assert.equal(await token2.name.call(), "TOKEN2", "New token name should be 'TOKEN2'");        
    })

    it("create updater", async function() {
        updater = await TokenUpdater.new(token1.address, token2.address);
        assert.equal(await updater.oldToken.call(), token1.address, "Old token should be token1");
        assert.equal(await updater.newToken.call(), token2.address, "New token should be token2");
    })

    it("mint tokens for updater", async function() {
        await token2.mint(updater.address, await token1.totalSupply.call());
        assert.equal(await _TB(token2, updater.address), await _RT(60), "Updater should have 60 new tokens");
    })

    it("holder1 changes tokens", async function() {
        await updater.getUpdatedToken({from:holder1});
        assert.equal(await _TB(token2, holder1), await _RT(20), "Holder1 should get 20 new tokens");
    })

    it("holder1 tries to change tokens again", async function() {
        try {
            await updater.getUpdatedToken({from:holder1});
        } catch(e) {
            return true;
        }
        assert.isTrue(false, "Should never get here");        
    })

    it("mint new tokens for holder1 and change", async function() {
        await token1.mint(holder1, await _RT(6), {from:owner});
        await token2.mint(updater.address, await _RT(16));

        await updater.getUpdatedToken({from:holder1});
        assert.equal(await _TB(token2, holder1), await _RT(26), "Holder1 should have 26 new tokens");
    })
    
    it("holder2 changes tokens", async function() {
        await updater.getUpdatedToken({from:holder2});
        assert.equal(await _TB(token2, holder2), await _RT(15), "Holder2 should get 15 new tokens");
    })

    it("owner changes tokens", async function() {
        await updater.getUpdatedToken({from:owner});
        assert.equal(await _TB(token2, owner), await _RT(25), "Owner should get 25 new tokens");
    })

    it("withdraw unused new tokens from updater", async function() {
        await updater.withdrawTokens(token2.address, reserve, await _TB(token2, updater.address), {from:owner});
        assert.equal(await _TB(token2, reserve), await _RT(10), "10 tokens should be moved to reserve");
        assert.equal(await _TB(token2, updater.address), 0, "Should be 0 new tokens in updater");
    })
})



contract("TokenUpdater, BCSToken", function(accounts) {
    it("create", async function() {
        await Prepare(accounts);
        token1 = await BCSToken.new(BCSTokenCap, BCSDecimals);        
        assert.equal(await _TB(token1, owner), await _RT(BCSTokenCap), "Owner should have all BCS1 tokens");
    })

    it("transfer some tokens", async function() {        
        await token1.setLockedState(false);
        await token1.transfer(holder1, await _RT(200), {from:owner});
        await token1.transfer(holder2, await _RT(50), {from:owner});
        assert.equal(await _TB(token1, holder1), await _RT(200), "Holder1 should have 200 tokens");
        assert.equal(await _TB(token1, holder2), await _RT(50), "Holder2 should have 50 tokens");
        assert.equal(await _TB(token1, owner), await _RT(750), "Owner should have 750 tokens");
    })

    it("lock transfer for everybody", async function() {        
        assert.isFalse(await token1.transferLocked.call(), "Transfer should be unlocked");
        await token1.setLockedState(true);
        assert.isTrue(await token1.transferLocked.call(), "Transfer should be locked");
    })    

    it("try to transfer something", async function() {
        try {
            await token1.transfer(holder2, await _RT(10), {from:holder1});
        } catch (e) {
            return true;
        }

        assert.isTrue(false, "Should never get here");
    })

    it("create new token", async function() {
        var supplyToCreate = (await token1.totalSupply.call()).toNumber() / (10 ** BCSDecimals);
        assert.equal(await token1.totalSupply.call(), await _RT(supplyToCreate), "!");
        token2 = await BCSToken.new(supplyToCreate, BCSDecimals);                 
        assert.equal(await token2.decimals.call(), BCSDecimals, "New token decimals should be 18");        
    })

    it("create updater", async function() {
        updater = await TokenUpdater.new(token1.address, token2.address);
        assert.equal(await updater.oldToken.call(), token1.address, "Old token should be token1");
        assert.equal(await updater.newToken.call(), token2.address, "New token should be token2");
        await token2.allowTransferFor(updater.address, true);
    })

    it("transfer tokens to updater", async function() {
        await token2.transfer(updater.address, await token1.totalSupply.call());
        assert.equal(await _TB(token2, updater.address), await _RT(BCSTokenCap), "Updater should have all new tokens");
    })

    it("holder1 changes tokens", async function() {
        await updater.getUpdatedToken({from:holder1});
        assert.equal(await _TB(token2, holder1), await _RT(200), "Holder1 should get 200 new tokens");
    })

    it("holder1 tries to change tokens again", async function() {
        try {
            await updater.getUpdatedToken({from:holder1});
        } catch(e) {
            return true;
        }
        assert.isTrue(false, "Should never get here");        
    })
    
    it("holder2 changes tokens", async function() {
        await updater.getUpdatedToken({from:holder2});
        assert.equal(await _TB(token2, holder2), await _RT(50), "Holder2 should get 50 new tokens");
    })

    it("owner burns some of old tokens", async function() {
        await token1.burn(await _RT(BCSTokenBurn));
        assert.equal(await _TB(token1, owner), await _RT(750 - BCSTokenBurn), "Owner should get 650 new tokens");
    })

    it("owner changes tokens", async function() {
        await updater.getUpdatedToken({from:owner});
        assert.equal(await _TB(token2, owner), await _RT(650), "Owner should get 650 new tokens");
    })

    it("withdraw unused new tokens from updater", async function() {
        var amount = await _TB(token2, updater.address);
        assert.equal(amount, await _RT(BCSTokenBurn), "Excess should equal to 100 token (burnt by token1)");

        await updater.withdrawTokens(token2.address, owner, amount, {from:owner});
        assert.equal(await _TB(token2, owner), await _RT(750), "100 tokens should be moved to reserve");
        assert.equal(await _TB(token2, updater.address), 0, "Should be 0 new tokens in updater");
    })

    it("burn unused new tokens and check total supply equality", async function() {
        await token2.burn(await _RT(BCSTokenBurn));
        assert.equal(await _TB(token2, owner), await _RT(650), "Owner should have 650 tokens (BCS2) again");
        assert.equal((await token1.totalSupply.call()).toNumber(), (await token2.totalSupply.call()).toNumber(), "tokens total supplies should be equal now");
    })
})