pragma solidity ^0.4.10;

import "truffle/Assert.sol";
import "truffle/DeployedAddresses.sol";
import "../contracts/crowdsale/TrancheWallet.sol";
import "../contracts/helpers/AddressStorage.sol";
import "../contracts/helpers/FakeTime.sol";

contract TestWallet is FakeTime {    

    uint256 public constant TRANCHE_AMOUNT_PCT = 8;
    uint256 public constant TRANCHE_PERIOD_DAYS = 30;
    uint256 public constant FUNDS_COMPLETE_UNLOCK_DAYS = 365;
    
    address public mainAccount;
    address public beneficiary;

    uint public initialBalance = 10 ether;
    uint public walletFunds = 10 ether; 

    TrancheWallet public wallet;

    event LogOneTrancheSize(uint256 size);

    function TestWallet() {
        AddressStorage asr = AddressStorage(DeployedAddresses.AddressStorage());
        mainAccount = asr.address1();
        beneficiary = asr.address1();        
    }

    function testConstructor() {
        wallet = new TrancheWallet(beneficiary, TRANCHE_PERIOD_DAYS, TRANCHE_AMOUNT_PCT);

        Assert.notEqual(address(wallet), 0x0, "wallet should be not 0");
        Assert.equal(wallet.beneficiary(), beneficiary, "Invalid beneficiary");
        Assert.equal(wallet.tranchePeriodInDays(), TRANCHE_PERIOD_DAYS, "Invalid tranche period");
        Assert.equal(wallet.trancheAmountPct(), TRANCHE_AMOUNT_PCT, "Invalid tranche amount");
        Assert.equal(this.balance, initialBalance, "!!!");
    }

    function testSend() {        
        address w = address(wallet);
        bool success = w.send(walletFunds);
        Assert.equal(success, true, "Send operation failed");
        Assert.equal(w.balance, walletFunds, "Invalid amount received");
    }

    function testLock() {
        wallet.lock(FUNDS_COMPLETE_UNLOCK_DAYS);
        Assert.equal(wallet.completeUnlockTime() - wallet.lockStart(), FUNDS_COMPLETE_UNLOCK_DAYS * 1 days, "Invalid complete unlock");
    }

    function testCompleteUnlock() {
        //advance time on 1 period, 2 tranches
        uint nowTime = wallet.getNowTime();
        wallet.setNowTime(FUNDS_COMPLETE_UNLOCK_DAYS * 1 days + 1 seconds + nowTime);
        uint256 amount;
        uint256 tranches;
        (amount, tranches) = wallet.amountAvailableToWithdraw();        
        Assert.equal(tranches, 0, "Invalid tranche: 0");
        Assert.equal(amount, wallet.balance, "Should be equal to wallet balance");

        wallet.setNowTime(nowTime);
    }

    function testTranche() {
        uint256 amount;
        uint256 tranches;
        uint256 oneTranche = wallet.oneTrancheAmount();

        LogOneTrancheSize(oneTranche);

        //one tranche available
        (amount, tranches) = wallet.amountAvailableToWithdraw();        
        Assert.equal(tranches, 1, "Invalid tranche: 1");
        Assert.equal(amount, tranches * oneTranche, "Invalid amount of 1 tranche");

        //advance time on 1 period, 2 tranches
        uint nowTime = wallet.getNowTime();
        wallet.setNowTime(TRANCHE_PERIOD_DAYS * 1 days + 1 seconds + nowTime);

        (amount, tranches) = wallet.amountAvailableToWithdraw();
        Assert.equal(tranches, 2, "Invalid tranche: 2");
        Assert.equal(amount, tranches * oneTranche, "Invalid amount of 2 tranches");

        //advance time on less than 1 period, 2 tranches still
        nowTime = wallet.getNowTime();
        wallet.setNowTime(TRANCHE_PERIOD_DAYS * 1 minutes + nowTime);

        (amount, tranches) = wallet.amountAvailableToWithdraw();
        Assert.equal(tranches, 2, "Invalid tranche: 2");
        Assert.equal(amount, tranches * oneTranche, "Invalid amount of 2 tranches");

        //send available tranches to beneficiary 
        uint oldBalance = wallet.beneficiary().balance;
        wallet.sendToBeneficiary();
        Assert.equal(oldBalance + amount, wallet.beneficiary().balance, "Invalid amount withdrawn");
        Assert.equal(tranches, wallet.tranchesSent(), "Invalid tranchesSent value");

        // now no tranches are available
        (amount, tranches) = wallet.amountAvailableToWithdraw();
        Assert.equal(tranches, 0, "Should be 0 tranches now");
        Assert.equal(amount, 0, "Should be nothing to withdraw now");

        //advance time on less than 1 period, still no tranches
        nowTime = wallet.getNowTime();
        wallet.setNowTime(TRANCHE_PERIOD_DAYS * 1 minutes + nowTime);

        (amount, tranches) = wallet.amountAvailableToWithdraw();
        Assert.equal(tranches, 0, "Should be 0 tranches now");
        Assert.equal(amount, 0, "Should be nothing to withdraw now");

        //advance time on 3 periods, 3 tranches
        nowTime = wallet.getNowTime();
        wallet.setNowTime(3 * TRANCHE_PERIOD_DAYS * 1 days + nowTime);

        (amount, tranches) = wallet.amountAvailableToWithdraw();
        Assert.equal(tranches, 3, "Invalid tranche: 3");
        Assert.equal(amount, tranches * oneTranche, "Invalid amount of 3 tranches");

        //advance time on 7 periods, available tranches are 3 and the rest = 8 total
        nowTime = wallet.getNowTime();
        wallet.setNowTime(7 * TRANCHE_PERIOD_DAYS * 1 days + nowTime);
        (amount, tranches) = wallet.amountAvailableToWithdraw();
        Assert.equal(tranches, 10, "Invalid tranche: 10");
        Assert.equal(amount, tranches * oneTranche, "Invalid amount of 10 tranches");

        //send available tranches to beneficiary 
        oldBalance = wallet.beneficiary().balance;
        wallet.sendToBeneficiary();
        Assert.equal(oldBalance + amount, wallet.beneficiary().balance, "Invalid amount withdrawn");
        Assert.equal(12, wallet.tranchesSent(), "Invalid tranchesSent value");

        // now no tranches are available
        (amount, tranches) = wallet.amountAvailableToWithdraw();
        Assert.equal(tranches, 0, "Should be 0 tranches now");
        Assert.equal(amount, 0, "Should be nothing to withdraw now");

        //advance amount on one period, less than one tranche available
        nowTime = wallet.getNowTime();
        wallet.setNowTime(1 * TRANCHE_PERIOD_DAYS * 1 days + nowTime);
        (amount, tranches) = wallet.amountAvailableToWithdraw();
        Assert.equal(tranches, 0, "Should be 0 tranches now");
        Assert.equal(amount, wallet.balance, "Should be equal to wallet balance");
    }

    function afterAll() {
        mainAccount.transfer(this.balance);
    }
}