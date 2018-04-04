var Migrations = artifacts.require("Migrations");

module.exports = function(deployer, network, accounts) { 
  // Deploy the Migrations contract as our only task
  deployer.deploy(Migrations);  
}; 