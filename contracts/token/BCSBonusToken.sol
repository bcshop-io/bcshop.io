pragma solidity ^0.4.10;

import './MintableToken.sol';
import './ReturnableToken.sol';

///A token to distribute during pre-pre-tge stage
contract BCSBonusToken is ReturnableToken, MintableToken {
    
    function BCSBonusToken() {
        name = "BCSHOP BONUS TOKEN 1.0";
        symbol = "";
        decimals = 0; 
    }

}