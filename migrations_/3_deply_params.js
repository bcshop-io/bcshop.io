var contract2 = artifacts.require("WithParams");

module.exports = function(deployer) {
    deployer.deploy(contract2, 14, 'sample string new');
};