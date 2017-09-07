//
//
// Tests dividend wallet based on token with floating supply
//
//

var Web3 = require("web3");
var web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));
var utils = new (require("./timeutils.js"))(web3);

var DividendWallet = artifacts.require("DividendWalletFl");
var wallet;

var Token = artifacts.require("BCSToken");
var token;

var TokenCap = 100;

var owner;
var beneficiary;
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

        token = await Token.new(TokenCap, 18);    
        wallet = await Wallet.new(token.address);
        await token.setValueAgent(wallet.address);

        return resolve(true);
    })
}

contract("DividendWallet, common tests.", function(accounts) {
    it("create and distribute token", async function() {
        await Prepare(accounts);
        await token.transfer(investor1, await _RT(token, 20));
        await token.transfer(investor1, await _RT(token, 50));
    })
})

