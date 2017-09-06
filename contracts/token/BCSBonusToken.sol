pragma solidity ^0.4.10;

import './MintableToken.sol';
import './ReturnableToken.sol';

///A token to distribute during pre-pre-tge stage
contract BCSBonusToken is ReturnableToken, MintableToken {
    
    function BCSBonusToken(string _name, string _symbol, uint256 _decimals) {
        name = _name;
        symbol = _symbol;
        decimals =_decimals; 
    }

}