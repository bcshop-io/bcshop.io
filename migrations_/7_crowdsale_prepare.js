var t = artifacts.require("BCSToken");
var c = artifacts.require("BCSCrowdsale");

//  module.exports = function(deployer, network, accounts) {    
//    deployer.deploy(t, 1000);
//  };

var tobj;
var cobj;
 module.exports = function(deployer, network, accounts) {    
   deployer.deploy(t, 1000).then(function() {             
     return deployer.deploy(c, t.address, accounts[1], 0, 5, 3000000000000000000, 10).then(function(){
       return t.deployed().then(function (instance) {
          return instance.approve(c.address, 100);
       });
     });     
   });
 };

// module.exports = function(deployer, network, accounts) {    
//    deployer.deploy(t, 1000).then(function(instance) {     
//      return deployer.deploy(c, t.address, accounts[1], 0, 5, 3000000000000000000, 10);
//    });
//  };
