pragma solidity ^0.4.10;

import '../common/Manageable.sol';
import '../shop/TokenVendor.sol';
import '../token/BCSBonusToken.sol';

contract BCSBonusController is Manageable {

    address beneficiary;
    BCSBonusToken public bonusToken;
    TokenVendor public tokenVendor;

    function BCSBonusController(address _beneficiary) {
        beneficiary = _beneficiary;
    }

    function createTokenAndVendor() managerOnly {
        tokenVendor = new TokenVendor("BONUS", beneficiary, beneficiary, 0);
        bonusToken = new BCSBonusToken();

        bonusToken.setManager(tokenVendor, true);
        tokenVendor.setToken(bonusToken);

        tokenVendor.transferOwnership(msg.sender);
        bonusToken.transferOwnership(msg.sender);
    }
}