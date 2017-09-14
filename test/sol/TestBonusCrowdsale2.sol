pragma solidity ^0.4.10;

import './AddressStorageUser.sol';
import '../contracts/crowdsale/BCSTgeCrowdsale.sol';
import '../contracts/token/BCSToken.sol';
import '../contracts/token/TokenPool.sol';
import '../contracts/crowdsale/FloorInvestRestrictions.sol';

//Tests for crowdsale variable bonus system
//required migrations
//3_helper_deploy.js
contract TestBonusCrowdsale2 is AddressStorageUser {

    uint public initialBalance = 10 ether;

    IInvestRestrictions restrictions;
    BCSTgeCrowdsale crowdsale;
    BCSToken token;
    TokenPool pool;

    uint investAmount;
    uint oldBalance;
    uint oldBalance2;
    uint oldTokens;

    uint8 bonusPct;
    uint256 minInvest;
    uint8 durationHours;
    uint16 tokenSellPct;
    uint8 decimals;
    uint256 tokenCap;
    uint8 tokensForOneEther;
    uint256 tokenSupply;
    uint8 bonusSteps;    

    function TestBonusCrowdsale2() {}

    /* Test for crowdsale with variable bonuses, that decreases as time passes */
    function test1() {
        durationHours = 4;
        tokenSellPct = 70;
        decimals = 2;
        tokenCap = 1000;
        tokensForOneEther = 1;
        bonusSteps = 4;
        bonusPct = 15;
        minInvest = 0;
            
        token = new BCSToken(tokenCap, decimals);
        pool = new TokenPool(token);
        tokenSupply = token.totalSupply();
        token.transfer(pool, tokenSupply * tokenSellPct / 100);

        //transfer all tokens to some other address
        token.transfer(address1, token.balanceOf(this));
        crowdsale = new BCSTgeCrowdsale(pool, IInvestRestrictions(0x0), address2, 0, durationHours, 0, tokensForOneEther, bonusPct, bonusSteps);
        pool.setTrustee(crowdsale, true);

        uint oneStepD = (crowdsale.endTime() - crowdsale.startTime()) / bonusSteps;
        
        Assert.equal(oneStepD, 1 hours, "1");
        Assert.equal(crowdsale.getCurrentBonusPct(), 15, "1 step");

        crowdsale.advanceTime(1 minutes);
        Assert.equal(crowdsale.getCurrentBonusPct(), 15, "Still 1 step");
        crowdsale.invest.value(1 ether)();
        Assert.equal(token.balanceOf(this), 115, "115 tokens");

        crowdsale.advanceTime(oneStepD);
        Assert.equal(crowdsale.getCurrentBonusPct(), 10, "2 step");

        crowdsale.advanceTime(oneStepD);
        crowdsale.advanceTime(25 minutes);
        Assert.equal(crowdsale.getCurrentBonusPct(), 5, "3 step");
        
        //crowdsale.advanceTime(oneStepD);        
        crowdsale.setNowTime(crowdsale.endTime() - 1 minutes);
        Assert.equal(crowdsale.getCurrentBonusPct(), 0, "Last step");

        crowdsale.invest.value(1 ether)();
        Assert.equal(token.balanceOf(this), 215, "215 tokens");

    }
}