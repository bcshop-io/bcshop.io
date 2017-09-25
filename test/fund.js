var Web3 = require("web3");
var web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));

var Fund = artifacts.require("BonusTokenFund");
var fund;
var Token = artifacts.require("BCSToken");
var token;
var BToken = artifacts.require("BCSBonusToken");
var btoken;

var TokenCap = 1000;
var BonusEtherRate = 1000;
var owner, holder1, holder2, holder3, etherHolder;
var OneEther = web3.toWei(1, "ether");
var tranche1 = OneEther;
var tranche2 = OneEther;
var tranche2 = OneEther;

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

function Prepare(accounts) {
    return new Promise(async (resolve, reject) => {
        owner = accounts[0];
        holder1 = accounts[1];
        holder2 = accounts[2];
        holder3 = accounts[3];
        etherHolder = accounts[4];

        token = await Token.new(TokenCap, 18);
        btoken = await BToken.new("BCB Token", "BCB", 18);
        fund = await Fund.new(token.address, btoken.address, BonusEtherRate, 1);
        
        await token.setValueAgent(fund.address);
        await token.setReturnAgent(fund.address);
        await btoken.setReturnAgent(fund.address);
        await fund.setReturnableToken(token.address);
        await fund.setReturnableToken(btoken.address);        
        await btoken.setMinter(fund.address, true);

        return resolve(true);
    })
}

contract("BonusTokenFund. BCS-BCB exchange.", function(accounts) {
    it("create", async function() {
        await Prepare(accounts);

        await token.transfer(holder1, await _RT(token, 100));
        await token.transfer(holder2, await _RT(token, 200));
        
        await web3.eth.sendTransaction({from:etherHolder, to: fund.address, value: tranche1});

        assert.equal(await fund.valueToken.call(), token.address, "Invalid real token");
        assert.equal(await fund.bonusToken.call(), btoken.address, "Invalid bonus token");
    })    

    it("holder1 transfers 1 BCS token.", async function() {

        var expectedTokens = await _RT(btoken, 100); //tranche1 * BonusEtherRate / 10;
        assert.equal(await fund.bonusTokensToIssue.call(holder1), expectedTokens, "100 bonus tokens for holder1");

        await token.transfer(fund.address, await _RT(token, 1), {from:holder1});       
        assert.equal(await _TB(btoken, holder1), expectedTokens, "Holder1 should get 100 bonus token");
        assert.equal(await _TB(token, fund.address), await _RT(token, 1), "Fund should have 1 bcs token")
        assert.equal(await fund.bonusTokensToIssue.call(holder1), 0, "0 bonus tokens for holder1");
    })

    it("holder1 transfers 1 BCS token again. should get 0.", async function() {
                    
        await token.transfer(fund.address, await _RT(token, 1), {from:holder1});       
        assert.equal(await _TB(btoken, holder1), await _RT(btoken, 100), "Holder1 should have 100 bonus token still");
        assert.equal(await _TB(token, fund.address), await _RT(token, 2), "Fund should have 2 bcs token")
        assert.equal(await fund.bonusTokensToIssue.call(holder1), 0, "0 bonus tokens for holder1");
    })
    
    it("holder2 transfers 2 BCS tokens. One should be returned", async function() {
        await token.transfer(fund.address, await _RT(token, 2), {from:holder2});       
        assert.equal(await _TB(btoken, holder2), tranche1 * BonusEtherRate / 5, "Holder1 should get 200 bonus token");
        assert.equal(await _TB(token, fund.address), await _RT(token, 3), "Fund should have 3 bcs token")
        assert.equal(await _TB(token, holder2), await _RT(token, 199), "Holder2 should have 199 bcs token")
    })

    it("withdraw BCS tokens from fund", async function() {
        await fund.withdrawTokens(token.address, owner, await _RT(token, 2), {from: owner});
        assert.equal(await _TB(token, owner), await _RT(token, 402), "Owner should have 402 bcs tokens");        
    })
    
    it("invalid withdraw BCS tokens from fund, invalid sender", async function() {
        try {
            await fund.withdrawTokens(token.address, owner, await _RT(token, 2), {from: holder1});
        } catch(e) {
            return true;
        }
        assert.isTrue(false, "withdraw should fail");
    })
})

contract("BonusTokenFund. Tranche - Get bonuses - Tranche - Sell bonuses - Tranche", function(accounts) {
    tranche1 = OneEther;
    tranche2 = OneEther;
    tranche2 = OneEther;
    
    it("create and send tranche1", async function() {
        await Prepare(accounts);
        await token.transfer(holder1, await _RT(token, TokenCap));        
        await web3.eth.sendTransaction({from:etherHolder, to: fund.address, value: tranche1});

        assert.equal(await web3.eth.getBalance(fund.address), tranche1, "Fund should have 1E");        
    })

    //it("withdraw bonuses", async function () {
    //    assert.equal(await )
    //})
})
