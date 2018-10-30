pragma solidity ^0.4.24;

/**@dev Interface to BonusTokenFund operations */
contract IBonusTokenFund {

    /**@dev Allows to send ether to specified address*/
    function allowCompensationFor(address to) public;
}

