var Web3 = require("web3");
var web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));

var Controller = artifacts.require("BCSBonusController");
var Token = artifacts.require("BCSPromoToken");
var Product = artifacts.require("TokenProduct");
var Vendor = artifacts.require("TokenVendor");

var token, product, controller, vendor;

contract("Compare gas prices", function(accounts) {

    var owner = accounts[0];

    it("Creation of token vendor. Controller and standalone transactions.", async function() {
        var b1 = await web3.eth.getBalance(owner);

        controller = await Controller.new(accounts[1]);
        await controller.createTokenAndVendor();

        var b2 = await web3.eth.getBalance(owner);
        var cost1 = b1.minus(b2).toNumber();
        console.log(cost1);

        var b3 = await web3.eth.getBalance(owner);
        
        vendor = await Vendor.new("BONUS", accounts[1], 1, 10, 100, 10, 100);
        token = await Token.new("BCS BONUS TOKEN", "", 0);
        await token.setManager(vendor.address, true);
        await vendor.setToken(token.address);
        
        
        var b4 = await web3.eth.getBalance(owner);
        var cost2 = b3.minus(b4).toNumber();
        console.log(cost2);

        assert.equal(cost1, cost2, "!");
    })

    it("Creation of token product. TokenVendor method and contract deploy.", async function() {        

        var b1 = await web3.eth.getBalance(owner);          
        await vendor.createProduct("P1", 10000, true, 2000, false, 0, 0);        
        var b2 = await web3.eth.getBalance(owner);
        var cost1 = b1.minus(b2).toNumber();
        console.log(cost1);
                
        var b3 = await web3.eth.getBalance(owner);        
        product = await Product.new(token.address, 0, "T1", 2000, 0, 0, 1, 10, 100, 10, 100);                
        var b4 = await web3.eth.getBalance(owner);
        var cost2 = b3.minus(b4).toNumber();
        console.log(cost2);

        assert.equal(cost1, cost2, "!");
    })
})