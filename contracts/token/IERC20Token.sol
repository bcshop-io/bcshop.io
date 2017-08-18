pragma solidity ^0.4.10;

/**@dev ERC20 compliant token interface. https://theethereum.wiki/w/index.php/ERC20_Token_Standard */
contract IERC20Token {
    function totalSupply() constant returns (uint total);
    function balanceOf(address _owner) constant returns (uint balance);
    function transfer(address _to, uint _value) returns (bool success);
    function transferFrom(address _from, address _to, uint _value) returns (bool success);
    function approve(address _spender, uint _value) returns (bool success);
    function allowance(address _owner, address _spender) constant returns (uint remaining);

    event Transfer(address indexed _from, address indexed _to, uint _value);
    event Approval(address indexed _owner, address indexed _spender, uint _value);
}
