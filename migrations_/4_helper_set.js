var storage = artifacts.require("AddressStorage");
var obj;

module.exports = function(deployer, accounts) {
    deployer.then(function() {
        //return storage.deployed();
        return deployer.deploy(storage);
    }).then(function(instance) {
        obj = instance;
        return obj.setAddresses(accounts[0], accounts[1], accounts[2], accounts[3]);
    });
}