pragma solidity ^0.4.10;

import '../contracts/token/DividendWalletFloating.sol';
import '../contracts/token/BCSToken.sol';
import './AddressStorageUser.sol';

//These are tests for floating supply dividend wallet that change token's totalSupply
//required migrations
//3_helper_deploy.js
contract TestDividendWalletFl2 is AddressStorageUser {

    uint multiplier = 10**18;

    uint public initialBalance = 1000000 wei;

    uint tranche1 = 20000 wei;
    uint tranche2 = 30000 wei;
    uint256 tokensToBurn = 2000000;
    uint256 tokens1 = 1000000;
    uint256 tokens2 = 2000000;
    
    uint256 tokensLeft;

    BCSToken token;
    DividendWalletFloating wallet;

    uint constant TOKEN_CAP = 10000000;
    
    function TestDividendWalletFl2() { }

    function () payable {}

    function beforeAllInit() {
    }

    function beforeEach() {
        token = new BCSToken(TOKEN_CAP);    
        wallet = new DividendWalletFloating(token);
        token.setValueAgent(wallet);        

        //transfer tokens before send ether, so address1 could claim something
        token.transfer(address1, tokens1); 
        token.transfer(address2, tokens2);    
        tokensLeft = token.balanceOf(this);                
    }

    /* Scenario:
       Wallet gets some ether. Address1 withdraws part of its share. Then some tokens are burnt.
       The remaining share for Address1 should remain unchanged 
       Wallet gets more ether. Now Address1 share should account for new tranche with modified supply*/
    function test1() {
        wallet.transfer(tranche1);
        uint256 oldBalance = address1.balance;
        uint256 c1 = wallet.etherBalanceOf(address1);

        Assert.equal(c1, tranche1 * tokens1 / token.getValuableTokenAmount(), "Invalid claimable ether");
        uint256 withdraw = c1 / 4;
        wallet.withdrawFor(address1, withdraw);
        Assert.equal(address1.balance, oldBalance + withdraw, "Invalid balance after withdraw");

        token.burn(tokensToBurn);
        Assert.equal(token.getValuableTokenAmount(), TOKEN_CAP - tokensToBurn, "Invalid tokens after burn");

        uint256 c2 = wallet.etherBalanceOf(address1);
        Assert.equal(c2, c1 - withdraw, "Should remain the same amount to withdraw");

        wallet.transfer(tranche2);
        uint c3 = wallet.etherBalanceOf(address1);
        Assert.equal(
            c3, 
            c2 + tranche2 * token.balanceOf(address1) * multiplier / (token.getValuableTokenAmount() * multiplier), 
            "Invalid claimable ether 1 after tranche2");

        //multiply all addends on big number to eliminate rounding errors
        Assert.equal(
            wallet.etherBalanceOf(address2), 
            (tranche1 * multiplier / TOKEN_CAP + tranche2 * multiplier / token.getValuableTokenAmount()) * token.balanceOf(address2) / multiplier,
            "Invalid address2 balance after tranche2");
    }

    /* Scenario:
       */
    function test2() {

        wallet.transfer(tranche1);

        uint256 withdraw1 = wallet.etherBalanceOf(address1) / 2;
        wallet.withdrawFor(address1, withdraw1);

        //Assert.equal(wallet.etherBalanceOf(address1), 1000 wei, "1");

        token.transfer(address1, tokens1);
        wallet.send(tranche2);

        //Assert.equal(wallet.etherBalanceOf(address1), 7000 wei, "2");

        token.burn(tokensToBurn);
        wallet.transfer(tranche2);

        Assert.equal(wallet.balance, tranche1 + tranche2 + tranche2 - withdraw1, "Invalid wallet balance");        

        Assert.equal(
              wallet.etherBalanceOf(address1), 
              tranche1 * tokens1 / TOKEN_CAP - withdraw1 + tranche2 * (tokens1 + tokens1) / TOKEN_CAP + tranche2 * (tokens1 + tokens1) / (TOKEN_CAP - tokensToBurn), 
              "Invalid claimable ether after transfer and burn");
    }
}