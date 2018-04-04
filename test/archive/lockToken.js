//
//
// Tests different lock token transfer situations
//
//

var Web3 = require("web3");
var web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));
var utils = new (require("./timeutils.js"))(web3);

var Token = artifacts.require("BCSToken");
var token;
var owner, holder1, holder2;

function Prepare(accounts) {
    return new Promise(async (resolve, reject) => {
        
        owner = accounts[0];
        holder1 = accounts[1];
        holder2 = accounts[2];
        token = await Token.new(1000, 0);
        await token.setLockedState(false);
        await token.allowTransferFor(owner, false);
        return resolve(true);
    })
}

//returns given address specifeid token's real balance
async function _TB(_holder) {
    return new Promise(async (resolve, reject) =>{
        return resolve((await token.balanceOf.call(_holder)).toNumber());
    })
}

contract("Lock/Unlock global transfer.", function(accounts) {
    it("can transfer tokens initially", async function() {
        await Prepare(accounts);

        await token.transfer(holder1, 200);
        await token.transfer(holder2, 300);

        assert.equal(await _TB(holder1), 200, "Holder1 should have 200 tokens");
        assert.equal(await _TB(owner), 500, "Owner should have 200 tokens");
    })

    it("lock transfer", async function() {
        await token.setLockedState(true);
        assert.isTrue(await token.transferLocked.call(), "Transfer should be locked now");
    })

    it("try to transfer", async function() {
        try {
            await token.transfer(holder1, 200);
        } catch(e) {
            return true;
        }
        assert.isTrue(false, "Transfer should fail");
    })

    it("set allowed holders", async function() {
        await token.allowTransferFor(holder2, true);
        assert.isTrue(await token.transferAllowed.call(holder2), "Holder2 should be able to transfer");
        assert.isFalse(await token.transferAllowed.call(owner), "Owner shouldn't be able to transfer");
    })

    it("transfer tokens from allowed holder", async function() {
        await token.transfer(holder1, 50, {from: holder2});
        assert.equal(await _TB(holder1), 250, "Holder1 should now have 250 tokens");
    })

    it("try to transfer from unallowed holder", async function() {
        try {
            await token.transfer(holder1, 200);
        } catch(e) {
            return true;
        }
        assert.isTrue(false, "Transfer should fail");
    })

    it("unlock transfer", async function() {
        await token.setLockedState(false);
        assert.isFalse(await token.transferLocked.call(), "Transfer shouldn't be locked now");

        await token.allowTransferFor(holder2, false);
        assert.isFalse(await token.transferAllowed.call(holder2), "Holder2 shouldn't be able to transfer");
    })
    
    it("transfer tokens from previously unallowed holder", async function() {
        await token.transfer(holder1, 150, {from: owner});
        assert.equal(await _TB(holder1), 400, "Holder1 should now have 400 tokens");
    })

    it("lock transfer for holder1 till specific date", async function() {
        await token.lockTransferFor(holder1, 2);
        var nowTime = utils.currentTime();
        assert.equal(await token.transferLockUntil.call(holder1), nowTime + 2 * 86400, "Should be 2 days from now till transfer unlock");
        assert.isFalse(await token.canTransfer.call(holder1), "Holder1 shouldn't be able to transfer");
        assert.isTrue(await token.canTransfer.call(holder2), "Holder2 should be able to transfer");
    })

    it("try to transfer from locked holder", async function() {
        try {
            await token.transfer(holder2, 100, {from: holder1});
        } catch(e) {
            return true;
        }
        assert.isTrue(false, "Transfer should fail");
    })

    it("advance time for less than lock period", async function(){
        await utils.timeTravelAndMine(100);
        assert.isFalse(await token.canTransfer.call(holder1), "Holder1 still shouldn't be able to transfer");
    })

    it("again try to transfer from locked holder", async function() {
        try {
            await token.transfer(holder2, 100, {from: holder1});
        } catch(e) {
            return true;
        }
        assert.isTrue(false, "Transfer should fail");
    })

    it("advance time for lock period", async function(){
        await utils.timeTravelAndMine(2 * 86400);
        assert.isTrue(await token.canTransfer.call(holder1), "Holder1 should be able to transfer");
    })

    it("transfer tokens from previously locked holder", async function() {
        await token.transfer(holder2, 100, {from: holder1});
        assert.equal(await _TB(holder1), 300, "Holder1 should now have 300 tokens");
        assert.equal(await _TB(holder2), 350, "Holder2 should now have 350 tokens");
    })

    it("transfer tokens from other holder", async function() {
        await token.transfer(holder2, 200, {from: owner});
        assert.equal(await _TB(owner), 150, "Owner should now have 150 tokens");
        assert.equal(await _TB(holder2), 550, "Holder2 should now have 550 tokens");
    })
})