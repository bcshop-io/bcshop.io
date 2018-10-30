pragma solidity ^0.4.24;

import "./Manageable.sol";
import "./ICheckList.sol";

/**@dev Simple map address=>bool. Sometimes it is convenient or even 
 necessary to store the mapping outside of any other contract */
contract CheckList is Manageable, ICheckList {

    mapping (address=>bool) public contains;

    constructor() public {
    }

    function set(address addr, bool state) public managerOnly {
        contains[addr] = state;
    }

    function setArray(address[] addresses, bool state) public managerOnly {
        for(uint256 i = 0; i < addresses.length; ++i) {
            contains[addresses[i]] = state;
        }
    }
}