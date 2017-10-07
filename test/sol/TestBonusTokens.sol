pragma solidity ^0.4.10;

import "truffle/Assert.sol";
import "truffle/DeployedAddresses.sol";
import "../contracts/token/BCSPromoToken.sol";
import "../contracts/shop/TokenVendor.sol";
import "../contracts/helpers/AddressStorage.sol";

//required migrations
//3_helper_deploy.js
contract TestBonusTokens {

    uint public initialBalance = 1 ether;

    TokenVendor vendor;    
    BCSPromoToken token;
    TokenProduct p1;

    address vendorWallet;
    address providerWallet;

    uint256 constant FEE = 100;
    uint256 constant OFFER_LIMIT = 5;

    uint256 startTimeOffset = 1 hours;
    uint256 duration = 2 hours;

    function TestBonusTokens() {}

    function beforeAllInit() {
        AddressStorage asr = AddressStorage(DeployedAddresses.AddressStorage());

        vendorWallet = asr.address1();
        providerWallet = asr.address2();

        vendor = new TokenVendor("BONUS", vendorWallet, providerWallet, FEE);
        token = new BCSPromoToken();         
    }

    function testInitial() {
        token.setManager(vendor, true);
        //Assert.isTrue(token.managers(vendor), "manager");

        vendor.setToken(token);
        Assert.equal(address(token), address(vendor.token()), "token");
    }

    function testCreateOffer() {
        vendor.createProduct("Offer1", 2, false, OFFER_LIMIT, true, 0, 0);        
        p1 = TokenProduct(vendor.products(0));
        p1.setStartTime(p1.getNowTime() + startTimeOffset);
        p1.setEndTime(p1.startTime() + duration);

        Assert.equal(p1.id(), 0, "id");
        Assert.equal(address(p1.token()), address(token), "token");        
    }

    function testBuyTokens() {
        Assert.equal(token.balanceOf(this), 0, "0 tokens");

        p1.advanceTime(startTimeOffset + 1 seconds);
        p1.buy.value(1000 wei)("1");
        Assert.equal(token.balanceOf(this), 1, "1 token");        

        /* Tests below pass only if multiple buyers restriction lifted
           and following parameters set in TokenProduct.sol        
        uint8 constant BRONZE_REWARD = 1;
        uint8 constant SILVER_REWARD = 10;
        uint8 constant GOLD_REWARD = 100;
        uint8 constant SILVER_REWARD_CHANCE = 3;
        uint8 constant GOLD_REWARD_CHANCE = 5
        */
         p1.buy.value(1000 wei)("2");
         p1.buy.value(1000 wei)("3");
         Assert.equal(token.balanceOf(this), 12, "12 tokens");
         p1.buy.value(1000 wei)("4");
         p1.buy.value(1000 wei)("5");
         Assert.equal(token.balanceOf(this), 113, "113 tokens");
         Assert.equal(p1.soldUnits(), 5, "5 sold");

        // Test below only passes when OFFER_LIMIT is more than 5
        // p1.buy.value(1000 wei)("c11@gmail.com");
        // Assert.equal(p1.soldUnits(), 6, "6 sold");
    }

    //this should fail with 'invalid opcode'
    // function testBuyTokensAfterEnd() {
    //     p1.advanceTime(duration + 1 seconds);
    //     p1.buy.value(1000 wei)("fail@gmail.com");
    // }

    // function testPurchaseList() {
    //     var (pid, clientId, paidUnits, delivered) = p1.getPurchase(0);
    //     Assert.equal(pid, 0, "Invalid purchase Id");
    //     Assert.equal(paidUnits, 1, "Invalid paid units");        
    // }
}