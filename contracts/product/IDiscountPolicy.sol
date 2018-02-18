pragma solidity ^0.4.18;

contract IDiscountPolicy {

    /**@dev Returns discount that applies to buyer when he makes a purchase of specific amount*/
    function getBuyerDiscount(address buyer, uint256 amount) public constant returns(uint256) {}    

    /**@dev Transfers discount to the sender, returns discount amount*/
    function requestBuyerDiscount(address buyer, uint256 amount) public returns(uint256);    
}