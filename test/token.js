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
        await token.transfer(user1, await _RT(200));
        await token.transfer(user2, await _RT(300));

        assert.equal(await _TB(user1), await _RT(200), "user1 should have 200 tokens");
    })

});
