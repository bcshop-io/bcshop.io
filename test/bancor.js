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

    it("create token and proxy", async function() {
        token = await Token.new(TokenCap, Decimals);
        proxy = await Proxy.new(token.address);
        formula = await Formula.new();
        etherToken = await EtherToken.new();            
        changer = await BancorChanger.new(proxy.address, formula.address, maxChangeFee, etherToken.address, crr);
    })
})