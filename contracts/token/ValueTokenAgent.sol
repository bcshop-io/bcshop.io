pragma solidity ^0.4.10;

import '../common/Manageable.sol';

/**@dev Watches transfer operation of tokens to validate value-distribution state */
contract ValueTokenAgent is Manageable {
    /**@dev Called just before the token balance update*/   
    function tokenIsBeingTransferred(address from, address to, uint256 amount);

    /**@dev Called when non-transfer token state change occurs: burn, issue, change of valuable tokens.
    holder - address of token holder that committed the change
    amount - amount of new or deleted tokens  */
    function tokenChanged(address holder, uint256 amount);
}