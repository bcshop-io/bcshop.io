pragma solidity ^0.4.10;

import '../contracts/token/DividendWalletFloating.sol';
import '../contracts/token/BCSToken.sol';
import './AddressStorageUser.sol';

//These are tests for floating supply token that supports reserved accounts
//required migrations
//3_helper_deploy.js
contract TestReservedTokens is AddressStorageUser {

    BCSToken token;
    DividendWalletFloating wallet;

    uint public initialBalance = 10000000 wei;

    uint tranche1 = 20000 wei;
    uint tranche2 = 30000 wei;
    uint tranche3 = 30000 wei;
    uint256 tokensToBurn = 2000;
    uint256 tokens1 = 1000;
    uint256 tokens2 = 2000;
    uint256 tokensR = 2000;
    uint256 tokensLeft;

    uint constant TOKEN_CAP = 10000;

    function TestReservedTokens() {}

    function beforeEach() {
        token = new BCSToken(TOKEN_CAP);
        wallet = new DividendWalletFloating(token);
        token.setValueAgent(wallet);        
        
        token.transfer(address1, tokens1); 
        token.transfer(address2, tokens2);            
        tokensLeft = TOKEN_CAP - tokens1 - tokens2;
    }

    /* Scenario:
        Transfer tokens to address3. 
        Wallet gets ether. 
        Set Address3 to be reserved. Check valuableAmount
        Check Address3 claimable ether, it should be a portion of wallet's balance as token transfer happened 
            before setting reserved. 
        Wallet gets more ether. 
        Set Address3 not to be reserved. Check its claimable ether. It should not change.
        Try to withdraw address3 share and check the balance  */
    function test1() {                
        Assert.equal(token.getValuableTokenAmount(), TOKEN_CAP, "Invalid initial valuable tokens");

        token.transfer(address3, tokensR);
        wallet.transfer(tranche1);
        
        token.setReserved(address3, true);
        Assert.equal(token.getValuableTokenAmount(), TOKEN_CAP - tokensR, "Invalid valuable tokens");

        uint eb31 = wallet.etherBalanceOf(address3);
        Assert.equal(eb31, tranche1 * tokensR / TOKEN_CAP, "Invalid claimable ether after tranche 1");        

        //wallet.withdrawFor(address3, eb31 / 2); //should throw 'invalid opcode'

        wallet.transfer(tranche2);
        token.setReserved(address3, false);
        
        Assert.equal(wallet.etherBalanceOf(address3), eb31, "Invalid claimable ether after tranche 2");           

        uint oldBalance3 = address3.balance;
        wallet.withdrawFor(address3, eb31); 
        Assert.equal(address3.balance, oldBalance3 + eb31, "Invalid balance after withdrawal");        
    }

    /* Scenario:
       Wallet gets ether. 
       Address3 becomes reserved. Check valuable tokens. Check Address1 claimable ether
       Tokens are transferred to Address3. Check valuable tokens. Check Address1 claimable ether
       Wallet gets more ether. Check Address1 claimable ether
       Address3 stops being reserved. Check valuable tokens. Check Address1 claimable ether
       Check Address3 claimable ether. It should be 0.
       More otkens are transferred to Address1. 
       Wallet gets more ether. Check Address1 claimable ether */
    function test2() {
        
        wallet.transfer(tranche1);     
        token.setReserved(address3, true);
        

        Assert.equal(token.getValuableTokenAmount(), TOKEN_CAP, "Invalid initial valuable tokens");
        uint eb1 = wallet.etherBalanceOf(address1);
        Assert.equal(eb1, tokens1 * tranche1 / TOKEN_CAP, "Invalid address1 claimable ether 1");

        token.transfer(address3, tokensR);
        Assert.equal(token.getValuableTokenAmount(), TOKEN_CAP - tokensR, "Invalid valuable tokens");
        Assert.equal(wallet.etherBalanceOf(address1), eb1, "Address1 claimable ether should not be changed 1");

        wallet.transfer(tranche2);
        uint eb2 = wallet.etherBalanceOf(address1);
        Assert.equal(eb2, eb1 + tranche2 * tokens1 / (TOKEN_CAP - tokensR), 
                    "Invalid address1 claimable ether after tranche 2");
        token.setReserved(address3, false);

        Assert.equal(wallet.etherBalanceOf(address1), eb2, "Address1 claimable ether should not be changed 2");
        Assert.equal(token.getValuableTokenAmount(), TOKEN_CAP, "Invalid valuable tokens after no reserve");

        uint eb = wallet.etherBalanceOf(address3);
        Assert.equal(eb, 0, "Invalid address3 claimable ether");        

        token.transfer(address1, tokens1);
        wallet.transfer(tranche3);
        Assert.equal(wallet.etherBalanceOf(address1), eb2 + tranche3 * tokens1 * 2 / TOKEN_CAP, 
                    "Invalid address1 claimable ether after tranche 3");
    }

    /* Scenario.
        Testing multiple consecutive operations of token and ether transfers to reserved address */        
    function test3() {
        token.setReserved(address3, true);
        
        token.transfer(address3, tokensR);
        token.transfer(address3, tokensR);

        wallet.transfer(tranche1);

        uint eb1 = wallet.etherBalanceOf(address1);
        Assert.equal(eb1, tokens1 * tranche1 / (TOKEN_CAP - tokensR * 2), "Invalid claimable ether 1");

        wallet.transfer(tranche2);
        uint eb2 = wallet.etherBalanceOf(address1);
        Assert.equal(eb2, eb1 + tokens1 * tranche2 / (TOKEN_CAP - tokensR * 2), "Invalid claimable ether 2");

        token.transfer(address3, tokensR);
        token.transfer(address1, tokens1 / 2);
        Assert.equal(wallet.etherBalanceOf(address1), eb2, "Invalid claimable ether 3");        

        wallet.transfer(tranche3);
        token.transfer(address1, tokens1 / 2);

        uint eb3 = wallet.etherBalanceOf(address1);
        Assert.equal(eb3, eb2 + (tokens1 + tokens1 / 2) * tranche3 / (TOKEN_CAP - tokensR * 3), "Invalid claimable ether 4");

        //now set reserved to false
        token.setReserved(address3, false);
        wallet.transfer(tranche1);
        Assert.equal(token.balanceOf(address1), tokens1 * 2, "Invalid tokens");
        Assert.equal(
            wallet.etherBalanceOf(address1),
            eb3 + tranche1 * tokens1 * 2 / TOKEN_CAP,
            "Invalid claimable ether 5");

        Assert.equal(wallet.etherBalanceOf(address3), tranche1 * token.balanceOf(address3) / TOKEN_CAP, "Invalid address3 claimable ether");
    }
}