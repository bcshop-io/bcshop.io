require("./utils.js");
var Web3 = require("web3");
var web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));

var IExampleLib = artifacts.require("IExampleLib");
var ExampleLib = artifacts.require("ExampleLib");
var ExampleLib2 = artifacts.require("ExampleLib2");
var ExampleLibraryUser = artifacts.require("ExampleLibraryUser");
var LibDispatcherStorage = artifacts.require("ExampleLibDispatcherStorage");
var LibDispatcher = artifacts.require("ExampleLibDispatcher");
var Factory = artifacts.require("ExampleUserFactory");

var SafeMathLib = artifacts.require("SafeMathLib");
var SafeMathUserLib = artifacts.require("SafeMathUserLib");
var ExampleSafeMathUser = artifacts.require("ExampleSafeMathUser");

contract ("Example library user", function(accounts) {
    var lib;
    var libUser;

    it("init to (1,2)", async function() {
        lib = await ExampleLib.new();
        ExampleLibraryUser.link('IExampleLib', lib.address);
        libUser = await ExampleLibraryUser.new();

        assert.equal(await libUser.getVar1.call(), 0, "Var1 should equal 0");
        
        await libUser.setVars(1, 2);
        var res = await libUser.getVars.call(2, true);
        assert.equal(res[0].toNumber(), 1, "Var1 should equal 1");
        assert.equal(res[1].toNumber(), 2, "Var1 should equal 2");        
    })

    it("change  to (10, 20)", async function() {
        await libUser.setVars(10, 20);
        var res = await libUser.getVars.call(2, true);
        assert.equal(res[0].toNumber(), 10, "Var1 should equal 10");
        assert.equal(res[1].toNumber(), 20, "Var1 should equal 20");
    })

    it("call payable function, should fail", async function() {
        try {
            await web3.eth.sendTransaction({from:accounts[0], to:libUser.address, value: 2});         
        } catch (e) {
            return true;
        }
        assert.isTrue(false, "Function should fail");        
    })

    it("call payable function", async function() {
        var balance = await web3.eth.getBalance(libUser.address);
        assert.equal(balance.toNumber(), 0, "Balance of libUser should be 0");

        await web3.eth.sendTransaction({from:accounts[0], to:libUser.address, value: 10000});
        assert.equal(await libUser.getVar1.call(), 10000, "Var1 should equal to sent value: 10000");
        
        balance = await web3.eth.getBalance(libUser.address);
        assert.equal(balance.toNumber(), 10000, "Balance of libUser should be 10000");
    })
})

