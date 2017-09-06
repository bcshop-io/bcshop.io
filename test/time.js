var Web3 = require('web3');
web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));
var utils = new (require('./timeutils.js'))(web3);

var RTestTime = artifacts.require("RTestTime");
var r;

contract('RTestTime', function(accounts) {
    it('1', async function(){        
        r = await RTestTime.new();

        var rNow = await r.getNowTime.call();
        var rStart = await r.startTime.call();
        var blockTs = utils.currentTime();
        
        console.log("block ts = " + blockTs);
        console.log("contract start = " + rStart);
        console.log("contract now = " + rNow);        

        assert.equal(blockTs, rNow, "Invalid now time");
        
        await utils.timeTravelAndMine(10);
       
        rNow = await r.getNowTime.call();
        rNow = rNow.toNumber();
        console.log("contract now = " + rNow);        
        //assert.equal(blockTs + 10, rNow, "invalid increased time");
    })
})