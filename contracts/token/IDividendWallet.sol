pragma solidity ^0.4.10;

/**@dev Wallet that distributes its balance according to some rules */
contract IDividendWallet {
    function() payable;

    /**@dev Withdraws all sender's ether balance */
    function withdrawAll() returns (bool);     

    /**@dev Account specific ethereum balance getter */
    // these functions aren't abstract since the compiler emits automatically generated getter functions as external
    function etherBalanceOf(address _addr) constant returns (uint balance) {_addr; balance;}
}