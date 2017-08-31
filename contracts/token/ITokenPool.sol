pragma solidity ^0.4.10;

import './ERC20StandardToken.sol';

/**@dev Token pool that manages its tokens by designating trustees */
contract ITokenPool {    

    /**@dev Token to be managed */
    ERC20StandardToken public token;

    /**@dev Changes trustee state */
    function setTrustee(address trustee, bool state);

    /**@dev Returns remaining token amount */
    function getTokenAmount() constant returns (uint256);
}