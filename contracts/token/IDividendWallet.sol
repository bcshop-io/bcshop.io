pragma solidity ^0.4.10;

/**@dev Wallet that distributes its balance according to some rules */
contract IDividendWallet {
    function() payable;

     /**@dev Withdraw an amount of the sender's ether balance */
    function withdraw(uint _value) returns (bool);

    /**@dev Withdraw on behalf of a balance holder */
    function withdrawFor(address _addr, uint _value) returns (bool);

    /**@dev Account specific ethereum balance getter */
    function etherBalanceOf(address _addr) constant returns (uint);
}