// var Token = artifacts.require("BCSToken");
// var tokenObj;

// contract('BCSTokenTest', function(accounts) {
//     it('check owner', async function() {
        
//         var tokenInst = await Token.new(10000, 1, {from: accounts[1]});
//         var result = await tokenInst.owner.call();            
    
//         assert.equal(result, accounts[1], "Check for owner");                
//     })
// })

// function getEvents(_contract) {
//     return new Promise((resolve, reject) => {
//         var event = _contract.ReserveKnown({}, {fromBlock: 0, toBlock: 'latest'});
//         event.get(function(error, result) {
//             if(!error) {
//                 return resolve (result);
//             }
//         })    
//     })
// }


// contract("test events on live", function() {
//     it("Run", async function() {
//         var Restrictions = artifacts.require("ParticipantInvestRestrictions");
//         var contract = Restrictions.at("0xb7f78e6016cd45a448d3703ab1b4f5b5e5d41e69");

//         var allEvents = await getEvents(contract);
//         console.log(allEvents);
//     })
// })

// contract ("test something", function(accounts) {
//     it("block confirmations", async function() {
//         var Web3 = require("web3");
//         var web3 = new Web3(new Web3.providers.HttpProvider("https://api.myetherapi.com/eth"));
//         var txHash = "0x8a8f4012438b0ac0ba8af83915410aef397c261e158315deefc6e54a7157104d";
//         var confirmations = 0;
//         var txBlockNumber = web3.eth.getTransaction(txHash).blockNumber;
//         if(txBlockNumber != null) {
//             confirmations = web3.eth.blockNumber - txBlockNumber;
//             console.log("confirmations: " + confirmations);
//         } else {
//             console.log("pending...");
//         }
//     })
// })

// contract("deploy bcshop platform", function(accounts, network, addresses) {
//     it("run", async function() {        
//         var FEE = 200;
//         //var owner = accounts[0];
//         var owner = "0x18f2d8c51cfc0a66e51ba40369d243909fd82b7c";                

//         var ProductDispatcherStorage = artifacts.require("ProductDispatcherStorage");
//         var ProductEngine = artifacts.require("ProductEngine");
//         var ProductEngineTest = artifacts.require("ProductEngineTest");        
//         var VendorManager = artifacts.require("VendorManager");
//         var VendorFactory = artifacts.require("VendorFactory");
        
//         var engine = await ProductEngine.new({from:owner});        
//         var storage = await ProductDispatcherStorage.new(engine.address,{from:owner});
        
//         var ProductLibDispatcher = artifacts.require("LibDispatcher");
//         ProductLibDispatcher.unlinked_binary = ProductLibDispatcher.unlinked_binary.replace(
//             '1111222233334444555566667777888899990000',
//             storage.address.slice(2));        
//         var dispatcher = await ProductLibDispatcher.new({from:owner});

//         VendorFactory.link('IProductEngine', dispatcher.address);     
//         var manager = await VendorManager.new(owner, FEE, {from:owner});
//         var factory = await VendorFactory.new(manager.address,{from:owner});
        
//         await manager.setFactory(factory.address, true,{from:owner});

//         assert.isTrue(await manager.validFactory.call(factory.address), "Invalid factory in manager");
//         assert.equal(await storage.lib.call(), engine.address, "Engine address is not in dispatcher storage");
//         assert.equal(await manager.provider.call(), owner, "Invalid provider in manager");
//         assert.equal(await manager.providerFeePromille.call(), FEE, "Invalid provider fee in manager");
//         assert.equal(await manager.owner.call(), owner, "Invalid manager's owner");

//         console.log("manager:      " + manager.address);
//         console.log("factory:      " + factory.address);
//         console.log("engine:       " + engine.address);
//         console.log("storage:      " + storage.address);
//         console.log("dispatcher:   " + dispatcher.address);
//     })
// })