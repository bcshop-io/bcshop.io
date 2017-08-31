pragma solidity ^0.4.10;

import '../common/Manageable.sol';
import '../token/ReturnableToken.sol';

///Returnable tokens receiver
contract ReturnTokenAgent is Manageable {

    ReturnableToken public returnableToken;

    /**@dev Allows only token to execute method */
    modifier returnableTokenOnly {require(msg.sender == address(returnableToken)); _;}

    /**@dev Executes when tokens are transferred to this */
    function returnToken(address from, uint256 amountReturned);

    /**@dev Sets token that can call returnToken method */
    function setReturnableToken(ReturnableToken token) {
        returnableToken = token;
    }
}