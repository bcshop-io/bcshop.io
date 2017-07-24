pragma solidity ^0.4.10;

import '../common/Owned.sol';
import './ERC20StandardToken.sol';

/**@dev bcshop.io crowdsale token */
contract BCSToken is ERC20StandardToken, Owned {

    string public constant name = 'BCSHOP TOKEN 1.0';
    string public constant symbol = '';
    uint256 public constant decimals = 0;
    
    //specifies timestamp when specific token holder can transfer funds
    mapping (address => uint256) public transferLockUntil; 

    event Burn(address sender, uint256 value);

    function BCSToken(uint _initialSupply) {       
        tokensIssued = _initialSupply;
        //store all tokens at the owner's address;
        balances[msg.sender] = tokensIssued;
    }

    function transfer(address _to, uint256 _value) returns (bool success) {
        require(canTransfer(msg.sender));
        return super.transfer(_to, _value);
    }

    function transferFrom(address _from, address _to, uint256 _value) returns (bool success) {
        require(canTransfer(_from));
        return super.transferFrom(_from, _to, _value);
    }

    function canTransfer(address _sender) constant returns (bool){
        return now > transferLockUntil[_sender];
    }

    function lockTransferFor(address holder, uint256 daysFromNow) ownerOnly {
        transferLockUntil[holder] = daysFromNow * 1 days + now;
    }
    
    function burn(uint256 _value) returns (bool success) {
        require (balances[msg.sender] >= _value);            // Check if the sender has enough
        balances[msg.sender] -= _value;                      // Subtract from the sender
        tokensIssued -= _value;                              // Updates totalSupply
        Burn(msg.sender, _value);
        return true;
    }

}