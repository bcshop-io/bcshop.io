//
//
// Tests changing one token to another
//
//

var Web3 = require("web3");
var web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));

var Token = artifacts.require("BCSBonusToken");
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

contract("TokenUpdater", function(accounts) {
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