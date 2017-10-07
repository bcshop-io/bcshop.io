pragma solidity ^0.4.10;

import "truffle/Assert.sol";
import "truffle/DeployedAddresses.sol"; 
import "../contracts/crowdsale/BCSBonusController.sol";
import "../contracts/helpers/AddressStorage.sol";

contract TestBonusController {

    address beneficiary;
    BCSBonusController bonusController;
    BCSPromoToken token;
    TokenVendor vendor;

    function TestBonusController() {}

    function beforeAll() {
        AddressStorage asr = AddressStorage(DeployedAddresses.AddressStorage());
        beneficiary = asr.address1();
        bonusController = new BCSBonusController(beneficiary);
    }

    function testCreation() {        
        bonusController.createTokenAndVendor();
        token = bonusController.bonusToken();
        vendor = bonusController.tokenVendor();

        Assert.equal(token.owner(), this, "Invalid token owner");
        Assert.isTrue(token.managers(this), "Invalid token manager");

        Assert.equal(token.owner(), this, "Invalid vendor owner");
        Assert.isTrue(token.managers(this), "Invalid vendor manager");
    }

    function testTokenOperations() {
        token.setMinter(this, true);
        token.mint(this, 100);

        Assert.equal(token.balanceOf(this), 100, "Invalid token amount");        
    }

    function testVendorOperations() {
        vendor.createProduct("OFFER1", 0, true, 20, false, 0, 0);

        Assert.equal(vendor.getProductsCount(), 1, "Invalid product count");
    }
}