contract ("Link to dispatcher", function(accounts) {
    var lib;
    var lib2;
    var libUser;
    var dispatcher;
    var dispatcherStorage;

    it("create libraries and storage", async function() {
        lib = await ExampleLib.new();        
        dispatcherStorage = await LibDispatcherStorage.new(lib.address);
        LibDispatcher.unlinked_binary = LibDispatcher.unlinked_binary.replace(
            '1111222233334444555566667777888899990000',
            dispatcherStorage.address.slice(2));        
        dispatcher = await LibDispatcher.new();

        ExampleLibraryUser.link('IExampleLib', dispatcher.address);
        libUser = await ExampleLibraryUser.new();

        var tx = await dispatcherStorage.addFunction("getVar1(IExampleLib.Data storage)", 32);        
        //console.log(tx.logs[0].args);
        tx = await dispatcherStorage.addFunction("getVars(IExampleLib.Data storage,uint256,bool)", 64); // was 64                 
        //tx = await dispatcherStorage.addFunction("getVars(IExampleLib.Data storage)", 96); // was 64         
        tx = await dispatcherStorage.addFunction("getAllVars(IExampleLib.Data storage)", 128);
        //console.log(tx.logs[0].args);
        tx = await dispatcherStorage.addFunction("getBool(IExampleLib.Data storage)", 32);
        //console.log(tx.logs[0].args);
        tx = await dispatcherStorage.addFunction("getBoolAsInt(IExampleLib.Data storage)", 32);        
        //console.log(tx.logs[0].args);        
        tx = await dispatcherStorage.addFunction("getBytes(IExampleLib.Data storage)", 32);
        //tx = await dispatcherStorage.addFunction("setVars(IExampleLib.Data storage,uint256,uint256)", 32);
       // console.log(tx.logs[0].args);
        assert.equal((await libUser.getVar1.call()).toNumber(), 0, "Var1 should equal 0");
    })

    it("check initial values", async function() {
        var res = await libUser.getAllVars.call();
        console.log("INITIAL VALUES");
        console.log(res);
       
        assert.equal(res[0].toNumber(), 0, "Initially var1 should be 0");
        assert.isFalse(res[1], "Initially var3 should be false");
        assert.equal(res[2].toNumber(), 0, "Initially var2 should be 0");
           
        assert.isFalse(await libUser.getBool.call(), "initially getBool should return false");
        
      //  console.log(await libUser.getVars.call(0, true));
    })

    it("check boolean getters/setters", async function() {
        await libUser.setVar3(true);
        var res = await libUser.getAllVars.call();
        
        assert.equal(res[0].toNumber(), 0, "Initially var1 should be 0");
        assert.isTrue(res[1], "Now var3 should be true");
        assert.equal(res[2].toNumber(), 0, "Initially var2 should be 0");

        assert.isTrue(await libUser.getBool.call(), "getBool should return true");        
    })

    it("check bytes getters/setters", async function() {
        var bytesRes = await libUser.getBytes.call();
        //console.log(bytesRes.FromUTFBytes());
        assert.equal(bytesRes.FromUTFBytes(), "", "initially var4 is empty");

        await libUser.setVar4("abc");

        bytesRes = await libUser.getBytes.call();
        //console.log(bytesRes.FromUTFBytes());
        assert.equal(bytesRes.FromUTFBytes(), "abc", "var4 should equal 'abc'");        
    })

    it("change to (1,2)", async function() {
        var tx = await libUser.setVars(1, 2);
        
        var res = await libUser.getVars.call(12, false);        
        assert.equal(res[0].toNumber(), 1, "Var1 should equal 1");
        assert.equal(res[1].toNumber(), 2, "Var2 should equal 2");             

        var res = await libUser.getAllVars.call();
        //console.log(await libUser.data.call());
        assert.equal(res[0].toNumber(), 1, "var1 should be 1");
        assert.isTrue(res[1], "var3 should be true");
        assert.equal(res[2].toNumber(), 2, "var2 should be 2");
        assert.equal(res[3].FromUTFBytes(), "abc", "var4 should be 'abc'");

        assert.isTrue(await libUser.getBool.call(), "getBool should still return true");

       // console.log(await libUser.getVars.call(0, true));
    })

    it("change  to (10, 20)", async function() {
        await libUser.setVars(10, 20);
        var res = await libUser.getVars.call(2, true);
        assert.equal(res[0].toNumber(), 10, "Var1 should equal 10");
        assert.equal(res[1].toNumber(), 20, "Var2 should equal 20");        
    })

    it("call payable function, should fail", async function() {
        try {
            await web3.eth.sendTransaction({from:accounts[0], to:libUser.address, value: 2});
        } catch (e) {
            return true;
        }
        assert.isTrue(false, "Payment should fail");
        // var balance1 = await web3.eth.getBalance(libUser.address);        
        // var txr = await web3.eth.sendTransaction({from:accounts[0], to:libUser.address, value: 2});
        // var balance2 = await web3.eth.getBalance(libUser.address);
        // assert.equal(balance1.toNumber(), balance2.toNumber(), "Balances hould be equal as exception was raised");
        // console.log(txr);
        // assert.equal(await libUser.getVar1.call(), 10, "Var1 should still equal to 10");
    })

    it("call payable function", async function() {
        await web3.eth.sendTransaction({from:accounts[0], to:libUser.address, value: 10000});
        assert.equal(await libUser.getVar1.call(), 10000, "Var1 should equal to sent value: 10000");
    })

    it("create new library", async function() {
        lib2 = await ExampleLib2.new();
        await dispatcherStorage.replace(lib2.address);

        var data = await libUser.data.call();
        assert.equal(data[0].toNumber(), 10000, "Var1 should equal 10000");
        assert.equal(data[1].toNumber(), 20, "Var2 should equal 20");

        var res = await libUser.getVars.call(2, true);
        assert.equal(res[0].toNumber(), 20000, "GetVar1 should equal 10000*2");
        assert.equal(res[1].toNumber(), 40, "GetVar2 should equal 20*2");

        var res = await libUser.getAllVars.call();        
        assert.equal(res[0].toNumber(), 10000, "getAllVars.var1 should be 10000");
        assert.isTrue(res[1], "getAllVars.var3 should be true");
        assert.equal(res[2].toNumber(), 20, "getAllVars.var2 should be 20");
    })

    it("new library. change  to (50, 60)", async function() {
        await libUser.setVars(50, 60);
        
        var data = await libUser.data.call();
        assert.equal(data[0].toNumber(), 51, "Var1 should equal 51");
        assert.equal(data[1].toNumber(), 61, "Var2 should equal 61");

        var res = await libUser.getVars.call(2, true);
        assert.equal(res[0].toNumber(), 102, "GetVar1 should equal 51*2");
        assert.equal(res[1].toNumber(), 122, "GetVar2 should equal 61*2");

        var res = await libUser.getAllVars.call();        
        assert.equal(res[0].toNumber(), 51, "getAllVars.var1 should be 51");
        assert.isTrue(res[1], "getAllVars.var3 should be true");
        assert.equal(res[2].toNumber(), 61, "getAllVars.var2 should be 61");
    })    

    it("new library. payable function", async function() {
        await web3.eth.sendTransaction({from:accounts[0], to:libUser.address, value: 100});

        var data = await libUser.data.call();
        assert.equal(data[0].toNumber(), 200, "Var1 should equal 200");        

        var res = await libUser.getVar1.call();        
        assert.equal(res.toNumber(), 400, "GetVar1 should equal 200*2");
    })
})



