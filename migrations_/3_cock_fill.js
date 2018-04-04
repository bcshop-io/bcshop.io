const Random = artifacts.require("Random");
const CockFactory = artifacts.require("CockFactory");
const CockStorage = artifacts.require("CockStorage");
const CockFight = artifacts.require("CockFight");
const CockMarket = artifacts.require("CockMarket");
const CockToken = artifacts.require("CockToken");

module.exports = async function(deployer, network, accounts) {
    let factory = await CockFactory.deployed();
    let storage = await CockStorage.deployed();
    let token = await CockToken.deployed();

    //create some cocks
    // await factory.create(0, {from:accounts[0]});
    // try {
    //     await factory.create(1, {from:accounts[1]});
    // } catch (e) {
    //     console.log(e);
    // }
    // await factory.create(2, {from:accounts[2]});
    // await factory.create(3, {from:accounts[3]});

    // await factory.create(0, {from:accounts[1]});
    // await factory.create(0, {from:accounts[2]});
    
    // await factory.create(1, {from:accounts[0]});
    // await factory.create(3, {from:accounts[2]});
    // await factory.create(2, {from:accounts[3]});

    //simulate transfers
    //await storage.transfer(2, accounts[0]);
};