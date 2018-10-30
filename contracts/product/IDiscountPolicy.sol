pragma solidity ^0.4.24;

contract IDiscountPolicy {

    /**@dev Returns cashback that applies to customer when he makes a purchase of specific amount*/
    function getCustomerDiscount(address customer, uint256 amount) public view returns(uint256) {}    

    /**@dev Transfers cashback from the pool to cashback storage, returns cashback amount*/
    function requestCustomerDiscount(address customer, uint256 amount) public returns(uint256);    
}