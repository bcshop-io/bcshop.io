pragma solidity ^0.4.10;

import '../contracts/token/DividendWalletFloating.sol';
import '../contracts/token/BCSToken.sol';
import './AddressStorageUser.sol';

//These are common tests for floating supply dividend wallet
//required migrations
//3_helper_deploy.js
contract TestDividendWalletFl is AddressStorageUser {

    uint public initialBalance = 10 ether;

    uint public tranche1 = 2 ether;
    uint public tranche2 = 3 ether;

    uint256 public tokens1 = 100;
    uint256 public tokens2 = 200;
    uint256 public tokens3 = 300;
    uint256 public tokens4 = 400;
    uint256 public tokensLeft;

    ValueToken token;
    DividendWalletFloating wallet;

    uint public constant TOKEN_CAP = 1000;
    uint8 DECIMALS = 0;
    
    function TestDividendWalletFl() {}

    function () payable {}

    function beforeAllInit() {
    }

    function beforeEach() {
        token = new BCSToken(TOKEN_CAP, DECIMALS);    
        wallet = new DividendWalletFloating(token);
        token.setValueAgent(wallet);

        Assert.equal(address(wallet.valueToken()), address(token), "Invalid value token in wallet");
        Assert.equal(token.getValuableTokenAmount(), token.totalSupply(), "Invalid valuable amount");

        //transfer tokens before send ether, so address1 could claim something
        token.transfer(address1, tokens1); 
        token.transfer(address2, tokens1);
        token.transfer(address3, tokens3);        
        tokensLeft = token.balanceOf(this);        

        Assert.equal(token.balanceOf(address1), tokens1, "Invalid address1 token balance");
    }

    /* Scenario: 
    *   Wallet gets ether. This contract withdraws its share then transfers all tokens to address1. 
    *   Check for claimable ether for address1. It should remain unaffected by token transfer 
    *   Address1 withdraws its share. Addresses 2 and 3 do the same. Wallet is empty now. */ 
    function test1() {
        
        wallet.transfer(tranche1);
        Assert.equal(wallet.balance, tranche1, "1");

        uint256 total = token.getValuableTokenAmount();
        uint256 oldBalance1 = address1.balance;
        uint256 oldBalanceW = wallet.balance;
        uint256 oldBalanceThis = this.balance;

        uint256 c1 = wallet.etherBalanceOf(address1);
        uint256 c2 = wallet.etherBalanceOf(address2);
        uint256 cthis = wallet.etherBalanceOf(this);

        Assert.equal(total, token.totalSupply(), "2");
        Assert.equal(c1, oldBalanceW * tokens1 / total, "3");
        Assert.equal(c1, c2, "4");
        Assert.equal(cthis, oldBalanceW * tokensLeft / total, "5");
 
        uint256 withdraw1 = cthis;
        //wallet.withdraw(withdraw1);
        wallet.withdrawAll();
        Assert.equal(this.balance, oldBalanceThis + withdraw1, "6");
        Assert.equal(wallet.balance, oldBalanceW - withdraw1, "7");

        //try transfer tokens and check claimable ether for both addresses again to exploit
        token.transfer(address1, token.balanceOf(this) / 2);
        //uint256 exploitableBalance = wallet.balance * token.balanceOf(address1) / total;
        //uint256 withdraw2 = c1;
        Assert.equal(wallet.etherBalanceOf(this), 0, "8");
        Assert.equal(wallet.etherBalanceOf(address1), c1, "9");
 
        wallet.withdrawFor(address1, c1);
        Assert.equal(wallet.etherBalanceOf(address1), 0, "a");
        Assert.equal(address1.balance, oldBalance1 + c1, "b");

        //make withdraw for address2 and address3 to empty the wallet
        wallet.withdrawFor(address2, wallet.etherBalanceOf(address2));
        wallet.withdrawFor(address3, wallet.etherBalanceOf(address3));

        Assert.equal(wallet.balance, 0, "c");
    }

    // /* Scenario:
    // *   Wallet gets ether. This contract withdraws its share. Address1 withdraws half. 
    // *   Wallet gets more ether. This contract and addresses 1, 2, 3 withdraw their share.
    // *   Wallet is empty now  */
    // function test2() {
    //     wallet.transfer(tranche1);
    
    //     uint256 total = token.getValuableTokenAmount();
    //     uint256 c1 = wallet.etherBalanceOf(address1);        
    //     uint256 cthis = wallet.etherBalanceOf(this);
    //     uint oldBalance1 = address1.balance;
    //     uint oldBalance2 = address2.balance;
    //     uint oldBalanceT = this.balance;

    //     wallet.withdraw(cthis);
    //     wallet.withdrawFor(address1, c1 / 2);

    //     Assert.equal(wallet.etherBalanceOf(address1), c1 / 2, "1");
    //     Assert.equal(address1.balance, oldBalance1 + c1 / 2, "2");
    //     Assert.equal(this.balance, oldBalanceT + tranche1 * token.balanceOf(this) / total, "3");

    //     wallet.transfer(tranche2);
    //     c1 = wallet.etherBalanceOf(address1);
    //     cthis = wallet.etherBalanceOf(this);

    //     //for address1 there should be [(half of the first tranche plus tranche2) * share]
    //     Assert.equal(c1, (tranche1 / 2 + tranche2) * token.balanceOf(address1) / total, 
    //                 "4");
    //     //for 'this' there should be only tranche2 * share
    //     Assert.equal(cthis, tranche2 * token.balanceOf(this) / total, "5");        

    //     wallet.withdraw(cthis);
    //     wallet.withdrawFor(address1, c1);

    //     //there should left enough for address2 and address3 shares
    //     Assert.equal(wallet.balance, (tranche1 + tranche2) * (token.balanceOf(address2) + token.balanceOf(address3)) / total, 
    //                 "6");

    //     wallet.withdrawFor(address2, wallet.etherBalanceOf(address2));
    //     wallet.withdrawFor(address3, wallet.etherBalanceOf(address3));
        
    //     Assert.equal(wallet.balance, 0, "7");
    //     Assert.equal(address2.balance, oldBalance2 + (tranche1 + tranche2) * (token.balanceOf(address2)) / total, 
    //                 "8");
    // }

    /* Scenario:
    *   Wallet gets ether. This contract withdraws a part of its share and transfers all tokens to address1. 
    *   Then it attempts to withdraw the remaining part and should succeed. 
    *   Wallet gets more ether. Then the share should account for both tranches */
    // function test3() {
    //     wallet.transfer(tranche1);

    //     uint oldBalance = this.balance;
    //     uint cthis = wallet.etherBalanceOf(this);
    //     uint c1 = wallet.etherBalanceOf(address1);

    //     //withdraw part
    //     wallet.withdraw(cthis / 4);

    //     //transfer all tokens
    //     token.transfer(address1, token.balanceOf(this));
    //     Assert.equal(wallet.etherBalanceOf(this), cthis * 3 / 4, "We should still be able to withdraw 3/4");        

    //     //still can withdraw!
    //     wallet.withdraw(wallet.etherBalanceOf(this));
    //     Assert.equal(this.balance, oldBalance + cthis, "Invalid ether balance after withdrawal");

    //     //new tranche, address1 can withdraw old share of tranche1 + new share of tranche2
    //     wallet.transfer(tranche2);
    //     Assert.equal(wallet.etherBalanceOf(address1), c1 + tranche2 * token.balanceOf(address1) / token.getValuableTokenAmount(), 
    //                 "Invalid claimable ether for address1");
        
    //     Assert.equal(wallet.etherBalanceOf(this), 0, "Now 'this' can't withdraw as it has no tokens");
    // }
}
