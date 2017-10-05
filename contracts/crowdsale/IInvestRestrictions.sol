pragma solidity ^0.4.10;

import '../common/Manageable.sol';

/** @dev Restrictions on investment */
contract IInvestRestrictions is Manageable {
    /**@dev Returns true if investmet is allowed */
    function canInvest(address investor, uint amount, uint tokensLeft) constant returns (bool result) {
        investor; amount; result; tokensLeft;
    }

    /**@dev Returns how many tokens are not for sale, investor - the one who tries to invest */
   // function forbiddenTokens(address investor) constant returns(uint256 _tokens) {investor; _tokens;}

    /**@dev Called when investment was made */
    function investHappened(address investor, uint amount) managerOnly {}    
}