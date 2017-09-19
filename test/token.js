var Token = artifacts.require("BCSToken");
var token;

var TokenCap = 1000;
var owner, user1, user2;

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

contract("BCSToken", function(accounts) {
        
    it("create token", async function() {
        owner = accounts[0];
        user1 = accounts[1];
        user2 = accounts[2];

        token = await Token.new(TokenCap, 18);
        assert.equal(await _TB(owner), await _RT(1000), "Owner shoudl have all the tokens");
    })

    it("transfer tokens", async function() {
        var tresult1 =await token.transfer(user1, await _RT(200));        
        var tresult2 =await token.transfer(user2, await _RT(300));

        assert.equal(await _TB(user1), await _RT(200), "user1 should have 200 tokens");
        assert.equal(tresult1.logs[0].event, "Transfer", "Should fire Transfer event");
    })

    it("transfer 0 tokens", async function() {
        await token.transfer(user2, 0);
        assert.equal(await _TB(user2), await _RT(300), "user2 should have 300 tokens");
    })

    it("transfer too much tokens", async function() {
        try {
            await token.transfer(user1, await _RT(TokenCap));            
        } catch(e) {
            return true;
        }
        assert.isTrue("Transfer should fail");
    })

    it("approve transfer", async function() {
        var tresult1 = await token.approve(user1, await _RT(50), {from:user2});
        assert.equal(await token.allowance.call(user2, user1), await _RT(50), "Allowance should be 50");
        assert.equal(tresult1.logs[0].event, "Approval", "Should fire Approval event");
    })

    it("transfer from", async function() {
        await token.transferFrom(user2, owner, await _RT(10), {from:user1});
        assert.equal(await _TB(owner), await _RT(510), "Owner should get 10 tokens");        
        assert.equal(await token.allowance.call(user2, user1), await _RT(40), "Allowance should be 40");
    })

    it("try transfer from too much, should fail", async function() {
        try {
            await token.transferFrom(user2, owner, await _RT(45), {from:user1});
        } catch(e) {
            return true;
        }
        assert.isTrue(false, "TransferFrom should fail");
    })
})

contract("BCSToken. try to call internal methods", function(accounts) {
    var ErrorTokenInternalTransfer = artifacts.require("ErrorTokenInternalTransfer");
    var villain;

    it("create token", async function() {
        owner = accounts[0];
        user1 = accounts[1];
        user2 = accounts[2];

        token = await Token.new(TokenCap, 18);
        assert.equal(await _TB(owner), await _RT(1000), "Owner shoudl have all the tokens");
        villain = await ErrorTokenInternalTransfer.new();
    })

    it("transfer tokens", async function() {
        var tresult1 = await token.transfer(user1, await _RT(200));        
        var tresult2 = await token.transfer(user2, await _RT(300));
        await token.transfer(villain.address, await _RT(100));
        
        assert.equal(await _TB(user1), await _RT(200), "user1 should have 200 tokens");
        assert.equal(tresult1.logs[0].event, "Transfer", "Should fire Transfer event");
    })

    it("make legal transfer", async function() {
        await villain.makeLegalTransfer(token.address, user1, await _RT(50));
        assert.equal(await _TB(user1), await _RT(250), "Legal transfer should be OK");
    })

    it("make illegal transfer from. should fail", async function() {
        try {
            await villain.makeErrorTransfer(token.address, user1, 0);
        } catch(e) {
            return true;
        }
        assert.isTrue(false, "Illegal transfer should fail");
    })
})
