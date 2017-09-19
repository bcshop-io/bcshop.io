//
//
//  Tests tge sale. Tests investment in Ether, Bonus tokens, PreTge tokens
//
//

var Web3 = require("web3");
var web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));
var utils = new (require("./timeutils.js"))(web3);

var PToken = artifacts.require("BCSPreTgeToken");
var ptoken;

var BToken = artifacts.require("BCSPromoToken");
var btoken;

var Token = artifacts.require("BCSToken");
var token;

var Crowdsale = artifacts.require("BCSTgeCrowdsale");
var sale;

var TokenPool = artifacts.require("TokenPool");
var pool;

var Restrictions = artifacts.require("FloorInvestRestrictions");
var restrictions;

var OneEther = web3.toWei(1, "ether");

var TokenCap = 3000;
var PTokenCap = 1001;

var TokensForOneEther = 100;

var owner;
var beneficiary;
var binvestor1;
var binvestor2;
var pinvestor1;
var pinvestor2;
var investor1;
var investor2;
var investor3;
var investor4;

//returns real tokens amount considering token decimals
async function _RT(_token, _tokens) {
    return new Promise(async (resolve, reject) =>{
        return resolve((await _token.getRealTokenAmount.call(_tokens)).toNumber());
    })
}

//returns given address specifeid token's real balance
async function _TB(_token, _holder) {
    return new Promise(async (resolve, reject) =>{
        return resolve((await _token.balanceOf.call(_holder)).toNumber());
    })
}

function Prepare(accounts) {
    return new Promise(async (resolve, reject) => {
        
        owner = accounts[0];
        beneficiary = accounts[1];
        binvestor1 = accounts[2];
        binvestor2 = accounts[3];
        pinvestor1 = accounts[4];
        pinvestor2 = accounts[5];
        investor1 = accounts[6];
        investor2 = accounts[7];
        investor3 = accounts[8];
        investor4 = accounts[9];

        return resolve(true);
    })
}

