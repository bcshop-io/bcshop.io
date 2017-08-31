pragma solidity ^0.4.10;

import "truffle/Assert.sol";
import "truffle/DeployedAddresses.sol";
import "../contracts/crowdsale/BCSCrowdsale.sol";
import "../contracts/helpers/AddressStorage.sol";

contract TestCrowdsale {

    IERC20Token token;
    BCSCrowdsale crowdsale;
    address beneficiary;
    AddressStorage asr;

    uint public initialBalance = 10 ether;
    uint256 investAmount = 2 ether;
    uint256 excessExpected = 1 ether / 100;
    uint256 tokensForOneEther = 10;
    uint256 goalInWei = 3 ether;
    uint256 startTime;
    uint256 durationHours;

    function TestCrowdsale() {}

    function beforeAll() {
        token = IERC20Token(DeployedAddresses.BCSToken());
        asr = AddressStorage(DeployedAddresses.AddressStorage());
        crowdsale = BCSCrowdsale(DeployedAddresses.BCSCrowdsale());

        beneficiary = crowdsale.beneficiary();
        
        //crowdsale = new BCSCrowdsale(token, beneficiary, startTime, durationHours, goalInWei, tokensForOneEther);     
        crowdsale.setNowTime(crowdsale.startTime() + 1 seconds);
    }

    function test1() {
         Assert.equal(crowdsale.token(), token, "Token address");
         Assert.equal(beneficiary, asr.address2(), "Beneficiary address");
         Assert.equal(token.totalSupply(), 1000, "!!!");
         Assert.equal(crowdsale.tokensForOneEther(), 10, "Price test");        
    }

    function testStartConditions() {
        // Assert.equal(crowdsale.startTime(), crowdsale.getNowTime(), "!");
        // Assert.equal(crowdsale.startTime(), crowdsale.endTime(), "!");
        
        Assert.equal(uint(crowdsale.getState()), 2, "State should be active (2)");
        Assert.equal(token.balanceOf(this), 0, "Should be no tokens");
        Assert.equal(crowdsale.investedFrom(this), 0, "InvestedFrom should be 0");
        Assert.equal(crowdsale.overpays(this), 0, "Overpay should be 0");
    }

    function testOverpayCalc() {
        uint256 tokens;
        uint256 excess; 
        (tokens, excess) = crowdsale.howManyTokensForEther(investAmount + excessExpected);

        Assert.equal(excess, excessExpected, "Overpay should be 0.01 ether");
        Assert.equal(tokens, 20, "Not 20 Tokens");     
    }

    function testOverpay() {        

        crowdsale.invest.value(investAmount + excessExpected)();

        Assert.equal(crowdsale.balance, investAmount + excessExpected, "Invalid crowdsale balance");
        Assert.equal(crowdsale.overpays(this), excessExpected, "Overpay should be 0.01 ether");
        Assert.equal(token.balanceOf(this), 20, "Should have 20 tokens");
        Assert.equal(crowdsale.investedFrom(this), investAmount, "InvestedFrom should be 2 ether");        
    }

    function testRefundOverpay() {
        uint expectedRefund = crowdsale.overpays(this);
        uint oldBalance = this.balance;
        uint oldCrowdsaleBalance = crowdsale.balance;

        crowdsale.withdrawOverpay();

        Assert.equal(this.balance, oldBalance + expectedRefund, "Expected overpay refund not received");
        Assert.equal(crowdsale.balance, oldCrowdsaleBalance - expectedRefund, "Expected overpay  refund not sent");
        Assert.equal(crowdsale.overpays(this), 0, "Overpay should be 0");

    }

    function testCrowdsaleFinish() {
        crowdsale.setNowTime(crowdsale.endTime() + 1 seconds);
        Assert.equal(uint(crowdsale.getState()), 4, "State should be failure (4)");
    }

    function testRefund() {
        uint expectedRefund = crowdsale.investedFrom(this);
        uint oldBalance = this.balance;
        uint oldCrowdsaleBalance = crowdsale.balance;

        crowdsale.refund();

        Assert.equal(this.balance, oldBalance + expectedRefund, "Expected refund not received");
        Assert.equal(crowdsale.balance, oldCrowdsaleBalance - expectedRefund, "Expected refund not sent");
        Assert.equal(crowdsale.investedFrom(this), 0, "InvestedFrom should be 0");
    }

    // function testBeneficiaryFailed() {
    //     crowdsale.transferToBeneficiary(); //should throw
    // }

    function () payable {}
}
