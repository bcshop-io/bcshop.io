pragma solidity ^0.4.10;

import './AddressStorageUser.sol';
import '../contracts/crowdsale/BCSCrowdsale.sol';
import '../contracts/crowdsale/FloorInvestRestrictions.sol';
import '../contracts/token/BCSToken.sol';
import '../contracts/token/TokenPool.sol';

//Tests for crowdsale bonus system
//required migrations
//3_helper_deploy.js
contract TestBonusCrowdsale is AddressStorageUser {
    uint public initialBalance = 14 ether;

    IInvestRestrictions restrictions;
    BCSCrowdsale crowdsale;
    BCSToken token;
    TokenPool pool;

    uint investAmount;
    uint oldBalance;
    uint oldBalance2;
    uint oldTokens;

    uint8 bonusPct;
    uint256 minInvest;

    uint8 DURATION_HOURS;
    uint16 TOKEN_SELL_PCT;
    uint8  DECIMALS;
    uint256 TOKEN_CAP;
    uint8 TOKENS_FOR_ONE_ETHER;
    uint256 tokenSupply;

    function TestBonusCrowdsale() {

    }

    function beforeEach() {
    }

    //
    // Only one of the tests works at a time, due to gas amount restrictions
    //

    /* Test crowdsale with large token decimals 
        Scenario:

    */
    function test1() {
        DURATION_HOURS = 1;
        TOKEN_SELL_PCT = 70;
        DECIMALS = 18;
        TOKEN_CAP = 1;
        TOKENS_FOR_ONE_ETHER = 10;
            
        token = new BCSToken(TOKEN_CAP, DECIMALS);
        pool = new TokenPool(token);
        tokenSupply = token.totalSupply();
        token.transfer(pool, tokenSupply * TOKEN_SELL_PCT / 100);

        //transfer all tokens to some other address
        token.transfer(address1, token.balanceOf(this));

        bonusPct = 10;
        minInvest = 10000 wei;
        restrictions = new FloorInvestRestrictions(minInvest);
        crowdsale = new BCSCrowdsale(pool, restrictions, address2, 0, DURATION_HOURS, 0, TOKENS_FOR_ONE_ETHER, bonusPct);
        restrictions.setManager(crowdsale, true);

        pool.setTrustee(crowdsale, true);

        investAmount = 20000 wei;
        oldBalance = this.balance;
        oldTokens = token.balanceOf(this);
        
        var (tokens, excess) = crowdsale.howManyTokensForEther(investAmount);
        Assert.equal(tokens, 200000 + 20000, "1");
        Assert.equal(excess, 0, "1.1");
        Assert.isTrue(!restrictions.canInvest(this, minInvest / 2), "1.2");

       // crowdsale.invest.value(minInvest / 2)(); //should throw
        crowdsale.invest.value(investAmount)();
        Assert.equal(this.balance, oldBalance - investAmount, "2");
        Assert.equal(crowdsale.balance, investAmount, "2");
        Assert.equal(token.balanceOf(this), oldTokens + tokens, "3");

        oldTokens = token.balanceOf(this);
        (tokens, excess) = crowdsale.howManyTokensForEther(minInvest / 2);
        
        crowdsale.invest.value(minInvest / 2)();        
        Assert.equal(token.balanceOf(this), oldTokens + tokens, "4");
        
        uint investAmount2 = 1 ether / 10 - crowdsale.weiCollected();
        crowdsale.invest.value(investAmount2)();
        Assert.equal(token.balanceOf(pool), 1, "4.2");

        pool.returnTokensTo(this);
        Assert.equal(token.balanceOf(pool), 0, "5.1");
        Assert.equal(token.balanceOf(this), 1 ether * 7 / 10, "5.2");        
    }

    /*Test crowdsale with zero token decimals 
        Scenario:
        11 Tokens are being sold with 10% bonus. Each token costs 1 ether. 
        Buyer pays 11 ether. It should receive 10 tokens and 1 bonus.
        Also contract keeps 1 ether as an overpay to withdraw later */
    // function test2() {
    //     DURATION_HOURS = 1;
    //     TOKEN_SELL_PCT = 100;
    //     DECIMALS = 0;
    //     TOKEN_CAP = 11;
    //     TOKENS_FOR_ONE_ETHER = 1;
            
    //     token = new BCSToken(TOKEN_CAP, DECIMALS);
    //     pool = new TokenPool(token);
    //     tokenSupply = token.totalSupply();
    //     token.transfer(pool, tokenSupply);

    //     //transfer all tokens to some other address
    //     token.transfer(address1, token.balanceOf(this));

    //     bonusPct = 10;        

    //     crowdsale = new BCSCrowdsale(pool, IInvestRestrictions(0x0), address2, 0, DURATION_HOURS, 0, TOKENS_FOR_ONE_ETHER, bonusPct);
    //     pool.setTrustee(crowdsale, true);

    //     investAmount = 11 ether;
    //     oldBalance = this.balance;
    //     oldBalance2 = address2.balance;
    //     oldTokens = token.balanceOf(this);
                        
    //     var (tokens, excess) = crowdsale.howManyTokensForEther(investAmount);
    //     Assert.equal(tokens, 11, "1");
    //     Assert.equal(excess, 1 ether, "1.1");

    //     crowdsale.invest.value(investAmount)();
        
    //     Assert.equal(this.balance, oldBalance - investAmount, "2");        
    //     Assert.equal(token.balanceOf(this), oldTokens + tokens, "3");
    //     Assert.equal(crowdsale.overpays(this), excess, "3.1");
    //     Assert.equal(uint(crowdsale.getState()), 3, "4");

    //     crowdsale.withdrawOverpay();
    //     crowdsale.transferToBeneficiary();

    //     Assert.equal(this.balance, oldBalance - investAmount + excess, "5");
    //     Assert.equal(address2.balance, oldBalance2 + investAmount - excess, "6");
    //     Assert.equal(crowdsale.balance, 0, "7");
    //     Assert.equal(token.balanceOf(pool), 0, "8");
    // }

    function () payable {}
}