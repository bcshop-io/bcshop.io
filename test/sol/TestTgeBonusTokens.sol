pragma solidity ^0.4.10;

import "truffle/Assert.sol";
import "truffle/DeployedAddresses.sol";

import "../contracts/crowdsale/BCSTokenCrowdsale.sol";
import "../contracts/token/BCSToken.sol";
import "../contracts/token/BCSPromoToken.sol";
import "../contracts/token/TokenPool.sol";
import "../contracts/helpers/AddressStorage.sol";

//required migrations
//3_helper_deploy.js
contract TestTgeBonusTokens {

    uint256 public initialBalance = 5 ether;

    address owner;
    address bonusTokenHolder;

    BCSTokenCrowdsale tgeSale;
    BCSPromoToken bonusToken;
    BCSPromoToken fakeToken;
    BCSToken tgeToken;
    TokenPool pool;

    //tge token params
    uint256 maxTgeTokens = 1000;

    //bonus token params
    uint256 bonusTokensSold = 200;
    uint256 bonusTokensToBuy = 50;

    //tge parameters
    address beneficiary;
    uint256 startTime = 0;
    uint256 durationInHours = 1;
    uint256 goalInWei = 0;
    uint256 tokensForOneEther = 5;

    function TestTgeBonusTokens() {}

    function () payable {}

    function beforeAllInit() {
        AddressStorage asr = AddressStorage(DeployedAddresses.AddressStorage());
        owner = asr.address1();
        beneficiary = asr.address2();
        bonusTokenHolder = this;
                
        bonusToken = new BCSPromoToken();
        tgeToken = new BCSToken(maxTgeTokens, 0);

        pool = new TokenPool(tgeToken);                
        tgeSale = new BCSTokenCrowdsale(pool, IInvestRestrictions(0x0), beneficiary, startTime, durationInHours, goalInWei, tokensForOneEther, 0);

        bonusToken.mint(this, bonusTokensSold);
    }

    function testInit() {
        tgeSale.setReturnableToken(bonusToken);
        tgeToken.transfer(tgeSale, bonusToken.totalSupply());
        //tgeToken.approve(tgeSale, tgeToken.totalSupply());
        tgeToken.transfer(pool, tgeToken.totalSupply());
        pool.setTrustee(tgeSale, true);

        bonusToken.setReturnAgent(tgeSale);

        Assert.equal(tgeToken.balanceOf(tgeSale), bonusTokensSold, "Invalid tge's tgeToken balance");
        Assert.equal(tgeToken.balanceOf(this), maxTgeTokens - bonusTokensSold, "Invalid tgeToken holder tgeToken balance");
    }

    function testBuyWithTokens() {
        uint256 oldTokenBalance = tgeToken.balanceOf(this);
        uint256 oldTgeTokenBalance = tgeToken.balanceOf(tgeSale);

        bonusToken.transfer(tgeSale, bonusTokensToBuy);

        Assert.equal(tgeToken.balanceOf(this), oldTokenBalance + bonusTokensToBuy, "Invalid token amount after purchase");
        Assert.equal(tgeToken.balanceOf(tgeSale), oldTgeTokenBalance - bonusTokensToBuy, "Invalid tge's token amount after purchase");
        Assert.equal(bonusToken.balanceOf(this), bonusTokensSold - bonusTokensToBuy, "Invalid bonus token amount after purchase");
    }

    function testBuyWithEther() {
        uint256 oldTokenBalance = tgeToken.balanceOf(this);
        uint256 oldTgeBalance = tgeSale.balance;
        uint256 oldAllowance = tgeToken.allowance(this, tgeSale);
        uint256 oldTgeTokenBalance = tgeToken.balanceOf(tgeSale);

        //tgeSale.call.gas(120000).value(1 ether)();
       tgeSale.invest.value(1 ether)();

         Assert.equal(tgeSale.overpays(this), 0, "Invalid overpay");
         Assert.equal(tgeSale.balance, oldTgeBalance + 1 ether, "Invalid tgeSale balance after ether purchsae");
         Assert.equal(tgeToken.allowance(this, tgeSale), oldAllowance - tokensForOneEther, "Invalid tgeSale tokens left after ether purchase");
        //Assert.equal(oldTgeTokenBalance, 0, "!!!");
        Assert.equal(oldTgeTokenBalance, tgeToken.balanceOf(tgeSale), "!");
        Assert.equal(tgeToken.balanceOf(this), oldTokenBalance, "Invalid tgeToken balance after ether purchase");
    }
}
