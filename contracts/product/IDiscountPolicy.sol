pragma solidity ^0.4.18;

contract IDiscountPolicy {

    function getDiscount(address buyer, uint256 amount) public constant returns(uint256) {}

    /**@dev Transfers discount to the sender, returns discount amount*/
    function requestDiscount(address buyer, uint256 amount) public returns(uint256);
}