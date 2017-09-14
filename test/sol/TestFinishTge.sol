pragma solidity ^0.4.10;

import "truffle/Assert.sol";
import "truffle/DeployedAddresses.sol";
import "../contracts/crowdsale/BCSCrowdsaleController.sol";
import "../contracts/crowdsale/BCSCrowdsale.sol";
import "../contracts/token/BCSToken.sol";
import "../contracts/crowdsale/TrancheWallet.sol";
import "../contracts/helpers/AddressStorage.sol";

contract TestFinishTge {

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

    function TestFinishTge() {}

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

    function beforeAll3() {

        controller.createTge(0, tgeDurationHours);
        tge = controller.tgeSale();
        tge.invest.value(amountToInvestTge)();
        uint time1 = tge.endTime() + 1 seconds;
        tge.setNowTime(time1);        
        wallet.setNowTime(time1);
    }    

    function testTokensPreFinalize() {
        Assert.notEqual(controller.token().balanceOf(address(controller)), 0, "Controller should have tokenss");
    }

    function testFinalizeTge() {
        controller.finalizeTge();
        Assert.equal(tge.balance, 0, "Should be 0 ether on tge contract");
        Assert.equal(wallet.balance, amountToInvestTge + amountToInvestPreTge, "Wallet should contains all funds tge+pretge");
    }

    function testWallet() {
        Assert.notEqual(wallet.lockStart(), 0, "Wallet should be locked");
        Assert.equal(wallet.initialFunds(), wallet.balance, "Wallet initial funds should be equal to its balance");
    }

    //if uncommented, comment testWallet. Otherwise 'truffle test' throws out of gas exception
    // function testToken() {
    //     Assert.equal(controller.token().owner(), 0x0, "Token should have no owner");
    //     Assert.equal(controller.token().balanceOf(address(controller)), 0, "Controller shouldn't have any tokens");
    // }
}