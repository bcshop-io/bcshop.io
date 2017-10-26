require("./utils.js");

var Web3 = require("web3");
var web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));

var ExampleEvent = artifacts.require("ExampleEvent");

contract("Example events", function(accounts) {
    it("test", async function() {
        var example = await ExampleEvent.new(accounts[0], 5, false, "hello!", 0x616263);        

        await example.emitEvent();
        await example.emitEvent();

        await example.set(accounts[1], 15, false, "hi", 0x616263);
        await example.emitEvent();

        await example.set(accounts[1], 2, true, "hi", 0x67626369);
        await example.emitEvent();        

        var event = example.TestEvent({_addrVar:accounts[0]}, {fromBlock: 0, toBlock: 'latest'});
        var res = event.get(function(error, result) {
            //console.log(error);
            console.log(result);
            return result;
        })
        
        //console.log(event.get());
        //var event = web3.eth.contract(ExampleEvent.abi).at(example.address).TestEvent({}, {fromBlock: 0, toBlock: 'latest'});
        //console.log(event);
        // var res = event.watch(function(error, result) {
        //     console.log(error);
        //     console.log(result);          
        // })
       // console.log(res.callbacks[0].toString());        
    })
})