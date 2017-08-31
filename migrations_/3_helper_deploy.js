var storage = artifacts.require("AddressStorage");

module.exports = function(deployer, network, accounts) {        
    deployer.deploy(storage, accounts[0], accounts[1], accounts[2], accounts[3]);    
};
