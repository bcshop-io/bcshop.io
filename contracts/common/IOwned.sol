pragma solidity ^0.4.24;

/**@dev Simple interface to Owned base class */
contract IOwned {
    function owner() public view returns (address) {}
    function transferOwnership(address _newOwner) public;
}