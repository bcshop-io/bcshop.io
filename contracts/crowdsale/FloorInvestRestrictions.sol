pragma solidity ^0.4.10;

import './IInvestRestrictions.sol';

/**@dev Allows only investments with large enough amount only  */
contract FloorInvestRestrictions is IInvestRestrictions {

    /**@dev The smallest acceptible ether amount */
    uint256 public floor;

    /**@dev True if address already invested */
    mapping (address => bool) public investors;


    function FloorInvestRestrictions(uint256 _floor) {
        floor = _floor;
    }

    /** IInvestRestrictions implementation */
    function canInvest(address investor, uint amount, uint tokensLeft) constant returns (bool result) {
        
        //allow investment if it isn't the first one 
        if (investors[investor]) {
            result = true;
        } else {
            //otherwise check the floor
            result = (amount >= floor);
        }
    }

    /** IInvestRestrictions implementation */
    function investHappened(address investor, uint amount) managerOnly {
        investors[investor] = true;
    }
}