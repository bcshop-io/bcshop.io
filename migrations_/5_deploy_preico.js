//var preIcoPricing = artifacts.require("FlatPricing");
var libMath = artifacts.require("SafeMathLib");

// module.exports = function(deployer) {

//     var maxTokens = 3000000;
//     var salePct = 12;
//     //some calculations
//     var sellableTokens = maxTokens * salePct / 100;
//     var tokensForOneEtherPreIco = 115; 
//     var tokenPriceInWei = Math.pow(10, 18) / tokensForOneEtherPreIco;

//     deployer.deploy(libMath);
//     deployer.link(libMath, preIcoPricing);
//     deployer.deploy(preIcoPricing, tokenPriceInWei);
// };

var preIcoCrowdsale = artifacts.require("AllocatedCrowdsale");

module.exports = function(deployer) {
    var token =   0x49c2CD392D915cB13940Dda9Aec07401Bfe38837;
    var pricing = 0x5c3392F1E0e8c52ca47dDC84f3418402F4B1B0d5;
    var start = 1499928900;
    var end =   1499957700;
    var tokenOwner = 0x1006363b77e0775BFa4024e4F346bABBCa384Aea;

    deployer.deploy(libMath);
    deployer.link(libMath, preIcoCrowdsale);
    deployer.deploy(preIcoCrowdsale, token, pricing, tokenOwner, start, end, 109, tokenOwner);
    //deployer.deploy(preIcoCrowdsale, 0, 0, 0, 0, 0, 0, 0);
}