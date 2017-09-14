pragma solidity ^0.4.10;

import "truffle/Assert.sol";
import "truffle/DeployedAddresses.sol";
import "../contracts/crowdsale/BCSCrowdsaleController.sol";
import "../contracts/crowdsale/BCSCrowdsale.sol";
import "../contracts/token/BCSToken.sol";
import "../contracts/crowdsale/TrancheWallet.sol";
import "../contracts/helpers/AddressStorage.sol";
import "../contracts/helpers/FakeTime.sol";

/**@dev test environment prepare classes */
contract PrepareCrowdsale {
    uint public initialBalance = 10 ether;
    address public beneficiary;
    address public devTokenHolder;
    address public miscTokenHolder;

    uint public amountToInvestPreTge = 1 ether;
    uint public expectedTokensPreTge = 115;

    uint public amountToInvestTge = 2 ether;
    uint public expectedTokensTge = 200;

    uint public tgeStartsIn = 1 minutes;
    uint public tgeDurationHours = 5;

    BCSCrowdsaleController public controller;
    BCSCrowdsale public preTge;
    BCSCrowdsale public tge;
    TrancheWallet public wallet;

    function PrepareCrowdsale() {

    }

    function beforeAllInit() {
        controller = new BCSCrowdsaleController();
        AddressStorage asr = AddressStorage(DeployedAddresses.AddressStorage());

        beneficiary = asr.address1();
        devTokenHolder = asr.address1();
        miscTokenHolder = asr.address2();

        controller.initBeneficiaries(beneficiary, devTokenHolder, miscTokenHolder);
        controller.createToken();

        wallet = TrancheWallet(controller.beneficiaryWallet());        
    }
}

contract PrepareCrowdsalePreTgeFinished is PrepareCrowdsale {
    function PrepareCrowdsalePreTgeFinished() {}

    function beforeAllPreTge() {

        uint preTgeStartsAt = controller.token().getNowTime() + 2 minutes;
        uint preTgeHours = 4;
        
        controller.createPreTge(preTgeStartsAt, preTgeHours);
        preTge = controller.preTgeSale();
        
        preTge.setNowTime(preTge.startTime() + 1 seconds);               
        preTge.invest.value(amountToInvestPreTge)();

        preTge.setNowTime(preTge.endTime() + 1 seconds);
        controller.finalizePretge();
    }
}

contract PrepareCrowdsaleTgeFinished is PrepareCrowdsalePreTgeFinished {
    function PrepareCrowdsaleTgeFinished() {}

    function beforeAllTge() {
        controller.createTge(0, tgeDurationHours);
        tge = controller.tgeSale();
        tge.invest.value(amountToInvestTge)();
        uint time1 = tge.endTime() + 1 seconds;
        tge.setNowTime(time1);        
        wallet.setNowTime(time1);     
    }
}