contract("BCSTgeSale, BCSToken, BCSPreTgeToken, BCSPromoToken", function(accounts) {
    it("prepare", async function() {
        await Prepare(accounts);
        return true;
    })

    it("init: distribute bonus tokens", async function() {
        btoken = await BToken.new("BCSBONUS TOKEN", "BB", 0);
        btoken.setMinter(owner, true);
        await btoken.mint(binvestor1, 1);
        await btoken.mint(binvestor2, 10);

        assert.equal(await _TB(btoken, binvestor1), 1, "binvestor1 should have 1 bonus token");
        assert.equal(await _TB(btoken, binvestor2), 10, "binvestor2 should have 10 bonus tokens");
    })

    it("init: distribute pre-tge tokens", async function() {
        ptoken = await PToken.new(PTokenCap, "BCSBONUS PRETGE TOKEN", "PT", 18);
        await ptoken.transfer(pinvestor1, await _RT(ptoken, 300));
        await ptoken.transfer(pinvestor2, await _RT(ptoken, 700));        
        
        assert.equal(await _TB(ptoken, pinvestor1), await _RT(ptoken, 300), "pinvestor1 should have 300 pretge tokens");
        assert.equal(await _TB(ptoken, pinvestor2), await _RT(ptoken, 700), "pinvestor1 should have 300 pretge tokens");      
    })

    it("init: create sale", async function() {
        token = await Token.new(TokenCap, 18);
        pool = await TokenPool.new(token.address);
        
        sale = await Crowdsale.new(pool.address, '0x0', beneficiary, 0, 4, 0, TokensForOneEther, 15, 4);        
        //setting return agents
        await sale.setReturnableToken(btoken.address);
        await sale.setReturnableToken(ptoken.address);

        await btoken.setReturnAgent(sale.address);
        await ptoken.setReturnAgent(sale.address);

        var tokensToTransfer = (await _RT(token, await btoken.totalSupply.call())) + 
                (await ptoken.totalSupply.call()).toNumber();

        await token.transfer(sale.address, tokensToTransfer);
        await token.transfer(pool.address, await _TB(token, owner));
        await pool.setTrustee(sale.address, true);

        assert.equal(await btoken.returnAgents.call(sale.address), true , "Crowdsale should be bonus token's return agent");        
    })

    it("lock token's transfer", async function() {
        await token.setLockedState(true);
        assert.isFalse(await token.canTransfer(pool.address), "Pool shouldn't be able to transfer tokens");        
        
        await token.allowTransferFor(pool.address, true);
        assert.isTrue(await token.canTransfer(pool.address), "Pool should be able to transfer tokens");

        await token.allowTransferFor(sale.address, true);
    })    

    it("buy with bonus tokens", async function() {
        
        var btokens1 = await _TB(btoken, binvestor1);
        await btoken.transfer(sale.address, btokens1, {from: binvestor1} );
        assert.equal(await _TB(token, binvestor1), await _RT(token, 1), "BInvestor1 should have 1 token");        

        var btokens2 = await _TB(btoken, binvestor2);
        await btoken.transfer(sale.address, btokens2, {from: binvestor2} );
        assert.equal(await _TB(token, binvestor2), await _RT(token, 10), "BInvestor2 should have 10 tokens");

        assert.equal(await _TB(btoken, sale.address), await _RT(btoken, 11), "Sale should have 11 bonus tokens");
    })

    it("buy with pretge tokens", async function() {
        var ptokens1 = await _TB(ptoken, pinvestor1);
        await ptoken.transfer(sale.address, ptokens1, {from: pinvestor1} );
        assert.equal(await _TB(token, pinvestor1), await _RT(token, 300), "PInvestor1 should have 300 token");        

        ptokens1 = await _TB(ptoken, pinvestor2);
        await ptoken.transfer(sale.address, ptokens1, {from: pinvestor2} );
        assert.equal(await _TB(token, pinvestor2), await _RT(token, 700), "PInvestor2 should have 700 token");        

        assert.equal(await _TB(ptoken, sale.address), await _RT(ptoken, 1000), "Sale should have 1000 pretge tokens");
    })

    it("buy with ether, bonus", async function() {
        var curBonus = (await sale.getCurrentBonusPct.call()).toNumber();
        
        assert.equal(curBonus, 15, "Current bonus should be 15%");
        assert.equal((await sale.tokensLeft.call()).toNumber(), await _RT(token, TokenCap-PTokenCap-11), "1988 tokens shoul be available for Ether sale");
        
        var investment1 = OneEther;
        await sale.invest({from: investor1, value: investment1});         
        assert.equal(await _TB(token, investor1), await _RT(token, 100 + 15), "Investor1 should get 115 tokens");

        var investment2 = OneEther * 10;
        await sale.invest({from: investor2, value: investment2});
        assert.equal(await _TB(token, investor2), await _RT(token, 1000 + 150), "Investor2 should get 1150 tokens");
    })

    it("lower bonus to next", async function() {
        await utils.timeTravelAndMine(3600 + 10);
        
        var curBonus = (await sale.getCurrentBonusPct.call()).toNumber();        
        assert.equal(curBonus, 10, "Current bonus should be 10%");
    })

    it("lower bonus to zero", async function() {
        await utils.timeTravelAndMine(3600 * 2 + 10);

        var curBonus = (await sale.getCurrentBonusPct.call()).toNumber();        
        assert.equal(curBonus, 0, "Current bonus should be 0%");
    })

    it("buy with ether, no bonus", async function() {
        var investment3 = OneEther * 7;
        await sale.invest({from: investor3, value: investment3});
        assert.equal(await _TB(token, investor3), await _RT(token, 700), "Investor3 should get 700 tokens");
    })

    it("try return tokens before the end of sale", async function() {
        try {
            await sale.returnUnclaimedTokens();
        } catch (e) {
            return true;
        }
        assert.isTrue(false, "Should never get here");
    })

    it("try claim ether before the end of sale", async function() {
        try {
            await sale.transferToBeneficiary();
        } catch (e) {
            return true;
        }
        assert.isTrue(false, "Should never get here");
    })

    it("advance time to the end", async function() {
        await utils.timeTravelAndMine(4 * 3600 + 10);
        assert.equal(await sale.getState.call(), 3, "Sale should be finished");
    })

    it("return tokens to owner", async function() {
        assert.equal(await _TB(token, sale.address), await _RT(token, 1), "Sale should have 1 token unclaimed");
        
        var oldBalance = await _TB(token, owner);
        await sale.returnUnclaimedTokens({from:owner});        
        var newBalance = await _TB(token, owner);
        
        assert.equal(newBalance - oldBalance, await _RT(token, 1), "1 unclaimed token should be returned to owner");
    })

    it("claim ether", async function() {
        var oldBalance = await web3.eth.getBalance(beneficiary);
        await sale.transferToBeneficiary();
        var newBalance = await web3.eth.getBalance(beneficiary);
        var saleBalance = await web3.eth.getBalance(sale.address);

        assert.equal(newBalance.toNumber() - oldBalance.toNumber(), 18 * OneEther, "Beneficiary should receive 18 ether");
        assert.equal(saleBalance.toNumber(), 0, "Sale should have nothing");
    })

    it("return tokens from main sale", async function() {
        var tokensLeft = await pool.getTokenAmount.call();        
        
        var oldBalance = await _TB(token, owner);
        await pool.returnTokensTo(owner);        
        var newBalance = await _TB(token, owner);

        var diff = newBalance - oldBalance;
        assert.equal(diff, await _RT(token, 23), "23 not bought tokens should be returned to owner");
    }) 
})
