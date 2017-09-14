pragma solidity ^0.4.10;

import '../common/Manageable.sol';

/** @dev Restrictions on investment */
contract IInvestRestrictions is Manageable {
    /**@dev Returns true if investmet is allowed */
    function canInvest(address investor, uint amount) constant returns (bool result) {investor; amount; result;}

    /**@dev Called when investment was made */
    function investHappened(address investor, uint amount) managerOnly {}
}