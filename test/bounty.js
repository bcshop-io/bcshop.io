let fs = require("fs");
let BigNumber = require('bn.js');
let Web3 = require("web3");
let web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));
let utils = new (require("./timeutils.js"))(web3);

let Token = artifacts.require('BCSToken');
let MassTransfer = artifacts.require('MassTransfer');

contract("Bounty script test", function(accounts) {

    let token;
    let mt;

    let initialBalances = {
        "0xb9c5f14e5e460ef926e5772783992f686fc2d3c4": "513066926400336100001",
        "0x752adea2aaa4c71eda1bcf715c895fd2ac12fe6c": "3000000000000000000000",
        "0xc286212f207037479c070f1626eae3af3ced2126": "50000000000000000000",
        "0x9b86511feabff8664f87caceb31e30ef7ced0397": "50000000000000000000",
        "0x9f425144b3d68eb042214c557cd995209742c646": "50000000000000000000",
        "0x0ffeb241a155c85420704efa283e4b440943d613": "50000000000000000000",
        "0x7bd4816f3f6dac181ae6496964642ce29d7dfeb0": "50000000000000000000",
        "0x5f196a1f193758d8a19cfabe7f038ac4d27a6e36": "50000000000000000000",
        "0x5da8edec8e3385e5808599463abfbc7efd1d8a3e": "2000000000000000000",
	    "0x904c8580e15537c1a6b6ef85ca0bac872aebe27f": "2000000000000000000"
    };

    let multiplier = 200;
    let denominator = 333;

    before(async function() {
        let config = JSON.parse(fs.readFileSync("bountytest.json"));
        token = Token.at(config.token);
        mt = MassTransfer.at(config.mt);

        console.log(token.address);
        console.log(mt.address);
    });

    it("", async function() {
        let receivers = Object.keys(initialBalances);

        for(let i = 0; i < receivers.length; ++i) {
            let balance = await token.balanceOf.call(receivers[i]);
            
            let expectedBalance = new BigNumber(initialBalances[receivers[i]]);
            expectedBalance.imuln(multiplier);
            expectedBalance = expectedBalance.divn(denominator);

            //assert.equal(balance.toNumber(), expectedBalance.toNumber(), `Invalid balance for receiver ${i}`);
            assert.isTrue(
                balance.eq(expectedBalance), 
                `Invalid balance for receiver ${i}. ${balance.toString()} =/= ${expectedBalance.toString()}`
            );
        }
    });
});