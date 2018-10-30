pragma solidity ^0.4.24;

contract IEtherPriceProvider {
    function rate() public view returns (uint256);
}