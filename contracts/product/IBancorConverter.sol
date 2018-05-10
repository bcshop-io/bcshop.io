pragma solidity ^0.4.18;

contract IBancorQuickConverter {
    function convertFor(address[] _path, uint256 _amount, uint256 _minReturn, address _for) public payable returns (uint256);
}

contract IBancorConverterExtensions {
    function quickConverter() public constant returns (IBancorQuickConverter) {}
}

contract IBancorConverter {
    function extensions() public constant returns (IBancorConverterExtensions) {}
}