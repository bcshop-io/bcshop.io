pragma solidity ^0.4.10;

import './AddressStorageUser.sol';
import '../contracts/crowdsale/BCSCrowdsale.sol';
import '../contracts/crowdsale/ParticipantInvestRestrictions.sol';
import '../contracts/token/BCSToken.sol';
import '../contracts/token/TokenPool.sol';

contract TestRestrictions is AddressStorageUser {
        
    uint public initialBalance = 10 ether;

    BCSCrowdsale crowdsale1;
    BCSCrowdsale crowdsale2;
    TokenPool pool;
    ParticipantInvestRestrictions restrictions;
    BCSToken token;
    uint tokenCap = 1000;
    uint tokensForOneEther = 200;

    function TestRestrictions() {}

    function() payable {}

    function beforeEach() {
        token = new BCSToken(tokenCap, 0);
        pool = new TokenPool(token);
        token.transfer(pool, token.totalSupply());                    
    }

    // function testCommonPool() {

    //     restrictions = ParticipantInvestRestrictions(0x0);
    //     crowdsale1 = new BCSCrowdsale(pool, restrictions, address1, 0, 1, 0, tokensForOneEther, 0);
    //     crowdsale2 = new BCSCrowdsale(pool, restrictions, address1, 0, 1, 0, tokensForOneEther, 20);

    //     pool.setTrustee(crowdsale1, true);
    //     pool.setTrustee(crowdsale2, true);

    //     Assert.equal(crowdsale1.tokensLeft(), 1000, "Cap tokens");

    //     crowdsale1.invest.value(1 ether)(); //should buy 200 tokens

    //     Assert.equal(crowdsale1.tokensLeft(), 800, "1. Minus 1st invest");
    //     Assert.equal(crowdsale2.tokensLeft(), 800, "2. Minus 1st invest");
        
    //     crowdsale2.invest.value(2 ether)(); //should buy 440 tokens

    //     Assert.equal(crowdsale1.tokensLeft(), 320, "1. Minus 2nd invest");
    //     Assert.equal(crowdsale2.tokensLeft(), 320, "2. Minus 2nd invest");

    //     crowdsale1.invest.value(18 ether / 10)(); //should bay all the rest
        
    //     Assert.equal(token.balanceOf(this), 1000, "All tokens");
    //     Assert.equal(crowdsale2.tokensLeft(), 0, "2. Minus 3rd invest");

    //     //crowdsale1.invest.value(1 ether)(); //should throw
    // }

    /* Test reserve/unreserve particular investor*/
    // function testReserved() {
    //     restrictions = new ParticipantInvestRestrictions(1 ether, 1, 1);
    //     crowdsale1 = new BCSCrowdsale(pool, restrictions, address1, 0, 1, 0, tokensForOneEther, 0);
    //     pool.setTrustee(crowdsale1, true);
    //     restrictions.setManager(crowdsale1, true);

    //     Assert.isTrue(!restrictions.canInvest(this, 1 ether), "1"); //cant invest!       

    //     restrictions.reserveFor(this); //now set address as reserved
    //     Assert.isTrue(restrictions.canInvest(this, 1 ether), "2.1"); //can invest!
    //     Assert.isTrue(!restrictions.canInvest(this, 1 ether - 1 finney), "2.11"); //cant invest. low amount!

    //     restrictions.unreserveFor(this); //now set address as unreserved
    //     Assert.isTrue(!restrictions.canInvest(this, 1 ether), "2.2"); //cant invest!        

    //     restrictions.reserveFor(this); //now set address as reserved
    //     Assert.isTrue(restrictions.canInvest(this, 1 ether), "2.3"); //can invest!

    //     crowdsale1.invest.value(1 ether)(); //should buy 200 tokens
    //     Assert.equal(token.balanceOf(this), 200, "3");

    //     Assert.isTrue(restrictions.canInvest(this, 1 ether - 1 finney), "3.1"); //now can invest any amount
    //     //restrictions.unreserveFor(this); //now can't unreserve, should throw

    //     Assert.isTrue(!restrictions.canInvest(address1, 1 ether), "4"); //address1 cant invest, it is not reserved

    //     //restrictions.reserveFor(address1); //should throw, no more reserved places
    // }

    //Test crowdsale with no reserve addresses
    function testNoReserved() {
        restrictions = new ParticipantInvestRestrictions(1 ether, 1, 0);
        crowdsale1 = new BCSCrowdsale(pool, restrictions, address1, 0, 1, 0, tokensForOneEther, 0);
        pool.setTrustee(crowdsale1, true);
        restrictions.setManager(crowdsale1, true);
        
        Assert.isTrue(restrictions.canInvest(this, 1 ether), "1.1"); //can invest
        Assert.isTrue(!restrictions.canInvest(this, 1 ether - 1 finney), "1.11"); //cant invest low amount!
        Assert.isTrue(restrictions.canInvest(address1, 1 ether), "1.2"); // can invest
                
        //restrictions.reserveFor(this); //should throw

        crowdsale1.invest.value(1 ether)(); //should buy 200 tokens
        Assert.equal(token.balanceOf(this), 200, "2");        

        Assert.isTrue(!restrictions.canInvest(address1, 1 ether), "3"); //address1 cant invest, it is not reserved
        Assert.isTrue(restrictions.canInvest(this, 1 ether / 10), "3.1"); //now can invest low amount!
        
        crowdsale1.invest.value(1 ether / 10)(); //should buy 20 tokens
        Assert.equal(token.balanceOf(this), 220, "4");
    }
}
