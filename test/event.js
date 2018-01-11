require("./utils.js");

var Web3 = require("web3");
var web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));

var ExampleEvent = artifacts.require("ExampleEvent");

contract("Example events", function(accounts) {

    // it("catch VendorCreated event", async function() {

    //     var Vendor = artifacts.require("Vendor");
    //     var ProductDispatcherStorage = artifacts.require("ProductDispatcherStorage");
    //     var ProductEngine = artifacts.require("ProductEngine");        
    //     var Product = artifacts.require("Product");
    //     var VendorManager = artifacts.require("VendorManager");
    //     var VendorFactory = artifacts.require("VendorFactory");

    //     var engine = await ProductEngine.new();        
    //     var storage = await ProductDispatcherStorage.new(engine.address);
    //     var ProductLibDispatcher = artifacts.require("LibDispatcher");
    //     ProductLibDispatcher.unlinked_binary = ProductLibDispatcher.unlinked_binary.replace(
    //         '1111222233334444555566667777888899990000',
    //         storage.address.slice(2));        
    //     var dispatcher = await ProductLibDispatcher.new();
    
    //     VendorFactory.link('IProductEngine', dispatcher.address);
    //     var manager = await VendorManager.new(accounts[1], 100);
    //     var factory = await VendorFactory.new(manager.address);        
    //     await manager.setFactory(factory.address, true);

    //     var txr = await factory.createVendor(accounts[0], "Vendor1");
    //     var vendor = Vendor.at(txr.logs[0].args.vendor);
    //     console.log(txr.logs);
        
    //     var timestamp = web3.eth.getBlock(txr.logs[0].blockNumber).timestamp;
    //     console.log(timestamp);
    // })

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
            console.log("!");
            console.log(result);
            result.forEach(function(item, index, array) {
                var timestamp = web3.eth.getBlock(item.blockNumber).timestamp;
                console.log(timestamp);
            })            
            return result;
        })
        
    //     console.log(event.get());
    //     var event = web3.eth.contract(ExampleEvent.abi).at(example.address).TestEvent({}, {fromBlock: 0, toBlock: 'latest'});
    //     console.log(event);
    //     var res = event.watch(function(error, result) {
    //         console.log(error);
    //         console.log(result);          
    //     })
    //    console.log(res.callbacks[0].toString());        
    })
})