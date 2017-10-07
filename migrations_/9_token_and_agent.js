var token = artifacts.require("BCSPromoToken");
var agent = artifacts.require("SimpleReturnAgent");

module.exports = function(deployer, network, accounts) {        
    var owner = accounts[1];
    
    var fee = 100;
     deployer.deploy(token, {from:owner}).then(function() {
         return deployer.deploy(agent, {from:owner});         
     });
};
