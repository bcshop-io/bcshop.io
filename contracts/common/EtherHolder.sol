pragma solidity ^0.4.24;

import "../common/Manageable.sol";

/**@dev Contract that can hold and receive Ether and transfer it to anybody */
contract EtherHolder is Manageable {
    
    //
    // Methods

    constructor() public {
    } 

    /**@dev withdraws amount of ether to specific adddress */
    function withdrawEtherTo(uint256 amount, address to) public managerOnly {
        to.transfer(amount);
    }

    function() public payable {}
}