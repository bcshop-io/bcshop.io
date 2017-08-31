var token = artifacts.require("BCSBonusToken");
var vendor = artifacts.require("TokenVendor");

module.exports = function(deployer, network, accounts) {        
    var owner = accounts[1];
    var provider = accounts[2];
    var fee = 100;
     deployer.deploy(token, {from:owner}).then(function() {
         return deployer.deploy(vendor, owner, provider, fee, {from:owner});         
     });
};

// module.exports = function(deployer, network, accounts) {        
//     var owner = accounts[1];
//     var provider = accounts[2];
//     var fee = 100;
//      deployer.deploy(token, {from:owner}).then(function() {
//          return deployer.deploy(vendor, owner, provider, fee, {from:owner}).then(function(){
//              return vendor.deployed().then(function(instance){
//                  return instance.setToken(token.address);
//              })
//          })
//      });
// };