contract("create from another contract", function(accounts) {
    var factory;    
    var lib;
    var lib2;
    var libUser;
    var dispatcher;
    var dispatcherStorage;
        
    it("create libraries and storage", async function() {
        lib = await ExampleLib.new();        
        dispatcherStorage = await LibDispatcherStorage.new(lib.address);
        LibDispatcher.unlinked_binary = LibDispatcher.unlinked_binary.replace(
            '1111222233334444555566667777888899990000',
            dispatcherStorage.address.slice(2));

        dispatcher = await LibDispatcher.new();

        Factory.link('IExampleLib', dispatcher.address);
        factory = await Factory.new();

        var tx = await factory.createNewUser();        
        libUser = ExampleLibraryUser.at(await factory.users.call(0));

        var tx = await dispatcherStorage.addFunction("getVar1(IExampleLib.Data storage)", 32);        
        //console.log(tx.logs[0].args);
        tx = await dispatcherStorage.addFunction("getVars(IExampleLib.Data storage,uint256,bool)", 64); // was 64                 
        //tx = await dispatcherStorage.addFunction("getVars(IExampleLib.Data storage)", 96); // was 64         
        tx = await dispatcherStorage.addFunction("getAllVars(IExampleLib.Data storage)", 128);
        //console.log(tx.logs[0].args);
        tx = await dispatcherStorage.addFunction("getBool(IExampleLib.Data storage)", 32);
        //console.log(tx.logs[0].args);
        tx = await dispatcherStorage.addFunction("getBoolAsInt(IExampleLib.Data storage)", 32);        
        //console.log(tx.logs[0].args);        
        tx = await dispatcherStorage.addFunction("getBytes(IExampleLib.Data storage)", 32);

        assert.equal((await libUser.getVar1.call()).toNumber(), 0, "Var1 should equal 0");
    });
    
    it("change  to (10, 20)", async function() {
        await libUser.setVars(10, 20);
        var res = await libUser.getVars.call(2, true);
        assert.equal(res[0].toNumber(), 10, "Var1 should equal 10");
        assert.equal(res[1].toNumber(), 20, "Var2 should equal 20");
    })

    it("call payable function", async function() {
        await web3.eth.sendTransaction({from:accounts[0], to:libUser.address, value: 10000});
        assert.equal(await libUser.getVar1.call(), 10000, "Var1 should equal to sent value: 10000");
    })
    
    it("create new library", async function() {
        lib2 = await ExampleLib2.new();
        await dispatcherStorage.replace(lib2.address);

        var data = await libUser.data.call();
        assert.equal(data[0].toNumber(), 10000, "Var1 should equal 10000");
        assert.equal(data[1].toNumber(), 20, "Var2 should equal 20");

        var res = await libUser.getVars.call(2, true);
        assert.equal(res[0].toNumber(), 20000, "GetVar1 should equal 10000*2");
        assert.equal(res[1].toNumber(), 40, "GetVar2 should equal 20*2");
    })

    it("new library. change  to (50, 60)", async function() {
        await libUser.setVars(50, 60);
        
        var data = await libUser.data.call();
        assert.equal(data[0].toNumber(), 51, "Var1 should equal 51");
        assert.equal(data[1].toNumber(), 61, "Var2 should equal 61");

        var res = await libUser.getVars.call(2, true);
        assert.equal(res[0].toNumber(), 102, "GetVar1 should equal 51*2");
        assert.equal(res[1].toNumber(), 122, "GetVar2 should equal 61*2");
    })    
});


contract("Link library with another library", function(accounts) {
    var safeMathLib;
    var safeMathUserLib;
    var user;

    it("run", async function() {
        safeMathLib = await SafeMathLib.new();
        safeMathUserLib = await SafeMathUserLib.new();

        ExampleSafeMathUser.link('SafeMathUserLib', safeMathUserLib.address);
        user = await ExampleSafeMathUser.new();

        await user.setValues(1, 3);
       // console.log(await user.getSum.call());
    })
})