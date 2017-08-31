pragma solidity ^0.4.10;

import '../common/Manageable.sol';
import './ValueToken.sol';
import '../helpers/FakeTime.sol';

/**@dev bcshop.io crowdsale token */
contract BCSToken is ValueToken, FakeTime {
     
    /**@dev Specifies timestamp when specific token holder can transfer funds */
    mapping (address => uint256) public transferLockUntil; 
    /**@dev True if transfer is locked for all holders, false otherwise  */
    bool public transferLocked;

    event Burn(address sender, uint256 value);

    /**@dev Creates a token with given initial supply  */
    function BCSToken(uint256 _initialSupply, uint8 _decimals) {
        name = "BCSHOP TOKEN 1.0";
        symbol = "";
        decimals = _decimals;

        tokensIssued = _initialSupply * (10 ** decimals);
        //store all tokens at the owner's address;
        balances[msg.sender] = tokensIssued;        
    }

    /**@dev ERC20StandatdToken override */
    function doTransfer(address _from, address _to, uint256 _value) internal {
        require(canTransfer(_from));
        super.doTransfer(_from, _to, _value);
    }    

    /**@dev Returns true if given address can transfer tokens */
    function canTransfer(address holder) constant returns (bool) {
        return !transferLocked && now > transferLockUntil[holder];
    }    

    /**@dev Lock transfer for a given holder for a givan amount of days */
    function lockTransferFor(address holder, uint256 daysFromNow) managerOnly {
        transferLockUntil[holder] = daysFromNow * 1 days + now;
    }

    /**@dev Locks or allows transfer for all holders, for emergency reasons*/
    function setLockedState(bool state) managerOnly {
        transferLocked = state;
    }
    
    function burn(uint256 _value) managerOnly {        
        require (balances[msg.sender] >= _value);            // Check if the sender has enough

        if (address(valueAgent) != 0x0) {            
            valueAgent.tokenChanged(msg.sender, _value);
        }

        balances[msg.sender] -= _value;                      // Subtract from the sender
        tokensIssued -= _value;                              // Updates totalSupply        

        Burn(msg.sender, _value);        
    }
}