var controller = artifacts.require("BCSCrowdsaleController");

 module.exports = function(deployer) {
    
   deployer.deploy(controller);
 };

//  var obj;

// module.exports = function(deployer, network, accounts) {    
//   deployer.deploy(controller).then(function(instance) {
//       obj = instance;
//       return obj.initBeneficiaries(accounts[0], accounts[0], accounts[0], accounts[1]);
//   });
// };
