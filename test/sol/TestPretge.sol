pragma solidity ^0.4.10;

import "truffle/Assert.sol";
import "truffle/DeployedAddresses.sol";
import "../contracts/crowdsale/BCSCrowdsaleController.sol";
import "../contracts/crowdsale/BCSCrowdsale.sol";
import "../contracts/token/BCSToken.sol";
import "../contracts/crowdsale/TrancheWallet.sol";
import "../contracts/helpers/AddressStorage.sol";
import "../contracts/helpers/FakeTime.sol";

contract TestPretge {
    
    uint public initialBalance = 10 ether;
    address public beneficiary;
    address public devTokenHolder;
    address public miscTokenHolder;

    BCSCrowdsaleController controller;
    BCSCrowdsale preTge;
    
    function TestPretge() {
        controller = new BCSCrowdsaleController();
    }

    function beforeAll() {
        AddressStorage asr = AddressStorage(DeployedAddresses.AddressStorage());

        beneficiary = asr.address1();
        devTokenHolder = asr.address1();
        miscTokenHolder = asr.address2();

        controller.initBeneficiaries(beneficiary, devTokenHolder, miscTokenHolder);
    }

    // function testInitBeneficiaries() {
        

    //     //controller = BCSCrowdsaleController(DeployedAddresses.BCSCrowdsaleController());

    //     // Assert.equal(controller.beneficiaryWallet(), 0x0, "Now wallet should be 0");        
    //     // Assert.equal(controller.TOKEN_CAP(), 3000000, "Token cap should be set to 3000000");
    //     // Assert.equal(controller.TOKEN_DEV_RESERVE_PCT(), 20, "Token dev reserve p should be set to 20");
    //     controller.initBeneficiaries(beneficiary, devTokenHolder, miscTokenHolder);
    //     //Assert.notEqual(controller.beneficiaryWallet(), 0x0, "Now wallet should not be 0");        
    // }

    function testBeneficiaryWallet() {
        TrancheWallet tw = TrancheWallet(controller.beneficiaryWallet());
        //Assert.notEqual(tw, 0x0, "Wallet should not be 0");        
        Assert.equal(tw.beneficiary(), beneficiary, "Wallet beneficiary should be equal to beneficiary");
    }

    function testCreateToken() {
        controller.createToken();
        
        //Assert.notEqual(controller.token(), 0x0, "Token should not be 0");
        Assert.equal(controller.token().balanceOf(devTokenHolder), 600000, "Dev tokens should be 600000");
    }

    function testCreatePretge() {
        uint preTgeStartsAt = controller.token().getNowTime() + 2 minutes;
        uint preTgeHours = 4;
        
        controller.createPreTge(preTgeStartsAt, preTgeHours);

        preTge = controller.preTgeSale();        
        //Assert.notEqual(preTge, 0x0, "Pre tge should be created");
        // Assert.equal(controller.tgeSale(), 0x0, "tge shouldn't be created");        
        // Assert.equal(preTgeStartsAt, preTge.startTime(), "Time should match");
        // Assert.equal(uint(preTge.getState()), 1, "State should be BeforeStart (1)");        
        Assert.equal(preTge.startTime() + preTgeHours * 1 hours, preTge.endTime(), "!!");
        Assert.notEqual(controller.token().allowance(controller, preTge), 0, "Should be some tokens fore preTge approval");
    }

    function testSendFundsPreTge() {        
        //first, advance time        
        preTge.setNowTime(preTge.startTime() + 1 seconds);               
        Assert.equal(uint(preTge.getState()), 2, "State should be Active (2)");

        //Assert.equal(this.balance, 0, "Balance should be unchanged so far" );
        preTge.invest.value(1 ether)();
        //Assert.equal(success, true, "Succsesful invest");
        uint tokens = controller.token().balanceOf(this);
        Assert.equal(preTge.balance, 1 ether, "Should be 1 ether on pretge");
        Assert.equal(tokens, 115, "It should have 115 tokens");
    }

    function testEndPretge() {                
        uint funds = preTge.balance;
        preTge.setNowTime(preTge.endTime() + 1 seconds);               
        controller.finalizePretge();
        Assert.equal(controller.beneficiaryWallet().balance, funds, "Funds should be on wallet");        
    }

    // function testPreTgeStateSuccess() {
    //      Assert.equal(uint(preTge.getState()), 3, "State should be Success (3)");        
    // }


    // function setTime(uint256 newTime) {
    //     if(address(controller) != 0x0) {
    //         if(address(controller.beneficiaryWallet()) != 0x0) {
    //             TrancheWallet(controller.beneficiaryWallet()).setNowTime(newTime);
    //         }

    //         if(address(controller.token()) != 0x0) {
    //             controller.token().setNowTime(newTime);
    //         }            

    //         if(address(controller.preTgeSale()) != 0x0) {
    //             controller.preTgeSale().setNowTime(newTime);
    //         }

    //         if(address(controller.tgeSale()) != 0x0) {
    //             controller.tgeSale().setNowTime(newTime);
    //         }
    //     }
    // }

    // function getTime(uint256 newTime) constant returns(uint256) {
    //     if(address(controller) != 0x0) {
    //         if(address(controller.beneficiaryWallet()) != 0x0) {
    //             return TrancheWallet(controller.beneficiaryWallet()).getNowTime();
    //         }

    //         if(address(controller.token()) != 0x0) {
    //             return controller.token().getNowTime();
    //         }            

    //         if(address(controller.preTgeSale()) != 0x0) {
    //             return controller.preTgeSale().getNowTime();
    //         }

    //         if(address(controller.tgeSale()) != 0x0) {
    //             return controller.tgeSale().getNowTime();
    //         }
    //     }
    // }
}