//
// Tests bancor interaction
//

var Web3 = require("web3");
var web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));

var BancorChanger = artifacts.require("BancorChanger");
var Proxy = artifacts.require("SmartTokenProxy");
var Token = artifacts.require("BCSToken");
var Formula = artifacts.require("BancorFormula");
var EtherToken = artifacts.require("EtherToken");
var ERCToken = artifacts.require("ERC20Token");
var Holder = artifacts.require("TokenHolder1");

var TokenCap = 1000;
var Decimals = 18;

var OneEther = web3.toWei(1, "ether");

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

contract("SmartTokenProxy", function(accounts) {
    
    var token;
    var proxy;
    var changer;
    var formula;
    var etherToken;
    var maxChangeFee = 0;
    var crr = 10;

    var owner = accounts[0];
    var user1 = accounts[1];

    it("Create token and proxy. Changer's token address should be proxy", async function() {
        token = await Token.new(TokenCap, Decimals);
        await token.setLockedState(false);
        await token.transfer(user1, await _RT(token, 200));
        assert.equal(await _TB(token, owner), await _RT(token, 800), "Owner should have 800 BCS");
        assert.equal(await _TB(token, user1), await _RT(token, 200), "User should have 200 BCS");

        proxy = await Proxy.new(token.address);        
        formula = await Formula.new();
        etherToken = await EtherToken.new();            
        changer = await BancorChanger.new(proxy.address, formula.address, maxChangeFee, etherToken.address, crr);

        await proxy.transferOwnership(changer.address);
        await changer.acceptTokenOwnership();

        assert.equal(await proxy.owner.call(), changer.address, "Proxy owner should be changer");
        assert.equal(await changer.token.call(), proxy.address, "Invalid changer's token address");
    })

    it("check sale", async function() {
        var sellReturn = await changer.getSaleReturn.call(etherToken.address, await _RT(token, 1));
        console.log(sellReturn);
    })
})