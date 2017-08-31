pragma solidity ^0.4.10;

import "truffle/Assert.sol";
import "truffle/DeployedAddresses.sol";
import "../contracts/crowdsale/BCSCrowdsaleController.sol";
import "../contracts/crowdsale/BCSCrowdsale.sol";
import "../contracts/token/BCSToken.sol";
import "../contracts/crowdsale/TrancheWallet.sol";
import "../contracts/helpers/AddressStorage.sol";
import "../contracts/helpers/FakeTime.sol";
import "./PrepareCrowdsale.sol";

contract TestTge {

    uint public initialBalance = 10 ether;
    address public beneficiary;
    address public devTokenHolder;
    address public miscTokenHolder;

    uint amountToInvestPreTge = 1 ether;
    uint expectedTokensPreTge = 115;

    uint amountToInvestTge = 2 ether;
    uint expectedTokensTge = 200;

    uint tgeStartsIn = 1 minutes;
    uint tgeDurationHours = 5;

    BCSCrowdsaleController controller;
    BCSCrowdsale preTge;
    BCSCrowdsale tge;
    TrancheWallet wallet;

    function TestTge() {}

    function beforeAll1() {
        controller = new BCSCrowdsaleController();
        AddressStorage asr = AddressStorage(DeployedAddresses.AddressStorage());

        beneficiary = asr.address1();
        devTokenHolder = asr.address1();
        miscTokenHolder = asr.address2();

        controller.initBeneficiaries(beneficiary, devTokenHolder, miscTokenHolder);
        controller.createToken();

        wallet = TrancheWallet(controller.beneficiaryWallet());        
    }

    function beforeAll2() {

        uint preTgeStartsAt = controller.token().getNowTime() + 2 minutes;
        uint preTgeHours = 4;
        
        controller.createPreTge(preTgeStartsAt, preTgeHours);
        preTge = controller.preTgeSale();

        preTge.setNowTime(preTge.startTime() + 1 seconds);               
        preTge.invest.value(amountToInvestPreTge)();

        preTge.setNowTime(preTge.endTime() + 1 seconds);
        controller.finalizePretge();
    }

    // function testPretgeZeroFunds() {
    //     Assert.equal(preTge.balance, 0, "Should be no funds on pretge");       
    // }

    function testTgeCreationNow() {
        controller.createTge(0, tgeDurationHours);
        tge = controller.tgeSale();

        Assert.equal(tge.startTime(), now, "Test start time");
        Assert.equal(controller.token().allowance(controller, preTge), 0, "No tokens fore preTge");
    }

    function testTgeStateActive() {
         Assert.equal(uint(tge.getState()), 2, "Tge state should be Active (2)");        
    }

    function testInvestTge() {
        tge.invest.value(amountToInvestTge)();
        
        uint tokens = controller.token().balanceOf(this);
        Assert.equal(tge.balance, amountToInvestTge, "Should be 3 ether on tge contract");
        Assert.equal(tokens, expectedTokensTge + expectedTokensPreTge, "It should have 315 tokens");
    }

    function testEndTge() {
        uint time1 = tge.endTime() + 1 seconds;
        tge.setNowTime(time1);        
        wallet.setNowTime(time1);        
        Assert.equal(uint(tge.getState()), 3, "Tge state should be Success (3)");
    }
}