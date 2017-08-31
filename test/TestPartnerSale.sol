pragma solidity ^0.4.10;

import './AddressStorageUser.sol';
import '../contracts/crowdsale/BCSPartnerCrowdsale.sol';
import '../contracts/token/BCSToken.sol';
import '../contracts/token/TokenPool.sol';
//import '../contracts/crowdsale/IInvestRestrictions.sol';

contract TestPartnerSale is AddressStorageUser {
        
    uint public initialBalance = 10 ether;

    BCSPartnerCrowdsale crowdsale;
    TokenPool pool;    
    BCSToken token;

    function TestPartnerSale() {}

    function beforeAll() {
        token = new BCSToken(10000, 0);
        pool = new TokenPool(token);
        token.transfer(pool, token.totalSupply());
        //80% of raised ether goes to address1, 20% - to address2
        crowdsale = new BCSPartnerCrowdsale(pool, IInvestRestrictions(0x0), address1, 0, 1, 0, 100, 0, address2, 200);
        pool.setTrustee(crowdsale, true);        
    }

    function test1() {
        Assert.equal(crowdsale.partner(), address2, "1");

        uint oldBalance1 = crowdsale.beneficiary().balance;
        uint oldBalance2 = crowdsale.partner().balance;

        crowdsale.invest.value(1 ether)();
        crowdsale.invest.value(2 ether)();

        crowdsale.advanceTime(2 hours);

        Assert.equal(uint(crowdsale.getState()), 3, "State");
        Assert.equal(crowdsale.weiCollected(), 3 ether, "Collected");
        
        crowdsale.transferToBeneficiary();
        crowdsale.transferToPartner();

        Assert.equal(crowdsale.beneficiary().balance, oldBalance1 + 3 ether * 80 / 100, "Beneficiary");
        Assert.equal(crowdsale.partner().balance, oldBalance2 + 3 ether * 20 / 100, "Partner");
    }
}