var bct = artifacts.require("BurnableCrowdsaleToken");
var libMath = artifacts.require("SafeMathLib");

module.exports = function(deployer) {
    deployer.deploy(libMath);
    deployer.link(libMath, bct);
    deployer.deploy(bct, "CAU Token", "CAU", 3000000, 0, false);
};