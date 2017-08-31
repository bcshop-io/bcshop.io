var vendor = artifacts.require("TokenVendor");

module.exports = function(deployer, network, accounts) {             
     deployer.deploy(vendor, accounts[1], accounts[2], 100, {from:accounts[1]});
};