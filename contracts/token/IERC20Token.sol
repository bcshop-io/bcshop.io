pragma solidity ^0.4.10;

/**@dev ERC20 compliant token interface. 
https://theethereum.wiki/w/index.php/ERC20_Token_Standard 
https://github.com/ethereum/EIPs/blob/master/EIPS/eip-20-token-standard.md */
contract IERC20Token {
    string public name;
    string public symbol;
    uint8 public decimals;

    // these functions aren't abstract since the compiler emits automatically generated getter functions as external
    function totalSupply() constant returns (uint total) {total;}
    function balanceOf(address _owner) constant returns (uint balance) {_owner; balance;}    
    function allowance(address _owner, address _spender) constant returns (uint remaining) {_owner; _spender; remaining;}

    function transfer(address _to, uint _value) returns (bool success);
    function transferFrom(address _from, address _to, uint _value) returns (bool success);
    function approve(address _spender, uint _value) returns (bool success);
    

    event Transfer(address indexed _from, address indexed _to, uint _value);
    event Approval(address indexed _owner, address indexed _spender, uint _value);
}
