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
var OneBCS;
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
        await token.setLockedState(false);
        OneBCS = await _RT(token, 1);

        btoken = await BToken.new("BCB Token", "BCB", 18);
        fund = await Fund.new(token.address, btoken.address, BonusEtherRate, 1);
        
        await token.setValueAgent(fund.address);
        await token.setReturnAgent(fund.address);
        await btoken.setReturnAgent(fund.address);
        await fund.setReturnableToken(token.address);
        await fund.setReturnableToken(btoken.address);        
        await btoken.setMinter(fund.address, true);

        assert.isTrue(await fund.returnableTokens.call(btoken.address), "bonus token should be returnable to fund");
        assert.isTrue(await fund.returnableTokens.call(token.address), "BCS  token should be returnable to fund");
        assert.equal(await fund.bonusToken.call(), btoken.address, "Invalid fund's bonus token");
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

        await token.transfer(fund.address, OneBCS, {from:holder1});       
        assert.equal(await _TB(btoken, holder1), expectedTokens, "Holder1 should get 100 bonus token");
        assert.equal(await _TB(token, fund.address), OneBCS, "Fund should have 1 bcs token")
        assert.equal(await fund.bonusTokensToIssue.call(holder1), 0, "0 bonus tokens for holder1");
    })

    it("holder1 transfers 1 BCS token again. should get 0.", async function() {
                    
        await token.transfer(fund.address, OneBCS, {from:holder1});       
        assert.equal(await _TB(btoken, holder1), await _RT(btoken, 100), "Holder1 should have 100 bonus token still");
        assert.equal(await _TB(token, fund.address), await _RT(token, 2), "Fund should have 2 bcs token")
        assert.equal(await fund.bonusTokensToIssue.call(holder1), 0, "0 bonus tokens for holder1");
    })
    
    it("holder2 transfers 2 BCS tokens. One should be returned", async function() {
        await token.transfer(fund.address, OneBCS * 2, {from:holder2});       
        assert.equal(await _TB(btoken, holder2), tranche1 * BonusEtherRate / 5, "Holder1 should get 200 bonus token");
        assert.equal(await _TB(token, fund.address), OneBCS * 3, "Fund should have 3 bcs token")
        assert.equal(await _TB(token, holder2), await _RT(token, 199), "Holder2 should have 199 bcs token")
    })

    it("withdraw BCS tokens from fund", async function() {
        await fund.withdrawTokens(token.address, owner, OneBCS * 2, {from: owner});
        assert.equal(await _TB(token, owner), await _RT(token, 702), "Owner should have 702 bcs tokens");        
        assert.equal(await _TB(token, fund.address), OneBCS, "Fund should have 1 bcs token")
    })
    
    it("invalid withdraw BCS tokens from fund, invalid sender", async function() {
        try {
            await fund.withdrawTokens(token.address, owner, OneBCS, {from: holder1});
        } catch(e) {
            return true;
        }
        assert.isTrue(false, "withdraw should fail");
    })
})

contract("BonusTokenFund. Tranche - Get bonuses - Tranche - Sell bonuses - Tranche", function(accounts) {
    tranche1 = OneEther;
    tranche2 = OneEther;
    tranche3 = OneEther;    
    
    it("create and send tranche1", async function() {
        await Prepare(accounts);
        await fund.allowCompensationFor(holder1);
        await token.transfer(holder1, await _RT(token, TokenCap / 10));
        await web3.eth.sendTransaction({from:etherHolder, to: fund.address, value: tranche1});

        assert.equal(await web3.eth.getBalance(fund.address), tranche1, "Fund should have 1E");        
    })

    it("withdraw bonuses", async function () {
        assert.equal(await fund.bonusTokensToIssue.call(holder1), await _RT(btoken, 100), "100 bonus tokens for holder1");
        await token.transfer(fund.address, OneBCS, {from:holder1});

        assert.equal(await _TB(btoken, holder1), await _RT(btoken, 100), "Holder1 should get 100 BCB");
    })

    it("send tranche2 and change bonus tokens for ether", async function() {
        await web3.eth.sendTransaction({from:etherHolder, to: fund.address, value: tranche2});        
        assert.equal(await web3.eth.getBalance(fund.address), OneEther*2, "Fund should have 2E");        
    
        var oldBalance = await web3.eth.getBalance(holder1);
        await btoken.transfer(fund.address, await _RT(btoken, 100), {from:holder1});        
        var newBalance = await web3.eth.getBalance(holder1);
        assert.closeTo(newBalance.minus(oldBalance).toNumber(), Number(OneEther/10), Number(OneEther/100), "Holder1 should get 0.1E");

        assert.equal(await btoken.totalSupply.call(), 0, "There should be 0 bonus tokens");
    })

    it("send tranche3, check bonuses", async function() {
        await web3.eth.sendTransaction({from:etherHolder, to: fund.address, value: tranche3});
        assert.equal(await web3.eth.getBalance(fund.address), OneEther*2.9, "Fund should have 2.9E (0.1E spent in previous test)");
        
        // console.log("Token points " + (await fund.tokenPoints.call())/OneEther);
        // console.log("Last balance " + (await fund.lastBalance.call())/OneEther);
        // console.log("Last claimed points[holder] " + (await fund.lastClaimedPoints.call(holder1))/OneEther);
        // console.log("Bonus token points[holder] " + (await fund.bonusTokenPoints.call(holder1))/OneEther);      
        // console.log("totalTokenPoints() " + (await fund.totalTokenPoints.call())/OneEther);
        // console.log("tokensSinceLastUpdate(holder) " + (await fund.tokensSinceLastUpdate.call(holder1))/OneEther);

        assert.equal((await fund.bonusTokensToIssue.call(holder1)).toNumber(), await _RT(btoken, 198), "198 bonus tokens for holder1");
    })

    it("check the other holder bonus tokens to issue", async function() {
        assert.equal((await fund.bonusTokensToIssue.call(owner)).toNumber(), await _RT(btoken, 2700), "2700 bonus tokens for holder1");
    })
})

