pragma solidity ^0.4.10;

import './IERC20Token.sol';

/**@dev Standard ERC20 compliant token implementation */
contract ERC20StandardToken is IERC20Token {

    //tokens already issued
    uint256 tokensIssued;
    //balances for each account
    mapping (address => uint256) balances;
    //one account approves the transfer of an amount to another account
    mapping (address => mapping (address => uint256)) allowed;

    function ERC20StandardToken() {
     
    }    

    //
    //IERC20Token implementation
    // 

    function totalSupply() constant returns (uint total) {
        total = tokensIssued;
    }
 
    function balanceOf(address _owner) constant returns (uint balance) {
        balance = balances[_owner];
    }

    function transfer(address _to, uint256 _value) returns (bool success) {
        return transferFromTo(msg.sender, _to, _value);        
    }

    function transferFrom(address _from, address _to, uint256 _value) returns (bool success) {
        if (allowed[_from][msg.sender] >= _value) {
            if (transferFromTo(_from, _to, _value)) {
                allowed[_from][msg.sender] -= _value;
                return true;
            }            
        } 

        return false;        
    }

    function approve(address _spender, uint256 _value) returns (bool success) {
        allowed[msg.sender][_spender] = _value;
        Approval(msg.sender, _spender, _value);
        return true;
    }

    function allowance(address _owner, address _spender) constant returns (uint256 remaining) {
        remaining = allowed[_owner][_spender];
    }    

    //
    // Additional functions
    //
    /**@dev Gets real token amount in the smallest token units */
    function getRealTokenAmount(uint256 tokens) constant returns (uint256) {
        return tokens * (10 ** decimals);
    }

    //
    // Internal functions
    //    
    
    function transferFromTo(address _from, address _to, uint256 _value) internal returns (bool) {
        if (balances[_from] >= _value 
            && _value > 0
            && balances[_to] + _value > balances[_to]) {

            doTransfer(_from, _to, _value);
            Transfer(_from, _to, _value);

            return true;
        } else {
            return false;
        }
    }

    function doTransfer(address _from, address _to, uint256 _value) internal {
        balances[_from] -= _value;
        balances[_to] += _value;
    }
    
}